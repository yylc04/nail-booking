import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function getStoreIdByAccount(accountId?: string | null): Promise<string | null> {
  if (!accountId) return null
  const user = await prisma.storeUser.findUnique({
    where: { username: accountId },
    select: { storeId: true },
  })
  return user?.storeId ?? null
}

function generateQuoteNo(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = 'QT-'
  for (let i = 0; i < 6; i++) result += chars[Math.floor(Math.random() * chars.length)]
  return result
}

async function uniqueQuoteNo(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const no = generateQuoteNo()
    const exists = await prisma.quote.findUnique({ where: { quoteNo: no } })
    if (!exists) return no
  }
  return `QT-${Date.now().toString(36).toUpperCase().slice(-6)}`
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// GET — store settings (no phone) or query quotes by phone
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('accountId')
  const phone = searchParams.get('phone')

  const storeId = await getStoreIdByAccount(accountId)
  if (!storeId) return NextResponse.json({ error: '找不到店家' }, { status: 404 })

  // Return store quoteMode settings when no phone provided
  if (!phone) {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { quoteMode: true, quoteHoldHours: true },
    })
    return NextResponse.json({ quoteMode: store?.quoteMode ?? 'QUOTE_ONLY', quoteHoldHours: store?.quoteHoldHours ?? 24 })
  }

  // Lazy expiry check + return quotes
  const now = new Date()
  await prisma.quote.updateMany({
    where: {
      storeId,
      customerPhone: phone.trim(),
      quoteMode: 'QUOTE_HOLD',
      status: { in: ['PENDING', 'REPLIED'] },
      holdUntil: { lt: now },
    },
    data: { status: 'EXPIRED' },
  })

  const quotes = await prisma.quote.findMany({
    where: { storeId, customerPhone: phone.trim() },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, quoteNo: true, customerName: true, customerPhone: true,
      note: true, images: true, status: true, quoteMode: true,
      holdDate: true, holdTime: true, holdUntil: true,
      replyPrice: true, replyNote: true, repliedAt: true, createdAt: true,
    },
  })

  return NextResponse.json(quotes.map(q => ({
    ...q,
    images: JSON.parse(q.images) as string[],
  })))
}

// POST — submit quote
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('accountId')
  const storeId = await getStoreIdByAccount(accountId)
  if (!storeId) return NextResponse.json({ error: '找不到店家' }, { status: 404 })

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { quoteMode: true, quoteHoldHours: true },
  })

  const body = await req.json()
  const { customerName, customerPhone, note, images, holdDate, holdTime } = body

  if (!customerName?.trim()) return NextResponse.json({ error: '請填寫姓名' }, { status: 400 })
  if (!customerPhone?.trim()) return NextResponse.json({ error: '請填寫電話' }, { status: 400 })
  if (!images || !Array.isArray(images) || images.length === 0)
    return NextResponse.json({ error: '請至少上傳一張圖片' }, { status: 400 })
  if (images.length > 3)
    return NextResponse.json({ error: '最多上傳 3 張圖片' }, { status: 400 })

  const quoteMode = store?.quoteMode ?? 'QUOTE_ONLY'
  let computedHoldDate: Date | null = null
  let holdUntil: Date | null = null

  if (quoteMode === 'QUOTE_HOLD') {
    if (!holdDate || !holdTime) return NextResponse.json({ error: '傳圖卡位模式需選擇日期和時段' }, { status: 400 })

    computedHoldDate = new Date(holdDate)
    const holdHours = store?.quoteHoldHours ?? 24

    // Parse holdDate + holdTime into a DateTime and add holdHours
    const [hh, mm] = holdTime.split(':').map(Number)
    holdUntil = new Date(holdDate)
    holdUntil.setHours(hh, mm, 0, 0)
    holdUntil = new Date(holdUntil.getTime() + holdHours * 60 * 60 * 1000)

    // Check that the slot exists and isn't already taken
    const now = new Date()
    const dateOnly = new Date(holdDate)

    const slotExists = await prisma.dailySlot.findUnique({
      where: { storeId_date_time: { storeId, date: dateOnly, time: holdTime } },
    })
    if (!slotExists) return NextResponse.json({ error: '所選時段不存在，請重新選擇' }, { status: 400 })

    // Check appointment conflicts
    const appointments = await prisma.appointment.findMany({
      where: { storeId, date: dateOnly, status: { notIn: ['CANCELLED'] } },
      select: { startTime: true, endTime: true },
    })
    const slotStart = timeToMinutes(holdTime)
    const slotEnd = slotStart + 60
    const conflictAppt = appointments.some(a => {
      const aStart = timeToMinutes(a.startTime)
      const aEnd = timeToMinutes(a.endTime)
      return slotStart < aEnd && slotEnd > aStart
    })
    if (conflictAppt) return NextResponse.json({ error: '此時段已被預約，請選擇其他時段' }, { status: 400 })

    // Check other active QUOTE_HOLD on same slot
    const conflictHold = await prisma.quote.findFirst({
      where: {
        storeId,
        holdDate: dateOnly,
        holdTime,
        quoteMode: 'QUOTE_HOLD',
        status: { in: ['PENDING', 'REPLIED'] },
        holdUntil: { gt: now },
      },
    })
    if (conflictHold) return NextResponse.json({ error: '此時段已被卡位，請選擇其他時段' }, { status: 400 })
  }

  const quoteNo = await uniqueQuoteNo()
  const quote = await prisma.quote.create({
    data: {
      storeId,
      quoteNo,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      note: note?.trim() || null,
      images: JSON.stringify(images),
      quoteMode,
      holdDate: computedHoldDate,
      holdTime: quoteMode === 'QUOTE_HOLD' ? holdTime : null,
      holdUntil,
    },
  })

  return NextResponse.json({ quoteNo: quote.quoteNo, id: quote.id })
}

// PATCH — confirm or decline a QUOTE_HOLD quote
export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('accountId')
  const storeId = await getStoreIdByAccount(accountId)
  if (!storeId) return NextResponse.json({ error: '找不到店家' }, { status: 404 })

  const body = await req.json()
  const { action, quoteId, lineOrIg, notes: bookingNotes } = body

  if (!quoteId) return NextResponse.json({ error: '缺少 quoteId' }, { status: 400 })

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, storeId, quoteMode: 'QUOTE_HOLD' },
  })
  if (!quote) return NextResponse.json({ error: '找不到此詢價' }, { status: 404 })

  if (action === 'decline') {
    await prisma.quote.update({ where: { id: quoteId }, data: { status: 'REJECTED' } })
    return NextResponse.json({ ok: true })
  }

  if (action === 'confirm') {
    if (quote.status !== 'REPLIED') return NextResponse.json({ error: '尚未收到店家報價' }, { status: 400 })
    if (!quote.holdDate || !quote.holdTime) return NextResponse.json({ error: '卡位資訊缺失' }, { status: 400 })
    if (quote.holdUntil && quote.holdUntil < new Date()) {
      await prisma.quote.update({ where: { id: quoteId }, data: { status: 'EXPIRED' } })
      return NextResponse.json({ error: '卡位已過期，請重新詢價' }, { status: 400 })
    }

    const price = quote.replyPrice ?? 0
    const duration = 60
    const startTime = quote.holdTime
    const endTime = minutesToTime(timeToMinutes(startTime) + duration)

    // Find or create customer
    let customer = await prisma.customer.findUnique({
      where: { storeId_phone: { storeId, phone: quote.customerPhone } },
    })
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          storeId,
          name: quote.customerName,
          phone: quote.customerPhone,
          lineOrIg: lineOrIg?.trim() || null,
        },
      })
    } else if (lineOrIg?.trim()) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: { lineOrIg: lineOrIg.trim() },
      })
    }

    const appointment = await prisma.appointment.create({
      data: {
        customerId: customer.id,
        storeId,
        date: quote.holdDate,
        startTime,
        endTime,
        totalPrice: price,
        totalDuration: duration,
        notes: bookingNotes?.trim() || `來源：詢價 ${quote.quoteNo}`,
        services: {
          create: [{
            serviceId: null,
            serviceName: `詢價款式（${quote.quoteNo}）`,
            price,
            duration,
          }],
        },
      },
    })

    await prisma.quote.update({ where: { id: quoteId }, data: { status: 'CONFIRMED' } })

    // Return deposit info
    const depositInfo = await prisma.store.findUnique({
      where: { id: storeId },
      select: { depositEnabled: true, depositAmount: true, bankAccounts: { orderBy: { order: 'asc' } } },
    })

    return NextResponse.json({ ok: true, appointmentId: appointment.id, depositInfo })
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 })
}

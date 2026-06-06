import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function getStoreIdByAccount(accountId?: string | null): Promise<string> {
  if (!accountId) return 'default-store'
  const user = await prisma.storeUser.findUnique({
    where: { username: accountId },
    select: { storeId: true },
  })
  return user?.storeId ?? 'default-store'
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

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, phone, lineName, lineOrIg, date, startTime, services, notes, transferCode, accountId, quoteId } = body

  if (!name || !phone || !lineName || !lineOrIg || !date || !startTime || !services?.length) {
    return NextResponse.json({ error: '請填寫所有必填欄位' }, { status: 400 })
  }

  const storeId = await getStoreIdByAccount(accountId)

  // Check booking release lock
  const releaseStore = await prisma.store.findUnique({
    where: { id: storeId },
    select: { bookingReleaseEnabled: true, bookingReleaseDay: true, bookingReleaseHour: true },
  })
  if (releaseStore?.bookingReleaseEnabled) {
    const bookingDate = new Date(date)
    const now = new Date()
    const todayMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const dateMonth = new Date(bookingDate.getFullYear(), bookingDate.getMonth(), 1).getTime()
    if (dateMonth > todayMonth) {
      const openDate = new Date(
        bookingDate.getFullYear(), bookingDate.getMonth() - 1,
        releaseStore.bookingReleaseDay, releaseStore.bookingReleaseHour, 0, 0
      )
      if (now < openDate) {
        return NextResponse.json({ error: '尚未開放該月份的預約' }, { status: 400 })
      }
    }
  }

  const totalDuration = services.reduce((s: number, sv: { duration: number }) => s + sv.duration, 0)
  const totalPrice = services.reduce((s: number, sv: { price: number }) => s + sv.price, 0)
  const endTime = minutesToTime(timeToMinutes(startTime) + totalDuration)

  let customer = await prisma.customer.findUnique({
    where: { storeId_phone: { storeId, phone } },
  })
  if (!customer) {
    customer = await prisma.customer.create({
      data: { name, phone, lineName, lineOrIg, storeId },
    })
  } else {
    // Update lineName/lineOrIg if provided
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: { lineName, lineOrIg },
    })
  }

  const appointment = await prisma.appointment.create({
    data: {
      customerId: customer.id,
      storeId,
      date: new Date(date),
      startTime,
      endTime,
      totalPrice,
      totalDuration,
      notes,
      transferCode: transferCode || null,
      services: {
        create: services.map((s: { serviceId: string; name: string; price: number; duration: number }) => ({
          serviceId: s.serviceId,
          serviceName: s.name,
          price: s.price,
          duration: s.duration,
        })),
      },
    },
    include: { services: true, customer: true },
  })

  // Mark associated quote as CONFIRMED and tag appointment notes
  if (quoteId) {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, storeId },
      select: { quoteNo: true },
    })
    if (quote) {
      await prisma.quote.update({ where: { id: quoteId }, data: { status: 'CONFIRMED' } })
      if (!notes) {
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { notes: `來源：詢價 ${quote.quoteNo}` },
        })
      }
    }
  }

  return NextResponse.json(appointment)
}

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

// POST — submit quote
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('accountId')
  const storeId = await getStoreIdByAccount(accountId)
  if (!storeId) return NextResponse.json({ error: '找不到店家' }, { status: 404 })

  const body = await req.json()
  const { customerName, customerPhone, note, images } = body

  if (!customerName?.trim()) return NextResponse.json({ error: '請填寫姓名' }, { status: 400 })
  if (!customerPhone?.trim()) return NextResponse.json({ error: '請填寫電話' }, { status: 400 })
  if (!images || !Array.isArray(images) || images.length === 0)
    return NextResponse.json({ error: '請至少上傳一張圖片' }, { status: 400 })
  if (images.length > 3)
    return NextResponse.json({ error: '最多上傳 3 張圖片' }, { status: 400 })

  const quoteNo = await uniqueQuoteNo()
  const quote = await prisma.quote.create({
    data: {
      storeId,
      quoteNo,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      note: note?.trim() || null,
      images: JSON.stringify(images),
    },
  })

  return NextResponse.json({ quoteNo: quote.quoteNo, id: quote.id })
}

// GET — query by phone number
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('accountId')
  const phone = searchParams.get('phone')

  if (!phone) return NextResponse.json({ error: '請提供電話號碼' }, { status: 400 })

  const storeId = await getStoreIdByAccount(accountId)
  if (!storeId) return NextResponse.json({ error: '找不到店家' }, { status: 404 })

  const quotes = await prisma.quote.findMany({
    where: { storeId, customerPhone: phone.trim() },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, quoteNo: true, customerName: true, customerPhone: true,
      note: true, images: true, status: true,
      replyPrice: true, replyNote: true, repliedAt: true, createdAt: true,
    },
  })

  return NextResponse.json(quotes.map(q => ({
    ...q,
    images: JSON.parse(q.images) as string[],
  })))
}

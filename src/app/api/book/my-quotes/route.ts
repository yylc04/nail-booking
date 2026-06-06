import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCustomerSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getCustomerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('accountId')

  let storeId: string | null = null
  if (accountId) {
    const user = await prisma.storeUser.findUnique({
      where: { username: accountId },
      select: { storeId: true },
    })
    storeId = user?.storeId ?? null
  }
  if (!storeId) {
    const customer = await prisma.customer.findUnique({
      where: { id: session.customerId },
      select: { storeId: true },
    })
    storeId = customer?.storeId ?? null
  }
  if (!storeId) return NextResponse.json([])

  // Lazy expiry check
  await prisma.quote.updateMany({
    where: {
      storeId,
      customerPhone: session.phone,
      quoteMode: 'QUOTE_HOLD',
      status: { in: ['PENDING', 'REPLIED'] },
      holdUntil: { lt: new Date() },
    },
    data: { status: 'EXPIRED' },
  })

  const quotes = await prisma.quote.findMany({
    where: { storeId, customerPhone: session.phone },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, quoteNo: true, note: true, images: true,
      status: true, quoteMode: true,
      holdDate: true, holdTime: true, holdUntil: true,
      quoteReplies: true, repliedAt: true, createdAt: true,
    },
  })

  return NextResponse.json(quotes.map(q => ({
    ...q,
    images: JSON.parse(q.images) as string[],
    quoteReplies: q.quoteReplies ? JSON.parse(q.quoteReplies) : [],
  })))
}

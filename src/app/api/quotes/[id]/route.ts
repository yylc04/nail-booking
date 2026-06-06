import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStoreSession } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const storeId = session.storeId
  if (!storeId) return NextResponse.json({ error: 'No store' }, { status: 400 })

  const { id } = await params
  const body = await req.json()
  const { action, quoteReplies } = body

  if (action === 'reject') {
    const result = await prisma.quote.updateMany({
      where: { id, storeId },
      data: { status: 'REJECTED' },
    })
    if (result.count === 0) return NextResponse.json({ error: '找不到此詢價' }, { status: 404 })
    return NextResponse.json({ ok: true })
  }

  // Reply — recalculate holdUntil using quotePayHours for QUOTE_HOLD quotes
  const existing = await prisma.quote.findFirst({ where: { id, storeId }, select: { quoteMode: true } })
  if (!existing) return NextResponse.json({ error: '找不到此詢價' }, { status: 404 })

  const replies: Array<{ imageIndex: number; price: number; note?: string }> = Array.isArray(quoteReplies)
    ? quoteReplies.filter(r => typeof r.imageIndex === 'number' && typeof r.price === 'number')
    : []
  if (replies.length === 0) return NextResponse.json({ error: '請至少填寫一張圖片的報價' }, { status: 400 })

  let newHoldUntil: Date | undefined
  if (existing.quoteMode === 'QUOTE_HOLD') {
    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { quotePayHours: true } })
    const payHours = store?.quotePayHours || 24
    newHoldUntil = new Date(Date.now() + payHours * 3600 * 1000)
  }

  await prisma.quote.update({
    where: { id },
    data: {
      status: 'REPLIED',
      quoteReplies: JSON.stringify(replies),
      repliedAt: new Date(),
      ...(newHoldUntil ? { holdUntil: newHoldUntil } : {}),
    },
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const storeId = session.storeId
  if (!storeId) return NextResponse.json({ error: 'No store' }, { status: 400 })

  const { id } = await params
  const result = await prisma.quote.deleteMany({ where: { id, storeId } })
  if (result.count === 0) return NextResponse.json({ error: '找不到此詢價' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

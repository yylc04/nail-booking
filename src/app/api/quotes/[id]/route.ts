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
  const { action, replyPrice, replyNote } = body

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
      replyPrice: replyPrice != null ? Number(replyPrice) : null,
      replyNote: replyNote?.trim() || null,
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

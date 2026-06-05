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

  const quote = await prisma.quote.updateMany({
    where: { id, storeId },
    data: {
      status: 'REPLIED',
      replyPrice: replyPrice != null ? Number(replyPrice) : null,
      replyNote: replyNote?.trim() || null,
      repliedAt: new Date(),
    },
  })

  if (quote.count === 0) return NextResponse.json({ error: '找不到此詢價' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

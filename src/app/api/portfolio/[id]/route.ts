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
  const { name, price, imageData, categoryId, isVisible } = body

  const item = await prisma.portfolio.updateMany({
    where: { id, storeId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(price !== undefined ? { price } : {}),
      ...(imageData !== undefined ? { imageData } : {}),
      ...(categoryId !== undefined ? { categoryId: categoryId || null } : {}),
      ...(isVisible !== undefined ? { isVisible } : {}),
    },
  })
  return NextResponse.json(item)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const storeId = session.storeId
  if (!storeId) return NextResponse.json({ error: 'No store' }, { status: 400 })

  const { id } = await params
  await prisma.portfolio.deleteMany({ where: { id, storeId } })
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStoreSession } from '@/lib/auth'

export async function GET() {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const storeId = session.storeId
  if (!storeId) return NextResponse.json([])

  const items = await prisma.portfolio.findMany({
    where: { storeId },
    orderBy: { order: 'asc' },
    include: { category: { select: { id: true, name: true } } },
  })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const storeId = session.storeId
  if (!storeId) return NextResponse.json({ error: 'No store' }, { status: 400 })

  const body = await req.json()
  const { name, price, imageData, categoryId } = body

  const maxOrderItem = await prisma.portfolio.findFirst({
    where: { storeId },
    orderBy: { order: 'desc' },
    select: { order: true },
  })
  const order = (maxOrderItem?.order ?? -1) + 1

  const item = await prisma.portfolio.create({
    data: { storeId, name, price: price || null, imageData, categoryId: categoryId || null, order },
    include: { category: { select: { id: true, name: true } } },
  })
  return NextResponse.json(item)
}

export async function PUT(req: NextRequest) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const storeId = session.storeId
  if (!storeId) return NextResponse.json({ error: 'No store' }, { status: 400 })

  const body = await req.json()
  const { items } = body as { items: { id: string; order: number }[] }

  await Promise.all(
    items.map(({ id, order }) =>
      prisma.portfolio.updateMany({ where: { id, storeId }, data: { order } })
    )
  )
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStoreSession } from '@/lib/auth'

export async function GET() {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storeId = session.storeId
  if (!storeId) return NextResponse.json([])

  const categories = await prisma.serviceCategory.findMany({
    where: { storeId },
    include: { services: { where: { storeId }, orderBy: { order: 'asc' } } },
    orderBy: { order: 'asc' },
  })
  return NextResponse.json(categories)
}

export async function POST(req: NextRequest) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storeId = session.storeId
  if (!storeId) return NextResponse.json({ error: 'No store assigned' }, { status: 400 })

  const body = await req.json()
  const { name, price, duration, description, categoryName, isActive } = body

  let category = await prisma.serviceCategory.findUnique({
    where: { storeId_name: { storeId, name: categoryName || '其他' } },
  })
  if (!category) {
    category = await prisma.serviceCategory.create({
      data: { storeId, name: categoryName || '其他' },
    })
  }

  const service = await prisma.service.create({
    data: {
      name,
      price: Number(price),
      duration: Number(duration),
      description,
      isActive: isActive ?? true,
      storeId,
      categoryId: category.id,
    },
  })
  return NextResponse.json(service)
}

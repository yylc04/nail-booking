import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStoreSession } from '@/lib/auth'

const STORE_ID = 'default-store'

export async function GET() {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const categories = await prisma.serviceCategory.findMany({
    where: { storeId: STORE_ID },
    include: { services: { where: { storeId: STORE_ID }, orderBy: { order: 'asc' } } },
    orderBy: { order: 'asc' },
  })
  return NextResponse.json(categories)
}

export async function POST(req: NextRequest) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, price, duration, description, categoryName, isActive } = body

  // Upsert category
  let category = await prisma.serviceCategory.findUnique({
    where: { storeId_name: { storeId: STORE_ID, name: categoryName || '其他' } },
  })
  if (!category) {
    category = await prisma.serviceCategory.create({
      data: { storeId: STORE_ID, name: categoryName || '其他' },
    })
  }

  const service = await prisma.service.create({
    data: {
      name,
      price: Number(price),
      duration: Number(duration),
      description,
      isActive: isActive ?? true,
      storeId: STORE_ID,
      categoryId: category.id,
    },
  })
  return NextResponse.json(service)
}

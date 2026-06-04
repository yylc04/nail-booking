import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStoreSession } from '@/lib/auth'

async function checkOwnership(id: string, storeId: string) {
  const service = await prisma.service.findUnique({ where: { id }, select: { storeId: true } })
  return service?.storeId === storeId
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storeId = session.storeId
  if (!storeId) return NextResponse.json({ error: 'No store assigned' }, { status: 400 })

  const { id } = await params
  if (!await checkOwnership(id, storeId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { name, price, duration, description, categoryName, isActive } = body

  let categoryId: string | undefined
  if (categoryName) {
    let cat = await prisma.serviceCategory.findUnique({
      where: { storeId_name: { storeId, name: categoryName } },
    })
    if (!cat) {
      cat = await prisma.serviceCategory.create({
        data: { storeId, name: categoryName },
      })
    }
    categoryId = cat.id
  }

  const service = await prisma.service.update({
    where: { id },
    data: {
      name,
      price: price !== undefined ? Number(price) : undefined,
      duration: duration !== undefined ? Number(duration) : undefined,
      description,
      isActive,
      categoryId,
    },
  })
  return NextResponse.json(service)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const storeId = session.storeId
  if (!storeId) return NextResponse.json({ error: 'No store assigned' }, { status: 400 })

  const { id } = await params
  if (!await checkOwnership(id, storeId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.service.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

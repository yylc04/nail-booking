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
    orderBy: { order: 'asc' },
    select: { id: true, name: true },
  })
  return NextResponse.json(categories)
}

export async function POST(req: NextRequest) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storeId = session.storeId
  if (!storeId) return NextResponse.json({ error: 'No store assigned' }, { status: 400 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: '請輸入分類名稱' }, { status: 400 })

  const existing = await prisma.serviceCategory.findUnique({
    where: { storeId_name: { storeId, name: name.trim() } },
  })
  if (existing) return NextResponse.json({ error: '此分類已存在' }, { status: 409 })

  const cat = await prisma.serviceCategory.create({
    data: { storeId, name: name.trim() },
  })
  return NextResponse.json(cat)
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStoreSession } from '@/lib/auth'

const STORE_ID = 'default-store'

export async function POST(req: NextRequest) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: '請輸入分類名稱' }, { status: 400 })

  const existing = await prisma.serviceCategory.findUnique({
    where: { storeId_name: { storeId: STORE_ID, name: name.trim() } },
  })
  if (existing) return NextResponse.json({ error: '此分類已存在' }, { status: 409 })

  const cat = await prisma.serviceCategory.create({
    data: { storeId: STORE_ID, name: name.trim() },
  })
  return NextResponse.json(cat)
}

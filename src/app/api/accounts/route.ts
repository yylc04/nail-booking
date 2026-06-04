import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getStoreSession } from '@/lib/auth'

export async function GET() {
  const session = await getStoreSession()
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const users = await prisma.storeUser.findMany({
    select: {
      id: true, username: true, role: true, createdAt: true,
      storeId: true, contactName: true, phone: true, lineId: true,
      plan: true, expiryDate: true, notes: true,
      store: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(users.map(u => ({
    ...u,
    storeName: u.store?.name ?? null,
    store: undefined,
  })))
}

export async function POST(req: NextRequest) {
  const session = await getStoreSession()
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { username, password } = await req.json()
  if (!username || !password) {
    return NextResponse.json({ error: '請填入帳號和密碼' }, { status: 400 })
  }

  const existing = await prisma.storeUser.findUnique({ where: { username } })
  if (existing) return NextResponse.json({ error: '此帳號已存在' }, { status: 409 })

  // Create a store for this new account
  const newStore = await prisma.store.create({
    data: { name: `${username} 美甲工作室` },
  })

  const hash = await bcrypt.hash(password, 12)
  const user = await prisma.storeUser.create({
    data: { username, passwordHash: hash, role: 'STORE', storeId: newStore.id },
    select: {
      id: true, username: true, role: true, createdAt: true,
      storeId: true, contactName: true, phone: true, lineId: true,
      plan: true, expiryDate: true, notes: true,
    },
  })
  return NextResponse.json({ ...user, storeName: newStore.name })
}

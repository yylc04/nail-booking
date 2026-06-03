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
    select: { id: true, username: true, role: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(users)
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

  const hash = await bcrypt.hash(password, 12)
  const user = await prisma.storeUser.create({
    data: { username, passwordHash: hash, role: 'STORE' },
    select: { id: true, username: true, role: true, createdAt: true },
  })
  return NextResponse.json(user)
}

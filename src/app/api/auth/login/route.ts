import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { setStoreSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) {
      return NextResponse.json({ error: '請輸入帳號和密碼' }, { status: 400 })
    }

    const user = await prisma.storeUser.findUnique({ where: { username } })
    if (!user) {
      return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 })
    }

    await setStoreSession({
      userId: user.id,
      username: user.username,
      role: user.role as 'SUPER_ADMIN' | 'STORE',
      storeId: user.storeId ?? undefined,
    })
    return NextResponse.json({ ok: true, role: user.role, username: user.username })
  } catch {
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}

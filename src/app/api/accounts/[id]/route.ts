import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStoreSession } from '@/lib/auth'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStoreSession()
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params

  const user = await prisma.storeUser.findUnique({ where: { id } })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role === 'SUPER_ADMIN') {
    return NextResponse.json({ error: '不能刪除超級管理員' }, { status: 400 })
  }

  await prisma.storeUser.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

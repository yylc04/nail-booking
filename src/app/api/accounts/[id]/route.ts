import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStoreSession } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStoreSession()
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { storeName, contactName, phone, lineId, plan, expiryDate, notes } = body

  const user = await prisma.storeUser.findUnique({ where: { id }, select: { storeId: true } })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Update store name if provided and user has a store
  if (storeName !== undefined && user.storeId) {
    await prisma.store.update({
      where: { id: user.storeId },
      data: { name: storeName },
    })
  }

  const updated = await prisma.storeUser.update({
    where: { id },
    data: {
      ...(contactName !== undefined ? { contactName } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(lineId !== undefined ? { lineId } : {}),
      ...(plan !== undefined ? { plan } : {}),
      ...(expiryDate !== undefined ? { expiryDate: expiryDate ? new Date(expiryDate) : null } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
    select: {
      id: true, username: true, role: true, createdAt: true,
      storeId: true, contactName: true, phone: true, lineId: true,
      plan: true, expiryDate: true, notes: true,
      store: { select: { name: true } },
    },
  })

  return NextResponse.json({ ...updated, storeName: updated.store?.name ?? null, store: undefined })
}

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

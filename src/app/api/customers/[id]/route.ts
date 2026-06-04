import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStoreSession } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const customer = await prisma.customer.update({
    where: { id },
    data: {
      name: body.name,
      phone: body.phone,
      email: body.email,
      notes: body.notes,
      lineName: body.lineName,
      lineOrIg: body.lineOrIg,
    },
  })
  return NextResponse.json(customer)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await prisma.customer.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

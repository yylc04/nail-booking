import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStoreSession } from '@/lib/auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const appt = await prisma.appointment.findUnique({
    where: { id },
    include: { customer: true, services: true },
  })
  if (!appt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(appt)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const storeSession = await getStoreSession()

  // Allow unauthenticated transfer code update (customer deposit confirmation flow)
  if (!storeSession) {
    if (typeof body.transferCode === 'string' && Object.keys(body).length === 1) {
      await prisma.appointment.update({
        where: { id },
        data: { transferCode: body.transferCode },
      })
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appt = await prisma.appointment.update({
    where: { id },
    data: {
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.date ? { date: new Date(body.date) } : {}),
      ...(body.startTime !== undefined ? { startTime: body.startTime } : {}),
      ...(body.endTime !== undefined ? { endTime: body.endTime } : {}),
      ...(body.transferCode !== undefined ? { transferCode: body.transferCode } : {}),
    },
    include: { customer: true, services: true },
  })
  return NextResponse.json(appt)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await prisma.appointment.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

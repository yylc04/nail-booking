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
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  const appt = await prisma.appointment.update({
    where: { id },
    data: {
      status: body.status,
      notes: body.notes,
      date: body.date ? new Date(body.date) : undefined,
      startTime: body.startTime,
      endTime: body.endTime,
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

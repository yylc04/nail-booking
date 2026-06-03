import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCustomerSession } from '@/lib/auth'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCustomerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const appt = await prisma.appointment.findUnique({ where: { id } })

  if (!appt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (appt.customerId !== session.customerId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (appt.status !== 'PENDING') {
    return NextResponse.json({ error: '只能取消待確認的預約' }, { status: 400 })
  }

  await prisma.appointment.update({ where: { id }, data: { status: 'CANCELLED' } })
  return NextResponse.json({ ok: true })
}

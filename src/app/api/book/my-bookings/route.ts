import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCustomerSession } from '@/lib/auth'

export async function GET() {
  const session = await getCustomerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const appointments = await prisma.appointment.findMany({
    where: { customerId: session.customerId },
    include: { services: true },
    orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
  })

  return NextResponse.json(appointments)
}

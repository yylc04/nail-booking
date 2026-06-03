import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStoreSession } from '@/lib/auth'

const STORE_ID = 'default-store'

export async function GET(req: NextRequest) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') // YYYY-MM
  const search = searchParams.get('search') || ''

  let dateFilter = {}
  if (month) {
    const [y, m] = month.split('-').map(Number)
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m, 0)
    dateFilter = { date: { gte: start, lte: end } }
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      storeId: STORE_ID,
      ...dateFilter,
      ...(search
        ? {
            OR: [
              { customer: { name: { contains: search, mode: 'insensitive' } } },
              { customer: { phone: { contains: search } } },
            ],
          }
        : {}),
    },
    include: {
      customer: true,
      services: true,
    },
    orderBy: [{ date: 'desc' }, { startTime: 'asc' }],
  })

  return NextResponse.json(appointments)
}

export async function POST(req: NextRequest) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { customerId, date, startTime, endTime, services, notes, totalPrice, totalDuration } = body

  const appointment = await prisma.appointment.create({
    data: {
      customerId,
      storeId: STORE_ID,
      date: new Date(date),
      startTime,
      endTime,
      notes,
      totalPrice,
      totalDuration,
      services: {
        create: services.map((s: { serviceId: string; serviceName: string; price: number; duration: number }) => ({
          serviceId: s.serviceId,
          serviceName: s.serviceName,
          price: s.price,
          duration: s.duration,
        })),
      },
    },
    include: { customer: true, services: true },
  })

  return NextResponse.json(appointment)
}

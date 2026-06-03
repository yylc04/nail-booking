import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const STORE_ID = 'default-store'

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, phone, date, startTime, services, notes } = body

  if (!name || !phone || !date || !startTime || !services?.length) {
    return NextResponse.json({ error: '請填寫所有必填欄位' }, { status: 400 })
  }

  const totalDuration = services.reduce((s: number, sv: { duration: number }) => s + sv.duration, 0)
  const totalPrice = services.reduce((s: number, sv: { price: number }) => s + sv.price, 0)
  const endTime = minutesToTime(timeToMinutes(startTime) + totalDuration)

  // Upsert customer
  let customer = await prisma.customer.findUnique({
    where: { storeId_phone: { storeId: STORE_ID, phone } },
  })
  if (!customer) {
    customer = await prisma.customer.create({
      data: { name, phone, storeId: STORE_ID },
    })
  }

  const appointment = await prisma.appointment.create({
    data: {
      customerId: customer.id,
      storeId: STORE_ID,
      date: new Date(date),
      startTime,
      endTime,
      totalPrice,
      totalDuration,
      notes,
      services: {
        create: services.map((s: { serviceId: string; name: string; price: number; duration: number }) => ({
          serviceId: s.serviceId,
          serviceName: s.name,
          price: s.price,
          duration: s.duration,
        })),
      },
    },
    include: { services: true, customer: true },
  })

  return NextResponse.json(appointment)
}

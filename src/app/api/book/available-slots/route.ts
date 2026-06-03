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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get('date')
  const duration = Number(searchParams.get('duration') || '60')

  if (!dateStr) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const date = new Date(dateStr)
  const dayOfWeek = date.getDay()

  // Check exception date
  const exception = await prisma.exceptionDate.findUnique({
    where: { storeId_date: { storeId: STORE_ID, date } },
  })

  let openTime: string
  let closeTime: string
  let slotMinutes = 30

  if (exception) {
    if (exception.isClosed) return NextResponse.json({ slots: [], closed: true })
    openTime = exception.openTime!
    closeTime = exception.closeTime!
  } else {
    const bh = await prisma.businessHour.findUnique({
      where: { storeId_dayOfWeek: { storeId: STORE_ID, dayOfWeek } },
    })
    if (!bh || !bh.isOpen) return NextResponse.json({ slots: [], closed: true })
    openTime = bh.openTime
    closeTime = bh.closeTime
    slotMinutes = bh.slotMinutes
  }

  // Get existing appointments for the day
  const appointments = await prisma.appointment.findMany({
    where: {
      storeId: STORE_ID,
      date,
      status: { notIn: ['CANCELLED'] },
    },
    select: { startTime: true, endTime: true },
  })

  const openMin = timeToMinutes(openTime)
  const closeMin = timeToMinutes(closeTime)
  const slots: string[] = []

  for (let t = openMin; t + duration <= closeMin; t += slotMinutes) {
    const slotStart = t
    const slotEnd = t + duration

    const conflict = appointments.some(a => {
      const aStart = timeToMinutes(a.startTime)
      const aEnd = timeToMinutes(a.endTime)
      return slotStart < aEnd && slotEnd > aStart
    })

    if (!conflict) {
      slots.push(minutesToTime(slotStart))
    }
  }

  return NextResponse.json({ slots, openTime, closeTime })
}

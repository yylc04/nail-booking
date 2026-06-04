import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const STORE_ID = 'default-store'

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get('date')
  const duration = Number(searchParams.get('duration') || '60')

  if (!dateStr) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const date = new Date(dateStr)
  const dayOfWeek = date.getDay()

  // Check exception date (closed days override everything)
  const exception = await prisma.exceptionDate.findUnique({
    where: { storeId_date: { storeId: STORE_ID, date } },
  })
  if (exception?.isClosed) return NextResponse.json({ slots: [], closed: true })

  // Check weekly open/closed status
  const bh = await prisma.businessHour.findUnique({
    where: { storeId_dayOfWeek: { storeId: STORE_ID, dayOfWeek } },
  })
  if (bh && !bh.isOpen) return NextResponse.json({ slots: [], closed: true })

  // Get manually configured time slots for this day of week
  const daySlots = await prisma.businessSlot.findMany({
    where: { storeId: STORE_ID, dayOfWeek },
    orderBy: { time: 'asc' },
  })

  if (daySlots.length === 0) return NextResponse.json({ slots: [], closed: false })

  // Get existing appointments for this date
  const appointments = await prisma.appointment.findMany({
    where: { storeId: STORE_ID, date, status: { notIn: ['CANCELLED'] } },
    select: { startTime: true, endTime: true },
  })

  // Filter out conflicting slots
  const available = daySlots
    .map(s => s.time)
    .filter(slotTime => {
      const slotStart = timeToMinutes(slotTime)
      const slotEnd = slotStart + duration
      return !appointments.some(a => {
        const aStart = timeToMinutes(a.startTime)
        const aEnd = timeToMinutes(a.endTime)
        return slotStart < aEnd && slotEnd > aStart
      })
    })

  return NextResponse.json({ slots: available, closed: false })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function getStoreIdByAccount(accountId?: string | null): Promise<string> {
  if (!accountId) return 'default-store'
  const user = await prisma.storeUser.findUnique({
    where: { username: accountId },
    select: { storeId: true },
  })
  return user?.storeId ?? 'default-store'
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get('date')
  const duration = Number(searchParams.get('duration') || '60')
  const accountId = searchParams.get('accountId')

  if (!dateStr) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const storeId = await getStoreIdByAccount(accountId)
  const date = new Date(dateStr)

  const exception = await prisma.exceptionDate.findUnique({
    where: { storeId_date: { storeId, date } },
  })
  if (exception?.isClosed) return NextResponse.json({ slots: [], closed: true })

  const daySlots = await prisma.dailySlot.findMany({
    where: { storeId, date },
    orderBy: { time: 'asc' },
  })

  if (daySlots.length === 0) return NextResponse.json({ slots: [], closed: false })

  const [appointments, heldQuotes] = await Promise.all([
    prisma.appointment.findMany({
      where: { storeId, date, status: { notIn: ['CANCELLED'] } },
      select: { startTime: true, endTime: true },
    }),
    prisma.quote.findMany({
      where: {
        storeId,
        holdDate: date,
        quoteMode: 'QUOTE_HOLD',
        status: { in: ['PENDING', 'REPLIED'] },
        holdUntil: { gt: new Date() },
      },
      select: { holdTime: true },
    }),
  ])

  const heldTimes = new Set(heldQuotes.map(q => q.holdTime).filter(Boolean) as string[])

  const available = daySlots
    .map(s => s.time)
    .filter(slotTime => {
      if (heldTimes.has(slotTime)) return false
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

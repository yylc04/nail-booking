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
  const year = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))
  const duration = Number(searchParams.get('duration') || '60')
  const accountId = searchParams.get('accountId')

  if (!year || !month) return NextResponse.json({ error: 'year and month required' }, { status: 400 })

  const storeId = await getStoreIdByAccount(accountId)

  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0)
  monthEnd.setHours(23, 59, 59, 999)

  const [allSlots, allExceptions, allAppointments, allHeldQuotes] = await Promise.all([
    prisma.dailySlot.findMany({
      where: { storeId, date: { gte: monthStart, lte: monthEnd } },
      select: { date: true, time: true },
    }),
    prisma.exceptionDate.findMany({
      where: { storeId, date: { gte: monthStart, lte: monthEnd } },
      select: { date: true, isClosed: true },
    }),
    prisma.appointment.findMany({
      where: { storeId, date: { gte: monthStart, lte: monthEnd }, status: { notIn: ['CANCELLED'] } },
      select: { date: true, startTime: true, endTime: true },
    }),
    prisma.quote.findMany({
      where: {
        storeId,
        holdDate: { gte: monthStart, lte: monthEnd },
        quoteMode: 'QUOTE_HOLD',
        status: { in: ['PENDING', 'REPLIED'] },
        holdUntil: { gt: new Date() },
      },
      select: { holdDate: true, holdTime: true },
    }),
  ])

  // Group by date string
  const slotsByDate: Record<string, string[]> = {}
  for (const s of allSlots) {
    const key = s.date.toISOString().slice(0, 10)
    if (!slotsByDate[key]) slotsByDate[key] = []
    slotsByDate[key].push(s.time)
  }

  const closedDates = new Set<string>()
  for (const e of allExceptions) {
    if (e.isClosed) closedDates.add(e.date.toISOString().slice(0, 10))
  }

  const apptsByDate: Record<string, { startTime: string; endTime: string }[]> = {}
  for (const a of allAppointments) {
    const key = a.date.toISOString().slice(0, 10)
    if (!apptsByDate[key]) apptsByDate[key] = []
    apptsByDate[key].push({ startTime: a.startTime, endTime: a.endTime })
  }

  const heldByDate: Record<string, Set<string>> = {}
  for (const q of allHeldQuotes) {
    if (!q.holdDate || !q.holdTime) continue
    const key = q.holdDate.toISOString().slice(0, 10)
    if (!heldByDate[key]) heldByDate[key] = new Set()
    heldByDate[key].add(q.holdTime)
  }

  // Compute availability for each day in the month
  const result: Record<string, boolean> = {}
  const daysInMonth = new Date(year, month, 0).getDate()

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`

    if (closedDates.has(dateStr)) {
      result[dateStr] = false
      continue
    }

    const slots = slotsByDate[dateStr]
    if (!slots || slots.length === 0) {
      result[dateStr] = false
      continue
    }

    const appts = apptsByDate[dateStr] || []
    const held = heldByDate[dateStr] || new Set()

    const hasAvailable = slots.some(slotTime => {
      if (held.has(slotTime)) return false
      const slotStart = timeToMinutes(slotTime)
      const slotEnd = slotStart + duration
      return !appts.some(a => {
        const aStart = timeToMinutes(a.startTime)
        const aEnd = timeToMinutes(a.endTime)
        return slotStart < aEnd && slotEnd > aStart
      })
    })

    result[dateStr] = hasAvailable
  }

  return NextResponse.json(result)
}

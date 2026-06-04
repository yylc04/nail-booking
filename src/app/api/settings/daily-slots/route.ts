import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStoreSession } from '@/lib/auth'

const STORE_ID = 'default-store'

// GET /api/settings/daily-slots?month=2026-06
// Returns all daily slots and exception dates for a given month
export async function GET(req: NextRequest) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') // "2026-06"

  if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })

  const [y, m] = month.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 0) // last day of month

  const [dailySlots, exceptionDates] = await Promise.all([
    prisma.dailySlot.findMany({
      where: { storeId: STORE_ID, date: { gte: start, lte: end } },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    }),
    prisma.exceptionDate.findMany({
      where: { storeId: STORE_ID, date: { gte: start, lte: end } },
    }),
  ])

  // Group by date string "YYYY-MM-DD"
  const slotMap: Record<string, string[]> = {}
  for (const s of dailySlots) {
    const key = s.date.toISOString().split('T')[0]
    if (!slotMap[key]) slotMap[key] = []
    slotMap[key].push(s.time)
  }

  const closedMap: Record<string, { isClosed: boolean; note?: string }> = {}
  for (const e of exceptionDates) {
    closedMap[e.date.toISOString().split('T')[0]] = { isClosed: e.isClosed, note: e.note || undefined }
  }

  return NextResponse.json({ slots: slotMap, exceptions: closedMap })
}

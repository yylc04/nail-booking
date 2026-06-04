import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStoreSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storeId = session.storeId
  if (!storeId) return NextResponse.json({ slots: {}, exceptions: {} })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')

  if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })

  const [y, m] = month.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 0)

  const [dailySlots, exceptionDates] = await Promise.all([
    prisma.dailySlot.findMany({
      where: { storeId, date: { gte: start, lte: end } },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    }),
    prisma.exceptionDate.findMany({
      where: { storeId, date: { gte: start, lte: end } },
    }),
  ])

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

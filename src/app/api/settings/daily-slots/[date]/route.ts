import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getStoreSession } from '@/lib/auth'

const STORE_ID = 'default-store'

// PUT /api/settings/daily-slots/2026-06-08
// Body: { slots: ["10:00", "14:00"], isClosed: false, note?: string }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date: dateStr } = await params
  const date = new Date(dateStr)

  if (isNaN(date.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })

  const { slots, isClosed, note } = await req.json()

  // Delete existing daily slots for this date
  await prisma.dailySlot.deleteMany({ where: { storeId: STORE_ID, date } })

  if (isClosed) {
    // Mark as closed, remove any daily slots
    await prisma.exceptionDate.upsert({
      where: { storeId_date: { storeId: STORE_ID, date } },
      update: { isClosed: true, note: note || null },
      create: { storeId: STORE_ID, date, isClosed: true, note: note || null },
    })
  } else {
    // Remove closed status if existed
    await prisma.exceptionDate.deleteMany({ where: { storeId: STORE_ID, date } })

    // Create new daily slots
    if (Array.isArray(slots) && slots.length > 0) {
      await prisma.dailySlot.createMany({
        data: slots.map((time: string) => ({ storeId: STORE_ID, date, time })),
        skipDuplicates: true,
      })
    }
  }

  revalidatePath('/book')
  return NextResponse.json({ ok: true })
}

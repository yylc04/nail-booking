import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getStoreSession } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storeId = session.storeId
  if (!storeId) return NextResponse.json({ error: 'No store assigned' }, { status: 400 })

  const { date: dateStr } = await params
  const date = new Date(dateStr)

  if (isNaN(date.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })

  const { slots, isClosed, note } = await req.json()

  await prisma.dailySlot.deleteMany({ where: { storeId, date } })

  if (isClosed) {
    await prisma.exceptionDate.upsert({
      where: { storeId_date: { storeId, date } },
      update: { isClosed: true, note: note || null },
      create: { storeId, date, isClosed: true, note: note || null },
    })
  } else {
    await prisma.exceptionDate.deleteMany({ where: { storeId, date } })

    if (Array.isArray(slots) && slots.length > 0) {
      await prisma.dailySlot.createMany({
        data: slots.map((time: string) => ({ storeId, date, time })),
        skipDuplicates: true,
      })
    }
  }

  revalidatePath('/book')
  return NextResponse.json({ ok: true })
}

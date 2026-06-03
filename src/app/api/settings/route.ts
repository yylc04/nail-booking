import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStoreSession } from '@/lib/auth'

const STORE_ID = 'default-store'

export async function GET() {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const store = await prisma.store.findUnique({
    where: { id: STORE_ID },
    include: {
      businessHours: { orderBy: { dayOfWeek: 'asc' } },
      exceptionDates: { orderBy: { date: 'asc' } },
    },
  })
  return NextResponse.json(store)
}

export async function PUT(req: NextRequest) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, logo, businessHours, exceptionDates } = body

  const store = await prisma.store.update({
    where: { id: STORE_ID },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(logo !== undefined ? { logo } : {}),
    },
  })

  if (businessHours) {
    for (const h of businessHours) {
      await prisma.businessHour.upsert({
        where: { storeId_dayOfWeek: { storeId: STORE_ID, dayOfWeek: h.dayOfWeek } },
        update: { isOpen: h.isOpen, openTime: h.openTime, closeTime: h.closeTime, slotMinutes: h.slotMinutes ?? 30 },
        create: { storeId: STORE_ID, dayOfWeek: h.dayOfWeek, isOpen: h.isOpen, openTime: h.openTime, closeTime: h.closeTime, slotMinutes: h.slotMinutes ?? 30 },
      })
    }
  }

  if (exceptionDates) {
    // Delete removed dates
    const dates = exceptionDates.map((e: { date: string }) => new Date(e.date))
    await prisma.exceptionDate.deleteMany({
      where: { storeId: STORE_ID, date: { notIn: dates } },
    })
    for (const e of exceptionDates) {
      await prisma.exceptionDate.upsert({
        where: { storeId_date: { storeId: STORE_ID, date: new Date(e.date) } },
        update: { isClosed: e.isClosed, openTime: e.openTime, closeTime: e.closeTime, note: e.note },
        create: { storeId: STORE_ID, date: new Date(e.date), isClosed: e.isClosed, openTime: e.openTime, closeTime: e.closeTime, note: e.note },
      })
    }
  }

  return NextResponse.json(store)
}

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
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
      businessSlots: { orderBy: [{ dayOfWeek: 'asc' }, { time: 'asc' }] },
      exceptionDates: { orderBy: { date: 'asc' } },
      bankAccounts: { orderBy: { order: 'asc' } },
    },
  })
  return NextResponse.json(store)
}

export async function PUT(req: NextRequest) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, logo, address, bookingNotes, businessHours, businessSlots, exceptionDates, depositEnabled, depositAmount, bankAccounts } = body

  const store = await prisma.store.update({
    where: { id: STORE_ID },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(logo !== undefined ? { logo } : {}),
      ...(address !== undefined ? { address } : {}),
      ...(bookingNotes !== undefined ? { bookingNotes } : {}),
      ...(depositEnabled !== undefined ? { depositEnabled } : {}),
      ...(depositAmount !== undefined ? { depositAmount: Number(depositAmount) } : {}),
    },
  })

  if (businessHours) {
    for (const h of businessHours) {
      await prisma.businessHour.upsert({
        where: { storeId_dayOfWeek: { storeId: STORE_ID, dayOfWeek: h.dayOfWeek } },
        update: { isOpen: h.isOpen },
        create: { storeId: STORE_ID, dayOfWeek: h.dayOfWeek, isOpen: h.isOpen },
      })
    }
  }

  // Sync weekly template slots (BusinessSlot)
  if (businessSlots !== undefined) {
    await prisma.businessSlot.deleteMany({ where: { storeId: STORE_ID } })
    if (businessSlots.length > 0) {
      await prisma.businessSlot.createMany({
        data: businessSlots.map((s: { dayOfWeek: number; time: string }) => ({
          storeId: STORE_ID, dayOfWeek: s.dayOfWeek, time: s.time,
        })),
        skipDuplicates: true,
      })
    }
  }

  if (exceptionDates !== undefined) {
    const validDates = exceptionDates.filter((e: { date: string }) => e.date)
    const dbDates = validDates.map((e: { date: string }) => new Date(e.date))
    await prisma.exceptionDate.deleteMany({
      where: { storeId: STORE_ID, date: { notIn: dbDates } },
    })
    for (const e of validDates) {
      await prisma.exceptionDate.upsert({
        where: { storeId_date: { storeId: STORE_ID, date: new Date(e.date) } },
        update: { isClosed: e.isClosed, note: e.note },
        create: { storeId: STORE_ID, date: new Date(e.date), isClosed: e.isClosed, note: e.note },
      })
    }
  }

  if (bankAccounts !== undefined) {
    await prisma.bankAccount.deleteMany({ where: { storeId: STORE_ID } })
    if (bankAccounts.length > 0) {
      await prisma.bankAccount.createMany({
        data: bankAccounts.map((b: { bankName: string; accountNumber: string; accountName: string }, i: number) => ({
          storeId: STORE_ID, bankName: b.bankName, accountNumber: b.accountNumber, accountName: b.accountName, order: i,
        })),
      })
    }
  }

  revalidatePath('/', 'layout')
  revalidatePath('/book')
  return NextResponse.json(store)
}

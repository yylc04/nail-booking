import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getStoreSession } from '@/lib/auth'

export async function GET() {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storeId = session.storeId
  if (!storeId) return NextResponse.json(null)

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: {
      businessHours: { orderBy: { dayOfWeek: 'asc' } },
      businessSlots: { orderBy: [{ dayOfWeek: 'asc' }, { time: 'asc' }] },
      exceptionDates: { orderBy: { date: 'asc' } },
      bankAccounts: { orderBy: { order: 'asc' } },
      storeInfoBlocks: { orderBy: { order: 'asc' } },
    },
  })
  return NextResponse.json(store)
}

export async function PUT(req: NextRequest) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storeId = session.storeId
  if (!storeId) return NextResponse.json({ error: 'No store assigned' }, { status: 400 })

  const body = await req.json()
  const {
    name, logo, address, metroInfo, lineAccount, igAccount, tagline, introduction,
    bookingNotes, businessHours, businessSlots, exceptionDates,
    depositEnabled, depositAmount, bankAccounts, storeInfoBlocks,
    quoteMode, quoteHoldHours, quotePayHours,
  } = body

  const store = await prisma.store.update({
    where: { id: storeId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(logo !== undefined ? { logo } : {}),
      ...(address !== undefined ? { address } : {}),
      ...(metroInfo !== undefined ? { metroInfo } : {}),
      ...(lineAccount !== undefined ? { lineAccount } : {}),
      ...(igAccount !== undefined ? { igAccount } : {}),
      ...(tagline !== undefined ? { tagline } : {}),
      ...(introduction !== undefined ? { introduction } : {}),
      ...(bookingNotes !== undefined ? { bookingNotes } : {}),
      ...(depositEnabled !== undefined ? { depositEnabled } : {}),
      ...(depositAmount !== undefined ? { depositAmount: Number(depositAmount) } : {}),
      ...(quoteMode !== undefined ? { quoteMode } : {}),
      ...(quoteHoldHours !== undefined ? { quoteHoldHours: Math.max(1, Number(quoteHoldHours)) } : {}),
      ...(quotePayHours !== undefined ? { quotePayHours: Math.max(1, Number(quotePayHours)) } : {}),
    },
  })

  if (businessHours) {
    for (const h of businessHours) {
      await prisma.businessHour.upsert({
        where: { storeId_dayOfWeek: { storeId, dayOfWeek: h.dayOfWeek } },
        update: { isOpen: h.isOpen },
        create: { storeId, dayOfWeek: h.dayOfWeek, isOpen: h.isOpen },
      })
    }
  }

  if (businessSlots !== undefined) {
    await prisma.businessSlot.deleteMany({ where: { storeId } })
    if (businessSlots.length > 0) {
      await prisma.businessSlot.createMany({
        data: businessSlots.map((s: { dayOfWeek: number; time: string }) => ({
          storeId, dayOfWeek: s.dayOfWeek, time: s.time,
        })),
        skipDuplicates: true,
      })
    }
  }

  if (exceptionDates !== undefined) {
    const validDates = exceptionDates.filter((e: { date: string }) => e.date)
    const dbDates = validDates.map((e: { date: string }) => new Date(e.date))
    await prisma.exceptionDate.deleteMany({
      where: { storeId, date: { notIn: dbDates } },
    })
    for (const e of validDates) {
      await prisma.exceptionDate.upsert({
        where: { storeId_date: { storeId, date: new Date(e.date) } },
        update: { isClosed: e.isClosed, note: e.note },
        create: { storeId, date: new Date(e.date), isClosed: e.isClosed, note: e.note },
      })
    }
  }

  if (bankAccounts !== undefined) {
    await prisma.bankAccount.deleteMany({ where: { storeId } })
    if (bankAccounts.length > 0) {
      await prisma.bankAccount.createMany({
        data: bankAccounts.map((b: { bankName: string; accountNumber: string; accountName: string }, i: number) => ({
          storeId, bankName: b.bankName, accountNumber: b.accountNumber, accountName: b.accountName, order: i,
        })),
      })
    }
  }

  if (storeInfoBlocks !== undefined) {
    await prisma.storeInfoBlock.deleteMany({ where: { storeId } })
    if (storeInfoBlocks.length > 0) {
      await prisma.storeInfoBlock.createMany({
        data: storeInfoBlocks.map((b: { title: string; content: string }, i: number) => ({
          storeId, title: b.title, content: b.content, order: i,
        })),
      })
    }
  }

  revalidatePath('/', 'layout')
  revalidatePath('/book')
  return NextResponse.json(store)
}

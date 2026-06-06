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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('accountId')
  const storeId = await getStoreIdByAccount(accountId)

  const [categories, store, portfolio, storeInfoBlocks] = await Promise.all([
    prisma.serviceCategory.findMany({
      where: { storeId },
      include: {
        services: { where: { storeId, isActive: true }, orderBy: { order: 'asc' } },
      },
      orderBy: { order: 'asc' },
    }),
    prisma.store.findUnique({
      where: { id: storeId },
      select: {
        name: true, tagline: true, logo: true,
        address: true, metroInfo: true,
        lineAccount: true, igAccount: true,
        introduction: true, bookingNotes: true,
        bookingReleaseEnabled: true, bookingReleaseDay: true,
        bookingReleaseHour: true, bookingReleaseNote: true,
      },
    }),
    prisma.portfolio.findMany({
      where: { storeId, isVisible: true },
      orderBy: { order: 'asc' },
      select: {
        id: true, name: true, price: true, imageData: true,
        categoryId: true, order: true,
      },
    }),
    prisma.storeInfoBlock.findMany({
      where: { storeId },
      orderBy: { order: 'asc' },
    }),
  ])

  return NextResponse.json({ categories, store, portfolio, storeInfoBlocks })
}

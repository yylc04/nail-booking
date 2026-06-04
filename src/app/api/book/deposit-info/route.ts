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

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      depositEnabled: true,
      depositAmount: true,
      bankAccounts: { orderBy: { order: 'asc' } },
    },
  })
  return NextResponse.json(store)
}

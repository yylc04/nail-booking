import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const STORE_ID = 'default-store'

export async function GET() {
  const store = await prisma.store.findUnique({
    where: { id: STORE_ID },
    select: {
      depositEnabled: true,
      depositAmount: true,
      bankAccounts: { orderBy: { order: 'asc' } },
    },
  })
  return NextResponse.json(store)
}

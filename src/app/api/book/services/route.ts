import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const STORE_ID = 'default-store'

export async function GET() {
  const categories = await prisma.serviceCategory.findMany({
    where: { storeId: STORE_ID },
    include: {
      services: { where: { storeId: STORE_ID, isActive: true }, orderBy: { order: 'asc' } },
    },
    orderBy: { order: 'asc' },
  })

  const store = await prisma.store.findUnique({
    where: { id: STORE_ID },
    select: { name: true, logo: true, address: true, bookingNotes: true },
  })

  return NextResponse.json({ categories, store })
}

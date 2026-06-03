import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStoreSession } from '@/lib/auth'

const STORE_ID = 'default-store'

export async function GET(req: NextRequest) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''

  const customers = await prisma.customer.findMany({
    where: {
      storeId: STORE_ID,
      ...(search ? { OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ]} : {}),
    },
    include: {
      _count: { select: { appointments: true } },
      appointments: {
        select: { totalPrice: true, status: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const result = customers.map(c => ({
    ...c,
    appointmentCount: c._count.appointments,
    totalSpent: c.appointments
      .filter(a => a.status === 'COMPLETED')
      .reduce((sum, a) => sum + a.totalPrice, 0),
    appointments: undefined,
    _count: undefined,
  }))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, phone, email, notes } = body

  const existing = await prisma.customer.findUnique({
    where: { storeId_phone: { storeId: STORE_ID, phone } },
  })
  if (existing) return NextResponse.json({ error: '此電話號碼已存在' }, { status: 409 })

  const customer = await prisma.customer.create({
    data: { name, phone, email, notes, storeId: STORE_ID },
  })
  return NextResponse.json(customer)
}

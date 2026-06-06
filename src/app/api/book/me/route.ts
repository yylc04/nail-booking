import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCustomerSession, setCustomerSession } from '@/lib/auth'

export async function GET() {
  const session = await getCustomerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ name: session.customerName, phone: session.phone, customerId: session.customerId })
}

export async function PUT(req: NextRequest) {
  const session = await getCustomerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: '請輸入姓名' }, { status: 400 })

  await prisma.customer.update({
    where: { id: session.customerId },
    data: { name: name.trim() },
  })

  await setCustomerSession({ ...session, customerName: name.trim() })
  return NextResponse.json({ ok: true })
}

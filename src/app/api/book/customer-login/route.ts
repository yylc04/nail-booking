import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { setCustomerSession } from '@/lib/auth'

const STORE_ID = 'default-store'

export async function POST(req: NextRequest) {
  const { phone } = await req.json()
  if (!phone) return NextResponse.json({ error: '請輸入電話號碼' }, { status: 400 })

  const customer = await prisma.customer.findUnique({
    where: { storeId_phone: { storeId: STORE_ID, phone } },
  })

  if (!customer) {
    return NextResponse.json({ error: '查無此電話，請先完成預約' }, { status: 404 })
  }

  await setCustomerSession({ phone: customer.phone, customerId: customer.id, customerName: customer.name })
  return NextResponse.json({ ok: true, name: customer.name })
}

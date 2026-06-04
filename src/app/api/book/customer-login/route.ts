import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { setCustomerSession } from '@/lib/auth'

async function getStoreIdByAccount(accountId?: string | null): Promise<string> {
  if (!accountId) return 'default-store'
  const user = await prisma.storeUser.findUnique({
    where: { username: accountId },
    select: { storeId: true },
  })
  return user?.storeId ?? 'default-store'
}

export async function POST(req: NextRequest) {
  const { phone, accountId } = await req.json()
  if (!phone) return NextResponse.json({ error: '請輸入電話號碼' }, { status: 400 })

  const storeId = await getStoreIdByAccount(accountId)

  const customer = await prisma.customer.findUnique({
    where: { storeId_phone: { storeId, phone } },
  })

  if (!customer) {
    return NextResponse.json({ error: '查無此電話，請先完成預約' }, { status: 404 })
  }

  await setCustomerSession({ phone: customer.phone, customerId: customer.id, customerName: customer.name })
  return NextResponse.json({ ok: true, name: customer.name })
}

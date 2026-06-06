import { NextResponse } from 'next/server'
import { getCustomerSession } from '@/lib/auth'

export async function GET() {
  const session = await getCustomerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ name: session.customerName, phone: session.phone })
}

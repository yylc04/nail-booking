import { NextResponse } from 'next/server'
import { getStoreSession } from '@/lib/auth'

export async function GET() {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(session)
}

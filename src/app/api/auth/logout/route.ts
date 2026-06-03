import { NextResponse } from 'next/server'
import { clearStoreSession } from '@/lib/auth'

export async function POST() {
  await clearStoreSession()
  return NextResponse.json({ ok: true })
}

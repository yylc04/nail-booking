import { NextRequest, NextResponse } from 'next/server'
import { getStoreSessionFromRequest, getCustomerSessionFromRequest } from '@/lib/auth'

const STORE_PROTECTED = [
  '/calendar',
  '/appointments',
  '/customers',
  '/services',
  '/settings',
  '/accounts',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Dashboard root and sub-pages require store login
  const isStorePage = pathname === '/' || STORE_PROTECTED.some(p => pathname.startsWith(p))
  if (isStorePage) {
    const session = await getStoreSessionFromRequest(req)
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    // Accounts page is super admin only
    if (pathname.startsWith('/accounts') && session.role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/', req.url))
    }
    return NextResponse.next()
  }

  // Customer my-bookings requires customer login
  if (pathname.startsWith('/book/my-bookings')) {
    const session = await getCustomerSessionFromRequest(req)
    if (!session) {
      return NextResponse.redirect(new URL('/book/login', req.url))
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}

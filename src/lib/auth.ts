import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const STORE_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'nail-booking-store-secret-key-2024'
)
const CUSTOMER_SECRET = new TextEncoder().encode(
  process.env.JWT_CUSTOMER_SECRET || 'nail-booking-customer-secret-key-2024'
)

const STORE_COOKIE = 'store_session'
const CUSTOMER_COOKIE = 'customer_session'

export interface StorePayload {
  userId: string
  username: string
  role: 'SUPER_ADMIN' | 'STORE'
  storeId?: string
}

export interface CustomerPayload {
  phone: string
  customerId: string
  customerName: string
}

export async function signStoreToken(payload: StorePayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(STORE_SECRET)
}

export async function verifyStoreToken(token: string): Promise<StorePayload | null> {
  try {
    const { payload } = await jwtVerify(token, STORE_SECRET)
    return payload as unknown as StorePayload
  } catch {
    return null
  }
}

export async function signCustomerToken(payload: CustomerPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1d')
    .sign(CUSTOMER_SECRET)
}

export async function verifyCustomerToken(token: string): Promise<CustomerPayload | null> {
  try {
    const { payload } = await jwtVerify(token, CUSTOMER_SECRET)
    return payload as unknown as CustomerPayload
  } catch {
    return null
  }
}

export async function getStoreSession(): Promise<StorePayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(STORE_COOKIE)?.value
  if (!token) return null
  return verifyStoreToken(token)
}

export async function getCustomerSession(): Promise<CustomerPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(CUSTOMER_COOKIE)?.value
  if (!token) return null
  return verifyCustomerToken(token)
}

export async function setStoreSession(payload: StorePayload): Promise<void> {
  const token = await signStoreToken(payload)
  const cookieStore = await cookies()
  cookieStore.set(STORE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
}

export async function setCustomerSession(payload: CustomerPayload): Promise<void> {
  const token = await signCustomerToken(payload)
  const cookieStore = await cookies()
  cookieStore.set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  })
}

export async function clearStoreSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(STORE_COOKIE)
}

export async function clearCustomerSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(CUSTOMER_COOKIE)
}

// For middleware (edge runtime)
export async function getStoreSessionFromRequest(req: NextRequest): Promise<StorePayload | null> {
  const token = req.cookies.get(STORE_COOKIE)?.value
  if (!token) return null
  return verifyStoreToken(token)
}

export async function getCustomerSessionFromRequest(req: NextRequest): Promise<CustomerPayload | null> {
  const token = req.cookies.get(CUSTOMER_COOKIE)?.value
  if (!token) return null
  return verifyCustomerToken(token)
}

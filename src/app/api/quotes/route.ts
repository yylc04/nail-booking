import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStoreSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const storeId = session.storeId
  if (!storeId) return NextResponse.json([])

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') // 'PENDING' | 'REPLIED' | null (all)

  const quotes = await prisma.quote.findMany({
    where: {
      storeId,
      ...(status === 'PENDING' ? { status: 'PENDING' } : {}),
      ...(status === 'REPLIED' ? { status: 'REPLIED' } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(quotes.map(q => ({
    ...q,
    images: JSON.parse(q.images) as string[],
  })))
}

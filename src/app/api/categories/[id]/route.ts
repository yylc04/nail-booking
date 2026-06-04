import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStoreSession } from '@/lib/auth'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStoreSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const storeId = session.storeId
  if (!storeId) return NextResponse.json({ error: 'No store assigned' }, { status: 400 })

  const { id } = await params

  // Verify ownership
  const cat = await prisma.serviceCategory.findUnique({ where: { id }, select: { storeId: true } })
  if (!cat || cat.storeId !== storeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const serviceCount = await prisma.service.count({ where: { categoryId: id } })
  if (serviceCount > 0) {
    return NextResponse.json({ error: `此分類下還有 ${serviceCount} 個服務，請先移動或刪除服務再刪除分類` }, { status: 400 })
  }

  await prisma.serviceCategory.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

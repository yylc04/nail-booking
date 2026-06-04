import { redirect } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import { getStoreSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Sidebar } from '@/components/sidebar'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  noStore()
  const session = await getStoreSession()
  if (!session) redirect('/login')

  let storeName: string | undefined
  let logo: string | null | undefined

  if (session.storeId) {
    const store = await prisma.store.findUnique({
      where: { id: session.storeId },
      select: { name: true, logo: true },
    })
    storeName = store?.name
    logo = store?.logo
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        role={session.role}
        username={session.username}
        logo={logo}
        storeName={storeName}
        storeId={session.storeId}
      />
      <main className="flex-1 overflow-auto bg-background pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}

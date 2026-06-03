import { redirect } from 'next/navigation'
import { getStoreSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Sidebar } from '@/components/sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getStoreSession()
  if (!session) redirect('/login')

  const store = await prisma.store.findUnique({
    where: { id: 'default-store' },
    select: { name: true, logo: true },
  })

  return (
    <div className="flex min-h-screen">
      <Sidebar
        role={session.role}
        username={session.username}
        logo={store?.logo}
        storeName={store?.name}
      />
      <main className="flex-1 overflow-auto bg-background">
        {children}
      </main>
    </div>
  )
}

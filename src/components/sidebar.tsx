'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Sparkles, LayoutDashboard, CalendarDays, ClipboardList, Users, Gem, Settings, UserCog, LogOut, Link2, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import Image from 'next/image'

interface SidebarProps {
  role: 'SUPER_ADMIN' | 'STORE'
  username: string
  logo?: string | null
  storeName?: string
  storeId?: string
}

const navItems = [
  { href: '/', label: '儀表板', icon: LayoutDashboard },
  { href: '/calendar', label: '行事曆', icon: CalendarDays },
  { href: '/appointments', label: '預約清單', icon: ClipboardList },
  { href: '/customers', label: '客戶管理', icon: Users },
  { href: '/services', label: '服務項目', icon: Gem },
  { href: '/settings', label: '營業設定', icon: Settings },
]

export function Sidebar({ role, username, logo, storeName, storeId }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const bookingUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/book/${username}`
    : `/book/${username}`

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    toast.success('已登出')
    router.push('/login')
  }

  function handleCopyLink() {
    const url = `${window.location.origin}/book/${username}`
    navigator.clipboard.writeText(url).then(() => {
      toast.success('預約連結已複製')
    }).catch(() => {
      toast.error('複製失敗，請手動複製')
    })
  }

  return (
    <aside className="w-64 min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo area */}
      <div className="p-6 border-b border-sidebar-border">
        {logo ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-sm">
              <Image src={logo} alt="店家Logo" width={64} height={64} className="w-full h-full object-cover" unoptimized />
            </div>
            <span className="text-sm font-semibold text-sidebar-foreground text-center">{storeName || '美甲工作室'}</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-sidebar-foreground">{storeName || '美甲工作室'}</p>
              <p className="text-xs text-muted-foreground">預約管理系統</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}

        {role === 'SUPER_ADMIN' && (
          <Link
            href="/accounts"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              pathname === '/accounts'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <UserCog className="w-4 h-4 shrink-0" />
            帳號管理
          </Link>
        )}

        {/* Booking link for STORE accounts */}
        {role === 'STORE' && storeId && (
          <div className="mt-3 px-3 py-3 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 mb-1.5">
              <Link2 className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-xs font-semibold text-primary">我的預約連結</span>
            </div>
            <p className="text-[10px] text-muted-foreground break-all mb-2 leading-relaxed">
              /book/{username}
            </p>
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg px-2 py-1.5 transition-colors"
            >
              <Copy className="w-3 h-3" /> 複製連結
            </button>
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between px-3 py-2">
          <div>
            <p className="text-xs font-semibold text-sidebar-foreground">{username}</p>
            <p className="text-xs text-muted-foreground">{role === 'SUPER_ADMIN' ? '超級管理員' : '店家帳號'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="登出"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Sparkles, CalendarDays, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

interface Appointment {
  id: string; date: string; startTime: string; endTime: string; status: string
  totalPrice: number; totalDuration: number; notes?: string
  services: { serviceName: string; price: number }[]
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: '待確認', CONFIRMED: '已確認', COMPLETED: '已完成', CANCELLED: '已取消',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
  COMPLETED: 'bg-green-100 text-green-800 border-green-200',
  CANCELLED: 'bg-gray-100 text-gray-600 border-gray-200',
}

export default function MyBookingsPage() {
  const router = useRouter()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelId, setCancelId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/book/my-bookings').then(r => {
      if (r.status === 401) { router.push('/book/login'); return null }
      return r.json()
    }).then(data => { if (data) { setAppointments(data); setLoading(false) } })
  }, [router])

  async function handleCancel() {
    if (!cancelId) return
    const res = await fetch(`/api/book/cancel/${cancelId}`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      toast.success('預約已取消')
      setAppointments(prev => prev.map(a => a.id === cancelId ? { ...a, status: 'CANCELLED' } : a))
    } else {
      toast.error(data.error || '取消失敗')
    }
    setCancelId(null)
  }

  async function handleLogout() {
    await fetch('/api/book/customer-logout', { method: 'POST' })
    router.push('/book/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-fuchsia-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur border-b border-border/50 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold">我的預約</h1>
              <p className="text-xs text-muted-foreground">預約記錄查詢</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1 text-muted-foreground">
            <LogOut className="w-3.5 h-3.5" /> 登出
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">載入中...</div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-12">
            <CalendarDays className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">尚無預約記錄</p>
            <Button className="mt-4" onClick={() => router.push('/book')}>立即預約</Button>
          </div>
        ) : (
          appointments.map(appt => (
            <Card key={appt.id} className="border-border/50 shadow-sm bg-white">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-sm">
                      {format(new Date(appt.date), 'yyyy年M月d日 EEEE', { locale: zhTW })}
                    </p>
                    <p className="text-xs text-muted-foreground">{appt.startTime} – {appt.endTime}</p>
                  </div>
                  <Badge variant="outline" className={`text-xs ${STATUS_COLOR[appt.status]}`}>
                    {STATUS_LABEL[appt.status]}
                  </Badge>
                </div>

                <div className="bg-accent/40 rounded-xl p-3 mb-3">
                  <div className="flex flex-wrap gap-1.5">
                    {appt.services.map((s, i) => (
                      <span key={i} className="text-xs bg-white border border-border/50 rounded-full px-2.5 py-0.5">
                        {s.serviceName}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">{appt.totalDuration} 分鐘</p>
                    <p className="text-sm font-bold text-primary">NT$ {appt.totalPrice.toLocaleString()}</p>
                  </div>
                </div>

                {appt.status === 'PENDING' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-destructive border-destructive/30 hover:bg-destructive/5"
                    onClick={() => setCancelId(appt.id)}
                  >
                    取消預約
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}

        <div className="text-center pt-4">
          <Button variant="outline" onClick={() => router.push('/book')}>返回預約頁面</Button>
        </div>
      </div>

      <AlertDialog open={!!cancelId} onOpenChange={o => !o && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認取消預約</AlertDialogTitle>
            <AlertDialogDescription>確定要取消這筆預約嗎？取消後無法復原。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-destructive hover:bg-destructive/90">確認取消</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

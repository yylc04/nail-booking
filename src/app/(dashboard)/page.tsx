import { prisma } from '@/lib/prisma'
import { getStoreSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, addDays } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { CalendarCheck, Users, TrendingUp, Clock, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const STATUS_LABEL: Record<string, string> = {
  PENDING: '待確認', CONFIRMED: '已確認', COMPLETED: '已完成', CANCELLED: '已取消',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
}

export default async function DashboardPage() {
  const session = await getStoreSession()
  if (!session) redirect('/login')

  const storeId = session.storeId

  // No store assigned (e.g. SUPER_ADMIN) - show empty dashboard
  if (!storeId) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground">歡迎回來，{session.username}！</h1>
            <p className="text-sm text-muted-foreground">{format(new Date(), 'yyyy年M月d日 EEEE', { locale: zhTW })}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">此帳號為超級管理員，請前往帳號管理頁面。</p>
      </div>
    )
  }

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const upcomingEnd = endOfDay(addDays(now, 7))

  const [monthlyAppts, todayAppts, upcomingAppts, totalCustomers] = await Promise.all([
    prisma.appointment.findMany({
      where: { storeId, date: { gte: monthStart, lte: monthEnd }, status: { not: 'CANCELLED' } },
      select: { totalPrice: true, status: true },
    }),
    prisma.appointment.findMany({
      where: { storeId, date: { gte: todayStart, lte: todayEnd }, status: { not: 'CANCELLED' } },
      include: { customer: true, services: true },
      orderBy: { startTime: 'asc' },
    }),
    prisma.appointment.findMany({
      where: {
        storeId,
        date: { gte: todayStart, lte: upcomingEnd },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      include: { customer: true, services: true },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    }),
    prisma.customer.count({ where: { storeId } }),
  ])

  const monthlyRevenue = monthlyAppts
    .filter(a => a.status === 'COMPLETED')
    .reduce((s, a) => s + a.totalPrice, 0)

  const stats = [
    { label: '本月預約', value: monthlyAppts.length, icon: CalendarCheck, color: 'text-pink-500', bg: 'bg-pink-50' },
    { label: '本月營收', value: `NT$ ${monthlyRevenue.toLocaleString()}`, icon: TrendingUp, color: 'text-rose-500', bg: 'bg-rose-50' },
    { label: '總客戶數', value: totalCustomers, icon: Users, color: 'text-fuchsia-500', bg: 'bg-fuchsia-50' },
    { label: '今日預約', value: todayAppts.length, icon: Clock, color: 'text-purple-500', bg: 'bg-purple-50' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">歡迎回來，{session.username}！</h1>
          <p className="text-sm text-muted-foreground">{format(now, 'yyyy年M月d日 EEEE', { locale: zhTW })}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                </div>
                <div className={`p-2 rounded-xl ${s.bg}`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> 今日預約
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayAppts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">今天沒有預約</p>
            ) : (
              <div className="space-y-3">
                {todayAppts.map(appt => (
                  <div key={appt.id} className="flex items-center justify-between p-3 rounded-xl bg-accent/50">
                    <div>
                      <p className="text-sm font-semibold">{appt.customer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {appt.startTime} – {appt.endTime} · {appt.services.map(s => s.serviceName).join('、')}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[appt.status]}`}>
                      {STATUS_LABEL[appt.status]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-primary" /> 近期預約（7 天內）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingAppts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">近期沒有預約</p>
            ) : (
              <div className="space-y-3">
                {upcomingAppts.map(appt => (
                  <div key={appt.id} className="flex items-center justify-between p-3 rounded-xl bg-accent/50">
                    <div>
                      <p className="text-sm font-semibold">{appt.customer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(appt.date), 'M/d')} {appt.startTime} · {appt.services.map(s => s.serviceName).join('、')}
                      </p>
                    </div>
                    <Badge variant="outline" className={`text-xs ${STATUS_COLOR[appt.status]}`}>
                      {STATUS_LABEL[appt.status]}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-400',
  CONFIRMED: 'bg-blue-400',
  COMPLETED: 'bg-green-400',
  CANCELLED: 'bg-gray-300',
}

interface Appointment {
  id: string
  date: string
  startTime: string
  status: string
  customer: { name: string }
  services: { serviceName: string }[]
}

export default function CalendarPage() {
  const [current, setCurrent] = useState(new Date())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selected, setSelected] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    const month = format(current, 'yyyy-MM')
    const res = await fetch(`/api/appointments?month=${month}`)
    const data = await res.json()
    setAppointments(data)
    setLoading(false)
  }, [current])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  const monthStart = startOfMonth(current)
  const monthEnd = endOfMonth(current)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad = getDay(monthStart) // Sunday=0

  const selectedAppts = selected
    ? appointments.filter(a => isSameDay(new Date(a.date), selected))
    : []

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center gap-3">
        <CalendarDays className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">行事曆</h1>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-4">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" size="icon" onClick={() => setCurrent(m => subMonths(m, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-lg font-bold text-foreground">
              {format(current, 'yyyy年M月', { locale: zhTW })}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setCurrent(m => addMonths(m, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-2">
            {['日', '一', '二', '三', '四', '五', '六'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          {loading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">載入中...</div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
              {days.map(day => {
                const dayAppts = appointments.filter(a => isSameDay(new Date(a.date), day))
                const isSelected = selected && isSameDay(day, selected)
                const isToday = isSameDay(day, new Date())
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelected(isSelected ? null : day)}
                    className={`relative p-1 rounded-xl text-left transition-all min-h-[56px] md:min-h-[72px] ${
                      isSelected ? 'bg-primary/10 ring-2 ring-primary' :
                      isToday ? 'bg-primary/5' : 'hover:bg-accent'
                    }`}
                  >
                    <span className={`text-xs font-semibold block text-center mb-1 w-6 h-6 mx-auto rounded-full flex items-center justify-center ${
                      isToday ? 'bg-primary text-primary-foreground' :
                      isSameMonth(day, current) ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                      {format(day, 'd')}
                    </span>
                    <div className="space-y-0.5">
                      {dayAppts.slice(0, 2).map(a => (
                        <div key={a.id} className={`text-[10px] leading-tight px-1 py-0.5 rounded text-white truncate ${STATUS_COLOR[a.status]}`}>
                          <span className="hidden sm:inline">{a.startTime} </span>{a.customer.name}
                        </div>
                      ))}
                      {dayAppts.length > 3 && (
                        <div className="text-[10px] text-muted-foreground text-center">+{dayAppts.length - 3}</div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected day detail */}
      {selected && (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">
              {format(selected, 'M月d日 EEEE', { locale: zhTW })} 的預約
            </h3>
            {selectedAppts.length === 0 ? (
              <p className="text-sm text-muted-foreground">當天沒有預約</p>
            ) : (
              <div className="space-y-2">
                {selectedAppts.map(a => (
                  <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-accent/40">
                    <div className={`w-2 h-2 rounded-full ${STATUS_COLOR[a.status]}`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{a.customer.name}</p>
                      <p className="text-xs text-muted-foreground">{a.startTime} · {a.services.map(s => s.serviceName).join('、')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

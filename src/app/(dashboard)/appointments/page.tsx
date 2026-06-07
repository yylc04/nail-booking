'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import { ClipboardList, Plus, Search, Pencil, Trash2, CheckCircle, ArrowUpDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const STATUS_LABEL: Record<string, string> = {
  PENDING: '待確認', CONFIRMED: '已確認', COMPLETED: '已完成', CANCELLED: '已取消',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
  COMPLETED: 'bg-green-100 text-green-800 border-green-200',
  CANCELLED: 'bg-gray-100 text-gray-600 border-gray-200',
}

interface Appointment {
  id: string
  date: string
  startTime: string
  endTime: string
  status: string
  totalPrice: number
  totalDuration: number
  notes?: string
  transferCode?: string
  customer: { id: string; name: string; phone: string; lineName?: string; lineOrIg?: string }
  services: { id: string; serviceName: string; price: number }[]
}

interface Customer { id: string; name: string; phone: string }
interface ServiceCategory {
  id: string; name: string
  services: { id: string; name: string; price: number; duration: number }[]
}

function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number); return h * 60 + m
}
function minToTime(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Form state
  const [fCustomerId, setFCustomerId] = useState('')
  const [fDate, setFDate] = useState('')
  const [fStartTime, setFStartTime] = useState('')
  const [fNotes, setFNotes] = useState('')
  const [fServices, setFServices] = useState<{ serviceId: string; serviceName: string; price: number; duration: number }[]>([])
  const [fStatus, setFStatus] = useState('PENDING')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [apptRes, custRes, svcRes] = await Promise.all([
      fetch('/api/appointments'),
      fetch('/api/customers'),
      fetch('/api/services'),
    ])
    const [appts, custs, cats] = await Promise.all([apptRes.json(), custRes.json(), svcRes.json()])
    setAppointments(appts)
    setCustomers(custs)
    setCategories(cats)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const displayedAppointments = useMemo(() => {
    let list = appointments
    if (statusFilter !== 'ALL') list = list.filter(a => a.status === statusFilter)
    if (search) {
      const s = search.toLowerCase()
      list = list.filter(a =>
        a.customer.name.toLowerCase().includes(s) || a.customer.phone.includes(s)
      )
    }
    return [...list].sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime()
        || a.startTime.localeCompare(b.startTime)
      return sortDir === 'desc' ? -diff : diff
    })
  }, [appointments, statusFilter, search, sortDir])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: appointments.length }
    for (const a of appointments) counts[a.status] = (counts[a.status] || 0) + 1
    return counts
  }, [appointments])

  function openCreate() {
    setEditing(null)
    setFCustomerId(''); setFDate(''); setFStartTime(''); setFNotes(''); setFServices([]); setFStatus('PENDING')
    setShowForm(true)
  }

  function openEdit(a: Appointment) {
    setEditing(a)
    setFCustomerId(a.customer.id)
    setFDate(a.date.split('T')[0])
    setFStartTime(a.startTime)
    setFNotes(a.notes || '')
    setFStatus(a.status)
    setFServices(a.services.map(s => ({ serviceId: s.id, serviceName: s.serviceName, price: s.price, duration: 0 })))
    setShowForm(true)
  }

  const totalDuration = fServices.reduce((s, sv) => s + sv.duration, 0)
  const totalPrice = fServices.reduce((s, sv) => s + sv.price, 0)
  const endTime = fStartTime && totalDuration > 0 ? minToTime(timeToMin(fStartTime) + totalDuration) : ''

  function toggleService(svc: { id: string; name: string; price: number; duration: number }) {
    setFServices(prev => {
      const idx = prev.findIndex(s => s.serviceId === svc.id)
      if (idx >= 0) return prev.filter((_, i) => i !== idx)
      return [...prev, { serviceId: svc.id, serviceName: svc.name, price: svc.price, duration: svc.duration }]
    })
  }

  async function handleSave() {
    if (editing) {
      const res = await fetch(`/api/appointments/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: fStatus, notes: fNotes, date: fDate, startTime: fStartTime, endTime }),
      })
      if (res.ok) { toast.success('預約已更新'); setShowForm(false); fetchData() }
      else toast.error('更新失敗')
    } else {
      if (!fCustomerId || !fDate || !fStartTime || fServices.length === 0) {
        return toast.error('請填寫所有必填欄位')
      }
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: fCustomerId, date: fDate, startTime: fStartTime, endTime, services: fServices, notes: fNotes, totalPrice, totalDuration }),
      })
      if (res.ok) { toast.success('預約已新增'); setShowForm(false); fetchData() }
      else toast.error('新增失敗')
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    const res = await fetch(`/api/appointments/${deleteId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('預約已刪除'); fetchData() }
    else toast.error('刪除失敗')
    setDeleteId(null)
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">預約清單</h1>
        </div>
        <Button onClick={openCreate} className="gap-2 min-h-[44px]">
          <Plus className="w-4 h-4" /> 新增預約
        </Button>
      </div>

      {/* Search + sort */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜尋客戶姓名或電話..."
            className="pl-9 min-h-[44px]"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          className="min-h-[44px] w-11 shrink-0"
          title={sortDir === 'desc' ? '目前：最新在上' : '目前：最舊在上'}
          onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
        >
          <ArrowUpDown className={`w-4 h-4 transition-transform ${sortDir === 'asc' ? 'rotate-180' : ''}`} />
        </Button>
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { key: 'ALL', label: '全部' },
          { key: 'PENDING', label: '待確認' },
          { key: 'CONFIRMED', label: '已確認' },
          { key: 'COMPLETED', label: '已完成' },
          { key: 'CANCELLED', label: '已取消' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
              statusFilter === key
                ? 'bg-primary text-white border-primary'
                : 'bg-white border-border/60 text-muted-foreground hover:border-primary/40'
            }`}
          >
            {label}
            {statusCounts[key] != null && statusCounts[key] > 0 && (
              <span className={`ml-1.5 text-[10px] ${statusFilter === key ? 'opacity-80' : 'opacity-60'}`}>
                {statusCounts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">載入中...</div>
          ) : displayedAppointments.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-muted-foreground text-sm">{search || statusFilter !== 'ALL' ? '查無符合條件的預約' : '尚無預約記錄'}</p>
              <button onClick={openCreate} className="text-sm text-primary font-medium hover:underline">+ 新增第一筆預約</button>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {displayedAppointments.map(a => (
                <div key={a.id} className="p-4 hover:bg-accent/30 transition-colors">
                  <div className="flex items-start gap-3">
                    {/* Date column */}
                    <div className="text-center w-11 shrink-0">
                      <p className="text-xs text-muted-foreground">{format(new Date(a.date), 'M月')}</p>
                      <p className="text-xl font-bold text-primary leading-tight">{format(new Date(a.date), 'd')}</p>
                    </div>
                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <p className="text-sm font-semibold">{a.customer.name}</p>
                            <span className="text-xs text-muted-foreground">{a.customer.phone}</span>
                          </div>
                          {(a.customer.lineName || a.customer.lineOrIg) && (
                            <p className="text-xs text-muted-foreground mb-0.5">
                              {a.customer.lineName && <span className="mr-2">Line：{a.customer.lineName}</span>}
                              {a.customer.lineOrIg && <span>@{a.customer.lineOrIg}</span>}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {a.startTime}{a.endTime ? ` – ${a.endTime}` : ''}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{a.services.map(s => s.serviceName).join('、')}</p>
                          <p className="text-xs font-medium text-primary mt-0.5">NT$ {a.totalPrice.toLocaleString()}</p>
                          {a.transferCode && (
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <p className="text-xs">
                                <span className="text-muted-foreground">匯款末五碼：</span>
                                <span className="font-mono font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{a.transferCode}</span>
                              </p>
                              {a.status === 'PENDING' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50"
                                  onClick={async () => {
                                    const res = await fetch(`/api/appointments/${a.id}`, {
                                      method: 'PUT', headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ status: 'CONFIRMED' }),
                                    })
                                    if (res.ok) { toast.success('已確認收款'); fetchData() }
                                    else toast.error('操作失敗')
                                  }}
                                >
                                  <CheckCircle className="w-3 h-3" /> 確認收款
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        {/* Actions: top-right on all screens */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openEdit(a)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => setDeleteId(a.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      {/* Status row */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="outline" className={`text-xs ${STATUS_COLOR[a.status]}`}>
                          {STATUS_LABEL[a.status]}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-auto">
          <DialogHeader>
            <DialogTitle>{editing ? '編輯預約' : '新增預約'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editing && (
              <div className="space-y-2">
                <Label>客戶 <span className="text-destructive">*</span></Label>
                <Select value={fCustomerId} onValueChange={v => setFCustomerId(v || '')}>
                  <SelectTrigger><SelectValue placeholder="選擇客戶" /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>日期 <span className="text-destructive">*</span></Label>
                <Input type="date" value={fDate} onChange={e => setFDate(e.target.value)} className="min-h-[44px]" />
              </div>
              <div className="space-y-2">
                <Label>開始時間 <span className="text-destructive">*</span></Label>
                <Input type="time" value={fStartTime} onChange={e => setFStartTime(e.target.value)} className="min-h-[44px]" />
              </div>
            </div>
            {editing && (
              <div className="space-y-2">
                <Label>狀態</Label>
                <Select value={fStatus} onValueChange={v => setFStatus(v || 'PENDING')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!editing && (
              <div className="space-y-2">
                <Label>服務項目 <span className="text-destructive">*</span></Label>
                <div className="border border-border rounded-xl p-3 space-y-3 max-h-48 overflow-y-auto">
                  {categories.map(cat => (
                    <div key={cat.id}>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">{cat.name}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {cat.services.map(svc => {
                          const selected = fServices.some(s => s.serviceId === svc.id)
                          return (
                            <button
                              key={svc.id}
                              type="button"
                              onClick={() => toggleService(svc)}
                              className={`text-left p-2 rounded-lg border text-xs transition-all ${selected ? 'bg-primary/10 border-primary text-primary' : 'border-border hover:border-primary/50'}`}
                            >
                              <p className="font-medium">{svc.name}</p>
                              <p className="text-muted-foreground">NT$ {svc.price} · {svc.duration}分鐘</p>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {fServices.length > 0 && (
                  <div className="text-xs text-muted-foreground bg-accent/50 rounded-lg p-2">
                    共 {totalDuration} 分鐘 · NT$ {totalPrice.toLocaleString()} · 結束時間: {endTime}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>備註</Label>
              <Textarea value={fNotes} onChange={e => setFNotes(e.target.value)} rows={2} placeholder="選填" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>取消</Button>
            <Button onClick={handleSave}>儲存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>此操作無法復原，確定要刪除這筆預約嗎？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">刪除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

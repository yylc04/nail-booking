'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Settings, Upload, Plus, Trash2, Wand2, Banknote, MapPin, FileText,
  ChevronLeft, ChevronRight, X, Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths, subMonths, isBefore, startOfDay } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import Image from 'next/image'

const DAYS_ZH = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
const DAYS_SHORT = ['日', '一', '二', '三', '四', '五', '六']
const STORE_ID = 'default-store'

interface BusinessSlot { dayOfWeek: number; time: string }
interface BankAccount { bankName: string; accountNumber: string; accountName: string }

// State for a single day's modal
interface DayModalState {
  date: Date
  isClosed: boolean
  note: string
  slots: string[]
  newTime: string
}

export default function SettingsPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  // Store info
  const [storeName, setStoreName] = useState('')
  const [logo, setLogo] = useState<string | null>(null)
  const [address, setAddress] = useState('')
  const [bookingNotes, setBookingNotes] = useState('')

  // Calendar
  const [calMonth, setCalMonth] = useState(new Date())
  const [slotMap, setSlotMap] = useState<Record<string, string[]>>({})    // "YYYY-MM-DD" → ["10:00", ...]
  const [closedMap, setClosedMap] = useState<Record<string, { isClosed: boolean; note?: string }>>({})
  const [calLoading, setCalLoading] = useState(true)

  // Day modal
  const [modal, setModal] = useState<DayModalState | null>(null)
  const [modalSaving, setModalSaving] = useState(false)

  // Weekly templates
  const [templates, setTemplates] = useState<BusinessSlot[]>([])
  const [tplDay, setTplDay] = useState(1)
  const [tplTime, setTplTime] = useState('')

  // Deposit
  const [depositEnabled, setDepositEnabled] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])

  const [globalSaving, setGlobalSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load store settings
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      setStoreName(data?.name || '')
      setLogo(data?.logo || null)
      setAddress(data?.address || '')
      setBookingNotes(data?.bookingNotes || '')
      setDepositEnabled(data?.depositEnabled || false)
      setDepositAmount(data?.depositAmount ? String(data.depositAmount) : '0')
      setBankAccounts(data?.bankAccounts || [])
      setTemplates(data?.businessSlots?.map((s: { dayOfWeek: number; time: string }) => ({ dayOfWeek: s.dayOfWeek, time: s.time })) || [])
      setLoading(false)
    })
  }, [])

  // Load calendar slots for current month
  const loadCalendarSlots = useCallback(async (month: Date) => {
    setCalLoading(true)
    const monthStr = format(month, 'yyyy-MM')
    const res = await fetch(`/api/settings/daily-slots?month=${monthStr}`)
    const data = await res.json()
    setSlotMap(data.slots || {})
    setClosedMap(data.exceptions || {})
    setCalLoading(false)
  }, [])

  useEffect(() => { loadCalendarSlots(calMonth) }, [calMonth, loadCalendarSlots])

  // Calendar grid
  const monthStart = startOfMonth(calMonth)
  const monthEnd = endOfMonth(calMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad = getDay(monthStart)
  const today = startOfDay(new Date())

  function openDayModal(day: Date) {
    const key = format(day, 'yyyy-MM-dd')
    const closedInfo = closedMap[key]
    setModal({
      date: day,
      isClosed: closedInfo?.isClosed ?? false,
      note: closedInfo?.note || '',
      slots: [...(slotMap[key] || [])].sort(),
      newTime: '',
    })
  }

  function addSlotToModal() {
    if (!modal) return
    if (!modal.newTime) { toast.error('請選擇時間'); return }
    if (modal.slots.includes(modal.newTime)) { toast.error('此時段已存在'); return }
    setModal(m => m ? { ...m, slots: [...m.slots, m.newTime].sort(), newTime: '' } : m)
  }

  function removeSlotFromModal(time: string) {
    setModal(m => m ? { ...m, slots: m.slots.filter(s => s !== time) } : m)
  }

  function applyWeeklyTemplate() {
    if (!modal) return
    const dow = modal.date.getDay()
    const tplSlots = templates.filter(t => t.dayOfWeek === dow).map(t => t.time)
    if (tplSlots.length === 0) { toast.error(`${DAYS_ZH[dow]}尚未設定預設時段`); return }
    const merged = [...new Set([...modal.slots, ...tplSlots])].sort()
    setModal(m => m ? { ...m, slots: merged } : m)
    toast.success(`已帶入 ${tplSlots.length} 個時段`)
  }

  async function saveModal() {
    if (!modal) return
    setModalSaving(true)
    const dateStr = format(modal.date, 'yyyy-MM-dd')
    const res = await fetch(`/api/settings/daily-slots/${dateStr}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots: modal.slots, isClosed: modal.isClosed, note: modal.note }),
    })
    setModalSaving(false)
    if (res.ok) {
      // Update local maps
      const key = dateStr
      if (modal.isClosed) {
        setClosedMap(m => ({ ...m, [key]: { isClosed: true, note: modal.note } }))
        setSlotMap(m => { const n = { ...m }; delete n[key]; return n })
      } else {
        setClosedMap(m => { const n = { ...m }; delete n[key]; return n })
        if (modal.slots.length > 0) setSlotMap(m => ({ ...m, [key]: modal.slots }))
        else setSlotMap(m => { const n = { ...m }; delete n[key]; return n })
      }
      toast.success('已儲存')
      setModal(null)
    } else {
      toast.error('儲存失敗')
    }
  }

  // Template management
  function addTemplate() {
    if (!tplTime) { toast.error('請選擇時間'); return }
    if (templates.some(t => t.dayOfWeek === tplDay && t.time === tplTime)) { toast.error('已存在'); return }
    setTemplates(prev => [...prev, { dayOfWeek: tplDay, time: tplTime }].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.time.localeCompare(b.time)))
    setTplTime('')
  }

  function removeTemplate(dow: number, time: string) {
    setTemplates(prev => prev.filter(t => !(t.dayOfWeek === dow && t.time === time)))
  }

  // Logo
  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('圖片不能超過 2MB'); return }
    const reader = new FileReader()
    reader.onload = () => setLogo(reader.result as string)
    reader.readAsDataURL(file)
  }

  // Bank accounts
  function addBankAccount() { setBankAccounts(prev => [...prev, { bankName: '', accountNumber: '', accountName: '' }]) }
  function updateBankAccount(idx: number, field: keyof BankAccount, value: string) {
    setBankAccounts(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b))
  }
  function removeBankAccount(idx: number) { setBankAccounts(prev => prev.filter((_, i) => i !== idx)) }

  // Save global settings
  async function handleSave() {
    setGlobalSaving(true)
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: storeName, logo, address, bookingNotes,
        businessSlots: templates,
        depositEnabled, depositAmount,
        bankAccounts: bankAccounts.filter(b => b.bankName || b.accountNumber),
      }),
    })
    setGlobalSaving(false)
    if (res.ok) {
      toast.success('設定已儲存')
      router.refresh() // refresh server components (sidebar name/logo)
    } else {
      toast.error('儲存失敗')
    }
  }

  if (loading) return <div className="p-6 text-muted-foreground">載入中...</div>

  const tplsByDay = DAYS_ZH.map((_, i) => ({
    day: i,
    slots: templates.filter(t => t.dayOfWeek === i).sort((a, b) => a.time.localeCompare(b.time)),
  }))

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">營業設定</h1>
        </div>
        <Button onClick={handleSave} disabled={globalSaving}>{globalSaving ? '儲存中...' : '儲存設定'}</Button>
      </div>

      {/* ── Store info ── */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wand2 className="w-4 h-4 text-primary" /> 店家資訊</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>店家名稱</Label>
              <Input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="我的美甲工作室" />
            </div>
            <div className="space-y-2">
              <Label>工作室地址</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="台北市大安區忠孝東路..." />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-4">
              {logo ? (
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary/20">
                  <Image src={logo} alt="Logo" fill className="object-cover" unoptimized />
                  <button onClick={() => setLogo(null)} className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Trash2 className="w-5 h-5 text-white" />
                  </button>
                </div>
              ) : (
                <div onClick={() => fileRef.current?.click()} className="w-20 h-20 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary/50 transition-colors">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">上傳</span>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">支援 JPG、PNG，最大 2MB</p>
                <Button variant="outline" size="sm" className="mt-2 gap-1" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-3 h-3" /> 選擇圖片
                </Button>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          </div>
        </CardContent>
      </Card>

      {/* ── Booking notes ── */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> 預約注意事項</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            value={bookingNotes}
            onChange={e => setBookingNotes(e.target.value)}
            rows={4}
            placeholder={`例如：\n• 請勿留長指甲，施術前請先修剪\n• 取消預約需提前 24 小時通知\n• 遲到超過 15 分鐘視為取消`}
          />
          <p className="text-xs text-muted-foreground mt-1.5">客人填寫預約資料前，需閱讀並勾選同意</p>
        </CardContent>
      </Card>

      {/* ── Calendar slot management ── */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">月曆時段管理</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">點擊日期設定當天開放時段或標記公休</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Month nav */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCalMonth(m => subMonths(m, 1))}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="font-bold">{format(calMonth, 'yyyy年M月', { locale: zhTW })}</span>
            <Button variant="ghost" size="icon" onClick={() => setCalMonth(m => addMonths(m, 1))}><ChevronRight className="w-4 h-4" /></Button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1">
            {DAYS_SHORT.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          {calLoading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">載入中...</div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} />)}
              {days.map(day => {
                const key = format(day, 'yyyy-MM-dd')
                const daySlots = slotMap[key] || []
                const closedInfo = closedMap[key]
                const isClosed = closedInfo?.isClosed
                const isPast = isBefore(day, today)
                const isToday = isSameDay(day, new Date())

                return (
                  <button
                    key={key}
                    onClick={() => openDayModal(day)}
                    className={`relative min-h-[72px] p-1.5 rounded-xl text-left transition-all hover:ring-2 hover:ring-primary/30 ${
                      isToday ? 'ring-2 ring-primary/50' : ''
                    } ${isPast ? 'opacity-50' : ''} bg-white border border-border/40`}
                  >
                    <span className={`text-xs font-bold block mb-1 ${isToday ? 'text-primary' : 'text-foreground'}`}>
                      {format(day, 'd')}
                    </span>
                    {isClosed ? (
                      <span className="text-[10px] bg-red-100 text-red-600 rounded px-1 py-0.5 font-medium">公休</span>
                    ) : daySlots.length > 0 ? (
                      <div className="space-y-0.5">
                        {daySlots.slice(0, 2).map(t => (
                          <span key={t} className="block text-[10px] bg-pink-100 text-pink-700 rounded px-1 py-0.5 leading-tight">{t}</span>
                        ))}
                        {daySlots.length > 2 && (
                          <span className="text-[10px] text-muted-foreground">+{daySlots.length - 2}</span>
                        )}
                      </div>
                    ) : null}
                  </button>
                )
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-pink-100 border border-pink-200" />有時段</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-200" />公休</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded ring-2 ring-primary/50" />今天</div>
          </div>
        </CardContent>
      </Card>

      {/* ── Weekly templates ── */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">每週預設時段（套用範本）</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">在月曆日期中點「一鍵帶入」可快速套用，不會自動覆蓋已設定的日期</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <select value={tplDay} onChange={e => setTplDay(Number(e.target.value))} className="text-sm border border-border rounded-xl px-3 py-2 bg-background">
              {DAYS_ZH.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
            <Input type="time" value={tplTime} onChange={e => setTplTime(e.target.value)} className="w-32" />
            <Button onClick={addTemplate} variant="outline" className="gap-1"><Plus className="w-3.5 h-3.5" /> 新增</Button>
          </div>
          <div className="space-y-2">
            {tplsByDay.filter(d => d.slots.length > 0).map(({ day, slots: ts }) => (
              <div key={day} className="flex items-start gap-2">
                <span className="text-xs font-medium text-muted-foreground w-10 pt-1">{DAYS_ZH[day]}</span>
                <div className="flex flex-wrap gap-1.5">
                  {ts.map(s => (
                    <span key={s.time} className="inline-flex items-center gap-1 text-xs bg-accent border border-border rounded-full px-2.5 py-1">
                      {s.time}
                      <button onClick={() => removeTemplate(day, s.time)} className="text-muted-foreground hover:text-destructive transition-colors"><X className="w-2.5 h-2.5" /></button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {templates.length === 0 && <p className="text-sm text-muted-foreground">尚未設定範本</p>}
          </div>
        </CardContent>
      </Card>

      {/* ── Deposit ── */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Banknote className="w-4 h-4 text-primary" /> 訂金設定</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input type="checkbox" id="deposit-toggle" checked={depositEnabled} onChange={e => setDepositEnabled(e.target.checked)} className="accent-primary w-4 h-4" />
            <Label htmlFor="deposit-toggle">啟用訂金功能</Label>
          </div>
          {depositEnabled && (
            <>
              <div className="space-y-2">
                <Label>訂金金額 (NT$)</Label>
                <Input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="500" className="w-40" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>匯款帳戶資訊</Label>
                  <Button variant="outline" size="sm" onClick={addBankAccount} className="gap-1"><Plus className="w-3 h-3" /> 新增帳戶</Button>
                </div>
                {bankAccounts.map((b, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-accent/30 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">銀行名稱</Label>
                        <Input value={b.bankName} onChange={e => updateBankAccount(idx, 'bankName', e.target.value)} placeholder="台灣銀行" className="text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">戶名</Label>
                        <Input value={b.accountName} onChange={e => updateBankAccount(idx, 'accountName', e.target.value)} placeholder="王小明" className="text-sm" />
                      </div>
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">帳號</Label>
                        <Input value={b.accountNumber} onChange={e => updateBankAccount(idx, 'accountNumber', e.target.value)} placeholder="012-345678901234" className="text-sm" />
                      </div>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive shrink-0" onClick={() => removeBankAccount(idx)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Day modal ── */}
      <Dialog open={!!modal} onOpenChange={o => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {modal && format(modal.date, 'M月d日 EEEE', { locale: zhTW })}
            </DialogTitle>
          </DialogHeader>
          {modal && (
            <div className="space-y-4">
              {/* Open / Closed toggle */}
              <div className="flex rounded-xl overflow-hidden border border-border">
                <button
                  onClick={() => setModal(m => m ? { ...m, isClosed: false } : m)}
                  className={`flex-1 py-2 text-sm font-medium transition-all ${!modal.isClosed ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-accent'}`}
                >
                  開放預約
                </button>
                <button
                  onClick={() => setModal(m => m ? { ...m, isClosed: true } : m)}
                  className={`flex-1 py-2 text-sm font-medium transition-all ${modal.isClosed ? 'bg-red-500 text-white' : 'text-muted-foreground hover:bg-accent'}`}
                >
                  設為公休
                </button>
              </div>

              {modal.isClosed ? (
                <div className="space-y-2">
                  <Label className="text-xs">公休備註（選填）</Label>
                  <Input value={modal.note} onChange={e => setModal(m => m ? { ...m, note: e.target.value } : m)} placeholder="例：店休、節日..." />
                </div>
              ) : (
                <>
                  {/* Existing slots */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs">已開放時段</Label>
                      <button onClick={applyWeeklyTemplate} className="text-xs text-primary hover:underline">
                        一鍵帶入{DAYS_ZH[modal.date.getDay()]}預設
                      </button>
                    </div>
                    {modal.slots.length === 0 ? (
                      <p className="text-xs text-muted-foreground">尚未新增時段</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {modal.slots.map(t => (
                          <span key={t} className="inline-flex items-center gap-1 text-xs bg-pink-100 text-pink-700 rounded-full px-2.5 py-1 border border-pink-200">
                            {t}
                            <button onClick={() => removeSlotFromModal(t)} className="hover:text-red-600"><X className="w-2.5 h-2.5" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add slot */}
                  <div className="flex gap-2">
                    <Input
                      type="time"
                      value={modal.newTime}
                      onChange={e => setModal(m => m ? { ...m, newTime: e.target.value } : m)}
                      className="flex-1"
                    />
                    <Button onClick={addSlotToModal} variant="outline" size="sm" className="gap-1 shrink-0">
                      <Plus className="w-3.5 h-3.5" /> 新增
                    </Button>
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>取消</Button>
                <Button className="flex-1 gap-1" onClick={saveModal} disabled={modalSaving}>
                  <Check className="w-3.5 h-3.5" />{modalSaving ? '儲存中...' : '儲存'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

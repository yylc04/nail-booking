'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Sparkles, ChevronLeft, ChevronRight, Check, Banknote, Wand2,
  Lock, CalendarCheck, CalendarClock,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, isSameDay, isBefore, startOfDay,
} from 'date-fns'
import { zhTW } from 'date-fns/locale'
import Image from 'next/image'

interface CartItem { id: string; name: string; price: number; duration: number; qty: number }
interface BankAccount { bankName: string; accountNumber: string; accountName: string }
interface DepositInfo { depositEnabled: boolean; depositAmount: number; bankAccounts: BankAccount[] }
interface StoreInfo {
  name: string; logo?: string; bookingNotes?: string
  bookingReleaseEnabled?: boolean; bookingReleaseDay?: number
  bookingReleaseHour?: number; bookingReleaseNote?: string | null
}

const STEPS = ['選擇服務', '選擇時段', '填寫資料', '完成預約']

export default function CheckoutPage() {
  const params = useParams()
  const router = useRouter()
  const accountId = params.accountId as string

  const [ready, setReady] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [quoteId, setQuoteId] = useState<string | null>(null)
  const [quoteIsHold, setQuoteIsHold] = useState(false)
  const [step, setStep] = useState(1)
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [depositInfo, setDepositInfo] = useState<DepositInfo | null>(null)

  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [calMonth, setCalMonth] = useState(new Date())
  const [monthStatus, setMonthStatus] = useState<Record<string, boolean>>({})
  const [slots, setSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [closed, setClosed] = useState(false)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [lineName, setLineName] = useState('')
  const [lineOrIg, setLineOrIg] = useState('')
  const [notes, setNotes] = useState('')
  const [agreedToNotes, setAgreedToNotes] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [apptId, setApptId] = useState('')
  const [showDeposit, setShowDeposit] = useState(false)
  const [transferCode, setTransferCode] = useState('')
  const [confirmingTransfer, setConfirmingTransfer] = useState(false)

  const totalDuration = cart.reduce((s, i) => s + i.duration * i.qty, 0)
  const totalPrice = cart.reduce((s, i) => s + i.price * i.qty, 0)

  // Read localStorage immediately — no network wait before showing UI
  useEffect(() => {
    const saved = localStorage.getItem('nail_booking_quote_cart')
    if (!saved) { router.replace(`/book/${accountId}/member`); return }
    try {
      const data = JSON.parse(saved)
      localStorage.removeItem('nail_booking_quote_cart')
      if (!data.cart?.length) { router.replace(`/book/${accountId}/member`); return }
      setCart(data.cart)
      if (data.quoteId) setQuoteId(data.quoteId)
      if (data.quoteIsHold && data.holdDate && data.holdTime) {
        setSelectedDate(new Date(`${data.holdDate}T00:00:00`))
        setSelectedSlot(data.holdTime)
        setQuoteIsHold(true)
        setStep(2)
      } else {
        setStep(1)
      }
      setReady(true)
    } catch {
      router.replace(`/book/${accountId}/member`)
    }
  }, [accountId, router]) // eslint-disable-line react-hooks/exhaustive-deps

  // Background fetches — don't block initial render
  useEffect(() => {
    fetch(`/api/book/services?accountId=${accountId}`).then(r => r.json()).then(d => setStore(d.store))
    fetch(`/api/book/deposit-info?accountId=${accountId}`).then(r => r.json()).then(setDepositInfo)
    fetch('/api/book/me').then(r => r.ok ? r.json() : null).then(d => {
      if (d) {
        setName(prev => prev || d.name)
        setPhone(prev => prev || d.phone)
      }
    })
  }, [accountId])

  // Month status for calendar
  useEffect(() => {
    if (step !== 1 || !ready) return
    const year = calMonth.getFullYear()
    const month = calMonth.getMonth() + 1
    fetch(`/api/book/month-status?year=${year}&month=${month}&duration=${totalDuration}&accountId=${accountId}`)
      .then(r => r.json()).then(data => setMonthStatus(data || {}))
  }, [step, calMonth, accountId, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSlots = useCallback(async (date: Date) => {
    setSlotsLoading(true); setSelectedSlot(null); setSlots([])
    const res = await fetch(`/api/book/available-slots?date=${format(date, 'yyyy-MM-dd')}&duration=${totalDuration}&accountId=${accountId}`)
    const data = await res.json()
    setSlots(data.slots || [])
    setClosed(data.closed || false)
    setSlotsLoading(false)
  }, [totalDuration, accountId])

  useEffect(() => {
    if (step === 1 && selectedDate) fetchSlots(selectedDate)
  }, [step, selectedDate, fetchSlots])

  async function handleSubmit() {
    if (!name || !phone || !lineName || !lineOrIg || !selectedDate || !selectedSlot) {
      return toast.error('請填寫所有必填欄位')
    }
    if (store?.bookingNotes && !agreedToNotes) return toast.error('請先勾選同意注意事項')
    setSubmitting(true)
    const services = cart.flatMap(i =>
      Array.from({ length: i.qty }, () => ({ serviceId: i.id, name: i.name, price: i.price, duration: i.duration }))
    )
    const res = await fetch('/api/book/appointments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, phone, lineName, lineOrIg,
        date: format(selectedDate, 'yyyy-MM-dd'),
        startTime: selectedSlot, services, notes, accountId,
        ...(quoteId ? { quoteId } : {}),
      }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { toast.error(data.error || '預約失敗，請重試'); return }
    setApptId(data.id)
    if (depositInfo?.depositEnabled && depositInfo.bankAccounts.length > 0) {
      setShowDeposit(true)
    } else {
      setDone(true); setStep(3)
    }
  }

  async function handleTransferConfirm() {
    if (!transferCode || transferCode.length !== 5) return toast.error('請輸入正確的匯款帳號末五碼（5位數字）')
    if (!/^\d{5}$/.test(transferCode)) return toast.error('末五碼須為 5 位數字')
    setConfirmingTransfer(true)
    const res = await fetch(`/api/appointments/${apptId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transferCode }),
    })
    setConfirmingTransfer(false)
    if (res.ok) { setShowDeposit(false); setDone(true); setStep(3) }
    else toast.error('提交失敗，請重試')
  }

  // Calendar helpers (mirrors main page)
  const today = startOfDay(new Date())
  const monthStart = startOfMonth(calMonth)
  const monthEnd = endOfMonth(calMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad = getDay(monthStart)
  const releaseEnabled = store?.bookingReleaseEnabled ?? false
  const releaseDay = store?.bookingReleaseDay ?? 25
  const releaseHour = store?.bookingReleaseHour ?? 0

  function isDateLocked(date: Date): boolean {
    if (!releaseEnabled) return false
    const now = new Date()
    const todayMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const dateMonth = new Date(date.getFullYear(), date.getMonth(), 1).getTime()
    if (dateMonth <= todayMonth) return false
    const openDate = new Date(date.getFullYear(), date.getMonth() - 1, releaseDay, releaseHour, 0, 0)
    return now < openDate
  }

  function getOpenTimeForDate(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth() - 1, releaseDay, releaseHour, 0, 0)
  }

  const nextReleaseBannerTime: Date | null = (() => {
    if (!releaseEnabled) return null
    const now = new Date()
    const thisMonthOpen = new Date(now.getFullYear(), now.getMonth(), releaseDay, releaseHour, 0, 0)
    return now < thisMonthOpen
      ? thisMonthOpen
      : new Date(now.getFullYear(), now.getMonth() + 1, releaseDay, releaseHour, 0, 0)
  })()

  if (!ready) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <p className="text-sm text-muted-foreground">載入中...</p>
    </div>
  )

  // ── Deposit screen ──
  if (showDeposit && depositInfo) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
              <Banknote className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold">請完成訂金匯款</h2>
            <p className="text-sm text-muted-foreground mt-1">預約已成立，請匯款後填入帳號末五碼</p>
          </div>
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="text-center p-3 bg-amber-50 rounded-xl">
                <p className="text-xs text-muted-foreground">訂金金額</p>
                <p className="text-2xl font-bold text-amber-700">NT$ {depositInfo.depositAmount.toLocaleString()}</p>
              </div>
              {depositInfo.bankAccounts.map((b, i) => (
                <div key={i} className="p-3 bg-accent/40 rounded-xl space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">{b.bankName}</p>
                  <p className="font-mono text-sm font-bold tracking-wide">{b.accountNumber}</p>
                  <p className="text-xs text-muted-foreground">戶名：{b.accountName}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <Label>匯款帳號末五碼</Label>
              <Input
                value={transferCode}
                onChange={e => setTransferCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="請輸入 5 位數字" maxLength={5} inputMode="numeric"
                className="text-center text-xl tracking-widest font-mono"
              />
              <Button className="w-full" onClick={handleTransferConfirm} disabled={confirmingTransfer}>
                {confirmingTransfer ? '提交中...' : '確認已匯款'}
              </Button>
              <Button variant="ghost" className="w-full text-sm text-muted-foreground"
                onClick={() => { setShowDeposit(false); setDone(true); setStep(3) }}>
                稍後再匯款，先完成預約
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ── Success screen ──
  if (done) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center max-w-sm w-full">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">預約成功！</h2>
          <p className="text-muted-foreground mb-1">您的預約編號：</p>
          <p className="text-xs text-muted-foreground font-mono bg-accent/50 rounded-lg px-3 py-1 inline-block mb-4">{apptId}</p>
          <p className="text-sm text-muted-foreground mb-6">
            {format(selectedDate!, 'yyyy年M月d日', { locale: zhTW })} {selectedSlot}<br />
            {cart.map(i => `${i.name}${i.qty > 1 ? ` x${i.qty}` : ''}`).join('、')}
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button variant="outline" onClick={() => router.push(`/book/${accountId}/member`)}>返回會員專區</Button>
            <Button onClick={() => router.push(`/book/${accountId}`)}>再次預約</Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Booking wizard ──
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur border-b border-border/50 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => router.push(`/book/${accountId}/member`)}
              className="p-1.5 rounded-xl hover:bg-accent transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            {store?.logo ? (
              <div className="w-9 h-9 rounded-full overflow-hidden border border-border/50 shrink-0">
                <Image src={store.logo} alt="Logo" width={36} height={36} className="w-full h-full object-cover" unoptimized />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-sm font-bold">{store?.name || '線上預約'}</h1>
              <p className="text-xs text-muted-foreground">線上預約</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            {STEPS.map((_, i) => (
              <div key={i} className="flex items-center flex-1">
                <div className={`flex-1 h-1.5 rounded-full transition-all ${i <= step ? 'bg-primary' : 'bg-border'}`} />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{STEPS[step]}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Step 1: Date & time */}
        {step === 1 && (
          <div className="space-y-4">
            {releaseEnabled && nextReleaseBannerTime && (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200/70">
                <CalendarClock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-amber-800">
                    下次開放預約時間：{format(nextReleaseBannerTime, 'M月d日 HH:00', { locale: zhTW })}
                  </p>
                  {store?.bookingReleaseNote && (
                    <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">{store.bookingReleaseNote}</p>
                  )}
                </div>
              </div>
            )}
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <Button variant="ghost" size="icon" onClick={() => setCalMonth(m => subMonths(m, 1))}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="font-bold">{format(calMonth, 'yyyy年M月', { locale: zhTW })}</span>
                  <Button variant="ghost" size="icon" onClick={() => setCalMonth(m => addMonths(m, 1))}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-7 mb-2">
                  {['日','一','二','三','四','五','六'].map(d => (
                    <div key={d} className="text-center text-xs text-muted-foreground py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} />)}
                  {days.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const past = isBefore(day, today)
                    const locked = isDateLocked(day)
                    const available = monthStatus[dateStr] !== false
                    const isSelected = selectedDate && isSameDay(day, selectedDate)
                    const isToday = isSameDay(day, new Date())
                    const disabled = past || (!locked && !available)
                    return (
                      <button
                        key={day.toISOString()} disabled={disabled}
                        onClick={() => {
                          if (locked) {
                            toast.error(`尚未開放預約，請於 ${format(getOpenTimeForDate(day), 'M月d日 HH:00', { locale: zhTW })} 後再試`)
                            return
                          }
                          setSelectedDate(day); setSelectedSlot(null)
                        }}
                        className={`aspect-square rounded-xl text-sm font-medium transition-all flex items-center justify-center ${
                          disabled ? 'text-muted-foreground/40 cursor-not-allowed' :
                          locked ? 'text-muted-foreground/50 cursor-not-allowed' :
                          isSelected ? 'bg-primary text-white shadow-sm' :
                          isToday ? 'bg-primary/15 text-primary font-semibold' : 'hover:bg-accent'
                        }`}
                      >
                        {locked ? (
                          <span className="flex flex-col items-center gap-0.5">
                            <Lock className="w-3 h-3" />
                            <span className="text-[10px]">{format(day, 'd')}</span>
                          </span>
                        ) : format(day, 'd')}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
            {selectedDate && (
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold mb-3">
                    {format(selectedDate, 'M月d日 EEEE', { locale: zhTW })} 可用時段
                    <span className="text-xs text-muted-foreground ml-2">（共 {totalDuration} 分鐘）</span>
                  </p>
                  {slotsLoading ? (
                    <p className="text-sm text-muted-foreground">載入中...</p>
                  ) : closed ? (
                    <p className="text-sm text-muted-foreground text-center py-4">當天公休</p>
                  ) : slots.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">當天已無可用時段</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {slots.map(slot => (
                        <button key={slot} onClick={() => setSelectedSlot(slot)}
                          className={`min-h-[44px] px-1 rounded-xl text-sm font-medium transition-all border ${
                            selectedSlot === slot
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                              : 'border-border hover:border-primary/50 hover:bg-accent'
                          }`}
                        >{slot}</button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 min-h-[48px]"
                onClick={() => router.push(`/book/${accountId}/member`)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> 返回
              </Button>
              <Button className="flex-1 min-h-[48px]" disabled={!selectedSlot} onClick={() => setStep(2)}>
                下一步 <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Customer info */}
        {step === 2 && (
          <div className="space-y-4">
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-4 space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-primary" /> 填寫預約資料
                </h3>
                <div className="bg-accent/40 rounded-xl p-3 text-sm">
                  <p className="font-medium">{format(selectedDate!, 'yyyy年M月d日', { locale: zhTW })} {selectedSlot}</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    {cart.map(i => `${i.name}${i.qty > 1 ? ` x${i.qty}` : ''}`).join('、')} · {totalDuration}分鐘 · NT$ {totalPrice.toLocaleString()}
                  </p>
                </div>
                {quoteIsHold && selectedDate && selectedSlot && (
                  <div className="flex items-center gap-2 p-2.5 bg-blue-50 rounded-xl border border-blue-200">
                    <CalendarCheck className="w-4 h-4 text-blue-600 shrink-0" />
                    <p className="text-xs text-blue-800">
                      此時段已為您卡位：<strong>{format(selectedDate, 'M月d日', { locale: zhTW })} {selectedSlot}</strong>
                    </p>
                  </div>
                )}
                {depositInfo?.depositEnabled && (
                  <div className="flex items-center gap-2 p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                    <Banknote className="w-4 h-4 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-800">
                      此預約需支付 <strong>NT$ {depositInfo.depositAmount.toLocaleString()}</strong> 訂金（預約後顯示匯款資訊）
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>姓名 <span className="text-destructive">*</span></Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="您的姓名" />
                </div>
                <div className="space-y-2">
                  <Label>手機號碼 <span className="text-destructive">*</span></Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="09xxxxxxxx" type="tel" />
                </div>
                <div className="space-y-2">
                  <Label>Line 名稱 <span className="text-destructive">*</span></Label>
                  <Input value={lineName} onChange={e => setLineName(e.target.value)} placeholder="您的 Line 顯示名稱" />
                </div>
                <div className="space-y-2">
                  <Label>
                    Line ID 或 IG 帳號 <span className="text-destructive">*</span>
                    <span className="text-xs text-muted-foreground font-normal ml-1">（填其中一個即可）</span>
                  </Label>
                  <Input value={lineOrIg} onChange={e => setLineOrIg(e.target.value)} placeholder="Line ID 或 @ig_handle" />
                </div>
                <div className="space-y-2">
                  <Label>備註</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="特殊需求、過敏史等（選填）" rows={2} />
                </div>
              </CardContent>
            </Card>
            {store?.bookingNotes && (
              <Card className="border-amber-200/70 bg-amber-50/50 shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm font-semibold text-amber-900">預約注意事項</p>
                  <div className="text-xs text-amber-800 whitespace-pre-line leading-relaxed bg-white/60 rounded-xl p-3 border border-amber-200/50">
                    {store.bookingNotes}
                  </div>
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox" checked={agreedToNotes}
                      onChange={e => setAgreedToNotes(e.target.checked)}
                      className="mt-0.5 accent-primary w-4 h-4 shrink-0"
                    />
                    <span className="text-xs text-amber-900 font-medium">我已閱讀並同意以上注意事項</span>
                  </label>
                </CardContent>
              </Card>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 min-h-[48px]"
                onClick={() => quoteIsHold ? router.push(`/book/${accountId}/member`) : setStep(1)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> {quoteIsHold ? '返回' : '上一步'}
              </Button>
              <Button
                className="flex-1 min-h-[48px] text-base"
                disabled={submitting || (!!store?.bookingNotes && !agreedToNotes)}
                onClick={handleSubmit}
              >
                {submitting ? '送出中...' : '確認預約'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

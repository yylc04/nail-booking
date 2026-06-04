'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sparkles, ShoppingCart, ChevronLeft, ChevronRight, Check, X, Wand2, Banknote } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isBefore, startOfDay } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import Image from 'next/image'

interface Service { id: string; name: string; price: number; duration: number; description?: string }
interface Category { id: string; name: string; services: Service[] }
interface CartItem extends Service { qty: number }
interface BankAccount { bankName: string; accountNumber: string; accountName: string }
interface DepositInfo { depositEnabled: boolean; depositAmount: number; bankAccounts: BankAccount[] }
interface StoreInfo { name: string; logo?: string; address?: string; bookingNotes?: string }

const STEPS = ['選擇服務', '選擇時段', '填寫資料', '完成預約']

export default function BookPage() {
  const [step, setStep] = useState(0)
  const [categories, setCategories] = useState<Category[]>([])
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [depositInfo, setDepositInfo] = useState<DepositInfo | null>(null)
  const [agreedToNotes, setAgreedToNotes] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [calMonth, setCalMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [slots, setSlots] = useState<string[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [closed, setClosed] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Deposit flow
  const [showDeposit, setShowDeposit] = useState(false)
  const [apptId, setApptId] = useState('')
  const [transferCode, setTransferCode] = useState('')
  const [confirmingTransfer, setConfirmingTransfer] = useState(false)
  const [done, setDone] = useState(false)

  const totalDuration = cart.reduce((s, i) => s + i.duration * i.qty, 0)
  const totalPrice = cart.reduce((s, i) => s + i.price * i.qty, 0)

  useEffect(() => {
    fetch('/api/book/services').then(r => r.json()).then(data => {
      setCategories(data.categories || [])
      setStore(data.store)
    })
    fetch('/api/book/deposit-info').then(r => r.json()).then(setDepositInfo)
  }, [])

  function addToCart(svc: Service) {
    setCart(prev => {
      const idx = prev.findIndex(i => i.id === svc.id)
      if (idx >= 0) return prev.map((i, n) => n === idx ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { ...svc, qty: 1 }]
    })
  }

  function removeFromCart(id: string) {
    setCart(prev => {
      const idx = prev.findIndex(i => i.id === id)
      if (idx < 0) return prev
      if (prev[idx].qty <= 1) return prev.filter((_, n) => n !== idx)
      return prev.map((i, n) => n === idx ? { ...i, qty: i.qty - 1 } : i)
    })
  }

  const fetchSlots = useCallback(async (date: Date) => {
    setSlotsLoading(true); setSelectedSlot(null); setSlots([])
    const res = await fetch(`/api/book/available-slots?date=${format(date, 'yyyy-MM-dd')}&duration=${totalDuration}`)
    const data = await res.json()
    setSlots(data.slots || [])
    setClosed(data.closed || false)
    setSlotsLoading(false)
  }, [totalDuration])

  useEffect(() => {
    if (step === 1 && selectedDate) fetchSlots(selectedDate)
  }, [step, selectedDate, fetchSlots])

  async function handleSubmit() {
    if (!name || !phone || !selectedDate || !selectedSlot) return toast.error('請填寫所有必填欄位')
    if (store?.bookingNotes && !agreedToNotes) return toast.error('請先勾選同意注意事項')
    setSubmitting(true)
    const services = cart.flatMap(i =>
      Array.from({ length: i.qty }, () => ({ serviceId: i.id, name: i.name, price: i.price, duration: i.duration }))
    )
    const res = await fetch('/api/book/appointments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, date: format(selectedDate, 'yyyy-MM-dd'), startTime: selectedSlot, services, notes }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { toast.error(data.error || '預約失敗，請重試'); return }

    setApptId(data.id)
    if (depositInfo?.depositEnabled && depositInfo.bankAccounts.length > 0) {
      setShowDeposit(true)
    } else {
      setDone(true)
      setStep(3)
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

  function resetAll() {
    setStep(0); setCart([]); setSelectedDate(null); setSelectedSlot(null)
    setDone(false); setShowDeposit(false); setApptId(''); setTransferCode('')
    setName(''); setPhone(''); setNotes(''); setAgreedToNotes(false)
  }

  const today = startOfDay(new Date())
  const monthStart = startOfMonth(calMonth)
  const monthEnd = endOfMonth(calMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad = getDay(monthStart)

  // ── Deposit payment screen ──
  if (showDeposit && depositInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF7FB] via-[#FFECF5] to-[#FFD9EC] flex items-center justify-center p-4">
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
                placeholder="請輸入 5 位數字"
                maxLength={5}
                inputMode="numeric"
                className="text-center text-xl tracking-widest font-mono"
              />
              <Button className="w-full" onClick={handleTransferConfirm} disabled={confirmingTransfer}>
                {confirmingTransfer ? '提交中...' : '確認已匯款'}
              </Button>
              <Button variant="ghost" className="w-full text-sm text-muted-foreground" onClick={() => { setShowDeposit(false); setDone(true); setStep(3) }}>
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
      <div className="min-h-screen bg-gradient-to-br from-[#FFF7FB] via-[#FFECF5] to-[#FFD9EC] flex items-center justify-center p-4">
        <div className="text-center max-w-sm w-full">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">預約成功！</h2>
          <p className="text-muted-foreground mb-1">您的預約編號：</p>
          <p className="text-xs text-muted-foreground font-mono bg-accent/50 rounded-lg px-3 py-1 inline-block mb-4">{apptId}</p>
          <p className="text-sm text-muted-foreground mb-4">
            {format(selectedDate!, 'yyyy年M月d日', { locale: zhTW })} {selectedSlot} <br />
            {cart.map(i => `${i.name}${i.qty > 1 ? ` x${i.qty}` : ''}`).join('、')}
          </p>
          {store?.address && (
            <div className="flex items-center justify-center gap-2 text-sm text-foreground bg-white border border-border/50 rounded-xl px-4 py-3 mb-6 shadow-sm">
              <Wand2 className="w-4 h-4 text-primary shrink-0" />
              <span>{store.address}</span>
            </div>
          )}
          <div className="flex gap-3 justify-center flex-wrap">
            <Button variant="outline" onClick={resetAll}>再次預約</Button>
            <Button onClick={() => window.location.href = '/book/login'}>查看我的預約</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF7FB] via-[#FFECF5] to-[#FFD9EC]">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur border-b border-border/50 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            {store?.logo ? (
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-border/50">
                <Image src={store.logo} alt="Logo" width={40} height={40} className="w-full h-full object-cover" unoptimized />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-sm font-bold">{store?.name || 'Blooming♡'}</h1>
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
        {/* Step 0: Service selection */}
        {step === 0 && (
          <div className="space-y-4">
            {categories.map(cat => (
              <div key={cat.id}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-1">{cat.name}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {cat.services.map(svc => {
                    const inCart = cart.find(i => i.id === svc.id)
                    return (
                      <div key={svc.id} className="bg-white rounded-2xl p-3 border border-border/50 flex items-center justify-between gap-2 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{svc.name}</p>
                          <p className="text-xs text-muted-foreground">{svc.duration} 分鐘 · NT$ {svc.price.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {inCart && (
                            <>
                              <button onClick={() => removeFromCart(svc.id)} className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                                <X className="w-3 h-3" />
                              </button>
                              <span className="text-sm font-bold w-5 text-center">{inCart.qty}</span>
                            </>
                          )}
                          <button onClick={() => addToCart(svc)} className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/80 transition-colors">
                            <span className="text-lg leading-none">+</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {cart.length > 0 && (
              <Card className="sticky bottom-4 border-primary/30 shadow-lg shadow-primary/10 bg-white/95 backdrop-blur">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold">{cart.reduce((s, i) => s + i.qty, 0)} 項服務</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{totalDuration} 分鐘</p>
                      <p className="text-sm font-bold text-primary">NT$ {totalPrice.toLocaleString()}</p>
                    </div>
                  </div>
                  <Button className="w-full" onClick={() => setStep(1)}>選擇日期時段</Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step 1: Date & time */}
        {step === 1 && (
          <div className="space-y-4">
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <Button variant="ghost" size="icon" onClick={() => setCalMonth(m => subMonths(m, 1))}><ChevronLeft className="w-4 h-4" /></Button>
                  <span className="font-bold">{format(calMonth, 'yyyy年M月', { locale: zhTW })}</span>
                  <Button variant="ghost" size="icon" onClick={() => setCalMonth(m => addMonths(m, 1))}><ChevronRight className="w-4 h-4" /></Button>
                </div>
                <div className="grid grid-cols-7 mb-2">
                  {['日','一','二','三','四','五','六'].map(d => (
                    <div key={d} className="text-center text-xs text-muted-foreground py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} />)}
                  {days.map(day => {
                    const past = isBefore(day, today)
                    const isSelected = selectedDate && isSameDay(day, selectedDate)
                    const isToday = isSameDay(day, new Date())
                    return (
                      <button
                        key={day.toISOString()} disabled={past}
                        onClick={() => { setSelectedDate(day); setSelectedSlot(null) }}
                        className={`aspect-square rounded-xl text-sm font-medium transition-all flex items-center justify-center ${
                          past ? 'text-muted-foreground/40 cursor-not-allowed' :
                          isSelected ? 'bg-primary text-primary-foreground shadow-sm' :
                          isToday ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
                        }`}
                      >
                        {format(day, 'd')}
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
                    <div className="grid grid-cols-4 gap-2">
                      {slots.map(slot => (
                        <button
                          key={slot} onClick={() => setSelectedSlot(slot)}
                          className={`py-2 px-1 rounded-xl text-sm font-medium transition-all border ${
                            selectedSlot === slot ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'border-border hover:border-primary/50 hover:bg-accent'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(0)}><ChevronLeft className="w-4 h-4 mr-1" /> 上一步</Button>
              <Button className="flex-1" disabled={!selectedSlot} onClick={() => setStep(2)}>下一步 <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </div>
        )}

        {/* Step 2: Customer info */}
        {step === 2 && (
          <div className="space-y-4">
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-4 space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2"><Wand2 className="w-4 h-4 text-primary" /> 填寫預約資料</h3>
                <div className="bg-accent/40 rounded-xl p-3 text-sm">
                  <p className="font-medium">{format(selectedDate!, 'yyyy年M月d日', { locale: zhTW })} {selectedSlot}</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    {cart.map(i => `${i.name}${i.qty > 1 ? ` x${i.qty}` : ''}`).join('、')} · {totalDuration}分鐘 · NT$ {totalPrice.toLocaleString()}
                  </p>
                </div>
                {depositInfo?.depositEnabled && (
                  <div className="flex items-center gap-2 p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                    <Banknote className="w-4 h-4 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-800">此預約需支付 <strong>NT$ {depositInfo.depositAmount.toLocaleString()}</strong> 訂金（預約後顯示匯款資訊）</p>
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
                  <Label>備註</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="特殊需求、過敏史等（選填）" rows={2} />
                </div>
              </CardContent>
            </Card>

            {/* Booking notes agreement */}
            {store?.bookingNotes && (
              <Card className="border-amber-200/70 bg-amber-50/50 shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm font-semibold text-amber-900">預約注意事項</p>
                  <div className="text-xs text-amber-800 whitespace-pre-line leading-relaxed bg-white/60 rounded-xl p-3 border border-amber-200/50">
                    {store.bookingNotes}
                  </div>
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreedToNotes}
                      onChange={e => setAgreedToNotes(e.target.checked)}
                      className="mt-0.5 accent-primary w-4 h-4 shrink-0"
                    />
                    <span className="text-xs text-amber-900 font-medium">我已閱讀並同意以上注意事項</span>
                  </label>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4 mr-1" /> 上一步</Button>
              <Button
                className="flex-1"
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

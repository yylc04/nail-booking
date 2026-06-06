'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import {
  Sparkles, ShoppingCart, ChevronLeft, ChevronRight, Check, X,
  Wand2, Banknote, Plus, MapPin, MessageCircle, AtSign,
  ExternalLink, ImageIcon, Grid3X3, Camera, User, CalendarClock, Lock, CalendarCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, isSameDay, isBefore, startOfDay,
} from 'date-fns'
import { zhTW } from 'date-fns/locale'
import Image from 'next/image'
import Link from 'next/link'

interface Service { id: string; name: string; price: number; duration: number; description?: string }
interface Category { id: string; name: string; services: Service[] }
interface CartItem extends Service { qty: number }
interface BankAccount { bankName: string; accountNumber: string; accountName: string }
interface DepositInfo { depositEnabled: boolean; depositAmount: number; bankAccounts: BankAccount[] }
interface StoreInfo {
  name: string; tagline?: string; logo?: string; address?: string; metroInfo?: string
  lineAccount?: string; igAccount?: string; introduction?: string; bookingNotes?: string
  bookingReleaseEnabled?: boolean; bookingReleaseDay?: number
  bookingReleaseHour?: number; bookingReleaseNote?: string | null
}
interface PortfolioItem {
  id: string; name: string; price: number | null; imageData: string; categoryId: string | null
}
interface InfoBlock { id: string; title: string; content: string }

type Tab = 'portfolio' | 'services' | 'info'
const STEPS = ['選擇服務', '選擇時段', '填寫資料', '完成預約']

export default function BookPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const accountId = params.accountId as string

  const [tab, setTab] = useState<Tab>('portfolio')
  const [step, setStep] = useState(-1) // -1 = browse mode
  const [categories, setCategories] = useState<Category[]>([])
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
  const [storeInfoBlocks, setStoreInfoBlocks] = useState<InfoBlock[]>([])
  const [depositInfo, setDepositInfo] = useState<DepositInfo | null>(null)
  const [agreedToNotes, setAgreedToNotes] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [filterCat, setFilterCat] = useState<string | null>(null)
  const [lightboxItem, setLightboxItem] = useState<PortfolioItem | null>(null)

  // Booking flow state
  const [calMonth, setCalMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [slots, setSlots] = useState<string[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [closed, setClosed] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [lineName, setLineName] = useState('')
  const [lineOrIg, setLineOrIg] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showDeposit, setShowDeposit] = useState(false)
  const [apptId, setApptId] = useState('')
  const [transferCode, setTransferCode] = useState('')
  const [confirmingTransfer, setConfirmingTransfer] = useState(false)
  const [done, setDone] = useState(false)
  const [quoteId, setQuoteId] = useState<string | null>(null)
  const [quoteIsHold, setQuoteIsHold] = useState(false)

  const totalDuration = cart.reduce((s, i) => s + i.duration * i.qty, 0)
  const totalPrice = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const totalQty = cart.reduce((s, i) => s + i.qty, 0)

  useEffect(() => {
    if (!accountId) return
    fetch(`/api/book/services?accountId=${accountId}`).then(r => r.json()).then(data => {
      const cats: Category[] = data.categories || []
      setCategories(cats)
      setStore(data.store)
      setPortfolio(data.portfolio || [])
      setStoreInfoBlocks(data.storeInfoBlocks || [])

      // Handle quote flow URL params: ?customService=&customPrice=&quoteId=&quoteHoldDate=&quoteHoldTime=
      const customService = searchParams.get('customService')
      const customPrice = searchParams.get('customPrice')
      const quoteIdParam = searchParams.get('quoteId')
      const quoteHoldDate = searchParams.get('quoteHoldDate')
      const quoteHoldTime = searchParams.get('quoteHoldTime')
      if (customService && customPrice) {
        const price = parseInt(customPrice, 10)
        const firstSvc = cats.flatMap(c => c.services)[0]
        if (!isNaN(price)) {
          setCart([{
            id: firstSvc?.id || '__quote__',
            name: customService,
            price,
            duration: firstSvc?.duration || 60,
            qty: 1,
          }])
          if (quoteHoldDate && quoteHoldTime) {
            setSelectedDate(new Date(`${quoteHoldDate}T00:00:00`))
            setSelectedSlot(quoteHoldTime)
            setQuoteIsHold(true)
            setStep(2)
          } else {
            setStep(1)
          }
        }
      }
      if (quoteIdParam) setQuoteId(quoteIdParam)
      // Clean URL params
      const url = new URL(window.location.href)
      url.searchParams.delete('customService')
      url.searchParams.delete('customPrice')
      url.searchParams.delete('customNote')
      url.searchParams.delete('quoteId')
      url.searchParams.delete('quoteHoldDate')
      url.searchParams.delete('quoteHoldTime')
      window.history.replaceState({}, '', url.toString())
    })
    fetch(`/api/book/deposit-info?accountId=${accountId}`).then(r => r.json()).then(setDepositInfo)
  }, [accountId]) // eslint-disable-line react-hooks/exhaustive-deps

  function addToCart(svc: Service) {
    setCart(prev => {
      const idx = prev.findIndex(i => i.id === svc.id)
      if (idx >= 0) return prev.map((i, n) => n === idx ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { ...svc, qty: 1 }]
    })
  }

  function addPortfolioToCart(item: PortfolioItem) {
    const catSvcs = categories.find(c => c.id === item.categoryId)?.services
    if (!catSvcs || catSvcs.length === 0) {
      toast('請至「服務項目」選擇服務')
      return
    }
    const svc = catSvcs[0]
    const price = item.price ?? svc.price
    addToCart({ id: svc.id, name: item.name, price, duration: svc.duration })
    toast.success(`已加入：${item.name}`)
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

  function resetAll() {
    setStep(-1); setCart([]); setSelectedDate(null); setSelectedSlot(null)
    setDone(false); setShowDeposit(false); setApptId(''); setTransferCode('')
    setName(''); setPhone(''); setLineName(''); setLineOrIg(''); setNotes(''); setAgreedToNotes(false)
    setQuoteId(null); setQuoteIsHold(false)
  }

  const today = startOfDay(new Date())
  const monthStart = startOfMonth(calMonth)
  const monthEnd = endOfMonth(calMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad = getDay(monthStart)

  // Booking release helpers
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

  // Next release time for banner
  const nextReleaseBannerTime: Date | null = (() => {
    if (!releaseEnabled) return null
    const now = new Date()
    const thisMonthOpen = new Date(now.getFullYear(), now.getMonth(), releaseDay, releaseHour, 0, 0)
    return now < thisMonthOpen
      ? thisMonthOpen
      : new Date(now.getFullYear(), now.getMonth() + 1, releaseDay, releaseHour, 0, 0)
  })()

  // ── Special screens ──
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
              <Input value={transferCode} onChange={e => setTransferCode(e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="請輸入 5 位數字" maxLength={5} inputMode="numeric" className="text-center text-xl tracking-widest font-mono" />
              <Button className="w-full" onClick={handleTransferConfirm} disabled={confirmingTransfer}>{confirmingTransfer ? '提交中...' : '確認已匯款'}</Button>
              <Button variant="ghost" className="w-full text-sm text-muted-foreground" onClick={() => { setShowDeposit(false); setDone(true); setStep(3) }}>稍後再匯款，先完成預約</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

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
          <p className="text-sm text-muted-foreground mb-4">
            {format(selectedDate!, 'yyyy年M月d日', { locale: zhTW })} {selectedSlot}<br />
            {cart.map(i => `${i.name}${i.qty > 1 ? ` x${i.qty}` : ''}`).join('、')}
          </p>
          {store?.address && (
            <div className="flex items-center justify-center gap-2 text-sm bg-white border border-border/50 rounded-xl px-4 py-3 mb-6 shadow-sm">
              <Wand2 className="w-4 h-4 text-primary shrink-0" />
              <span>{store.address}</span>
            </div>
          )}
          <div className="flex gap-3 justify-center flex-wrap">
            <Button variant="outline" onClick={resetAll}>再次預約</Button>
            <Button onClick={() => window.location.href = `/book/login?ref=${accountId}`}>查看我的預約</Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Booking flow (step >= 0) ──
  if (step >= 0) {
    return (
      <div className="min-h-screen bg-white">
        {/* Booking header */}
        <div className="bg-white/80 backdrop-blur border-b border-border/50 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-center gap-3 mb-3">
              <button onClick={resetAll} className="p-1.5 rounded-xl hover:bg-accent transition-colors">
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
                                <button onClick={() => removeFromCart(svc.id)} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-sm font-bold w-5 text-center">{inCart.qty}</span>
                              </>
                            )}
                            <button onClick={() => addToCart(svc)} className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/80 transition-colors">
                              <span className="text-xl leading-none">+</span>
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
                        <span className="text-sm font-semibold">{totalQty} 項服務</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{totalDuration} 分鐘</p>
                        <p className="text-sm font-bold text-primary">NT$ {totalPrice.toLocaleString()}</p>
                      </div>
                    </div>
                    <Button className="w-full min-h-[48px] text-base" onClick={() => setStep(1)}>選擇日期時段</Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 1: Date & time */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Booking release banner */}
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
                    <p className="text-[11px] text-amber-600 mt-0.5">當月時段不受限，可隨時預約</p>
                  </div>
                </div>
              )}
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
                      const locked = isDateLocked(day)
                      const isSelected = selectedDate && isSameDay(day, selectedDate)
                      const isToday = isSameDay(day, new Date())
                      return (
                        <button
                          key={day.toISOString()} disabled={past}
                          onClick={() => {
                            if (locked) {
                              const openTime = getOpenTimeForDate(day)
                              toast.error(`尚未開放預約，請於 ${format(openTime, 'M月d日 HH:00', { locale: zhTW })} 後再試`)
                              return
                            }
                            setSelectedDate(day); setSelectedSlot(null)
                          }}
                          className={`aspect-square rounded-xl text-sm font-medium transition-all flex items-center justify-center ${
                            past ? 'text-muted-foreground/40 cursor-not-allowed' :
                            locked ? 'text-muted-foreground/50 cursor-not-allowed relative' :
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
                    {slotsLoading ? <p className="text-sm text-muted-foreground">載入中...</p>
                      : closed ? <p className="text-sm text-muted-foreground text-center py-4">當天公休</p>
                      : slots.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">當天已無可用時段</p>
                      : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {slots.map(slot => (
                            <button key={slot} onClick={() => setSelectedSlot(slot)}
                              className={`min-h-[44px] px-1 rounded-xl text-sm font-medium transition-all border ${selectedSlot === slot ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'border-border hover:border-primary/50 hover:bg-accent'}`}
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
                <Button variant="outline" className="flex-1 min-h-[48px]" onClick={() => quoteId ? router.back() : setStep(0)}><ChevronLeft className="w-4 h-4 mr-1" /> 上一步</Button>
                <Button className="flex-1 min-h-[48px]" disabled={!selectedSlot} onClick={() => setStep(2)}>下一步 <ChevronRight className="w-4 h-4 ml-1" /></Button>
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
                  {quoteIsHold && selectedDate && selectedSlot && (
                    <div className="flex items-center gap-2 p-2.5 bg-blue-50 rounded-xl border border-blue-200">
                      <CalendarCheck className="w-4 h-4 text-blue-600 shrink-0" />
                      <p className="text-xs text-blue-800">此時段已為您卡位：<strong>{format(selectedDate, 'M月d日', { locale: zhTW })} {selectedSlot}</strong></p>
                    </div>
                  )}
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
                    <Label>Line 名稱 <span className="text-destructive">*</span></Label>
                    <Input value={lineName} onChange={e => setLineName(e.target.value)} placeholder="您的 Line 顯示名稱" />
                  </div>
                  <div className="space-y-2">
                    <Label>Line ID 或 IG 帳號 <span className="text-destructive">*</span><span className="text-xs text-muted-foreground font-normal ml-1">（填其中一個即可）</span></Label>
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
                    <div className="text-xs text-amber-800 whitespace-pre-line leading-relaxed bg-white/60 rounded-xl p-3 border border-amber-200/50">{store.bookingNotes}</div>
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={agreedToNotes} onChange={e => setAgreedToNotes(e.target.checked)} className="mt-0.5 accent-primary w-4 h-4 shrink-0" />
                      <span className="text-xs text-amber-900 font-medium">我已閱讀並同意以上注意事項</span>
                    </label>
                  </CardContent>
                </Card>
              )}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 min-h-[48px]" onClick={() => quoteIsHold ? router.back() : setStep(1)}><ChevronLeft className="w-4 h-4 mr-1" /> 上一步</Button>
                <Button className="flex-1 min-h-[48px] text-base" disabled={submitting || (!!store?.bookingNotes && !agreedToNotes)} onClick={handleSubmit}>
                  {submitting ? '送出中...' : '確認預約'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Browse mode (main page) ──
  const portfolioCats = categories.filter(c => portfolio.some(p => p.categoryId === c.id))
  const filteredPortfolio = filterCat ? portfolio.filter(p => p.categoryId === filterCat) : portfolio

  return (
    <div className="min-h-screen bg-[#faf9f8]">
      {/* ── Store header ── */}
      <div className="bg-white border-b border-border/40">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-4">
          {/* Logo + name + tagline + 會員專區 */}
          <div className="flex items-start justify-between gap-2 mb-4">
            <div className="flex items-center gap-4">
              {store?.logo ? (
                <div className="w-[72px] h-[72px] rounded-full overflow-hidden border-2 border-primary/20 shrink-0 shadow-sm">
                  <Image src={store.logo} alt="Logo" width={72} height={72} className="w-full h-full object-cover" unoptimized />
                </div>
              ) : (
                <div className="w-[72px] h-[72px] rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-foreground">{store?.name || 'Blooming♡'}</h1>
                {store?.tagline && <p className="text-sm text-muted-foreground mt-0.5">{store.tagline}</p>}
              </div>
            </div>
            <Link href={`/book/${accountId}/login`}>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0 mt-1 min-h-[36px] text-xs border-primary/30 text-primary hover:bg-primary/5">
                <User className="w-3.5 h-3.5" /> 會員專區
              </Button>
            </Link>
          </div>

          {/* Introduction */}
          {store?.introduction && (
            <p className="text-sm text-foreground/80 leading-relaxed mb-4 whitespace-pre-line">{store.introduction}</p>
          )}

          {/* Contact / address links */}
          <div className="space-y-1.5">
            {store?.lineAccount && (
              <a
                href={`line://ti/p/${store.lineAccount}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/60 transition-colors group"
              >
                <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                  <MessageCircle className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">LINE 官方帳號</p>
                  <p className="text-xs text-muted-foreground">{store.lineAccount}</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            )}
            {store?.igAccount && (
              <a
                href={`https://instagram.com/${store.igAccount.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/60 transition-colors group"
              >
                <div className="w-8 h-8 rounded-xl bg-pink-100 flex items-center justify-center shrink-0">
                  <AtSign className="w-4 h-4 text-pink-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Instagram</p>
                  <p className="text-xs text-muted-foreground">{store.igAccount}</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            )}
            {store?.address && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(store.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/60 transition-colors group"
              >
                <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{store.address}</p>
                  {store.metroInfo && <p className="text-xs text-muted-foreground">{store.metroInfo}</p>}
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex border-b border-border/40">
            {([['portfolio', '作品集', Grid3X3], ['services', '服務項目', Sparkles], ['info', '店家資訊', Wand2]] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px ${
                  tab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="max-w-2xl mx-auto px-4 py-4 pb-28">

        {/* Portfolio tab */}
        {tab === 'portfolio' && (
          <div className="space-y-4">
            {/* Category filter */}
            {portfolioCats.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                <button
                  onClick={() => setFilterCat(null)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterCat === null ? 'bg-primary text-primary-foreground' : 'bg-white border border-border text-muted-foreground hover:border-primary/50'}`}
                >
                  全部
                </button>
                {portfolioCats.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setFilterCat(filterCat === c.id ? null : c.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterCat === c.id ? 'bg-primary text-primary-foreground' : 'bg-white border border-border text-muted-foreground hover:border-primary/50'}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {filteredPortfolio.length === 0 ? (
              <div className="text-center py-12">
                <ImageIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">尚未有作品</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {filteredPortfolio.map(item => {
                  return (
                    <div key={item.id} className="relative rounded-2xl overflow-hidden border border-border/40 bg-white shadow-sm group">
                      <div className="aspect-square relative cursor-pointer" onClick={() => setLightboxItem(item)}>
                        <Image src={item.imageData} alt={item.name} fill className="object-cover" unoptimized />
                        {/* Quick add button */}
                        {categories.flatMap(c => c.services).filter(s => item.categoryId && categories.find(c => c.id === item.categoryId)?.services.some(sv => sv.id === s.id)).length === 0 && null}
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            addPortfolioToCart(item)
                          }}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/80 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-semibold truncate">{item.name}</p>
                        {item.price != null && <p className="text-xs text-primary font-medium mt-0.5">NT$ {item.price.toLocaleString()}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Quote entry card */}
            <QuoteEntryCard accountId={accountId} />
          </div>
        )}

        {/* Services tab */}
        {tab === 'services' && (
          <div className="space-y-4">
            {categories.map(cat => (
              <div key={cat.id}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-1">{cat.name}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {cat.services.map(svc => {
                    const inCart = cart.find(i => i.id === svc.id)
                    return (
                      <div key={svc.id} className="bg-white rounded-2xl p-3 border border-border/50 flex items-center justify-between gap-2 shadow-sm">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{svc.name}</p>
                          <p className="text-xs text-muted-foreground">{svc.duration} 分鐘 · NT$ {svc.price.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {inCart && (
                            <>
                              <button onClick={() => removeFromCart(svc.id)} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                                <X className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-sm font-bold w-5 text-center">{inCart.qty}</span>
                            </>
                          )}
                          <button onClick={() => addToCart(svc)} className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/80 transition-colors">
                            <span className="text-xl leading-none">+</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            {categories.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground">尚未設定服務項目</div>
            )}

            {/* Quote entry card */}
            <QuoteEntryCard accountId={accountId} />
          </div>
        )}

        {/* Info tab */}
        {tab === 'info' && (
          <div className="space-y-4">
            {/* Fixed: booking notes */}
            {store?.bookingNotes && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200/60 p-4">
                <h3 className="text-sm font-semibold text-amber-900 mb-2">預約注意事項</h3>
                <p className="text-xs text-amber-800 whitespace-pre-line leading-relaxed">{store.bookingNotes}</p>
              </div>
            )}
            {/* Custom blocks */}
            {storeInfoBlocks.map(block => (
              <div key={block.id} className="rounded-2xl bg-white border border-border/50 p-4 shadow-sm">
                <h3 className="text-sm font-semibold mb-2">{block.title}</h3>
                <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{block.content}</p>
              </div>
            ))}
            {!store?.bookingNotes && storeInfoBlocks.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground">尚未設定店家資訊</div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom fixed bar ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-border/40 z-20 safe-bottom">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            {totalQty > 0 ? (
              <>
                <p className="text-xs text-muted-foreground">已選 {totalQty} 項</p>
                <p className="text-sm font-bold text-primary">NT$ {totalPrice.toLocaleString()}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">請先選擇服務</p>
            )}
          </div>
          <Button
            className="min-h-[48px] px-6 text-base font-semibold shrink-0"
            disabled={totalQty === 0}
            onClick={() => { setStep(0) }}
          >
            開始預約
          </Button>
        </div>
      </div>

      {/* ── Lightbox ── */}
      <Dialog open={!!lightboxItem} onOpenChange={o => !o && setLightboxItem(null)}>
        <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl">
          {lightboxItem && (
            <>
              <div className="aspect-square relative">
                <Image src={lightboxItem.imageData} alt={lightboxItem.name} fill className="object-cover" unoptimized />
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold">{lightboxItem.name}</h3>
                  {lightboxItem.price != null && <p className="text-sm text-primary font-medium mt-0.5">NT$ {lightboxItem.price.toLocaleString()}</p>}
                </div>
                <Button
                  className="w-full min-h-[48px]"
                  onClick={() => {
                    addPortfolioToCart(lightboxItem)
                    setLightboxItem(null)
                  }}
                >
                  加入預約
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function QuoteEntryCard({ accountId }: { accountId: string }) {
  return (
    <Link href={`/book/${accountId}/quote`}>
      <div className="flex items-center gap-4 bg-white rounded-2xl border border-primary/20 shadow-sm p-4 hover:shadow-md hover:border-primary/40 transition-all group cursor-pointer">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
          <Camera className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">有想做的款式嗎？</p>
          <p className="text-xs text-muted-foreground mt-0.5">上傳圖片讓店家幫你報價 →</p>
        </div>
      </div>
    </Link>
  )
}

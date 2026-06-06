'use client'

import { useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Search, Clock, CheckCircle2, ImageIcon,
  CalendarCheck, XCircle, AlertCircle, CalendarClock,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import Image from 'next/image'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, isSameDay, isBefore, startOfDay,
} from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface BankAccount { bankName: string; accountNumber: string; accountName: string }
interface DepositInfo { depositEnabled: boolean; depositAmount: number; bankAccounts: BankAccount[] }

interface QuoteReply {
  imageIndex: number
  price: number
  note?: string
}

interface QuoteRecord {
  id: string
  quoteNo: string
  customerName: string
  customerPhone: string
  note: string | null
  images: string[]
  status: 'PENDING' | 'REPLIED' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED'
  quoteMode: 'QUOTE_ONLY' | 'QUOTE_HOLD'
  holdDate: string | null
  holdTime: string | null
  holdUntil: string | null
  quoteReplies: QuoteReply[]
  repliedAt: string | null
  createdAt: string
}

interface Service { id: string; name: string; price: number; duration: number }
interface Category { id: string; name: string; services: Service[] }
type ConfirmStep = 'quote' | 'addons' | 'datetime' | 'confirm'

export default function QuoteStatusPage() {
  const params = useParams()
  const router = useRouter()
  const accountId = params.accountId as string

  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [quotes, setQuotes] = useState<QuoteRecord[] | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  // Multi-step confirm flow
  const [confirmStep, setConfirmStep] = useState<ConfirmStep | null>(null)
  const [confirmQuote, setConfirmQuote] = useState<QuoteRecord | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)

  // Add-on services
  const [categories, setCategories] = useState<Category[]>([])
  const [addOns, setAddOns] = useState<Service[]>([])
  const [servicesLoading, setServicesLoading] = useState(false)

  // Date/time selection (QUOTE_ONLY)
  const [calMonth, setCalMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [slots, setSlots] = useState<string[]>([])
  const [dayClosed, setDayClosed] = useState(false)
  const [slotsLoading, setSlotsLoading] = useState(false)

  // Confirm fields
  const [lineOrIg, setLineOrIg] = useState('')
  const [bookingNotes, setBookingNotes] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [confirmedDeposit, setConfirmedDeposit] = useState<DepositInfo | null>(null)

  // Decline dialog
  const [declineQuote, setDeclineQuote] = useState<QuoteRecord | null>(null)
  const [declining, setDeclining] = useState(false)

  const selectedReply = confirmQuote?.quoteReplies?.find(r => r.imageIndex === selectedImageIndex)
  const addOnsDuration = addOns.reduce((s, a) => s + a.duration, 0)
  const totalDuration = 60 + addOnsDuration
  const basePrice = selectedReply?.price ?? 0
  const addOnsTotal = addOns.reduce((s, a) => s + a.price, 0)
  const grandTotal = basePrice + addOnsTotal

  async function handleSearch() {
    if (!phone.trim()) { toast.error('請輸入電話號碼'); return }
    setLoading(true)
    const res = await fetch(`/api/book/quote?accountId=${accountId}&phone=${encodeURIComponent(phone.trim())}`)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { toast.error(data.error || '查詢失敗'); return }
    setQuotes(data)
    if (data.length === 0) toast('查無詢價紀錄')
  }

  function openConfirmFlow(q: QuoteRecord, imageIndex: number) {
    setConfirmQuote(q)
    setSelectedImageIndex(imageIndex)
    setAddOns([])
    setLineOrIg('')
    setBookingNotes('')
    setSelectedDate(null)
    setSelectedSlot(null)
    setSlots([])
    setCalMonth(new Date())
    setConfirmStep('quote')
  }

  function closeConfirmFlow() {
    setConfirmStep(null)
    setConfirmQuote(null)
    setSelectedImageIndex(null)
  }

  async function loadServices() {
    if (categories.length > 0) return
    setServicesLoading(true)
    const res = await fetch(`/api/book/services?accountId=${accountId}`)
    const data = await res.json()
    setCategories(data.categories || [])
    setServicesLoading(false)
  }

  const fetchSlots = useCallback(async (date: Date, dur: number) => {
    setSlotsLoading(true)
    setSelectedSlot(null)
    setSlots([])
    const res = await fetch(`/api/book/available-slots?date=${format(date, 'yyyy-MM-dd')}&duration=${dur}&accountId=${accountId}`)
    const data = await res.json()
    setSlots(data.slots || [])
    setDayClosed(data.closed || false)
    setSlotsLoading(false)
  }, [accountId])

  async function goNext() {
    if (!confirmQuote) return
    if (confirmStep === 'quote') {
      await loadServices()
      setConfirmStep('addons')
      return
    }
    if (confirmStep === 'addons') {
      if (confirmQuote.quoteMode === 'QUOTE_ONLY') setConfirmStep('datetime')
      else setConfirmStep('confirm')
      return
    }
    if (confirmStep === 'datetime') {
      if (!selectedDate || !selectedSlot) { toast.error('請選擇日期和時段'); return }
      setConfirmStep('confirm')
      return
    }
  }

  function goBack() {
    if (!confirmQuote) return
    if (confirmStep === 'confirm') {
      if (confirmQuote.quoteMode === 'QUOTE_ONLY') setConfirmStep('datetime')
      else setConfirmStep('addons')
      return
    }
    if (confirmStep === 'datetime') { setConfirmStep('addons'); return }
    if (confirmStep === 'addons') { setConfirmStep('quote'); return }
    if (confirmStep === 'quote') { closeConfirmFlow(); return }
  }

  function toggleAddOn(svc: Service) {
    setAddOns(prev =>
      prev.find(a => a.id === svc.id) ? prev.filter(a => a.id !== svc.id) : [...prev, svc]
    )
  }

  async function handleConfirm() {
    if (!confirmQuote || selectedImageIndex === null) return
    if (confirmQuote.quoteMode === 'QUOTE_ONLY' && (!selectedDate || !selectedSlot)) {
      toast.error('請選擇預約日期和時段'); return
    }
    setConfirming(true)
    const res = await fetch(`/api/book/quote?accountId=${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'confirm',
        quoteId: confirmQuote.id,
        selectedImageIndex,
        lineOrIg,
        notes: bookingNotes,
        addOnServices: addOns.map(s => ({ serviceId: s.id, serviceName: s.name, price: s.price, duration: s.duration })),
        ...(confirmQuote.quoteMode === 'QUOTE_ONLY' && selectedDate && selectedSlot
          ? { bookingDate: format(selectedDate, 'yyyy-MM-dd'), bookingTime: selectedSlot }
          : {}),
      }),
    })
    const data = await res.json()
    setConfirming(false)
    if (!res.ok) { toast.error(data.error || '確認失敗'); return }
    setConfirmedDeposit(data.depositInfo)
    closeConfirmFlow()
    handleSearch()
  }

  async function handleDecline() {
    if (!declineQuote) return
    setDeclining(true)
    const res = await fetch(`/api/book/quote?accountId=${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'decline', quoteId: declineQuote.id }),
    })
    setDeclining(false)
    if (!res.ok) { toast.error('操作失敗'); return }
    toast.success('已取消，時段已釋放')
    setDeclineQuote(null)
    handleSearch()
  }

  const statusConfig = {
    PENDING:   { label: '待回覆',    icon: Clock,         cls: 'bg-amber-100 text-amber-700' },
    REPLIED:   { label: '已回覆',    icon: CheckCircle2,  cls: 'bg-green-100 text-green-700' },
    CONFIRMED: { label: '已確認預約', icon: CalendarCheck, cls: 'bg-blue-100 text-blue-700' },
    REJECTED:  { label: '已取消',    icon: XCircle,       cls: 'bg-gray-100 text-gray-500' },
    EXPIRED:   { label: '已過期',    icon: AlertCircle,   cls: 'bg-red-100 text-red-600' },
  }

  const allSteps: ConfirmStep[] = confirmQuote?.quoteMode === 'QUOTE_ONLY'
    ? ['quote', 'addons', 'datetime', 'confirm']
    : ['quote', 'addons', 'confirm']
  const currentStepIdx = confirmStep ? allSteps.indexOf(confirmStep) : 0

  const stepTitles: Record<ConfirmStep, string> = {
    quote: '確認款式',
    addons: '加購服務',
    datetime: '選擇時段',
    confirm: '確認預約',
  }

  const today = startOfDay(new Date())
  const monthStart = startOfMonth(calMonth)
  const monthEnd = endOfMonth(calMonth)
  const calDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad = getDay(monthStart)

  return (
    <div className="min-h-screen bg-[#faf9f8]">
      {/* Header */}
      <div className="bg-white border-b border-border/40 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-xl hover:bg-accent transition-colors">
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div>
            <h1 className="text-base font-bold">查詢報價</h1>
            <p className="text-xs text-muted-foreground">輸入電話查詢詢價結果</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Search */}
        <div className="bg-white rounded-2xl border border-border/50 shadow-sm p-4 space-y-3">
          <Label>電話號碼</Label>
          <div className="flex gap-2">
            <Input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="09xxxxxxxx"
              type="tel"
              className="flex-1"
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={loading} className="gap-1.5 shrink-0 min-h-[44px]">
              <Search className="w-4 h-4" />
              {loading ? '查詢中...' : '查詢'}
            </Button>
          </div>
        </div>

        {/* Deposit success banner */}
        {confirmedDeposit && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-2">
            <p className="text-sm font-bold text-green-800 flex items-center gap-2">
              <CalendarCheck className="w-4 h-4" /> 預約已成立！
            </p>
            {confirmedDeposit.depositEnabled && confirmedDeposit.bankAccounts.length > 0 && (
              <>
                <p className="text-xs text-green-700">請匯款 NT$ {confirmedDeposit.depositAmount.toLocaleString()} 訂金至以下帳戶：</p>
                {confirmedDeposit.bankAccounts.map((b, i) => (
                  <div key={i} className="text-xs text-green-800 bg-green-100/60 rounded-xl p-2.5 space-y-0.5">
                    <p>{b.bankName}</p>
                    <p className="font-mono font-semibold">{b.accountNumber}</p>
                    <p>戶名：{b.accountName}</p>
                  </div>
                ))}
              </>
            )}
            {!confirmedDeposit.depositEnabled && (
              <p className="text-xs text-green-700">店家將與您確認詳細事宜，請等候聯繫。</p>
            )}
          </div>
        )}

        {/* Quote list */}
        {quotes !== null && (
          <div className="space-y-3">
            {quotes.length === 0 ? (
              <div className="text-center py-10">
                <ImageIcon className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">查無此電話的詢價紀錄</p>
              </div>
            ) : (
              quotes.map(q => {
                const sc = statusConfig[q.status]
                const StatusIcon = sc.icon
                return (
                  <div key={q.id} className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
                    {/* Header row */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                      <div>
                        <p className="text-xs text-muted-foreground font-mono">{q.quoteNo}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(q.createdAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${sc.cls}`}>
                          <StatusIcon className="w-3 h-3" />{sc.label}
                        </span>
                        {q.quoteMode === 'QUOTE_HOLD' && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">已卡位</span>
                        )}
                      </div>
                    </div>

                    {/* Hold info */}
                    {q.quoteMode === 'QUOTE_HOLD' && q.holdDate && q.holdTime && q.status !== 'CONFIRMED' && q.status !== 'REJECTED' && (
                      <div className="px-4 pt-3 pb-1">
                        <div className={`rounded-xl p-2.5 text-xs ${q.status === 'EXPIRED' ? 'bg-red-50 border border-red-100 text-red-700' : 'bg-blue-50 border border-blue-100 text-blue-700'}`}>
                          <p className="font-semibold flex items-center gap-1"><CalendarClock className="w-3 h-3" /> 卡位時段：{format(new Date(q.holdDate), 'M月d日', { locale: zhTW })} {q.holdTime}</p>
                          {q.holdUntil && q.status === 'PENDING' && (
                            <p className="mt-0.5 text-amber-700">店家回覆截止：{format(new Date(q.holdUntil), 'M月d日 HH:mm', { locale: zhTW })}</p>
                          )}
                          {q.holdUntil && q.status === 'REPLIED' && (
                            <p className="mt-0.5 text-amber-700">付款截止：{format(new Date(q.holdUntil), 'M月d日 HH:mm', { locale: zhTW })}</p>
                          )}
                          {q.status === 'EXPIRED' && <p className="mt-0.5">保留時間已過，請重新詢價</p>}
                        </div>
                      </div>
                    )}

                    {/* Images — when PENDING/CONFIRMED/REJECTED/EXPIRED: simple thumbnails */}
                    {q.status !== 'REPLIED' && (
                      <div className="px-4 pt-3 pb-2">
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {q.images.map((img, i) => (
                            <div
                              key={i}
                              className="w-20 h-20 rounded-xl overflow-hidden border border-border/40 shrink-0 cursor-pointer"
                              onClick={() => setLightboxSrc(img)}
                            >
                              <Image src={img} alt="詢價圖片" width={80} height={80} className="w-full h-full object-cover" unoptimized />
                            </div>
                          ))}
                        </div>
                        {q.note && (
                          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                            <span className="font-medium text-foreground">說明：</span>{q.note}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Reply block — per-image quotes with 選擇此款 */}
                    {(q.status === 'REPLIED' || q.status === 'CONFIRMED') && (
                      <div className="px-4 pt-3 pb-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-green-800">店家報價</p>
                          {q.repliedAt && (
                            <p className="text-[10px] text-muted-foreground">
                              {format(new Date(q.repliedAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                            </p>
                          )}
                        </div>
                        {q.note && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            <span className="font-medium text-foreground">說明：</span>{q.note}
                          </p>
                        )}
                        <div className="space-y-2">
                          {q.images.map((img, i) => {
                            const reply = q.quoteReplies?.find(r => r.imageIndex === i)
                            return (
                              <div key={i} className={`flex gap-3 items-center rounded-xl p-2.5 border ${reply ? 'bg-green-50 border-green-200/60' : 'bg-gray-50 border-border/40'}`}>
                                <div
                                  className="w-16 h-16 rounded-xl overflow-hidden border border-border/30 shrink-0 cursor-pointer"
                                  onClick={() => setLightboxSrc(img)}
                                >
                                  <Image src={img} alt={`款式 ${i + 1}`} width={64} height={64} className="w-full h-full object-cover" unoptimized />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-muted-foreground mb-0.5">款式 {i + 1}</p>
                                  {reply ? (
                                    <>
                                      <p className="text-base font-bold text-green-700">NT$ {reply.price.toLocaleString()}</p>
                                      {reply.note && <p className="text-xs text-green-800 leading-relaxed mt-0.5">{reply.note}</p>}
                                    </>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">此款不提供</p>
                                  )}
                                </div>
                                {q.status === 'REPLIED' && reply && (
                                  <Button
                                    size="sm"
                                    className="shrink-0 min-h-[36px] text-xs px-3"
                                    onClick={() => openConfirmFlow(q, i)}
                                  >
                                    選擇此款
                                  </Button>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {/* Decline button for QUOTE_HOLD */}
                        {q.status === 'REPLIED' && q.quoteMode === 'QUOTE_HOLD' && (
                          <Button
                            variant="outline"
                            className="w-full min-h-[44px] text-muted-foreground"
                            onClick={() => setDeclineQuote(q)}
                          >
                            不預約（釋放時段）
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        <Button variant="outline" className="w-full" onClick={() => router.push(`/book/${accountId}/quote`)}>
          送出新詢價
        </Button>
      </div>

      {/* Lightbox */}
      <Dialog open={!!lightboxSrc} onOpenChange={o => !o && setLightboxSrc(null)}>
        <DialogContent className="max-w-sm p-2">
          {lightboxSrc && (
            <div className="aspect-square relative rounded-xl overflow-hidden">
              <Image src={lightboxSrc} alt="放大圖" fill className="object-contain" unoptimized />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Multi-step confirm dialog */}
      <Dialog open={!!confirmStep} onOpenChange={o => !o && closeConfirmFlow()}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {confirmStep && stepTitles[confirmStep]}
            </DialogTitle>
            {/* Step progress bar */}
            <div className="flex gap-1 pt-1">
              {allSteps.map((s, i) => (
                <div
                  key={s}
                  className={`flex-1 h-1 rounded-full transition-colors ${i <= currentStepIdx ? 'bg-primary' : 'bg-border'}`}
                />
              ))}
            </div>
          </DialogHeader>

          {/* Step 1: Confirm selected image + price */}
          {confirmStep === 'quote' && confirmQuote && selectedImageIndex !== null && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">已選擇款式，確認報價後繼續</p>
              <div className="flex gap-3 items-center bg-green-50 border border-green-200/60 rounded-xl p-3">
                {confirmQuote.images[selectedImageIndex] && (
                  <div
                    className="w-20 h-20 rounded-xl overflow-hidden border border-border/30 shrink-0 cursor-pointer"
                    onClick={() => setLightboxSrc(confirmQuote.images[selectedImageIndex])}
                  >
                    <Image
                      src={confirmQuote.images[selectedImageIndex]}
                      alt={`款式 ${selectedImageIndex + 1}`}
                      width={80} height={80}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-xs text-green-800 font-semibold mb-0.5">款式 {selectedImageIndex + 1}</p>
                  <p className="text-2xl font-bold text-green-700">NT$ {basePrice.toLocaleString()}</p>
                  {selectedReply?.note && (
                    <p className="text-xs text-green-800 mt-0.5 leading-relaxed">{selectedReply.note}</p>
                  )}
                </div>
              </div>
              {confirmQuote.quoteMode === 'QUOTE_HOLD' && confirmQuote.holdDate && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-2.5 text-xs text-blue-700">
                  <p className="font-semibold">已卡位時段</p>
                  <p>{format(new Date(confirmQuote.holdDate), 'yyyy/MM/dd（EEEE）', { locale: zhTW })} {confirmQuote.holdTime}</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={closeConfirmFlow}>取消</Button>
                <Button className="flex-1 min-h-[44px]" onClick={goNext}>下一步</Button>
              </div>
            </div>
          )}

          {/* Step 2: Add-on services */}
          {confirmStep === 'addons' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">可加購其他服務，或直接點「下一步」跳過</p>
              {servicesLoading ? (
                <p className="text-sm text-muted-foreground text-center py-6">載入中...</p>
              ) : categories.filter(c => c.services.length > 0).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">此店家目前無其他服務項目</p>
              ) : (
                <div className="space-y-3 max-h-[38vh] overflow-y-auto pr-0.5">
                  {categories.filter(c => c.services.length > 0).map(cat => (
                    <div key={cat.id}>
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{cat.name}</p>
                      <div className="space-y-1.5">
                        {cat.services.map(svc => {
                          const isSelected = addOns.some(a => a.id === svc.id)
                          return (
                            <button
                              key={svc.id}
                              onClick={() => toggleAddOn(svc)}
                              className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center gap-2.5 ${
                                isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 bg-white'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                                isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                              }`}>
                                {isSelected && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{svc.name}</p>
                                <p className="text-xs text-muted-foreground">{svc.duration} 分鐘</p>
                              </div>
                              <p className="text-sm font-semibold text-primary shrink-0">+NT$ {svc.price.toLocaleString()}</p>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {addOns.length > 0 && (
                <div className="bg-primary/5 border border-primary/15 rounded-xl p-2.5">
                  <p className="text-xs text-muted-foreground">加購小計</p>
                  <p className="text-sm font-bold text-primary">+NT$ {addOnsTotal.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">報價 + 加購 = NT$ {grandTotal.toLocaleString()}</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={goBack}>上一步</Button>
                <Button className="flex-1 min-h-[44px]" onClick={goNext}>下一步</Button>
              </div>
            </div>
          )}

          {/* Step 3: Date/time selection (QUOTE_ONLY only) */}
          {confirmStep === 'datetime' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">請選擇預約日期與時段（共 {totalDuration} 分鐘）</p>

              {/* Calendar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCalMonth(m => subMonths(m, 1))}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-bold">{format(calMonth, 'yyyy年M月', { locale: zhTW })}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCalMonth(m => addMonths(m, 1))}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-7">
                  {['日','一','二','三','四','五','六'].map(d => (
                    <div key={d} className="text-center text-[10px] text-muted-foreground py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {Array.from({ length: startPad }).map((_, i) => <div key={`pad${i}`} />)}
                  {calDays.map(day => {
                    const isPast = isBefore(day, today)
                    const isSel = selectedDate ? isSameDay(day, selectedDate) : false
                    const isToday = isSameDay(day, new Date())
                    return (
                      <button
                        key={day.toISOString()}
                        disabled={isPast}
                        onClick={() => { setSelectedDate(day); fetchSlots(day, totalDuration) }}
                        className={`aspect-square rounded-lg text-xs font-medium transition-all flex items-center justify-center ${
                          isPast
                            ? 'text-muted-foreground/30 cursor-not-allowed'
                            : isSel
                              ? 'bg-primary text-white'
                              : isToday
                                ? 'bg-primary/15 text-primary font-semibold'
                                : 'hover:bg-accent'
                        }`}
                      >
                        {format(day, 'd')}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Time slots */}
              {selectedDate && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {format(selectedDate, 'M月d日', { locale: zhTW })} 可用時段
                  </p>
                  {slotsLoading ? (
                    <p className="text-xs text-muted-foreground text-center py-3">載入中...</p>
                  ) : dayClosed ? (
                    <p className="text-xs text-muted-foreground text-center py-3">當天公休</p>
                  ) : slots.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">當天已無可用時段</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5">
                      {slots.map(slot => (
                        <button
                          key={slot}
                          onClick={() => setSelectedSlot(slot)}
                          className={`min-h-[36px] rounded-lg text-xs font-medium transition-all border ${
                            selectedSlot === slot
                              ? 'bg-primary text-white border-primary'
                              : 'border-border hover:border-primary/50 hover:bg-accent'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={goBack}>上一步</Button>
                <Button
                  className="flex-1 min-h-[44px]"
                  disabled={!selectedDate || !selectedSlot}
                  onClick={goNext}
                >
                  下一步
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Summary + confirm */}
          {confirmStep === 'confirm' && confirmQuote && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="bg-accent/30 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">預約摘要</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span>款式 {selectedImageIndex !== null ? selectedImageIndex + 1 : ''}</span>
                    <span className="font-medium">NT$ {basePrice.toLocaleString()}</span>
                  </div>
                  {addOns.map(a => (
                    <div key={a.id} className="flex justify-between text-sm text-muted-foreground">
                      <span>{a.name}</span>
                      <span>+NT$ {a.price.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold border-t border-border/50 pt-1.5">
                    <span>總計</span>
                    <span className="text-primary">NT$ {grandTotal.toLocaleString()}</span>
                  </div>
                </div>

                {/* Date/time */}
                {confirmQuote.quoteMode === 'QUOTE_HOLD' && confirmQuote.holdDate && (
                  <p className="text-xs text-muted-foreground pt-0.5">
                    📅 {format(new Date(confirmQuote.holdDate), 'yyyy/MM/dd（EEEE）', { locale: zhTW })} {confirmQuote.holdTime}
                  </p>
                )}
                {confirmQuote.quoteMode === 'QUOTE_ONLY' && selectedDate && selectedSlot && (
                  <p className="text-xs text-muted-foreground pt-0.5">
                    📅 {format(selectedDate, 'yyyy/MM/dd（EEEE）', { locale: zhTW })} {selectedSlot}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">LINE / IG（選填）</Label>
                <Input value={lineOrIg} onChange={e => setLineOrIg(e.target.value)} placeholder="@your_line_id" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">備註（選填）</Label>
                <Textarea value={bookingNotes} onChange={e => setBookingNotes(e.target.value)} rows={2} placeholder="有任何需要告知的事項..." />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={goBack}>上一步</Button>
                <Button className="flex-1 min-h-[44px]" onClick={handleConfirm} disabled={confirming}>
                  {confirming ? '確認中...' : '確認預約'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Decline confirm */}
      <AlertDialog open={!!declineQuote} onOpenChange={o => !o && setDeclineQuote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定不預約？</AlertDialogTitle>
            <AlertDialogDescription>
              取消後，已卡位的時段將立即釋放。此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回</AlertDialogCancel>
            <AlertDialogAction onClick={handleDecline} disabled={declining} className="bg-destructive hover:bg-destructive/90">
              {declining ? '處理中...' : '確定取消'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

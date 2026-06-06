'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  CalendarDays, MessageSquareMore, LogOut, ChevronLeft,
  CalendarCheck, Clock, CheckCircle2, XCircle, AlertCircle, Sparkles, Pencil, Check, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import Image from 'next/image'
import Link from 'next/link'

interface Appointment {
  id: string; date: string; startTime: string; endTime: string; status: string
  totalPrice: number; totalDuration: number; notes?: string
  services: { serviceName: string; price: number }[]
}

interface QuoteReply {
  imageIndex: number
  price: number
  note?: string
  duration?: number
}

interface QuoteRecord {
  id: string; quoteNo: string; note: string | null; images: string[]
  status: 'PENDING' | 'REPLIED' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED'
  quoteMode: 'QUOTE_ONLY' | 'QUOTE_HOLD'
  holdDate: string | null; holdTime: string | null; holdUntil: string | null
  quoteReplies: QuoteReply[]; repliedAt: string | null; createdAt: string
}

interface AddonService { id: string; name: string; price: number; duration: number }
interface AddonCategory { id: string; name: string; services: AddonService[] }
interface AddonCartItem { id: string; name: string; price: number; duration: number; qty: number }

const APPT_STATUS_LABEL: Record<string, string> = {
  PENDING: '待確認', CONFIRMED: '已確認', COMPLETED: '已完成', CANCELLED: '已取消',
}
const APPT_STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
  COMPLETED: 'bg-green-100 text-green-800 border-green-200',
  CANCELLED: 'bg-gray-100 text-gray-600 border-gray-200',
}

const QUOTE_STATUS_CFG = {
  PENDING:   { label: '待回覆',    Icon: Clock,         cls: 'bg-amber-100 text-amber-700' },
  REPLIED:   { label: '已回覆',    Icon: CheckCircle2,  cls: 'bg-green-100 text-green-700' },
  CONFIRMED: { label: '已確認預約', Icon: CalendarCheck, cls: 'bg-blue-100 text-blue-700' },
  REJECTED:  { label: '已取消',    Icon: XCircle,       cls: 'bg-gray-100 text-gray-500' },
  EXPIRED:   { label: '已過期',    Icon: AlertCircle,   cls: 'bg-red-100 text-red-600' },
}

type Tab = 'appointments' | 'quotes'

export default function MemberPage() {
  const params = useParams()
  const router = useRouter()
  const accountId = params.accountId as string

  const [tab, setTab] = useState<Tab>('appointments')
  const [customerName, setCustomerName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [quotes, setQuotes] = useState<QuoteRecord[]>([])
  const [apptLoading, setApptLoading] = useState(true)
  const [quotesLoading, setQuotesLoading] = useState(false)
  const [quotesLoaded, setQuotesLoaded] = useState(false)
  const [cancelId, setCancelId] = useState<string | null>(null)

  const [declineQuote, setDeclineQuote] = useState<QuoteRecord | null>(null)
  const [declining, setDeclining] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  // Add-on modal
  const [showAddonModal, setShowAddonModal] = useState(false)
  const [addonCart, setAddonCart] = useState<AddonCartItem[]>([])
  const [addonQuoteData, setAddonQuoteData] = useState<{ q: QuoteRecord; reply: QuoteReply } | null>(null)
  const [addonCategories, setAddonCategories] = useState<AddonCategory[]>([])
  const [addonServicesLoaded, setAddonServicesLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/book/me').then(r => {
      if (r.status === 401) { router.replace(`/book/${accountId}/login`); return null }
      return r.json()
    }).then(d => { if (d) setCustomerName(d.name) })

    fetch('/api/book/my-bookings').then(r => {
      if (r.status === 401) { router.replace(`/book/${accountId}/login`); return null }
      return r.json()
    }).then(d => { if (d) { setAppointments(d); setApptLoading(false) } })
  }, [accountId, router])

  function loadQuotes() {
    if (quotesLoaded) return
    setQuotesLoading(true)
    fetch(`/api/book/my-quotes?accountId=${accountId}`).then(r => r.json()).then(d => {
      setQuotes(d || [])
      setQuotesLoading(false)
      setQuotesLoaded(true)
    })
  }

  useEffect(() => {
    if (tab === 'quotes') loadQuotes()
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveName() {
    if (!nameInput.trim()) return toast.error('請輸入姓名')
    setSavingName(true)
    const res = await fetch('/api/book/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameInput.trim() }),
    })
    setSavingName(false)
    if (res.ok) {
      setCustomerName(nameInput.trim())
      setEditingName(false)
      toast.success('姓名已更新')
    } else {
      toast.error('更新失敗')
    }
  }

  function startEditName() {
    setNameInput(customerName)
    setEditingName(true)
  }

  async function handleCancelAppt() {
    if (!cancelId) return
    const res = await fetch(`/api/book/cancel/${cancelId}`, { method: 'POST' })
    if (res.ok) {
      toast.success('預約已取消')
      setAppointments(prev => prev.map(a => a.id === cancelId ? { ...a, status: 'CANCELLED' } : a))
    } else {
      const d = await res.json()
      toast.error(d.error || '取消失敗')
    }
    setCancelId(null)
  }

  function selectQuote(q: QuoteRecord, reply: QuoteReply) {
    const serviceName = reply.note?.trim() || '自訂款式'
    const dur = reply.duration || 60
    setAddonCart([{ id: '__quote__', name: serviceName, price: reply.price, duration: dur, qty: 1 }])
    setAddonQuoteData({ q, reply })
    if (!addonServicesLoaded) {
      fetch(`/api/book/services?accountId=${accountId}`)
        .then(r => r.json())
        .then(d => { setAddonCategories(d.categories || []); setAddonServicesLoaded(true) })
    }
    setShowAddonModal(true)
  }

  function proceedToCheckout() {
    if (!addonQuoteData) return
    const { q } = addonQuoteData
    const isHold = q.quoteMode === 'QUOTE_HOLD' && !!q.holdDate && !!q.holdTime
    localStorage.setItem('nail_booking_quote_cart', JSON.stringify({
      cart: addonCart,
      quoteId: q.id,
      quoteIsHold: isHold,
      holdDate: isHold ? format(new Date(q.holdDate!), 'yyyy-MM-dd') : null,
      holdTime: isHold ? q.holdTime : null,
    }))
    router.push(`/book/${accountId}/checkout`)
  }

  const addonTotalPrice = addonCart.reduce((s, i) => s + i.price * i.qty, 0)
  const addonTotalDuration = addonCart.reduce((s, i) => s + i.duration * i.qty, 0)

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
    setQuotesLoaded(false)
    loadQuotes()
  }

  async function handleLogout() {
    await fetch('/api/book/customer-logout', { method: 'POST' })
    router.push(`/book/${accountId}`)
  }

  const deadlineText = (q: QuoteRecord) => {
    if (!q.holdUntil || q.quoteMode !== 'QUOTE_HOLD') return null
    if (q.status === 'PENDING') return `店家回覆截止：${format(new Date(q.holdUntil), 'M月d日 HH:mm', { locale: zhTW })}`
    if (q.status === 'REPLIED') return `付款截止：${format(new Date(q.holdUntil), 'M月d日 HH:mm', { locale: zhTW })}`
    return null
  }

  return (
    <div className="min-h-screen bg-[#faf9f8]">
      {/* Header */}
      <div className="bg-white border-b border-border/40 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href={`/book/${accountId}`} className="p-1.5 rounded-xl hover:bg-accent transition-colors">
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </Link>
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold">會員專區</h1>
              {customerName && (
                <div className="flex items-center gap-1">
                  {editingName ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        className="h-6 text-xs w-28 px-1.5"
                        onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                        autoFocus
                      />
                      <button onClick={handleSaveName} disabled={savingName} className="text-primary hover:text-primary/80 transition-colors">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setEditingName(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">{customerName}</p>
                      <button onClick={startEditName} className="text-muted-foreground hover:text-primary transition-colors">
                        <Pencil className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1 text-muted-foreground min-h-[40px]">
            <LogOut className="w-3.5 h-3.5" /> 登出
          </Button>
        </div>

        {/* Tabs */}
        <div className="max-w-2xl mx-auto px-4 flex border-t border-border/30">
          {([
            ['appointments', '我的預約', CalendarDays],
            ['quotes', '我的詢價', MessageSquareMore],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium border-b-2 transition-all -mb-px ${
                tab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3 pb-20">

        {/* === Appointments Tab === */}
        {tab === 'appointments' && (
          <>
            {apptLoading ? (
              <div className="text-center py-12 text-muted-foreground text-sm">載入中...</div>
            ) : appointments.length === 0 ? (
              <div className="text-center py-12">
                <CalendarDays className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">尚無預約記錄</p>
                <Button className="mt-4" onClick={() => router.push(`/book/${accountId}`)}>立即預約</Button>
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
                        <p className="text-xs text-muted-foreground">{appt.startTime}{appt.endTime ? ` – ${appt.endTime}` : ''}</p>
                      </div>
                      <Badge variant="outline" className={`text-xs ${APPT_STATUS_COLOR[appt.status] || ''}`}>
                        {APPT_STATUS_LABEL[appt.status] || appt.status}
                      </Badge>
                    </div>
                    <div className="bg-accent/40 rounded-xl p-3 mb-3">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {appt.services.map((s, i) => (
                          <span key={i} className="text-xs bg-white border border-border/50 rounded-full px-2.5 py-0.5">{s.serviceName}</span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">{appt.totalDuration} 分鐘</p>
                        <p className="text-sm font-bold text-primary">NT$ {appt.totalPrice.toLocaleString()}</p>
                      </div>
                    </div>
                    {appt.status === 'PENDING' && (
                      <Button variant="outline" size="sm" className="w-full text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => setCancelId(appt.id)}>
                        取消預約
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}

        {/* === Quotes Tab === */}
        {tab === 'quotes' && (
          <>
            {quotesLoading ? (
              <div className="text-center py-12 text-muted-foreground text-sm">載入中...</div>
            ) : quotes.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquareMore className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">尚無詢價記錄</p>
                <Button className="mt-4" onClick={() => router.push(`/book/${accountId}/quote`)}>傳圖詢價</Button>
              </div>
            ) : (
              quotes.map(q => {
                const sc = QUOTE_STATUS_CFG[q.status]
                const StatusIcon = sc.Icon
                const deadline = deadlineText(q)
                return (
                  <div key={q.id} className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                      <div>
                        <p className="text-xs text-muted-foreground font-mono">{q.quoteNo}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(q.createdAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}</p>
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
                          <p className="font-semibold">卡位時段：{format(new Date(q.holdDate), 'M月d日', { locale: zhTW })}（{['日','一','二','三','四','五','六'][new Date(q.holdDate).getDay()]}）{q.holdTime}</p>
                          {deadline && <p className="mt-0.5 text-amber-700">{deadline}</p>}
                          {q.status === 'EXPIRED' && <p className="mt-0.5">保留時間已過，請重新詢價</p>}
                        </div>
                      </div>
                    )}

                    {/* Images — simple thumbnails when not REPLIED */}
                    {q.status !== 'REPLIED' && (
                      <div className="px-4 pt-3 pb-2">
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {q.images.map((img, i) => (
                            <div key={i} className="w-20 h-20 rounded-xl overflow-hidden border border-border/40 shrink-0 cursor-pointer" onClick={() => setLightboxSrc(img)}>
                              <Image src={img} alt="" width={80} height={80} className="w-full h-full object-cover" unoptimized />
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

                    {/* Store reply — per-image quotes with 選擇此款 */}
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
                                      {reply.duration && <p className="text-xs text-muted-foreground mt-0.5">{reply.duration} 分鐘</p>}
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
                                    onClick={() => selectQuote(q, reply)}
                                  >
                                    選擇此款
                                  </Button>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {/* Decline for QUOTE_HOLD */}
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

            <Button variant="outline" className="w-full mt-2" onClick={() => router.push(`/book/${accountId}/quote`)}>
              送出新詢價
            </Button>
          </>
        )}
      </div>

      {/* Cancel appointment dialog */}
      <AlertDialog open={!!cancelId} onOpenChange={o => !o && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認取消預約</AlertDialogTitle>
            <AlertDialogDescription>確定要取消這筆預約嗎？取消後無法復原。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelAppt} className="bg-destructive hover:bg-destructive/90">確認取消</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Decline dialog */}
      <AlertDialog open={!!declineQuote} onOpenChange={o => !o && setDeclineQuote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定不預約？</AlertDialogTitle>
            <AlertDialogDescription>取消後，已卡位的時段將立即釋放。此操作無法復原。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回</AlertDialogCancel>
            <AlertDialogAction onClick={handleDecline} disabled={declining} className="bg-destructive hover:bg-destructive/90">
              {declining ? '處理中...' : '確定取消'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add-on modal */}
      {showAddonModal && addonQuoteData && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddonModal(false)} />
          <div className="relative z-10 bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg flex flex-col max-h-[88vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/40 shrink-0">
              <div>
                <h2 className="text-base font-bold">加購服務</h2>
                <p className="text-xs text-muted-foreground">可選擇加購其他服務項目</p>
              </div>
              <button
                onClick={() => setShowAddonModal(false)}
                className="w-8 h-8 rounded-full bg-accent flex items-center justify-center hover:bg-accent/80 transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Selected quote item */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">已選擇款式</p>
                <div className="bg-accent/40 rounded-2xl p-3 flex items-center gap-3">
                  {addonQuoteData.q.images[addonQuoteData.reply.imageIndex] && (
                    <div className="w-14 h-14 rounded-xl overflow-hidden border border-border/30 shrink-0">
                      <Image
                        src={addonQuoteData.q.images[addonQuoteData.reply.imageIndex]}
                        alt="款式圖片" width={56} height={56}
                        className="w-full h-full object-cover" unoptimized
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{addonCart[0]?.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{addonCart[0]?.duration} 分鐘</p>
                  </div>
                  <p className="text-primary font-bold text-sm shrink-0">
                    NT$ {addonCart[0]?.price.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Add-on services */}
              {addonCategories.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">加購服務（選填）</p>
                  <div className="space-y-3">
                    {addonCategories.map(cat => (
                      <div key={cat.id} className="bg-white rounded-2xl border border-border/50 overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-border/30">
                          <p className="text-sm font-semibold">{cat.name}</p>
                        </div>
                        <div className="divide-y divide-border/20">
                          {cat.services.map(svc => {
                            const item = addonCart.find(i => i.id === svc.id)
                            const qty = item?.qty ?? 0
                            return (
                              <div key={svc.id} className="px-4 py-3 flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">{svc.name}</p>
                                  <p className="text-xs text-muted-foreground">{svc.duration} 分鐘・NT$ {svc.price.toLocaleString()}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {qty > 0 && (
                                    <>
                                      <button
                                        onClick={() => {
                                          if (qty === 1) setAddonCart(prev => prev.filter(i => i.id !== svc.id))
                                          else setAddonCart(prev => prev.map(i => i.id === svc.id ? { ...i, qty: i.qty - 1 } : i))
                                        }}
                                        className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-base leading-none hover:bg-accent transition-colors"
                                      >−</button>
                                      <span className="text-sm font-semibold w-4 text-center">{qty}</span>
                                    </>
                                  )}
                                  <button
                                    onClick={() => {
                                      if (qty === 0) setAddonCart(prev => [...prev, { id: svc.id, name: svc.name, price: svc.price, duration: svc.duration, qty: 1 }])
                                      else setAddonCart(prev => prev.map(i => i.id === svc.id ? { ...i, qty: i.qty + 1 } : i))
                                    }}
                                    className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-base leading-none hover:bg-primary/90 transition-colors"
                                  >+</button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!addonServicesLoaded && <p className="text-xs text-muted-foreground text-center py-2">載入服務中...</p>}
            </div>

            {/* Sticky bottom */}
            <div className="shrink-0 border-t border-border/40 px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">總金額</p>
                  <p className="text-xl font-bold text-primary">NT$ {addonTotalPrice.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">總時長</p>
                  <p className="text-sm font-semibold">{addonTotalDuration} 分鐘</p>
                </div>
              </div>
              <Button className="w-full min-h-[48px] text-base" onClick={proceedToCheckout}>
                {addonQuoteData.q.quoteMode === 'QUOTE_HOLD' ? '前往填寫資料' : '選擇預約時段'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Image lightbox */}
      <Dialog open={!!lightboxSrc} onOpenChange={o => !o && setLightboxSrc(null)}>
        <DialogContent className="max-w-sm p-2">
          {lightboxSrc && (
            <div className="aspect-square relative rounded-xl overflow-hidden">
              <Image src={lightboxSrc} alt="" fill className="object-contain" unoptimized />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

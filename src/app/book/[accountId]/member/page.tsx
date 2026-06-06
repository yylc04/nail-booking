'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  CalendarDays, MessageSquareMore, LogOut, ChevronLeft,
  CalendarCheck, Clock, CheckCircle2, XCircle, AlertCircle, Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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

interface QuoteRecord {
  id: string; quoteNo: string; note: string | null; images: string[]
  status: 'PENDING' | 'REPLIED' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED'
  quoteMode: 'QUOTE_ONLY' | 'QUOTE_HOLD'
  holdDate: string | null; holdTime: string | null; holdUntil: string | null
  replyPrice: number | null; replyNote: string | null; repliedAt: string | null; createdAt: string
}

interface BankAccount { bankName: string; accountNumber: string; accountName: string }
interface DepositInfo { depositEnabled: boolean; depositAmount: number; bankAccounts: BankAccount[] }

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
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [quotes, setQuotes] = useState<QuoteRecord[]>([])
  const [apptLoading, setApptLoading] = useState(true)
  const [quotesLoading, setQuotesLoading] = useState(false)
  const [quotesLoaded, setQuotesLoaded] = useState(false)
  const [cancelId, setCancelId] = useState<string | null>(null)

  // Quote confirm dialog
  const [confirmQuote, setConfirmQuote] = useState<QuoteRecord | null>(null)
  const [lineOrIg, setLineOrIg] = useState('')
  const [bookingNotes, setBookingNotes] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [confirmedDeposit, setConfirmedDeposit] = useState<DepositInfo | null>(null)

  // Quote decline dialog
  const [declineQuote, setDeclineQuote] = useState<QuoteRecord | null>(null)
  const [declining, setDeclining] = useState(false)

  // Image lightbox
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

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

  async function handleConfirm() {
    if (!confirmQuote) return
    setConfirming(true)
    const res = await fetch(`/api/book/quote?accountId=${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm', quoteId: confirmQuote.id, lineOrIg, notes: bookingNotes }),
    })
    const data = await res.json()
    setConfirming(false)
    if (!res.ok) { toast.error(data.error || '確認失敗'); return }
    setConfirmedDeposit(data.depositInfo)
    setConfirmQuote(null)
    setQuotesLoaded(false)
    loadQuotes()
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
              {customerName && <p className="text-xs text-muted-foreground">{customerName}</p>}
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

                    {/* Images */}
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

                    {/* Store reply */}
                    {(q.status === 'REPLIED' || q.status === 'CONFIRMED') && (
                      <div className="mx-4 mb-4 mt-1 rounded-xl bg-green-50 border border-green-200/60 p-3 space-y-2">
                        <p className="text-xs font-semibold text-green-800">店家回覆</p>
                        {q.replyPrice != null && (
                          <p className="text-lg font-bold text-green-700">NT$ {q.replyPrice.toLocaleString()}</p>
                        )}
                        {q.replyNote && <p className="text-xs text-green-800 leading-relaxed">{q.replyNote}</p>}
                        {q.repliedAt && (
                          <p className="text-[10px] text-green-600">回覆時間：{format(new Date(q.repliedAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}</p>
                        )}

                        {/* QUOTE_HOLD: confirm / decline */}
                        {q.quoteMode === 'QUOTE_HOLD' && q.status === 'REPLIED' && (
                          <div className="flex gap-2 pt-1">
                            <Button
                              className="flex-1 min-h-[44px]"
                              onClick={() => { setConfirmQuote(q); setLineOrIg(''); setBookingNotes('') }}
                            >
                              <CalendarCheck className="w-4 h-4 mr-1.5" /> 確認預約
                            </Button>
                            <Button variant="outline" className="flex-1 min-h-[44px] text-muted-foreground" onClick={() => setDeclineQuote(q)}>
                              不預約
                            </Button>
                          </div>
                        )}

                        {/* QUOTE_ONLY: book now */}
                        {q.quoteMode === 'QUOTE_ONLY' && q.replyPrice != null && q.status === 'REPLIED' && (
                          <Button className="w-full min-h-[44px] mt-1" onClick={() => router.push(`/book/${accountId}?customService=${encodeURIComponent('自訂款式')}&customPrice=${q.replyPrice}&customNote=${encodeURIComponent(q.replyNote || '')}`)}>
                            立即預約
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

      {/* Confirm quote dialog */}
      <Dialog open={!!confirmQuote} onOpenChange={o => !o && setConfirmQuote(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>確認預約</DialogTitle></DialogHeader>
          {confirmQuote && (
            <div className="space-y-4">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-sm space-y-1">
                <p className="font-semibold text-primary">
                  {confirmQuote.holdDate && format(new Date(confirmQuote.holdDate), 'yyyy/MM/dd（EEEE）', { locale: zhTW })} {confirmQuote.holdTime}
                </p>
                {confirmQuote.replyPrice != null && (
                  <p className="text-foreground">費用：NT$ {confirmQuote.replyPrice.toLocaleString()}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs">LINE / IG（選填）</Label>
                <Input value={lineOrIg} onChange={e => setLineOrIg(e.target.value)} placeholder="@your_line_id" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">備註（選填）</Label>
                <Textarea value={bookingNotes} onChange={e => setBookingNotes(e.target.value)} rows={2} placeholder="有任何需要告知的事項..." />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmQuote(null)}>取消</Button>
                <Button className="flex-1" onClick={handleConfirm} disabled={confirming}>
                  {confirming ? '確認中...' : '確認預約'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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

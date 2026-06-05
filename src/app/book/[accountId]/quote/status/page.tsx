'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Search, Clock, CheckCircle2, ImageIcon, CalendarCheck, XCircle, AlertCircle } from 'lucide-react'
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
import { format, differenceInSeconds } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface BankAccount { bankName: string; accountNumber: string; accountName: string }
interface DepositInfo { depositEnabled: boolean; depositAmount: number; bankAccounts: BankAccount[] }

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
  replyPrice: number | null
  replyNote: string | null
  repliedAt: string | null
  createdAt: string
}

function Countdown({ holdUntil }: { holdUntil: string }) {
  const [secs, setSecs] = useState(() => differenceInSeconds(new Date(holdUntil), new Date()))
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    ref.current = setInterval(() => {
      setSecs(differenceInSeconds(new Date(holdUntil), new Date()))
    }, 1000)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [holdUntil])
  if (secs <= 0) return <span className="text-red-600 font-medium">已過期</span>
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return (
    <span className="font-mono text-amber-700">
      {h > 0 ? `${h}h ` : ''}{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  )
}

export default function QuoteStatusPage() {
  const params = useParams()
  const router = useRouter()
  const accountId = params.accountId as string

  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [quotes, setQuotes] = useState<QuoteRecord[] | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  // Confirm dialog
  const [confirmQuote, setConfirmQuote] = useState<QuoteRecord | null>(null)
  const [lineOrIg, setLineOrIg] = useState('')
  const [bookingNotes, setBookingNotes] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [confirmedDeposit, setConfirmedDeposit] = useState<DepositInfo | null>(null)

  // Decline dialog
  const [declineQuote, setDeclineQuote] = useState<QuoteRecord | null>(null)
  const [declining, setDeclining] = useState(false)

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

  function handleBookNow(q: QuoteRecord) {
    const price = q.replyPrice ?? 0
    router.push(`/book/${accountId}?customService=${encodeURIComponent('自訂款式')}&customPrice=${price}&customNote=${encodeURIComponent(q.replyNote || '')}`)
  }

  const statusConfig = {
    PENDING: { label: '待回覆', icon: Clock, cls: 'bg-amber-100 text-amber-700' },
    REPLIED: { label: '已回覆', icon: CheckCircle2, cls: 'bg-green-100 text-green-700' },
    CONFIRMED: { label: '已確認預約', icon: CalendarCheck, cls: 'bg-blue-100 text-blue-700' },
    REJECTED: { label: '已取消', icon: XCircle, cls: 'bg-gray-100 text-gray-500' },
    EXPIRED: { label: '已過期', icon: AlertCircle, cls: 'bg-red-100 text-red-600' },
  }

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

        {/* Deposit success */}
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
            {(!confirmedDeposit.depositEnabled) && (
              <p className="text-xs text-green-700">店家將與您確認詳細事宜，請等候聯繫。</p>
            )}
          </div>
        )}

        {/* Results */}
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
                          <p className="font-semibold">卡位時段：{format(new Date(q.holdDate), 'yyyy/MM/dd', { locale: zhTW })} {q.holdTime}</p>
                          {q.holdUntil && q.status !== 'EXPIRED' && (
                            <p className="mt-0.5">保留截止：<Countdown holdUntil={q.holdUntil} /></p>
                          )}
                          {q.status === 'EXPIRED' && <p className="mt-0.5">保留時間已過，請重新詢價</p>}
                        </div>
                      </div>
                    )}

                    {/* Images */}
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

                    {/* Reply */}
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
                              className="flex-1 min-h-[44px] bg-primary text-white"
                              onClick={() => { setConfirmQuote(q); setLineOrIg(''); setBookingNotes('') }}
                            >
                              <CalendarCheck className="w-4 h-4 mr-1.5" /> 確認預約
                            </Button>
                            <Button
                              variant="outline"
                              className="flex-1 min-h-[44px] text-muted-foreground"
                              onClick={() => setDeclineQuote(q)}
                            >
                              不預約
                            </Button>
                          </div>
                        )}

                        {/* QUOTE_ONLY: book now */}
                        {q.quoteMode === 'QUOTE_ONLY' && q.replyPrice != null && (
                          <Button className="w-full min-h-[44px] mt-1" onClick={() => handleBookNow(q)}>
                            立即預約
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

      {/* Confirm booking dialog */}
      <Dialog open={!!confirmQuote} onOpenChange={o => !o && setConfirmQuote(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>確認預約</DialogTitle>
          </DialogHeader>
          {confirmQuote && (
            <div className="space-y-4">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-sm space-y-1">
                <p className="font-semibold text-primary">
                  {confirmQuote.holdDate && format(new Date(confirmQuote.holdDate), 'yyyy/MM/dd（EEEE）', { locale: zhTW })}
                  {' '}{confirmQuote.holdTime}
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

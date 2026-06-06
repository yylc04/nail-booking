'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ChevronLeft, Search, Clock, CheckCircle2, ImageIcon,
  CalendarCheck, XCircle, AlertCircle, CalendarClock,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import Image from 'next/image'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface QuoteReply {
  imageIndex: number
  price: number
  note?: string
  duration?: number
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

export default function QuoteStatusPage() {
  const params = useParams()
  const router = useRouter()
  const accountId = params.accountId as string

  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [quotes, setQuotes] = useState<QuoteRecord[] | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

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

  function selectQuote(q: QuoteRecord, reply: QuoteReply) {
    const serviceName = reply.note?.trim() || '自訂款式'
    const params = new URLSearchParams({
      customService: serviceName,
      customPrice: String(reply.price),
      quoteId: q.id,
    })
    if (reply.duration) params.set('customDuration', String(reply.duration))
    if (q.quoteMode === 'QUOTE_HOLD' && q.holdDate && q.holdTime) {
      params.set('quoteHoldDate', format(new Date(q.holdDate), 'yyyy-MM-dd'))
      params.set('quoteHoldTime', q.holdTime)
    }
    router.push(`/book/${accountId}?${params.toString()}`)
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

                    {/* Images — simple thumbnails when not REPLIED */}
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

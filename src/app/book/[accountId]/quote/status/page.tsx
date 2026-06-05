'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Search, Clock, CheckCircle2, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import Image from 'next/image'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface QuoteRecord {
  id: string
  quoteNo: string
  customerName: string
  note: string | null
  images: string[]
  status: 'PENDING' | 'REPLIED'
  replyPrice: number | null
  replyNote: string | null
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

  function handleBookNow(q: QuoteRecord) {
    const price = q.replyPrice ?? 0
    router.push(`/book/${accountId}?customService=${encodeURIComponent('自訂款式')}&customPrice=${price}&customNote=${encodeURIComponent(q.replyNote || '')}`)
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

        {/* Results */}
        {quotes !== null && (
          <div className="space-y-3">
            {quotes.length === 0 ? (
              <div className="text-center py-10">
                <ImageIcon className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">查無此電話的詢價紀錄</p>
              </div>
            ) : (
              quotes.map(q => (
                <div key={q.id} className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
                  {/* Header row */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                    <div>
                      <p className="text-xs text-muted-foreground font-mono">{q.quoteNo}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(q.createdAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                      q.status === 'REPLIED'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {q.status === 'REPLIED'
                        ? <><CheckCircle2 className="w-3 h-3" />已回覆</>
                        : <><Clock className="w-3 h-3" />待回覆</>
                      }
                    </span>
                  </div>

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
                  {q.status === 'REPLIED' && (
                    <div className="mx-4 mb-4 mt-1 rounded-xl bg-green-50 border border-green-200/60 p-3 space-y-2">
                      <p className="text-xs font-semibold text-green-800">店家回覆</p>
                      {q.replyPrice != null && (
                        <p className="text-lg font-bold text-green-700">NT$ {q.replyPrice.toLocaleString()}</p>
                      )}
                      {q.replyNote && (
                        <p className="text-xs text-green-800 leading-relaxed">{q.replyNote}</p>
                      )}
                      {q.repliedAt && (
                        <p className="text-[10px] text-green-600">
                          回覆時間：{format(new Date(q.repliedAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                        </p>
                      )}
                      {q.replyPrice != null && (
                        <Button
                          className="w-full min-h-[44px] mt-1"
                          onClick={() => handleBookNow(q)}
                        >
                          立即預約
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))
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
    </div>
  )
}

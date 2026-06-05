'use client'

import { useState, useEffect } from 'react'
import { MessageSquareMore, Clock, CheckCircle2, Search, X, ZoomIn } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'

interface QuoteItem {
  id: string
  quoteNo: string
  customerName: string
  customerPhone: string
  note: string | null
  images: string[]
  status: 'PENDING' | 'REPLIED'
  replyPrice: number | null
  replyNote: string | null
  repliedAt: string | null
  createdAt: string
}

type Filter = 'ALL' | 'PENDING' | 'REPLIED'

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<QuoteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('PENDING')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<QuoteItem | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  // Reply form
  const [replyPrice, setReplyPrice] = useState('')
  const [replyNote, setReplyNote] = useState('')
  const [replying, setReplying] = useState(false)

  async function loadQuotes(f: Filter) {
    setLoading(true)
    const q = f === 'ALL' ? '' : `?status=${f}`
    const res = await fetch(`/api/quotes${q}`)
    const data = await res.json()
    setQuotes(data || [])
    setLoading(false)
  }

  useEffect(() => { loadQuotes(filter) }, [filter])

  function openDetail(q: QuoteItem) {
    setSelected(q)
    setReplyPrice(q.replyPrice != null ? String(q.replyPrice) : '')
    setReplyNote(q.replyNote || '')
  }

  async function handleReply() {
    if (!selected) return
    if (!replyNote.trim() && !replyPrice) {
      toast.error('請填寫報價金額或回覆說明')
      return
    }
    setReplying(true)
    const res = await fetch(`/api/quotes/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        replyPrice: replyPrice ? Number(replyPrice) : null,
        replyNote: replyNote.trim(),
      }),
    })
    setReplying(false)
    if (!res.ok) { toast.error('回覆失敗'); return }
    toast.success('回覆已送出')
    setSelected(null)
    loadQuotes(filter)
  }

  const filtered = quotes.filter(q => {
    if (!search) return true
    const s = search.toLowerCase()
    return q.customerName.toLowerCase().includes(s)
      || q.customerPhone.includes(s)
      || q.quoteNo.toLowerCase().includes(s)
  })

  const pendingCount = quotes.filter(q => q.status === 'PENDING').length

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <MessageSquareMore className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">詢價管理</h1>
          <p className="text-xs text-muted-foreground">
            {pendingCount > 0 ? `${pendingCount} 筆待回覆` : '所有詢價已回覆'}
          </p>
        </div>
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex rounded-xl overflow-hidden border border-border shrink-0">
          {(['ALL', 'PENDING', 'REPLIED'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm font-medium transition-all min-h-[40px] ${
                filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {f === 'ALL' ? '全部' : f === 'PENDING' ? '待回覆' : '已回覆'}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜尋姓名、電話、編號..."
            className="pl-9"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground text-sm">載入中...</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">
          {search ? '查無符合結果' : '目前無詢價記錄'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(q => (
            <button
              key={q.id}
              onClick={() => openDetail(q)}
              className="w-full text-left bg-white rounded-2xl border border-border/50 shadow-sm hover:shadow-md hover:border-primary/30 transition-all p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{q.customerName}</span>
                    <span className="text-xs text-muted-foreground">{q.customerPhone}</span>
                    <span className="text-xs font-mono text-muted-foreground/70">{q.quoteNo}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(q.createdAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                  </p>
                  {q.note && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{q.note}</p>
                  )}
                </div>
                <div className="shrink-0 flex flex-col items-end gap-2">
                  <Badge variant={q.status === 'REPLIED' ? 'default' : 'secondary'}
                    className={q.status === 'REPLIED'
                      ? 'bg-green-100 text-green-700 hover:bg-green-100'
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                    }
                  >
                    {q.status === 'REPLIED'
                      ? <><CheckCircle2 className="w-3 h-3 mr-1" />已回覆</>
                      : <><Clock className="w-3 h-3 mr-1" />待回覆</>
                    }
                  </Badge>
                  <div className="flex gap-1">
                    {q.images.slice(0, 3).map((img, i) => (
                      <div key={i} className="w-8 h-8 rounded-lg overflow-hidden border border-border/40">
                        <Image src={img} alt="" width={32} height={32} className="w-full h-full object-cover" unoptimized />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{selected?.quoteNo}</span>
              {selected && (
                <Badge className={selected.status === 'REPLIED'
                  ? 'bg-green-100 text-green-700 text-xs'
                  : 'bg-amber-100 text-amber-700 text-xs'
                }>
                  {selected.status === 'REPLIED' ? '已回覆' : '待回覆'}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              {/* Customer info */}
              <div className="bg-accent/30 rounded-xl p-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">姓名</p>
                  <p className="font-medium">{selected.customerName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">電話</p>
                  <p className="font-medium">{selected.customerPhone}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">送出時間</p>
                  <p className="font-medium">{format(new Date(selected.createdAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}</p>
                </div>
              </div>

              {/* Images */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">客人上傳圖片</p>
                <div className="grid grid-cols-3 gap-2">
                  {selected.images.map((img, i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-xl overflow-hidden border border-border/40 relative group cursor-pointer"
                      onClick={() => setLightboxSrc(img)}
                    >
                      <Image src={img} alt="" fill className="object-cover" unoptimized />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ZoomIn className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customer note */}
              {selected.note && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">客人說明</p>
                  <p className="text-sm text-foreground bg-accent/30 rounded-xl p-3 leading-relaxed">{selected.note}</p>
                </div>
              )}

              {/* Existing reply */}
              {selected.status === 'REPLIED' && (
                <div className="rounded-xl bg-green-50 border border-green-200/60 p-3 space-y-1">
                  <p className="text-xs font-semibold text-green-800">已回覆</p>
                  {selected.replyPrice != null && (
                    <p className="text-lg font-bold text-green-700">NT$ {selected.replyPrice.toLocaleString()}</p>
                  )}
                  {selected.replyNote && <p className="text-xs text-green-800">{selected.replyNote}</p>}
                  {selected.repliedAt && (
                    <p className="text-[10px] text-green-600">{format(new Date(selected.repliedAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}</p>
                  )}
                </div>
              )}

              {/* Reply form */}
              <div className="space-y-3 pt-1 border-t border-border/40">
                <p className="text-sm font-semibold">
                  {selected.status === 'REPLIED' ? '修改回覆' : '送出回覆'}
                </p>
                <div className="space-y-2">
                  <Label className="text-xs">報價金額（NT$）</Label>
                  <Input
                    type="number"
                    value={replyPrice}
                    onChange={e => setReplyPrice(e.target.value)}
                    placeholder="例：1800"
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">回覆說明</Label>
                  <Textarea
                    value={replyNote}
                    onChange={e => setReplyNote(e.target.value)}
                    placeholder="例如：此款需加收手繪費用 NT$300，整體約 NT$2,100"
                    rows={3}
                  />
                </div>
                <Button className="w-full min-h-[44px]" onClick={handleReply} disabled={replying}>
                  {replying ? '送出中...' : '送出回覆'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image lightbox */}
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

'use client'

import { useState, useEffect } from 'react'
import {
  MessageSquareMore, Clock, CheckCircle2, Search, X, ZoomIn,
  CalendarCheck, XCircle, AlertCircle, Ban, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'

interface QuoteItem {
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

type Filter = 'ALL' | 'PENDING' | 'REPLIED'

function deadlineLabel(q: QuoteItem): string | null {
  if (!q.holdUntil || q.quoteMode !== 'QUOTE_HOLD') return null
  if (q.status !== 'PENDING' && q.status !== 'REPLIED') return null
  const dt = format(new Date(q.holdUntil), 'M月d日 HH:mm', { locale: zhTW })
  return q.status === 'PENDING' ? `回覆截止：${dt}` : `付款截止：${dt}`
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<QuoteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('PENDING')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<QuoteItem | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  async function handleReject() {
    if (!rejectId) return
    setRejecting(true)
    const res = await fetch(`/api/quotes/${rejectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    })
    setRejecting(false)
    if (!res.ok) { toast.error('操作失敗'); return }
    toast.success('已拒絕，時段已釋放')
    setRejectId(null)
    setSelected(null)
    loadQuotes(filter)
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    const res = await fetch(`/api/quotes/${deleteId}`, { method: 'DELETE' })
    setDeleting(false)
    if (!res.ok) { toast.error('刪除失敗'); return }
    toast.success('已刪除')
    setDeleteId(null)
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

  const statusBadge = (q: QuoteItem) => {
    if (q.status === 'REPLIED') return <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle2 className="w-3 h-3 mr-1" />已回覆</Badge>
    if (q.status === 'CONFIRMED') return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100"><CalendarCheck className="w-3 h-3 mr-1" />已確認</Badge>
    if (q.status === 'REJECTED') return <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100"><XCircle className="w-3 h-3 mr-1" />已拒絕</Badge>
    if (q.status === 'EXPIRED') return <Badge className="bg-red-100 text-red-600 hover:bg-red-100"><AlertCircle className="w-3 h-3 mr-1" />已過期</Badge>
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100"><Clock className="w-3 h-3 mr-1" />待回覆</Badge>
  }

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
          {filtered.map(q => {
            const dl = deadlineLabel(q)
            return (
              <div key={q.id} className="relative bg-white rounded-2xl border border-border/50 shadow-sm hover:shadow-md hover:border-primary/30 transition-all">
                <button className="w-full text-left p-4" onClick={() => openDetail(q)}>
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
                      {q.quoteMode === 'QUOTE_HOLD' && q.holdDate && q.holdTime && (
                        <p className="text-xs text-blue-700 mt-1 flex items-center gap-1">
                          <CalendarCheck className="w-3 h-3" />
                          {format(new Date(q.holdDate), 'yyyy/MM/dd', { locale: zhTW })} {q.holdTime}
                          {dl && <span className="text-amber-600 ml-1">（{dl}）</span>}
                        </p>
                      )}
                      {q.note && <p className="text-xs text-muted-foreground mt-1 truncate">{q.note}</p>}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <div className="flex flex-col items-end gap-1">
                        {statusBadge(q)}
                        {q.quoteMode === 'QUOTE_HOLD' && (
                          <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-300 bg-blue-50">已卡位</Badge>
                        )}
                      </div>
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
                {/* Delete button */}
                <button
                  onClick={e => { e.stopPropagation(); setDeleteId(q.id) }}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                  title="刪除詢價"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <span>{selected?.quoteNo}</span>
              {selected && statusBadge(selected)}
              {selected?.quoteMode === 'QUOTE_HOLD' && (
                <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-300 bg-blue-50">已卡位</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="bg-accent/30 rounded-xl p-3 grid grid-cols-2 gap-2 text-sm">
                <div><p className="text-xs text-muted-foreground">姓名</p><p className="font-medium">{selected.customerName}</p></div>
                <div><p className="text-xs text-muted-foreground">電話</p><p className="font-medium">{selected.customerPhone}</p></div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">送出時間</p>
                  <p className="font-medium">{format(new Date(selected.createdAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}</p>
                </div>
              </div>

              {/* QUOTE_HOLD info */}
              {selected.quoteMode === 'QUOTE_HOLD' && selected.holdDate && selected.holdTime && (
                <div className={`rounded-xl p-3 text-sm space-y-1 ${selected.status === 'EXPIRED' ? 'bg-red-50 border border-red-200/60' : 'bg-blue-50 border border-blue-200/60'}`}>
                  <p className={`text-xs font-semibold ${selected.status === 'EXPIRED' ? 'text-red-700' : 'text-blue-800'}`}>卡位資訊</p>
                  <p className={selected.status === 'EXPIRED' ? 'text-red-700' : 'text-blue-700'}>
                    {format(new Date(selected.holdDate), 'yyyy/MM/dd（EEEE）', { locale: zhTW })} {selected.holdTime}
                  </p>
                  {selected.holdUntil && (selected.status === 'PENDING' || selected.status === 'REPLIED') && (
                    <p className="text-xs text-amber-700">
                      {selected.status === 'PENDING' ? '店家回覆截止' : '付款截止'}：
                      {format(new Date(selected.holdUntil), 'M月d日（EEEE）HH:mm', { locale: zhTW })}
                    </p>
                  )}
                  {selected.status === 'EXPIRED' && (
                    <p className="text-xs text-red-600">已超過保留時間，時段自動釋放</p>
                  )}
                </div>
              )}

              {/* Images */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">客人上傳圖片</p>
                <div className="grid grid-cols-3 gap-2">
                  {selected.images.map((img, i) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden border border-border/40 relative group cursor-pointer" onClick={() => setLightboxSrc(img)}>
                      <Image src={img} alt="" fill className="object-cover" unoptimized />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ZoomIn className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selected.note && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">客人說明</p>
                  <p className="text-sm text-foreground bg-accent/30 rounded-xl p-3 leading-relaxed">{selected.note}</p>
                </div>
              )}

              {(selected.status === 'REPLIED' || selected.status === 'CONFIRMED') && (
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

              {/* Reject for QUOTE_HOLD PENDING/REPLIED */}
              {selected.quoteMode === 'QUOTE_HOLD' && (selected.status === 'PENDING' || selected.status === 'REPLIED') && (
                <div className="pt-1 border-t border-border/40">
                  <Button variant="outline" className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => setRejectId(selected.id)}>
                    <Ban className="w-4 h-4" /> 拒絕此詢價（釋放時段）
                  </Button>
                </div>
              )}

              {/* Reply form */}
              {selected.status !== 'CONFIRMED' && selected.status !== 'REJECTED' && selected.status !== 'EXPIRED' && (
                <div className="space-y-3 pt-1 border-t border-border/40">
                  <p className="text-sm font-semibold">{selected.status === 'REPLIED' ? '修改回覆' : '送出回覆'}</p>
                  <div className="space-y-2">
                    <Label className="text-xs">報價金額（NT$）</Label>
                    <Input type="number" value={replyPrice} onChange={e => setReplyPrice(e.target.value)} placeholder="例：1800" min={0} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">回覆說明</Label>
                    <Textarea value={replyNote} onChange={e => setReplyNote(e.target.value)} placeholder="例如：此款需加收手繪費用 NT$300，整體約 NT$2,100" rows={3} />
                  </div>
                  <Button className="w-full min-h-[44px]" onClick={handleReply} disabled={replying}>
                    {replying ? '送出中...' : '送出回覆'}
                  </Button>
                </div>
              )}
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

      {/* Reject confirm */}
      <AlertDialog open={!!rejectId} onOpenChange={o => !o && setRejectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定拒絕此詢價？</AlertDialogTitle>
            <AlertDialogDescription>拒絕後，卡位的時段將立即釋放，客人將無法再確認預約。此操作無法復原。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} disabled={rejecting} className="bg-destructive hover:bg-destructive/90">
              {rejecting ? '處理中...' : '確定拒絕'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要刪除此詢價？</AlertDialogTitle>
            <AlertDialogDescription>刪除後卡位時段將自動釋放，詢價記錄將永久移除。此操作無法復原。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
              {deleting ? '刪除中...' : '確定刪除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

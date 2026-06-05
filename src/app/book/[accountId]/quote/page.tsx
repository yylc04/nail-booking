'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Upload, X, Check, Camera, ChevronLeft, ChevronRight, Calendar, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import Image from 'next/image'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, isSameDay, isBefore, startOfDay,
} from 'date-fns'
import { zhTW } from 'date-fns/locale'

const DAYS_SHORT = ['日', '一', '二', '三', '四', '五', '六']

export default function QuotePage() {
  const params = useParams()
  const router = useRouter()
  const accountId = params.accountId as string

  const [quoteMode, setQuoteMode] = useState<'QUOTE_ONLY' | 'QUOTE_HOLD'>('QUOTE_ONLY')
  const [loadingMode, setLoadingMode] = useState(true)

  const [images, setImages] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [quoteNo, setQuoteNo] = useState('')

  // QUOTE_HOLD date/time selection
  const [calMonth, setCalMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [slots, setSlots] = useState<string[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const today = startOfDay(new Date())

  useEffect(() => {
    fetch(`/api/book/quote?accountId=${accountId}`)
      .then(r => r.json())
      .then(data => {
        setQuoteMode(data.quoteMode || 'QUOTE_ONLY')
        setLoadingMode(false)
      })
  }, [accountId])

  const fetchSlots = useCallback(async (date: Date) => {
    setSlotsLoading(true)
    setSelectedSlot(null)
    setSlots([])
    const res = await fetch(`/api/book/available-slots?date=${format(date, 'yyyy-MM-dd')}&duration=60&accountId=${accountId}`)
    const data = await res.json()
    setSlots(data.slots || [])
    setSlotsLoading(false)
  }, [accountId])

  function selectDate(day: Date) {
    setSelectedDate(day)
    fetchSlots(day)
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (images.length + files.length > 3) {
      toast.error('最多上傳 3 張圖片')
      return
    }
    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} 超過 5MB`); return }
      const reader = new FileReader()
      reader.onload = () => setImages(prev => [...prev, reader.result as string])
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  function removeImage(idx: number) {
    setImages(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    if (images.length === 0) { toast.error('請至少上傳一張圖片'); return }
    if (!name.trim()) { toast.error('請填寫姓名'); return }
    if (!phone.trim()) { toast.error('請填寫電話'); return }
    if (quoteMode === 'QUOTE_HOLD') {
      if (!selectedDate) { toast.error('請選擇想要預約的日期'); return }
      if (!selectedSlot) { toast.error('請選擇想要預約的時段'); return }
    }

    setSubmitting(true)
    const body: Record<string, unknown> = { customerName: name.trim(), customerPhone: phone.trim(), note, images }
    if (quoteMode === 'QUOTE_HOLD' && selectedDate && selectedSlot) {
      body.holdDate = format(selectedDate, 'yyyy-MM-dd')
      body.holdTime = selectedSlot
    }
    const res = await fetch(`/api/book/quote?accountId=${accountId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setSubmitting(false)

    if (!res.ok) { toast.error(data.error || '送出失敗，請重試'); return }
    setQuoteNo(data.quoteNo)
    setDone(true)
  }

  const monthStart = startOfMonth(calMonth)
  const monthEnd = endOfMonth(calMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad = getDay(monthStart)

  if (loadingMode) {
    return <div className="min-h-screen bg-[#faf9f8] flex items-center justify-center text-muted-foreground text-sm">載入中...</div>
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#faf9f8] flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <Check className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold">詢價已送出！</h2>
          <div className="bg-white rounded-2xl border border-border/50 shadow-sm p-4 space-y-2">
            <p className="text-xs text-muted-foreground">詢價編號</p>
            <p className="text-xl font-mono font-bold tracking-widest text-primary">{quoteNo}</p>
          </div>
          {quoteMode === 'QUOTE_HOLD' && selectedDate && selectedSlot && (
            <div className="bg-blue-50 border border-blue-200/60 rounded-2xl p-3 text-sm text-blue-800">
              <p className="font-semibold mb-1">已卡位時段</p>
              <p>{format(selectedDate, 'yyyy/MM/dd（EEEE）', { locale: zhTW })} {selectedSlot}</p>
              <p className="text-xs text-blue-600 mt-1">店家回覆報價後請盡快確認，逾期將自動釋放</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground leading-relaxed">
            店家確認後將盡快回覆<br />
            你可以用電話號碼查詢報價結果
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => router.push(`/book/${accountId}/quote/status`)} className="w-full min-h-[48px]">
              查詢報價
            </Button>
            <Button variant="outline" onClick={() => router.push(`/book/${accountId}`)} className="w-full min-h-[48px]">
              返回預約頁
            </Button>
          </div>
        </div>
      </div>
    )
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
            <h1 className="text-base font-bold">傳圖詢價</h1>
            <p className="text-xs text-muted-foreground">
              {quoteMode === 'QUOTE_HOLD' ? '上傳圖片並選擇時段，店家確認後正式預約' : '上傳圖片，讓店家為你報價'}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Image upload */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">參考圖片 <span className="text-destructive">*</span></Label>
            <span className="text-xs text-muted-foreground">{images.length} / 3</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {images.map((img, idx) => (
              <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-border/50 bg-white shadow-sm">
                <Image src={img} alt={`圖片 ${idx + 1}`} fill className="object-cover" unoptimized />
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
            {images.length < 3 && (
              <button
                onClick={() => fileRef.current?.click()}
                className="aspect-square rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1.5 hover:border-primary/50 hover:bg-primary/5 transition-colors bg-white"
              >
                <Camera className="w-6 h-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">新增圖片</span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
          <p className="text-xs text-muted-foreground">最多 3 張，每張不超過 5MB</p>
        </div>

        {/* Note */}
        <div className="space-y-2">
          <Label>想法說明 <span className="text-xs text-muted-foreground font-normal">（選填）</span></Label>
          <Textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="例如：想做這款但換成藍色，或是想加 3D 配件..."
            rows={3}
            className="bg-white"
          />
        </div>

        {/* QUOTE_HOLD: date + time picker */}
        {quoteMode === 'QUOTE_HOLD' && (
          <div className="bg-white rounded-2xl border border-border/50 shadow-sm p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">選擇想要的日期與時段 <span className="text-destructive">*</span></p>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">店家回覆報價前，此時段將暫時保留給您</p>

            {/* Calendar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <button onClick={() => setCalMonth(m => subMonths(m, 1))} className="p-1.5 rounded-xl hover:bg-accent transition-colors">
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </button>
                <span className="text-sm font-bold">{format(calMonth, 'yyyy年M月', { locale: zhTW })}</span>
                <button onClick={() => setCalMonth(m => addMonths(m, 1))} className="p-1.5 rounded-xl hover:bg-accent transition-colors">
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {DAYS_SHORT.map(d => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                ))}
                {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} />)}
                {days.map(day => {
                  const isPast = isBefore(day, today)
                  const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
                  const isToday = isSameDay(day, new Date())
                  return (
                    <button
                      key={day.toISOString()}
                      disabled={isPast}
                      onClick={() => selectDate(day)}
                      className={`aspect-square rounded-xl text-sm font-medium transition-all flex items-center justify-center
                        ${isPast ? 'opacity-30 cursor-not-allowed' : 'hover:bg-primary/10'}
                        ${isSelected ? 'bg-primary text-white' : isToday ? 'ring-2 ring-primary/50 text-primary' : ''}
                      `}
                    >
                      {format(day, 'd')}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Time slots */}
            {selectedDate && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <p className="text-xs font-semibold text-muted-foreground">
                    {format(selectedDate, 'M月d日', { locale: zhTW })} 可選時段
                  </p>
                </div>
                {slotsLoading ? (
                  <p className="text-xs text-muted-foreground py-2">載入中...</p>
                ) : slots.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">此日期沒有可用時段，請換一天</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {slots.map(s => (
                      <button
                        key={s}
                        onClick={() => setSelectedSlot(s)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all
                          ${selectedSlot === s
                            ? 'bg-primary text-white border-primary'
                            : 'bg-accent/50 border-border/50 hover:border-primary/40'
                          }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedDate && selectedSlot && (
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-2.5 text-sm text-primary font-medium">
                已選：{format(selectedDate, 'yyyy/MM/dd', { locale: zhTW })} {selectedSlot}
              </div>
            )}
          </div>
        )}

        {/* Name & Phone */}
        <div className="space-y-3 bg-white rounded-2xl border border-border/50 shadow-sm p-4">
          <p className="text-sm font-semibold">聯絡資料</p>
          <div className="space-y-2">
            <Label>姓名 <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="您的姓名" className="bg-white" />
          </div>
          <div className="space-y-2">
            <Label>電話 <span className="text-destructive">*</span></Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="09xxxxxxxx" type="tel" className="bg-white" />
            <p className="text-xs text-muted-foreground">電話用於查詢報價結果</p>
          </div>
        </div>

        <Button
          className="w-full min-h-[52px] text-base font-semibold"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? '送出中...' : (
            <span className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              {quoteMode === 'QUOTE_HOLD' ? '送出詢價並卡位' : '送出詢價'}
            </span>
          )}
        </Button>
      </div>
    </div>
  )
}

'use client'

import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Upload, X, Check, Camera, ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import Image from 'next/image'

export default function QuotePage() {
  const params = useParams()
  const router = useRouter()
  const accountId = params.accountId as string

  const [images, setImages] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [quoteNo, setQuoteNo] = useState('')

  const fileRef = useRef<HTMLInputElement>(null)

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

    setSubmitting(true)
    const res = await fetch(`/api/book/quote?accountId=${accountId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName: name.trim(), customerPhone: phone.trim(), note, images }),
    })
    const data = await res.json()
    setSubmitting(false)

    if (!res.ok) { toast.error(data.error || '送出失敗，請重試'); return }
    setQuoteNo(data.quoteNo)
    setDone(true)
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
            <p className="text-xs text-muted-foreground">上傳圖片，讓店家為你報價</p>
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
            <span className="flex items-center gap-2"><Upload className="w-4 h-4" /> 送出詢價</span>
          )}
        </Button>
      </div>
    </div>
  )
}

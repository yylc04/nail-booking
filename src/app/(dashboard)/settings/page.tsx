'use client'

import { useState, useEffect, useRef } from 'react'
import { Settings, Upload, Plus, Trash2, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import Image from 'next/image'

const DAYS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']

interface BusinessHour {
  dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string; slotMinutes: number
}
interface ExceptionDate {
  date: string; isClosed: boolean; openTime?: string; closeTime?: string; note?: string
}

export default function SettingsPage() {
  const [storeName, setStoreName] = useState('')
  const [logo, setLogo] = useState<string | null>(null)
  const [hours, setHours] = useState<BusinessHour[]>([])
  const [exceptions, setExceptions] = useState<ExceptionDate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      setStoreName(data?.name || '')
      setLogo(data?.logo || null)
      if (data?.businessHours?.length) {
        setHours(data.businessHours)
      } else {
        setHours(Array.from({ length: 7 }, (_, i) => ({
          dayOfWeek: i, isOpen: i >= 1 && i <= 6, openTime: '10:00', closeTime: '19:00', slotMinutes: 30,
        })))
      }
      setExceptions(data?.exceptionDates?.map((e: { date: string; isClosed: boolean; openTime?: string; closeTime?: string; note?: string }) => ({
        ...e, date: e.date.split('T')[0],
      })) || [])
      setLoading(false)
    })
  }, [])

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('圖片不能超過 2MB'); return }
    const reader = new FileReader()
    reader.onload = () => setLogo(reader.result as string)
    reader.readAsDataURL(file)
  }

  function updateHour(idx: number, field: keyof BusinessHour, value: string | boolean | number) {
    setHours(prev => prev.map((h, i) => i === idx ? { ...h, [field]: value } : h))
  }

  function addException() {
    setExceptions(prev => [...prev, { date: '', isClosed: true, note: '' }])
  }

  function updateException(idx: number, field: keyof ExceptionDate, value: string | boolean) {
    setExceptions(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  function removeException(idx: number) {
    setExceptions(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: storeName, logo, businessHours: hours, exceptionDates: exceptions.filter(e => e.date) }),
    })
    setSaving(false)
    if (res.ok) toast.success('設定已儲存')
    else toast.error('儲存失敗')
  }

  if (loading) return <div className="p-6 text-muted-foreground">載入中...</div>

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">營業設定</h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>{saving ? '儲存中...' : '儲存設定'}</Button>
      </div>

      {/* Store info */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wand2 className="w-4 h-4 text-primary" /> 店家資訊</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>店家名稱</Label>
            <Input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="我的美甲店" />
          </div>
          <div className="space-y-2">
            <Label>店家 Logo</Label>
            <div className="flex items-center gap-4">
              {logo ? (
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary/20">
                  <Image src={logo} alt="Logo" fill className="object-cover" unoptimized />
                  <button
                    onClick={() => setLogo(null)}
                    className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity"
                  >
                    <Trash2 className="w-5 h-5 text-white" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileRef.current?.click()}
                  className="w-20 h-20 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">上傳</span>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">支援 JPG、PNG，最大 2MB</p>
                <p className="text-xs text-muted-foreground">Logo 將顯示於後台側邊欄和預約頁面</p>
                <Button variant="outline" size="sm" className="mt-2 gap-1" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-3 h-3" /> 選擇圖片
                </Button>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          </div>
        </CardContent>
      </Card>

      {/* Business hours */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader><CardTitle className="text-base">每週營業時間</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {hours.map((h, i) => (
            <div key={h.dayOfWeek} className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 w-20">
                <input type="checkbox" id={`day-${i}`} checked={h.isOpen} onChange={e => updateHour(i, 'isOpen', e.target.checked)} className="accent-primary" />
                <Label htmlFor={`day-${i}`} className="text-sm">{DAYS[h.dayOfWeek]}</Label>
              </div>
              <Input type="time" value={h.openTime} onChange={e => updateHour(i, 'openTime', e.target.value)} disabled={!h.isOpen} className="w-28 text-sm" />
              <span className="text-muted-foreground text-sm">–</span>
              <Input type="time" value={h.closeTime} onChange={e => updateHour(i, 'closeTime', e.target.value)} disabled={!h.isOpen} className="w-28 text-sm" />
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">間隔</Label>
                <select
                  value={h.slotMinutes}
                  onChange={e => updateHour(i, 'slotMinutes', Number(e.target.value))}
                  disabled={!h.isOpen}
                  className="text-xs border border-border rounded-md px-2 py-1 bg-background"
                >
                  {[15, 30, 60].map(m => <option key={m} value={m}>{m}分鐘</option>)}
                </select>
              </div>
              {!h.isOpen && <span className="text-xs text-muted-foreground">公休</span>}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Exception dates */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">例外日期</CardTitle>
            <Button variant="outline" size="sm" onClick={addException} className="gap-1">
              <Plus className="w-3 h-3" /> 新增
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {exceptions.length === 0 && <p className="text-sm text-muted-foreground">尚無例外日期設定</p>}
          {exceptions.map((ex, idx) => (
            <div key={idx} className="flex items-center gap-3 flex-wrap p-3 rounded-xl bg-accent/30">
              <Input type="date" value={ex.date} onChange={e => updateException(idx, 'date', e.target.value)} className="w-40 text-sm" />
              <select
                value={ex.isClosed ? 'closed' : 'open'}
                onChange={e => updateException(idx, 'isClosed', e.target.value === 'closed')}
                className="text-xs border border-border rounded-md px-2 py-1.5 bg-background"
              >
                <option value="closed">公休</option>
                <option value="open">特殊開放</option>
              </select>
              {!ex.isClosed && (
                <>
                  <Input type="time" value={ex.openTime || ''} onChange={e => updateException(idx, 'openTime', e.target.value)} className="w-24 text-sm" />
                  <span className="text-muted-foreground">–</span>
                  <Input type="time" value={ex.closeTime || ''} onChange={e => updateException(idx, 'closeTime', e.target.value)} className="w-24 text-sm" />
                </>
              )}
              <Input value={ex.note || ''} onChange={e => updateException(idx, 'note', e.target.value)} placeholder="備註" className="flex-1 min-w-24 text-sm" />
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeException(idx)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

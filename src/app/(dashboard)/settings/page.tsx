'use client'

import { useState, useEffect, useRef } from 'react'
import { Settings, Upload, Plus, Trash2, Wand2, Banknote } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import Image from 'next/image'

const DAYS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']

interface BusinessHour { dayOfWeek: number; isOpen: boolean }
interface BusinessSlot { dayOfWeek: number; time: string }
interface ExceptionDate { date: string; isClosed: boolean; note?: string }
interface BankAccount { bankName: string; accountNumber: string; accountName: string }

export default function SettingsPage() {
  const [storeName, setStoreName] = useState('')
  const [logo, setLogo] = useState<string | null>(null)
  const [hours, setHours] = useState<BusinessHour[]>([])
  const [slots, setSlots] = useState<BusinessSlot[]>([])
  const [exceptions, setExceptions] = useState<ExceptionDate[]>([])
  const [depositEnabled, setDepositEnabled] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Slot input state
  const [selectedDay, setSelectedDay] = useState(1)
  const [newTime, setNewTime] = useState('')

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      setStoreName(data?.name || '')
      setLogo(data?.logo || null)
      setDepositEnabled(data?.depositEnabled || false)
      setDepositAmount(data?.depositAmount ? String(data.depositAmount) : '0')
      setBankAccounts(data?.bankAccounts || [])

      if (data?.businessHours?.length) {
        setHours(data.businessHours.map((h: { dayOfWeek: number; isOpen: boolean }) => ({ dayOfWeek: h.dayOfWeek, isOpen: h.isOpen })))
      } else {
        setHours(Array.from({ length: 7 }, (_, i) => ({ dayOfWeek: i, isOpen: i >= 1 && i <= 6 })))
      }

      setSlots(data?.businessSlots?.map((s: { dayOfWeek: number; time: string }) => ({ dayOfWeek: s.dayOfWeek, time: s.time })) || [])
      setExceptions(data?.exceptionDates?.map((e: { date: string; isClosed: boolean; note?: string }) => ({
        date: e.date.split('T')[0],
        isClosed: e.isClosed,
        note: e.note || '',
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

  function addSlot() {
    if (!newTime) { toast.error('請選擇時間'); return }
    const already = slots.some(s => s.dayOfWeek === selectedDay && s.time === newTime)
    if (already) { toast.error('此時段已存在'); return }
    setSlots(prev => [...prev, { dayOfWeek: selectedDay, time: newTime }].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.time.localeCompare(b.time)))
    setNewTime('')
  }

  function removeSlot(day: number, time: string) {
    setSlots(prev => prev.filter(s => !(s.dayOfWeek === day && s.time === time)))
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

  function addBankAccount() {
    setBankAccounts(prev => [...prev, { bankName: '', accountNumber: '', accountName: '' }])
  }

  function updateBankAccount(idx: number, field: keyof BankAccount, value: string) {
    setBankAccounts(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b))
  }

  function removeBankAccount(idx: number) {
    setBankAccounts(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: storeName,
        logo,
        businessHours: hours,
        businessSlots: slots,
        exceptionDates: exceptions.filter(e => e.date),
        depositEnabled,
        depositAmount,
        bankAccounts: bankAccounts.filter(b => b.bankName || b.accountNumber),
      }),
    })
    setSaving(false)
    if (res.ok) toast.success('設定已儲存')
    else toast.error('儲存失敗')
  }

  if (loading) return <div className="p-6 text-muted-foreground">載入中...</div>

  const slotsByDay = DAYS.map((_, i) => ({
    day: i,
    slots: slots.filter(s => s.dayOfWeek === i).sort((a, b) => a.time.localeCompare(b.time)),
  }))

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">營業設定</h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>{saving ? '儲存中...' : '儲存設定'}</Button>
      </div>

      {/* ── 1 & 2. Store info + Logo ── */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wand2 className="w-4 h-4 text-primary" /> 店家資訊</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>店家名稱</Label>
            <Input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="我的美甲工作室" />
            <p className="text-xs text-muted-foreground">修改後儲存，側邊欄與預約頁同步更新</p>
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
                <p className="text-xs text-muted-foreground">顯示於側邊欄與 /book 預約頁頂部</p>
                <Button variant="outline" size="sm" className="mt-2 gap-1" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-3 h-3" /> 選擇圖片
                </Button>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          </div>
        </CardContent>
      </Card>

      {/* ── 3. Time slots (manual) ── */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader><CardTitle className="text-base">預約時段設定</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Weekly open/closed */}
          <div>
            <p className="text-sm font-medium mb-2">每週營業日</p>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d, i) => {
                const h = hours.find(h => h.dayOfWeek === i)
                const isOpen = h?.isOpen ?? (i >= 1 && i <= 6)
                return (
                  <button
                    key={i}
                    onClick={() => setHours(prev => {
                      const exists = prev.findIndex(h => h.dayOfWeek === i)
                      if (exists >= 0) return prev.map((h, n) => n === exists ? { ...h, isOpen: !h.isOpen } : h)
                      return [...prev, { dayOfWeek: i, isOpen: true }]
                    })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${isOpen ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground'}`}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Add time slot */}
          <div>
            <p className="text-sm font-medium mb-2">新增可預約時段</p>
            <div className="flex gap-2 flex-wrap">
              <select
                value={selectedDay}
                onChange={e => setSelectedDay(Number(e.target.value))}
                className="text-sm border border-border rounded-xl px-3 py-2 bg-background"
              >
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
              <Input
                type="time"
                value={newTime}
                onChange={e => setNewTime(e.target.value)}
                className="w-32"
              />
              <Button onClick={addSlot} variant="outline" className="gap-1">
                <Plus className="w-3.5 h-3.5" /> 新增時段
              </Button>
            </div>
          </div>

          {/* Slot list per day */}
          <div className="space-y-3">
            {slotsByDay.filter(d => d.slots.length > 0 || hours.find(h => h.dayOfWeek === d.day)?.isOpen).map(({ day, slots: daySlots }) => {
              const isOpen = hours.find(h => h.dayOfWeek === day)?.isOpen ?? (day >= 1 && day <= 6)
              if (!isOpen && daySlots.length === 0) return null
              return (
                <div key={day} className="p-3 rounded-xl bg-accent/30">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">{DAYS[day]}{!isOpen && ' (公休)'}</p>
                  {daySlots.length === 0 ? (
                    <p className="text-xs text-muted-foreground">尚未設定時段</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {daySlots.map(s => (
                        <span key={s.time} className="inline-flex items-center gap-1 text-xs bg-white border border-border rounded-full px-2.5 py-1">
                          {s.time}
                          <button onClick={() => removeSlot(day, s.time)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {slots.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">尚未設定任何時段，客人將無法選擇時間</p>}
          </div>
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
                className="text-xs border border-border rounded-xl px-3 py-2 bg-background"
              >
                <option value="closed">公休</option>
                <option value="open">正常開放</option>
              </select>
              <Input value={ex.note || ''} onChange={e => updateException(idx, 'note', e.target.value)} placeholder="備註" className="flex-1 min-w-24 text-sm" />
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeException(idx)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── 5. Deposit settings ── */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Banknote className="w-4 h-4 text-primary" /> 訂金設定</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="deposit-toggle"
              checked={depositEnabled}
              onChange={e => setDepositEnabled(e.target.checked)}
              className="accent-primary w-4 h-4"
            />
            <Label htmlFor="deposit-toggle">啟用訂金功能</Label>
          </div>

          {depositEnabled && (
            <>
              <div className="space-y-2">
                <Label>訂金金額 (NT$)</Label>
                <Input
                  type="number"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  placeholder="500"
                  className="w-40"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>匯款帳戶資訊</Label>
                  <Button variant="outline" size="sm" onClick={addBankAccount} className="gap-1">
                    <Plus className="w-3 h-3" /> 新增帳戶
                  </Button>
                </div>
                {bankAccounts.length === 0 && (
                  <p className="text-sm text-muted-foreground">尚未設定匯款帳戶</p>
                )}
                {bankAccounts.map((b, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-accent/30 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">銀行名稱</Label>
                        <Input
                          value={b.bankName}
                          onChange={e => updateBankAccount(idx, 'bankName', e.target.value)}
                          placeholder="台灣銀行"
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">戶名</Label>
                        <Input
                          value={b.accountName}
                          onChange={e => updateBankAccount(idx, 'accountName', e.target.value)}
                          placeholder="王小明"
                          className="text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">帳號</Label>
                        <Input
                          value={b.accountNumber}
                          onChange={e => updateBankAccount(idx, 'accountNumber', e.target.value)}
                          placeholder="012-345678901234"
                          className="text-sm"
                        />
                      </div>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive shrink-0" onClick={() => removeBankAccount(idx)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

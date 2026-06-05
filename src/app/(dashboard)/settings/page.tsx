'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Settings, Upload, Plus, Trash2, Wand2, Banknote, FileText,
  ChevronLeft, ChevronRight, X, Check, GripVertical, AtSign,
  MapPin, MessageCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths, subMonths, isBefore, startOfDay } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import Image from 'next/image'

const DAYS_ZH = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
const DAYS_SHORT = ['日', '一', '二', '三', '四', '五', '六']

interface BusinessSlot { dayOfWeek: number; time: string }
interface BankAccount { bankName: string; accountNumber: string; accountName: string }
interface InfoBlock { title: string; content: string }

interface DayModalState {
  date: Date
  isClosed: boolean
  note: string
  slots: string[]
  newTime: string
}

export default function SettingsPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  // Store info
  const [storeName, setStoreName] = useState('')
  const [tagline, setTagline] = useState('')
  const [logo, setLogo] = useState<string | null>(null)
  const [address, setAddress] = useState('')
  const [metroInfo, setMetroInfo] = useState('')
  const [lineAccount, setLineAccount] = useState('')
  const [igAccount, setIgAccount] = useState('')
  const [introduction, setIntroduction] = useState('')
  const [bookingNotes, setBookingNotes] = useState('')

  // StoreInfoBlocks
  const [infoBlocks, setInfoBlocks] = useState<InfoBlock[]>([])
  const [newBlockTitle, setNewBlockTitle] = useState('')
  const [newBlockContent, setNewBlockContent] = useState('')
  const [showAddBlock, setShowAddBlock] = useState(false)
  const [editBlockIdx, setEditBlockIdx] = useState<number | null>(null)

  // Calendar
  const [calMonth, setCalMonth] = useState(new Date())
  const [slotMap, setSlotMap] = useState<Record<string, string[]>>({})
  const [closedMap, setClosedMap] = useState<Record<string, { isClosed: boolean; note?: string }>>({})
  const [calLoading, setCalLoading] = useState(true)

  // Day modal
  const [modal, setModal] = useState<DayModalState | null>(null)
  const [modalSaving, setModalSaving] = useState(false)

  // Weekly templates
  const [templates, setTemplates] = useState<BusinessSlot[]>([])
  const [tplDay, setTplDay] = useState(1)
  const [tplTime, setTplTime] = useState('')

  // Deposit
  const [depositEnabled, setDepositEnabled] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])

  const [globalSaving, setGlobalSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showApplyMonthDialog, setShowApplyMonthDialog] = useState(false)
  const [applyingMonth, setApplyingMonth] = useState(false)

  // Drag state for info blocks
  const dragIdx = useRef<number | null>(null)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      setStoreName(data?.name || '')
      setTagline(data?.tagline || '')
      setLogo(data?.logo || null)
      setAddress(data?.address || '')
      setMetroInfo(data?.metroInfo || '')
      setLineAccount(data?.lineAccount || '')
      setIgAccount(data?.igAccount || '')
      setIntroduction(data?.introduction || '')
      setBookingNotes(data?.bookingNotes || '')
      setDepositEnabled(data?.depositEnabled || false)
      setDepositAmount(data?.depositAmount ? String(data.depositAmount) : '0')
      setBankAccounts(data?.bankAccounts || [])
      setTemplates(data?.businessSlots?.map((s: { dayOfWeek: number; time: string }) => ({ dayOfWeek: s.dayOfWeek, time: s.time })) || [])
      setInfoBlocks(data?.storeInfoBlocks?.map((b: { title: string; content: string }) => ({ title: b.title, content: b.content })) || [])
      setLoading(false)
    })
  }, [])

  const loadCalendarSlots = useCallback(async (month: Date) => {
    setCalLoading(true)
    const monthStr = format(month, 'yyyy-MM')
    const res = await fetch(`/api/settings/daily-slots?month=${monthStr}`)
    const data = await res.json()
    setSlotMap(data.slots || {})
    setClosedMap(data.exceptions || {})
    setCalLoading(false)
  }, [])

  useEffect(() => { loadCalendarSlots(calMonth) }, [calMonth, loadCalendarSlots])

  const monthStart = startOfMonth(calMonth)
  const monthEnd = endOfMonth(calMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad = getDay(monthStart)
  const today = startOfDay(new Date())

  function openDayModal(day: Date) {
    const key = format(day, 'yyyy-MM-dd')
    const closedInfo = closedMap[key]
    setModal({
      date: day,
      isClosed: closedInfo?.isClosed ?? false,
      note: closedInfo?.note || '',
      slots: [...(slotMap[key] || [])].sort(),
      newTime: '',
    })
  }

  function addSlotToModal() {
    if (!modal) return
    if (!modal.newTime) { toast.error('請選擇時間'); return }
    if (modal.slots.includes(modal.newTime)) { toast.error('此時段已存在'); return }
    setModal(m => m ? { ...m, slots: [...m.slots, m.newTime].sort(), newTime: '' } : m)
  }

  function removeSlotFromModal(time: string) {
    setModal(m => m ? { ...m, slots: m.slots.filter(s => s !== time) } : m)
  }

  function applyWeeklyTemplate() {
    if (!modal) return
    const dow = modal.date.getDay()
    const tplSlots = templates.filter(t => t.dayOfWeek === dow).map(t => t.time)
    if (tplSlots.length === 0) { toast.error(`${DAYS_ZH[dow]}尚未設定預設時段`); return }
    const merged = [...new Set([...modal.slots, ...tplSlots])].sort()
    setModal(m => m ? { ...m, slots: merged } : m)
    toast.success(`已帶入 ${tplSlots.length} 個時段`)
  }

  async function saveModal() {
    if (!modal) return
    setModalSaving(true)
    const dateStr = format(modal.date, 'yyyy-MM-dd')
    const res = await fetch(`/api/settings/daily-slots/${dateStr}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots: modal.slots, isClosed: modal.isClosed, note: modal.note }),
    })
    setModalSaving(false)
    if (res.ok) {
      const key = dateStr
      if (modal.isClosed) {
        setClosedMap(m => ({ ...m, [key]: { isClosed: true, note: modal.note } }))
        setSlotMap(m => { const n = { ...m }; delete n[key]; return n })
      } else {
        setClosedMap(m => { const n = { ...m }; delete n[key]; return n })
        if (modal.slots.length > 0) setSlotMap(m => ({ ...m, [key]: modal.slots }))
        else setSlotMap(m => { const n = { ...m }; delete n[key]; return n })
      }
      toast.success('已儲存')
      setModal(null)
    } else {
      toast.error('儲存失敗')
    }
  }

  async function applyToMonth(mode: 'fill' | 'overwrite') {
    if (templates.length === 0) { toast.error('尚未設定任何每週預設時段'); setShowApplyMonthDialog(false); return }
    setApplyingMonth(true)
    const updated: Record<string, string[]> = {}
    let appliedCount = 0

    for (const day of days) {
      const key = format(day, 'yyyy-MM-dd')
      const dow = day.getDay()
      const tplSlots = templates.filter(t => t.dayOfWeek === dow).map(t => t.time)
      if (tplSlots.length === 0) continue
      const alreadyHasSlots = (slotMap[key] || []).length > 0
      const markedClosed = closedMap[key]?.isClosed
      if (mode === 'fill' && (alreadyHasSlots || markedClosed)) continue
      const res = await fetch(`/api/settings/daily-slots/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots: tplSlots, isClosed: false }),
      })
      if (res.ok) { updated[key] = tplSlots; appliedCount++ }
    }

    setSlotMap(prev => ({ ...prev, ...updated }))
    if (mode === 'overwrite') {
      setClosedMap(prev => {
        const next = { ...prev }
        Object.keys(updated).forEach(k => delete next[k])
        return next
      })
    }
    setApplyingMonth(false)
    setShowApplyMonthDialog(false)
    toast.success(`已套用至 ${appliedCount} 個日期`)
  }

  function addTemplate() {
    if (!tplTime) { toast.error('請選擇時間'); return }
    if (templates.some(t => t.dayOfWeek === tplDay && t.time === tplTime)) { toast.error('已存在'); return }
    setTemplates(prev => [...prev, { dayOfWeek: tplDay, time: tplTime }].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.time.localeCompare(b.time)))
    setTplTime('')
  }

  function removeTemplate(dow: number, time: string) {
    setTemplates(prev => prev.filter(t => !(t.dayOfWeek === dow && t.time === time)))
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('圖片不能超過 2MB'); return }
    const reader = new FileReader()
    reader.onload = () => setLogo(reader.result as string)
    reader.readAsDataURL(file)
  }

  function addBankAccount() { setBankAccounts(prev => [...prev, { bankName: '', accountNumber: '', accountName: '' }]) }
  function updateBankAccount(idx: number, field: keyof BankAccount, value: string) {
    setBankAccounts(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b))
  }
  function removeBankAccount(idx: number) { setBankAccounts(prev => prev.filter((_, i) => i !== idx)) }

  // InfoBlock management
  function addInfoBlock() {
    if (!newBlockTitle.trim()) { toast.error('請輸入區塊標題'); return }
    setInfoBlocks(prev => [...prev, { title: newBlockTitle.trim(), content: newBlockContent }])
    setNewBlockTitle('')
    setNewBlockContent('')
    setShowAddBlock(false)
  }

  function removeInfoBlock(idx: number) {
    setInfoBlocks(prev => prev.filter((_, i) => i !== idx))
  }

  function updateInfoBlock(idx: number, field: 'title' | 'content', val: string) {
    setInfoBlocks(prev => prev.map((b, i) => i === idx ? { ...b, [field]: val } : b))
  }

  function moveInfoBlock(from: number, to: number) {
    if (to < 0 || to >= infoBlocks.length) return
    const arr = [...infoBlocks]
    const [item] = arr.splice(from, 1)
    arr.splice(to, 0, item)
    setInfoBlocks(arr)
  }

  async function handleSave() {
    setGlobalSaving(true)
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: storeName, tagline, logo,
        address, metroInfo, lineAccount, igAccount, introduction,
        bookingNotes,
        businessSlots: templates,
        depositEnabled, depositAmount,
        bankAccounts: bankAccounts.filter(b => b.bankName || b.accountNumber),
        storeInfoBlocks: infoBlocks,
      }),
    })
    setGlobalSaving(false)
    if (res.ok) {
      toast.success('設定已儲存')
      router.refresh()
    } else {
      toast.error('儲存失敗')
    }
  }

  if (loading) return <div className="p-6 text-muted-foreground">載入中...</div>

  const tplsByDay = DAYS_ZH.map((_, i) => ({
    day: i,
    slots: templates.filter(t => t.dayOfWeek === i).sort((a, b) => a.time.localeCompare(b.time)),
  }))

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">營業設定</h1>
        </div>
        <Button onClick={handleSave} disabled={globalSaving} className="min-h-[44px]">{globalSaving ? '儲存中...' : '儲存設定'}</Button>
      </div>

      {/* ── Store info ── */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wand2 className="w-4 h-4 text-primary" /> 店家資訊</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>店家名稱</Label>
              <Input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="我的美甲工作室" />
            </div>
            <div className="space-y-2">
              <Label>一行簡介</Label>
              <Input value={tagline} onChange={e => setTagline(e.target.value)} placeholder="台北專業美甲｜預約制工作室" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>工作室介紹</Label>
            <Textarea value={introduction} onChange={e => setIntroduction(e.target.value)} rows={4} placeholder="關於工作室的介紹文字..." />
          </div>

          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-4">
              {logo ? (
                <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-primary/20">
                  <Image src={logo} alt="Logo" fill className="object-cover" unoptimized />
                  <button onClick={() => setLogo(null)} className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Trash2 className="w-5 h-5 text-white" />
                  </button>
                </div>
              ) : (
                <div onClick={() => fileRef.current?.click()} className="w-20 h-20 rounded-full border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary/50 transition-colors">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">上傳</span>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">支援 JPG、PNG，最大 2MB</p>
                <Button variant="outline" size="sm" className="mt-2 gap-1" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-3 h-3" /> 選擇圖片
                </Button>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-primary" /> 工作室地址</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="台北市大安區忠孝東路..." />
            </div>
            <div className="space-y-2">
              <Label>附近捷運站說明（選填）</Label>
              <Input value={metroInfo} onChange={e => setMetroInfo(e.target.value)} placeholder="捷運忠孝敦化站 5 號出口步行 3 分鐘" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5 text-green-600" /> LINE 帳號</Label>
              <Input value={lineAccount} onChange={e => setLineAccount(e.target.value)} placeholder="@blooming_nail" />
              <p className="text-xs text-muted-foreground">格式：@xxxx</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><AtSign className="w-3.5 h-3.5 text-pink-500" /> Instagram 帳號</Label>
              <Input value={igAccount} onChange={e => setIgAccount(e.target.value)} placeholder="@blooming_nail" />
              <p className="text-xs text-muted-foreground">格式：@xxxx</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Booking notes ── */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> 預約注意事項</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            value={bookingNotes}
            onChange={e => setBookingNotes(e.target.value)}
            rows={4}
            placeholder={`例如：\n• 請勿留長指甲，施術前請先修剪\n• 取消預約需提前 24 小時通知\n• 遲到超過 15 分鐘視為取消`}
          />
          <p className="text-xs text-muted-foreground mt-1.5">此為固定區塊，客人填寫預約資料前需勾選同意</p>
        </CardContent>
      </Card>

      {/* ── Store info blocks ── */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> 店家資訊區塊</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">在預約頁「店家資訊」分頁顯示，可自訂多個區塊</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {infoBlocks.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">尚未新增任何區塊</p>
          )}
          {infoBlocks.map((block, idx) => (
            <div key={idx} className="rounded-xl border border-border/60 bg-accent/20 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 cursor-grab" />
                {editBlockIdx === idx ? (
                  <Input
                    value={block.title}
                    onChange={e => updateInfoBlock(idx, 'title', e.target.value)}
                    className="flex-1 text-sm font-semibold"
                    placeholder="區塊標題"
                  />
                ) : (
                  <span className="flex-1 text-sm font-semibold">{block.title}</span>
                )}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditBlockIdx(editBlockIdx === idx ? null : idx)}
                    className="text-xs text-primary hover:underline px-2 py-1"
                  >
                    {editBlockIdx === idx ? '完成' : '編輯'}
                  </button>
                  <button onClick={() => moveInfoBlock(idx, idx - 1)} disabled={idx === 0} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => moveInfoBlock(idx, idx + 1)} disabled={idx === infoBlocks.length - 1} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => removeInfoBlock(idx)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {editBlockIdx === idx ? (
                <Textarea
                  value={block.content}
                  onChange={e => updateInfoBlock(idx, 'content', e.target.value)}
                  rows={3}
                  placeholder="區塊內容..."
                  className="text-sm"
                />
              ) : (
                <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed pl-6">{block.content || '（無內容）'}</p>
              )}
            </div>
          ))}

          {showAddBlock ? (
            <div className="rounded-xl border-2 border-dashed border-primary/40 p-3 space-y-2 bg-primary/5">
              <Input
                value={newBlockTitle}
                onChange={e => setNewBlockTitle(e.target.value)}
                placeholder="區塊標題（例：停車資訊）"
                className="text-sm"
              />
              <Textarea
                value={newBlockContent}
                onChange={e => setNewBlockContent(e.target.value)}
                placeholder="區塊內容..."
                rows={3}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={addInfoBlock} className="gap-1"><Check className="w-3.5 h-3.5" /> 新增</Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowAddBlock(false); setNewBlockTitle(''); setNewBlockContent('') }}>取消</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5 w-full border-dashed" onClick={() => setShowAddBlock(true)}>
              <Plus className="w-3.5 h-3.5" /> 新增區塊
            </Button>
          )}
          <p className="text-xs text-muted-foreground">範例：停車資訊、常見問題、服務說明</p>
        </CardContent>
      </Card>

      {/* ── Calendar slot management ── */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">月曆時段管理</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">點擊日期設定當天開放時段或標記公休</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCalMonth(m => subMonths(m, 1))}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="font-bold">{format(calMonth, 'yyyy年M月', { locale: zhTW })}</span>
            <Button variant="ghost" size="icon" onClick={() => setCalMonth(m => addMonths(m, 1))}><ChevronRight className="w-4 h-4" /></Button>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/5" onClick={() => setShowApplyMonthDialog(true)}>
              <Check className="w-3 h-3" /> 一鍵套用全月
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {DAYS_SHORT.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          {calLoading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">載入中...</div>
          ) : (
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
              {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} />)}
              {days.map(day => {
                const key = format(day, 'yyyy-MM-dd')
                const daySlots = slotMap[key] || []
                const closedInfo = closedMap[key]
                const isClosed = closedInfo?.isClosed
                const isPast = isBefore(day, today)
                const isToday = isSameDay(day, new Date())
                return (
                  <button
                    key={key} onClick={() => openDayModal(day)}
                    className={`relative min-h-[56px] sm:min-h-[72px] p-1 sm:p-1.5 rounded-lg sm:rounded-xl text-left transition-all active:scale-95 hover:ring-2 hover:ring-primary/30 ${isToday ? 'ring-2 ring-primary/50' : ''} ${isPast ? 'opacity-50' : ''} bg-white border border-border/40`}
                  >
                    <span className={`text-xs font-bold block mb-0.5 ${isToday ? 'text-primary' : 'text-foreground'}`}>{format(day, 'd')}</span>
                    {isClosed ? (
                      <span className="text-[9px] sm:text-[10px] bg-red-100 text-red-600 rounded px-0.5 sm:px-1 py-0.5 font-medium">公休</span>
                    ) : daySlots.length > 0 ? (
                      <div className="space-y-0.5">
                        <span className="hidden sm:block text-[10px] bg-primary/20 text-[#DB2777] rounded px-1 py-0.5 leading-tight">{daySlots[0]}</span>
                        <span className="sm:hidden block w-2 h-2 rounded-full bg-primary mx-auto" />
                        {daySlots.length > 1 && <span className="hidden sm:block text-[10px] text-muted-foreground">+{daySlots.length - 1}</span>}
                        {daySlots.length > 1 && <span className="sm:hidden text-[9px] text-muted-foreground block text-center">×{daySlots.length}</span>}
                      </div>
                    ) : null}
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-primary/20 border border-primary/30" />有時段</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-200" />公休</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded ring-2 ring-primary/50" />今天</div>
          </div>
        </CardContent>
      </Card>

      {/* ── Weekly templates ── */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">每週預設時段（套用範本）</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">在月曆日期中點「一鍵帶入」可快速套用，不會自動覆蓋已設定的日期</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <select value={tplDay} onChange={e => setTplDay(Number(e.target.value))} className="text-sm border border-border rounded-xl px-3 py-2 bg-background min-h-[44px]">
              {DAYS_ZH.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
            <Input type="time" value={tplTime} onChange={e => setTplTime(e.target.value)} className="w-32 min-h-[44px]" />
            <Button onClick={addTemplate} variant="outline" className="gap-1 min-h-[44px]"><Plus className="w-3.5 h-3.5" /> 新增</Button>
          </div>
          <div className="space-y-2">
            {tplsByDay.filter(d => d.slots.length > 0).map(({ day, slots: ts }) => (
              <div key={day} className="flex items-start gap-2">
                <span className="text-xs font-medium text-muted-foreground w-10 pt-1">{DAYS_ZH[day]}</span>
                <div className="flex flex-wrap gap-1.5">
                  {ts.map(s => (
                    <span key={s.time} className="inline-flex items-center gap-1 text-xs bg-accent border border-border rounded-full px-2.5 py-1">
                      {s.time}
                      <button onClick={() => removeTemplate(day, s.time)} className="text-muted-foreground hover:text-destructive transition-colors"><X className="w-2.5 h-2.5" /></button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {templates.length === 0 && <p className="text-sm text-muted-foreground">尚未設定範本</p>}
          </div>
        </CardContent>
      </Card>

      {/* ── Deposit ── */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Banknote className="w-4 h-4 text-primary" /> 訂金設定</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input type="checkbox" id="deposit-toggle" checked={depositEnabled} onChange={e => setDepositEnabled(e.target.checked)} className="accent-primary w-4 h-4" />
            <Label htmlFor="deposit-toggle">啟用訂金功能</Label>
          </div>
          {depositEnabled && (
            <>
              <div className="space-y-2">
                <Label>訂金金額 (NT$)</Label>
                <Input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="500" className="w-full sm:w-40" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>匯款帳戶資訊</Label>
                  <Button variant="outline" size="sm" onClick={addBankAccount} className="gap-1"><Plus className="w-3 h-3" /> 新增帳戶</Button>
                </div>
                {bankAccounts.map((b, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-accent/30 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">銀行名稱</Label>
                        <Input value={b.bankName} onChange={e => updateBankAccount(idx, 'bankName', e.target.value)} placeholder="台灣銀行" className="text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">戶名</Label>
                        <Input value={b.accountName} onChange={e => updateBankAccount(idx, 'accountName', e.target.value)} placeholder="王小明" className="text-sm" />
                      </div>
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">帳號</Label>
                        <Input value={b.accountNumber} onChange={e => updateBankAccount(idx, 'accountNumber', e.target.value)} placeholder="012-345678901234" className="text-sm" />
                      </div>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive shrink-0" onClick={() => removeBankAccount(idx)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Day modal ── */}
      <Dialog open={!!modal} onOpenChange={o => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{modal && format(modal.date, 'M月d日 EEEE', { locale: zhTW })}</DialogTitle>
          </DialogHeader>
          {modal && (
            <div className="space-y-4">
              <div className="flex rounded-xl overflow-hidden border border-border">
                <button onClick={() => setModal(m => m ? { ...m, isClosed: false } : m)} className={`flex-1 py-2 text-sm font-medium transition-all ${!modal.isClosed ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-accent'}`}>開放預約</button>
                <button onClick={() => setModal(m => m ? { ...m, isClosed: true } : m)} className={`flex-1 py-2 text-sm font-medium transition-all ${modal.isClosed ? 'bg-red-500 text-white' : 'text-muted-foreground hover:bg-accent'}`}>設為公休</button>
              </div>
              {modal.isClosed ? (
                <div className="space-y-2">
                  <Label className="text-xs">公休備註（選填）</Label>
                  <Input value={modal.note} onChange={e => setModal(m => m ? { ...m, note: e.target.value } : m)} placeholder="例：店休、節日..." />
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs">已開放時段</Label>
                      <button onClick={applyWeeklyTemplate} className="text-xs text-primary hover:underline">一鍵帶入{DAYS_ZH[modal.date.getDay()]}預設</button>
                    </div>
                    {modal.slots.length === 0 ? (
                      <p className="text-xs text-muted-foreground">尚未新增時段</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {modal.slots.map(t => (
                          <span key={t} className="inline-flex items-center gap-1 text-xs bg-primary/20 text-[#DB2777] rounded-full px-2.5 py-1 border border-primary/30">
                            {t}
                            <button onClick={() => removeSlotFromModal(t)} className="hover:text-red-600"><X className="w-2.5 h-2.5" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input type="time" value={modal.newTime} onChange={e => setModal(m => m ? { ...m, newTime: e.target.value } : m)} className="flex-1" />
                    <Button onClick={addSlotToModal} variant="outline" size="sm" className="gap-1 shrink-0"><Plus className="w-3.5 h-3.5" /> 新增</Button>
                  </div>
                </>
              )}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>取消</Button>
                <Button className="flex-1 gap-1" onClick={saveModal} disabled={modalSaving}><Check className="w-3.5 h-3.5" />{modalSaving ? '儲存中...' : '儲存'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Apply-to-month dialog ── */}
      <Dialog open={showApplyMonthDialog} onOpenChange={o => !o && !applyingMonth && setShowApplyMonthDialog(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>套用預設時段到本月</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">請選擇套用方式：</p>
            <button disabled={applyingMonth} onClick={() => applyToMonth('fill')} className="w-full text-left p-4 rounded-2xl border-2 border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0"><span className="w-2 h-2 rounded-full bg-primary" /></div>
                <div>
                  <p className="text-sm font-semibold text-primary">只套用未設定的日期</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">已手動設定的日期完全保留，只補上尚未設定的日期</p>
                  <span className="inline-block mt-1.5 text-[10px] font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">建議選項</span>
                </div>
              </div>
            </button>
            <button disabled={applyingMonth} onClick={() => applyToMonth('overwrite')} className="w-full text-left p-4 rounded-2xl border border-border hover:border-foreground/30 hover:bg-accent/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-5 h-5 rounded-full border-2 border-border flex items-center justify-center shrink-0"><span className="w-2 h-2 rounded-full bg-muted-foreground" /></div>
                <div>
                  <p className="text-sm font-semibold text-foreground">全部覆蓋</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">所有日期都套用每週預設時段，覆蓋已手動設定的日期</p>
                </div>
              </div>
            </button>
            {applyingMonth && <p className="text-xs text-center text-muted-foreground animate-pulse">套用中，請稍候...</p>}
            <Button variant="ghost" className="w-full text-muted-foreground" disabled={applyingMonth} onClick={() => setShowApplyMonthDialog(false)}>取消</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* unused drag ref suppressor */}
      <div ref={el => { void (el); void dragIdx }} className="hidden" />
    </div>
  )
}

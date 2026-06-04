'use client'

import { useState, useEffect, useCallback } from 'react'
import { UserCog, Plus, Trash2, Sparkles, Pencil, Link2, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

interface Account {
  id: string; username: string; role: string; createdAt: string
  storeId?: string; storeName?: string
  contactName?: string; phone?: string; lineId?: string
  plan?: string; expiryDate?: string; notes?: string
}

const PLAN_OPTIONS = ['免費試用', '月租', '買斷']

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Create form
  const [fUsername, setFUsername] = useState('')
  const [fPassword, setFPassword] = useState('')

  // Edit form
  const [eStoreName, setEStoreName] = useState('')
  const [eContactName, setEContactName] = useState('')
  const [ePhone, setEPhone] = useState('')
  const [eLineId, setELineId] = useState('')
  const [ePlan, setEPlan] = useState('')
  const [eExpiryDate, setEExpiryDate] = useState('')
  const [eNotes, setENotes] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/accounts')
    if (res.ok) setAccounts(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleCreate() {
    if (!fUsername || !fPassword) return toast.error('請填寫帳號和密碼')
    const res = await fetch('/api/accounts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: fUsername, password: fPassword }),
    })
    const data = await res.json()
    if (res.ok) { toast.success('帳號已建立'); setShowCreate(false); setFUsername(''); setFPassword(''); fetchData() }
    else toast.error(data.error || '建立失敗')
  }

  function openEdit(acc: Account) {
    setEditing(acc)
    setEStoreName(acc.storeName || '')
    setEContactName(acc.contactName || '')
    setEPhone(acc.phone || '')
    setELineId(acc.lineId || '')
    setEPlan(acc.plan || '')
    setEExpiryDate(acc.expiryDate ? acc.expiryDate.split('T')[0] : '')
    setENotes(acc.notes || '')
  }

  async function handleEdit() {
    if (!editing) return
    const res = await fetch(`/api/accounts/${editing.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeName: eStoreName,
        contactName: eContactName,
        phone: ePhone,
        lineId: eLineId,
        plan: ePlan,
        expiryDate: eExpiryDate || null,
        notes: eNotes,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      toast.success('帳號資料已更新')
      setEditing(null)
      fetchData()
    } else {
      toast.error(data.error || '更新失敗')
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    const res = await fetch(`/api/accounts/${deleteId}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) { toast.success('帳號已刪除'); fetchData() }
    else toast.error(data.error || '刪除失敗')
    setDeleteId(null)
  }

  function copyBookingLink(username: string) {
    const url = `${window.location.origin}/book/${username}`
    navigator.clipboard.writeText(url).then(() => {
      toast.success('預約連結已複製')
    }).catch(() => {
      toast.error('複製失敗')
    })
  }

  const planColor: Record<string, string> = {
    '免費試用': 'bg-gray-100 text-gray-600 border-gray-200',
    '月租': 'bg-blue-100 text-blue-700 border-blue-200',
    '買斷': 'bg-green-100 text-green-700 border-green-200',
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserCog className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">帳號管理</h1>
            <p className="text-xs text-muted-foreground">僅超級管理員可操作</p>
          </div>
        </div>
        <Button onClick={() => { setFUsername(''); setFPassword(''); setShowCreate(true) }} className="gap-2 min-h-[44px]">
          <Plus className="w-4 h-4" /> 新增帳號
        </Button>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">載入中...</div>
          ) : (
            <div className="divide-y divide-border/50">
              {accounts.map(acc => (
                <div key={acc.id} className="p-4 hover:bg-accent/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        {acc.role === 'SUPER_ADMIN'
                          ? <Sparkles className="w-5 h-5 text-primary" />
                          : <UserCog className="w-5 h-5 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-semibold">{acc.username}</p>
                          {acc.storeName && <span className="text-xs text-muted-foreground">（{acc.storeName}）</span>}
                          <Badge variant="outline" className={acc.role === 'SUPER_ADMIN' ? 'border-primary/30 text-primary bg-primary/5' : ''}>
                            {acc.role === 'SUPER_ADMIN' ? '超級管理員' : '店家帳號'}
                          </Badge>
                          {acc.plan && (
                            <Badge variant="outline" className={`text-xs ${planColor[acc.plan] || ''}`}>
                              {acc.plan}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                          {acc.contactName && <span>聯絡人：{acc.contactName}</span>}
                          {acc.phone && <span>電話：{acc.phone}</span>}
                          {acc.lineId && <span>Line：{acc.lineId}</span>}
                          {acc.expiryDate && (
                            <span>到期：{acc.plan === '買斷' ? '永久' : format(new Date(acc.expiryDate), 'yyyy/MM/dd')}</span>
                          )}
                        </div>
                        {acc.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">備註：{acc.notes}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5">建立於 {format(new Date(acc.createdAt), 'yyyy/MM/dd')}</p>

                        {/* Booking URL for non-super-admin */}
                        {acc.role !== 'SUPER_ADMIN' && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <Link2 className="w-3 h-3 text-primary shrink-0" />
                            <span className="text-xs text-primary font-mono">/book/{acc.username}</span>
                            <button
                              onClick={() => copyBookingLink(acc.username)}
                              className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {acc.role !== 'SUPER_ADMIN' && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(acc)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(acc.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增店家帳號</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>帳號 ID <span className="text-destructive">*</span></Label>
              <Input value={fUsername} onChange={e => setFUsername(e.target.value)} placeholder="設定帳號 ID（即預約網址後綴）" />
            </div>
            <div className="space-y-2">
              <Label>密碼 <span className="text-destructive">*</span></Label>
              <Input type="password" value={fPassword} onChange={e => setFPassword(e.target.value)} placeholder="設定密碼" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreate}>建立帳號</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>編輯帳號資料：{editing?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>店家名稱</Label>
              <Input value={eStoreName} onChange={e => setEStoreName(e.target.value)} placeholder="店家名稱" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>聯絡人姓名</Label>
                <Input value={eContactName} onChange={e => setEContactName(e.target.value)} placeholder="聯絡人" />
              </div>
              <div className="space-y-2">
                <Label>電話</Label>
                <Input value={ePhone} onChange={e => setEPhone(e.target.value)} placeholder="09xxxxxxxx" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Line ID</Label>
              <Input value={eLineId} onChange={e => setELineId(e.target.value)} placeholder="Line ID" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>方案</Label>
                <Select value={ePlan} onValueChange={v => setEPlan(v === '__none__' ? '' : (v ?? ''))}>
                  <SelectTrigger><SelectValue placeholder="選擇方案" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">未設定</SelectItem>
                    {PLAN_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>到期日{ePlan === '買斷' ? '（永久）' : ''}</Label>
                {ePlan === '買斷' ? (
                  <div className="h-9 flex items-center text-sm text-muted-foreground px-3 rounded-md border border-border bg-accent/30">永久</div>
                ) : (
                  <Input type="date" value={eExpiryDate} onChange={e => setEExpiryDate(e.target.value)} />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>備註</Label>
              <Textarea value={eNotes} onChange={e => setENotes(e.target.value)} rows={2} placeholder="選填" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
            <Button onClick={handleEdit}>儲存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除帳號</AlertDialogTitle>
            <AlertDialogDescription>確定要刪除此店家帳號嗎？此操作無法復原。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">刪除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

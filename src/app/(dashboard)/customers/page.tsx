'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Plus, Search, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface Customer {
  id: string; name: string; phone: string; email?: string; notes?: string
  lineName?: string; lineOrIg?: string
  appointmentCount: number; totalSpent: number; createdAt: string
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [fName, setFName] = useState('')
  const [fPhone, setFPhone] = useState('')
  const [fEmail, setFEmail] = useState('')
  const [fLineName, setFLineName] = useState('')
  const [fLineOrIg, setFLineOrIg] = useState('')
  const [fNotes, setFNotes] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/customers?search=${search}`)
    setCustomers(await res.json())
    setLoading(false)
  }, [search])

  useEffect(() => { fetchData() }, [fetchData])

  function openCreate() {
    setEditing(null); setFName(''); setFPhone(''); setFEmail(''); setFLineName(''); setFLineOrIg(''); setFNotes(''); setShowForm(true)
  }

  function openEdit(c: Customer) {
    setEditing(c); setFName(c.name); setFPhone(c.phone); setFEmail(c.email || '')
    setFLineName(c.lineName || ''); setFLineOrIg(c.lineOrIg || '')
    setFNotes(c.notes || ''); setShowForm(true)
  }

  async function handleSave() {
    if (!fName || !fPhone) return toast.error('請填寫姓名和電話')
    const url = editing ? `/api/customers/${editing.id}` : '/api/customers'
    const method = editing ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: fName, phone: fPhone, email: fEmail, lineName: fLineName, lineOrIg: fLineOrIg, notes: fNotes }),
    })
    const data = await res.json()
    if (res.ok) { toast.success(editing ? '客戶已更新' : '客戶已新增'); setShowForm(false); fetchData() }
    else toast.error(data.error || '操作失敗')
  }

  async function handleDelete() {
    if (!deleteId) return
    const res = await fetch(`/api/customers/${deleteId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('客戶已刪除'); fetchData() }
    else toast.error('刪除失敗')
    setDeleteId(null)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">客戶管理</h1>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> 新增客戶
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋姓名或電話..." className="pl-9" />
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">載入中...</div>
          ) : customers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">尚無客戶資料</div>
          ) : (
            <div className="divide-y divide-border/50">
              {customers.map(c => (
                <div key={c.id} className="flex items-center justify-between p-4 hover:bg-accent/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.phone}{c.email ? ` · ${c.email}` : ''}</p>
                      {(c.lineName || c.lineOrIg) && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {c.lineName && <span className="mr-2">Line：{c.lineName}</span>}
                          {c.lineOrIg && <span>@{c.lineOrIg}</span>}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-xs text-muted-foreground">累積次數</p>
                      <p className="text-sm font-bold text-foreground">{c.appointmentCount} 次</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">累積消費</p>
                      <p className="text-sm font-bold text-primary">NT$ {c.totalSpent.toLocaleString()}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? '編輯客戶' : '新增客戶'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>姓名 <span className="text-destructive">*</span></Label>
              <Input value={fName} onChange={e => setFName(e.target.value)} placeholder="客戶姓名" />
            </div>
            <div className="space-y-2">
              <Label>電話 <span className="text-destructive">*</span></Label>
              <Input value={fPhone} onChange={e => setFPhone(e.target.value)} placeholder="手機號碼" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={fEmail} onChange={e => setFEmail(e.target.value)} placeholder="選填" type="email" />
            </div>
            <div className="space-y-2">
              <Label>Line 名稱</Label>
              <Input value={fLineName} onChange={e => setFLineName(e.target.value)} placeholder="Line 顯示名稱" />
            </div>
            <div className="space-y-2">
              <Label>Line ID 或 IG 帳號</Label>
              <Input value={fLineOrIg} onChange={e => setFLineOrIg(e.target.value)} placeholder="Line ID 或 @ig_handle" />
            </div>
            <div className="space-y-2">
              <Label>備註</Label>
              <Textarea value={fNotes} onChange={e => setFNotes(e.target.value)} rows={2} placeholder="選填" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>取消</Button>
            <Button onClick={handleSave}>儲存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>刪除客戶後，相關預約記錄也會一併影響，確定要刪除嗎？</AlertDialogDescription>
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

'use client'

import { useState, useEffect, useCallback } from 'react'
import { UserCog, Plus, Trash2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

interface Account { id: string; username: string; role: string; createdAt: string }

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [fUsername, setFUsername] = useState('')
  const [fPassword, setFPassword] = useState('')

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
    if (res.ok) { toast.success('帳號已建立'); setShowForm(false); setFUsername(''); setFPassword(''); fetchData() }
    else toast.error(data.error || '建立失敗')
  }

  async function handleDelete() {
    if (!deleteId) return
    const res = await fetch(`/api/accounts/${deleteId}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) { toast.success('帳號已刪除'); fetchData() }
    else toast.error(data.error || '刪除失敗')
    setDeleteId(null)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserCog className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">帳號管理</h1>
            <p className="text-xs text-muted-foreground">僅超級管理員可操作</p>
          </div>
        </div>
        <Button onClick={() => { setFUsername(''); setFPassword(''); setShowForm(true) }} className="gap-2">
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
                <div key={acc.id} className="flex items-center justify-between p-4 hover:bg-accent/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      {acc.role === 'SUPER_ADMIN'
                        ? <Sparkles className="w-5 h-5 text-primary" />
                        : <UserCog className="w-5 h-5 text-primary" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{acc.username}</p>
                      <p className="text-xs text-muted-foreground">建立於 {format(new Date(acc.createdAt), 'yyyy/MM/dd')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={acc.role === 'SUPER_ADMIN' ? 'border-primary/30 text-primary bg-primary/5' : ''}>
                      {acc.role === 'SUPER_ADMIN' ? '超級管理員' : '店家帳號'}
                    </Badge>
                    {acc.role !== 'SUPER_ADMIN' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(acc.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增店家帳號</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>帳號 ID <span className="text-destructive">*</span></Label>
              <Input value={fUsername} onChange={e => setFUsername(e.target.value)} placeholder="設定帳號 ID" />
            </div>
            <div className="space-y-2">
              <Label>密碼 <span className="text-destructive">*</span></Label>
              <Input type="password" value={fPassword} onChange={e => setFPassword(e.target.value)} placeholder="設定密碼" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>取消</Button>
            <Button onClick={handleCreate}>建立帳號</Button>
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

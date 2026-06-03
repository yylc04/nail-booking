'use client'

import { useState, useEffect, useCallback } from 'react'
import { Gem, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

interface Service {
  id: string; name: string; price: number; duration: number; description?: string; isActive: boolean
}
interface Category { id: string; name: string; services: Service[] }

export default function ServicesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [fName, setFName] = useState('')
  const [fPrice, setFPrice] = useState('')
  const [fDuration, setFDuration] = useState('')
  const [fDesc, setFDesc] = useState('')
  const [fCategory, setFCategory] = useState('')
  const [fActive, setFActive] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/services')
    setCategories(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function openCreate() {
    setEditing(null); setFName(''); setFPrice(''); setFDuration(''); setFDesc(''); setFCategory(''); setFActive(true)
    setShowForm(true)
  }

  function openEdit(svc: Service, catName: string) {
    setEditing(svc); setFName(svc.name); setFPrice(String(svc.price)); setFDuration(String(svc.duration))
    setFDesc(svc.description || ''); setFCategory(catName); setFActive(svc.isActive)
    setShowForm(true)
  }

  async function handleSave() {
    if (!fName || !fPrice || !fDuration || !fCategory) return toast.error('請填寫所有必填欄位')
    const url = editing ? `/api/services/${editing.id}` : '/api/services'
    const method = editing ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: fName, price: fPrice, duration: fDuration, description: fDesc, categoryName: fCategory, isActive: fActive }),
    })
    if (res.ok) { toast.success(editing ? '已更新' : '已新增'); setShowForm(false); fetchData() }
    else toast.error('操作失敗')
  }

  async function handleDelete() {
    if (!deleteId) return
    const res = await fetch(`/api/services/${deleteId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('服務已刪除'); fetchData() }
    else toast.error('刪除失敗')
    setDeleteId(null)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gem className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">服務項目</h1>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> 新增服務
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">載入中...</div>
      ) : (
        <div className="space-y-4">
          {categories.map(cat => (
            <Card key={cat.id} className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-primary">{cat.name}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cat.services.map(svc => (
                    <div key={svc.id} className="relative p-3 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-accent/30 transition-all group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold truncate">{svc.name}</p>
                            {!svc.isActive && <Badge variant="outline" className="text-xs text-muted-foreground">停用</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{svc.duration} 分鐘</p>
                          {svc.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{svc.description}</p>}
                        </div>
                        <p className="text-sm font-bold text-primary shrink-0">NT$ {svc.price.toLocaleString()}</p>
                      </div>
                      <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(svc, cat.name)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteId(svc.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? '編輯服務' : '新增服務'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>服務名稱 <span className="text-destructive">*</span></Label>
              <Input value={fName} onChange={e => setFName(e.target.value)} placeholder="例：素色光療" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>價格 (NT$) <span className="text-destructive">*</span></Label>
                <Input type="number" value={fPrice} onChange={e => setFPrice(e.target.value)} placeholder="800" />
              </div>
              <div className="space-y-2">
                <Label>施作時間 (分鐘) <span className="text-destructive">*</span></Label>
                <Input type="number" value={fDuration} onChange={e => setFDuration(e.target.value)} placeholder="60" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>分類 <span className="text-destructive">*</span></Label>
              <Input value={fCategory} onChange={e => setFCategory(e.target.value)} placeholder="例：光療凝膠" list="cat-list" />
              <datalist id="cat-list">
                {categories.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label>說明</Label>
              <Textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={2} placeholder="選填" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="active" checked={fActive} onChange={e => setFActive(e.target.checked)} className="accent-primary" />
              <Label htmlFor="active">啟用此服務</Label>
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
            <AlertDialogDescription>確定要刪除此服務嗎？</AlertDialogDescription>
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

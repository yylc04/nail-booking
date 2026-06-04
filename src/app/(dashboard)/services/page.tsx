'use client'

import { useState, useEffect, useCallback } from 'react'
import { Gem, Plus, Pencil, Trash2, Tag } from 'lucide-react'
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
  const [editingCatName, setEditingCatName] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Category management
  const [showCatForm, setShowCatForm] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null)
  const [deleteCatError, setDeleteCatError] = useState('')

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
    setEditingCatName(catName)
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

  async function handleDeleteService() {
    if (!deleteId) return
    const res = await fetch(`/api/services/${deleteId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('服務已刪除'); fetchData() }
    else toast.error('刪除失敗')
    setDeleteId(null)
  }

  async function handleCreateCategory() {
    if (!newCatName.trim()) return toast.error('請輸入分類名稱')
    const res = await fetch('/api/categories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName.trim() }),
    })
    const data = await res.json()
    if (res.ok) { toast.success('分類已建立'); setNewCatName(''); setShowCatForm(false); fetchData() }
    else toast.error(data.error || '建立失敗')
  }

  async function handleDeleteCategory() {
    if (!deleteCatId) return
    const res = await fetch(`/api/categories/${deleteCatId}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) { toast.success('分類已刪除'); fetchData() }
    else setDeleteCatError(data.error || '刪除失敗')
    if (res.ok) setDeleteCatId(null)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gem className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">服務項目</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setNewCatName(''); setShowCatForm(true) }} className="gap-2">
            <Tag className="w-4 h-4" /> 管理分類
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> 新增服務
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">載入中...</div>
      ) : (
        <div className="space-y-4">
          {categories.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">尚未建立任何分類，請先新增分類</div>
          )}
          {categories.map(cat => (
            <Card key={cat.id} className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-primary">{cat.name}</CardTitle>
                  <Button
                    variant="ghost" size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1"
                    onClick={() => { setDeleteCatId(cat.id); setDeleteCatError('') }}
                  >
                    <Trash2 className="w-3 h-3" /> 刪除分類
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {cat.services.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">此分類尚無服務</p>
                ) : (
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
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Service form */}
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
              <Input value={fCategory} onChange={e => setFCategory(e.target.value)} placeholder="選擇或輸入分類名稱" list="cat-list" />
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

      {/* Category management dialog */}
      <Dialog open={showCatForm} onOpenChange={setShowCatForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>管理分類</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                placeholder="輸入新分類名稱"
                onKeyDown={e => e.key === 'Enter' && handleCreateCategory()}
              />
              <Button onClick={handleCreateCategory}>新增</Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-2.5 rounded-xl bg-accent/30">
                  <div>
                    <span className="text-sm font-medium">{cat.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{cat.services.length} 個服務</span>
                  </div>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                    onClick={() => { setDeleteCatId(cat.id); setDeleteCatError(''); setShowCatForm(false) }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCatForm(false)}>關閉</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete service */}
      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除服務</AlertDialogTitle>
            <AlertDialogDescription>確定要刪除此服務嗎？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteService} className="bg-destructive hover:bg-destructive/90">刪除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete category */}
      <AlertDialog open={!!deleteCatId} onOpenChange={o => { if (!o) { setDeleteCatId(null); setDeleteCatError('') } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除分類</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCatError
                ? <span className="text-destructive font-medium">{deleteCatError}</span>
                : '確定要刪除此分類嗎？'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteCatError('')}>取消</AlertDialogCancel>
            {!deleteCatError && (
              <AlertDialogAction onClick={handleDeleteCategory} className="bg-destructive hover:bg-destructive/90">刪除</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

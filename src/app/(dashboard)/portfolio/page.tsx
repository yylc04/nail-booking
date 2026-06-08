'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Upload, Eye, EyeOff, GripVertical, ImageIcon, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import Image from 'next/image'

interface Category { id: string; name: string }
interface PortfolioItem {
  id: string
  name: string
  price: number | null
  imageData: string
  categoryId: string | null
  isVisible: boolean
  order: number
  category: { id: string; name: string } | null
}

export default function PortfolioPage() {
  const [items, setItems] = useState<PortfolioItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)

  // New item form
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newCategoryId, setNewCategoryId] = useState('')
  const [newImage, setNewImage] = useState<string | null>(null)

  // Edit item state
  const [editItem, setEditItem] = useState<PortfolioItem | null>(null)
  const [editName, setEditName] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editImage, setEditImage] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const editFileRef = useRef<HTMLInputElement>(null)
  const dragItem = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/portfolio').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
    ]).then(([portfolio, cats]) => {
      setItems(portfolio || [])
      setCategories(cats || [])
      setLoading(false)
    })
  }, [])

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { toast.error('圖片不能超過 3MB'); return }
    const reader = new FileReader()
    reader.onload = () => setNewImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  function handleEditImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { toast.error('圖片不能超過 3MB'); return }
    const reader = new FileReader()
    reader.onload = () => setEditImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  function openEdit(item: PortfolioItem) {
    setEditItem(item)
    setEditName(item.name)
    setEditPrice(item.price != null ? String(item.price) : '')
    setEditCategoryId(item.categoryId || '')
    setEditImage(null)
  }

  async function handleAdd() {
    if (!newName.trim()) { toast.error('請輸入作品名稱'); return }
    if (!newImage) { toast.error('請選擇作品圖片'); return }
    setSaving(true)
    const res = await fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.trim(),
        price: newPrice ? Number(newPrice) : null,
        imageData: newImage,
        categoryId: newCategoryId || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const item = await res.json()
      setItems(prev => [...prev, item])
      setNewName('')
      setNewPrice('')
      setNewCategoryId('')
      setNewImage(null)
      setShowAdd(false)
      toast.success('作品已新增')
    } else {
      toast.error('新增失敗')
    }
  }

  async function handleEditSave() {
    if (!editItem) return
    if (!editName.trim()) { toast.error('請輸入作品名稱'); return }
    setEditSaving(true)
    const body: Record<string, unknown> = {
      name: editName.trim(),
      price: editPrice ? Number(editPrice) : null,
      categoryId: editCategoryId || null,
    }
    if (editImage) body.imageData = editImage
    const res = await fetch(`/api/portfolio/${editItem.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setEditSaving(false)
    if (res.ok) {
      const cat = categories.find(c => c.id === editCategoryId) ?? null
      setItems(prev => prev.map(i => i.id === editItem.id ? {
        ...i,
        name: editName.trim(),
        price: editPrice ? Number(editPrice) : null,
        categoryId: editCategoryId || null,
        category: cat ? { id: cat.id, name: cat.name } : null,
        imageData: editImage || i.imageData,
      } : i))
      setEditItem(null)
      toast.success('作品已更新')
    } else {
      toast.error('更新失敗')
    }
  }

  async function toggleVisibility(item: PortfolioItem) {
    await fetch(`/api/portfolio/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isVisible: !item.isVisible }),
    })
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, isVisible: !i.isVisible } : i))
  }

  async function deleteItem(id: string) {
    if (!confirm('確定要刪除這個作品嗎？')) return
    await fetch(`/api/portfolio/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
    toast.success('作品已刪除')
  }

  async function handleDragEnd() {
    if (dragItem.current === null || dragOverItem.current === null) return
    if (dragItem.current === dragOverItem.current) return

    const newItems = [...items]
    const dragged = newItems.splice(dragItem.current, 1)[0]
    newItems.splice(dragOverItem.current, 0, dragged)
    const reordered = newItems.map((item, idx) => ({ ...item, order: idx }))
    setItems(reordered)

    dragItem.current = null
    dragOverItem.current = null

    await fetch('/api/portfolio', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: reordered.map(({ id, order }) => ({ id, order })) }),
    })
  }

  if (loading) return <div className="p-6 text-muted-foreground">載入中...</div>

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ImageIcon className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">作品集管理</h1>
            <p className="text-xs text-muted-foreground">共 {items.length} 件作品，{items.filter(i => i.isVisible).length} 件顯示中</p>
          </div>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-1.5 min-h-[44px]">
          <Plus className="w-4 h-4" /> 新增作品
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <ImageIcon className="w-8 h-8 text-primary/50" />
          </div>
          <p className="text-muted-foreground text-sm">尚未新增任何作品</p>
          <Button variant="outline" className="mt-4 gap-1.5" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" /> 新增第一件作品
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {items.map((item, idx) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => { dragItem.current = idx }}
              onDragEnter={() => { dragOverItem.current = idx }}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              className="relative rounded-2xl overflow-hidden border border-border/50 shadow-sm bg-white group cursor-grab active:cursor-grabbing transition-all"
            >
              {/* Image */}
              <div className="aspect-square relative">
                <Image
                  src={item.imageData}
                  alt={item.name}
                  fill
                  className={`object-cover transition-all ${!item.isVisible ? 'grayscale opacity-60' : ''}`}
                  unoptimized
                />
                {/* Drag handle */}
                <div className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-black/50 rounded-lg p-1">
                    <GripVertical className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
                {/* 已隱藏 badge */}
                {!item.isVisible && (
                  <div className="absolute top-1.5 right-1.5 bg-black/70 rounded-full px-1.5 py-0.5 flex items-center gap-1">
                    <EyeOff className="w-2.5 h-2.5 text-white" />
                    <span className="text-[9px] text-white font-medium">已隱藏</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-2">
                <p className="text-xs font-semibold truncate">{item.name}</p>
                <div className="flex items-center justify-between mt-0.5">
                  {item.price != null && <p className="text-xs text-primary font-medium">NT$ {item.price.toLocaleString()}</p>}
                  {item.category && <span className="text-[10px] bg-accent text-muted-foreground rounded px-1.5 py-0.5">{item.category.name}</span>}
                </div>
              </div>

              {/* Action bar */}
              <div className="flex border-t border-border/50 divide-x divide-border/50">
                <button
                  onClick={() => openEdit(item)}
                  className="flex-1 py-1.5 flex items-center justify-center hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
                  title="編輯"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={() => toggleVisibility(item)}
                  className="flex-1 py-1.5 flex items-center justify-center gap-0.5 hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground text-[10px] font-medium"
                >
                  {item.isVisible
                    ? <><EyeOff className="w-3 h-3" /><span>隱藏</span></>
                    : <><Eye className="w-3 h-3" /><span>上架</span></>
                  }
                </button>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="flex-1 py-1.5 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors text-muted-foreground"
                  title="刪除"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={o => { if (!saving) { setShowAdd(o); if (!o) { setNewImage(null); setNewName(''); setNewPrice(''); setNewCategoryId('') } } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>新增作品</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>作品圖片 <span className="text-destructive">*</span></Label>
              {newImage ? (
                <div className="relative aspect-square w-full max-w-[200px] mx-auto rounded-2xl overflow-hidden border border-border">
                  <Image src={newImage} alt="預覽" fill className="object-cover" unoptimized />
                  <button
                    onClick={() => setNewImage(null)}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileRef.current?.click()}
                  className="aspect-square w-full max-w-[200px] mx-auto rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 transition-colors bg-accent/20"
                >
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">點擊上傳圖片</p>
                  <p className="text-[10px] text-muted-foreground">JPG / PNG，最大 3MB</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </div>

            <div className="space-y-2">
              <Label>作品名稱 <span className="text-destructive">*</span></Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="例：法式漸層指甲" />
            </div>

            <div className="space-y-2">
              <Label>價格（選填）</Label>
              <Input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="例：1800" min={0} />
            </div>

            <div className="space-y-2">
              <Label>分類（選填）</Label>
              <select
                value={newCategoryId}
                onChange={e => setNewCategoryId(e.target.value)}
                className="w-full text-sm border border-border rounded-xl px-3 py-2.5 bg-background min-h-[44px]"
              >
                <option value="">不指定分類</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)} disabled={saving}>取消</Button>
              <Button className="flex-1" onClick={handleAdd} disabled={saving}>
                {saving ? '新增中...' : '新增作品'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={o => { if (!editSaving && !o) setEditItem(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>編輯作品</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>作品圖片</Label>
              {(editImage || editItem?.imageData) ? (
                <div className="relative aspect-square w-full max-w-[200px] mx-auto rounded-2xl overflow-hidden border border-border">
                  <Image src={editImage || editItem!.imageData} alt="預覽" fill className="object-cover" unoptimized />
                  <button
                    onClick={() => editFileRef.current?.click()}
                    className="absolute bottom-2 right-2 p-1.5 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                    title="更換圖片"
                  >
                    <Upload className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => editFileRef.current?.click()}
                  className="aspect-square w-full max-w-[200px] mx-auto rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 transition-colors bg-accent/20"
                >
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">點擊上傳圖片</p>
                </div>
              )}
              <input ref={editFileRef} type="file" accept="image/*" className="hidden" onChange={handleEditImageChange} />
            </div>

            <div className="space-y-2">
              <Label>作品名稱 <span className="text-destructive">*</span></Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="例：法式漸層指甲" />
            </div>

            <div className="space-y-2">
              <Label>價格（選填）</Label>
              <Input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} placeholder="例：1800" min={0} />
            </div>

            <div className="space-y-2">
              <Label>分類（選填）</Label>
              <select
                value={editCategoryId}
                onChange={e => setEditCategoryId(e.target.value)}
                className="w-full text-sm border border-border rounded-xl px-3 py-2.5 bg-background min-h-[44px]"
              >
                <option value="">不指定分類</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setEditItem(null)} disabled={editSaving}>取消</Button>
              <Button className="flex-1" onClick={handleEditSave} disabled={editSaving}>
                {editSaving ? '儲存中...' : '儲存'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category legend */}
      {categories.length > 0 && items.length > 0 && (
        <Card className="mt-6 border-border/50 shadow-sm">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground mb-2">拖曳作品卡片可重新排序</p>
            <div className="flex flex-wrap gap-1.5">
              {categories.map(c => (
                <span key={c.id} className="text-xs bg-accent border border-border rounded-full px-2.5 py-1">{c.name} ({items.filter(i => i.categoryId === c.id).length})</span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

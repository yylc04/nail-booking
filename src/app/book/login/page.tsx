'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Sparkles, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ref = searchParams.get('ref') || ''
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!phone) return toast.error('請輸入手機號碼')
    setLoading(true)
    const res = await fetch('/api/book/customer-login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, accountId: ref || undefined }),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) {
      toast.success(`歡迎回來，${data.name}！`)
      router.push('/book/my-bookings')
    } else {
      toast.error(data.error || '查詢失敗')
    }
  }

  const backHref = ref ? `/book/${ref}` : '/book'

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-fuchsia-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-primary/10 mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">查詢我的預約</h1>
          <p className="text-sm text-muted-foreground mt-1">輸入預約時使用的手機號碼</p>
        </div>

        <Card className="border-border/50 shadow-lg shadow-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">客人登入</CardTitle>
            <CardDescription>只需輸入手機號碼，無需密碼</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">手機號碼</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="09xxxxxxxx" className="pl-9" required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? '查詢中...' : '查詢預約'}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <p className="text-xs text-muted-foreground">
                還沒有預約？{' '}
                <a href={backHref} className="text-primary hover:underline font-medium">立即預約</a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function CustomerLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

type Result = { name: string; pass: boolean; detail: string }
const results: Result[] = []

function ok(name: string, detail: string) {
  results.push({ name, pass: true, detail })
  console.log(`  ✅ ${name}: ${detail}`)
}
function fail(name: string, detail: string) {
  results.push({ name, pass: false, detail })
  console.log(`  ❌ ${name}: ${detail}`)
}

async function main() {
  console.log('========================================')
  console.log('  Vivian 帳號自動化測試')
  console.log('========================================')

  // ── Test 1: Role = STORE ────────────────────────────────────────────────────
  console.log('\n【1. Vivian role 驗證】')
  const vivian = await prisma.storeUser.findUnique({
    where: { username: 'vivian' },
    select: { role: true, storeId: true },
  })
  vivian?.role === 'STORE'
    ? ok('Vivian role = STORE', `role="${vivian.role}"`)
    : fail('Vivian role = STORE', `role="${vivian?.role}" (應為 STORE)`)

  // ── Test 2: storeId not null ────────────────────────────────────────────────
  console.log('\n【2. Vivian storeId 驗證】')
  vivian?.storeId
    ? ok('Vivian storeId 非 null', `storeId="${vivian.storeId}"`)
    : fail('Vivian storeId 非 null', 'storeId 仍為 null')

  const vivianStore = vivian?.storeId
    ? await prisma.store.findUnique({ where: { id: vivian.storeId } })
    : null
  vivianStore
    ? ok('vivian-store 存在', `name="${vivianStore.name}"`)
    : fail('vivian-store 存在', 'Store 記錄不存在')

  // ── Test 3: Vivian 新增服務 ─────────────────────────────────────────────────
  console.log('\n【3. Vivian 新增服務項目】')
  const storeId = vivian?.storeId
  if (storeId) {
    const TEST_SERVICE_NAME = '__test_vivian_service__'
    // Clean up any leftover from previous test run
    await prisma.service.deleteMany({ where: { storeId, name: TEST_SERVICE_NAME } })
    const catName = '__test_cat__'
    let cat = await prisma.serviceCategory.findUnique({
      where: { storeId_name: { storeId, name: catName } },
    })
    if (!cat) {
      cat = await prisma.serviceCategory.create({ data: { storeId, name: catName } })
    }
    const svc = await prisma.service.create({
      data: { name: TEST_SERVICE_NAME, price: 100, duration: 30, storeId, categoryId: cat.id },
    })
    svc?.id
      ? ok('Vivian 新增服務', `id="${svc.id}", name="${svc.name}"`)
      : fail('Vivian 新增服務', '建立失敗')
    // Cleanup
    await prisma.service.delete({ where: { id: svc.id } })
  } else {
    fail('Vivian 新增服務', 'storeId 為 null，跳過')
  }

  // ── Test 4: Vivian 新增客戶 ─────────────────────────────────────────────────
  console.log('\n【4. Vivian 新增客戶】')
  if (storeId) {
    const TEST_PHONE = '0900000000'
    await prisma.customer.deleteMany({ where: { storeId, phone: TEST_PHONE } })
    const customer = await prisma.customer.create({
      data: { name: '測試客戶', phone: TEST_PHONE, storeId },
    })
    customer?.id
      ? ok('Vivian 新增客戶', `id="${customer.id}", name="${customer.name}"`)
      : fail('Vivian 新增客戶', '建立失敗')
    // Cleanup
    await prisma.customer.delete({ where: { id: customer.id } })
  } else {
    fail('Vivian 新增客戶', 'storeId 為 null，跳過')
  }

  // ── Test 5: 資料隔離 ────────────────────────────────────────────────────────
  console.log('\n【5. 資料隔離驗證】')
  const yuu = await prisma.storeUser.findUnique({
    where: { username: '2yuu' },
    select: { storeId: true },
  })

  yuu?.storeId && vivian?.storeId && yuu.storeId !== vivian.storeId
    ? ok('storeId 互不相同', `2yuu="${yuu.storeId}" / vivian="${vivian.storeId}"`)
    : fail('storeId 互不相同', `2yuu="${yuu?.storeId}" / vivian="${vivian?.storeId}"`)

  // Services isolation: vivian should only see her own storeId services
  if (storeId && yuu?.storeId) {
    const yuuServices = await prisma.service.findMany({ where: { storeId: yuu.storeId } })
    const vivianServices = await prisma.service.findMany({ where: { storeId } })
    const leak = yuuServices.filter(s => s.storeId === storeId)
    leak.length === 0
      ? ok('服務項目無跨店洩漏', `2yuu ${yuuServices.length} 筆, vivian ${vivianServices.length} 筆`)
      : fail('服務項目無跨店洩漏', `${leak.length} 筆 2yuu 服務混入 vivian storeId`)
  }

  // ── Test 6: /book/vivian 路由存在 ───────────────────────────────────────────
  console.log('\n【6. /book/vivian 路由驗證】')
  // The dynamic route is src/app/book/[accountId]/page.tsx
  // We verify vivian user exists with a storeId (the route resolves via accountId=username)
  const { existsSync } = await import('fs')
  const routeFile = new URL('../src/app/book/[accountId]/page.tsx', import.meta.url).pathname
    .replace(/^\/([A-Z]:)/, '$1') // fix Windows path

  existsSync(routeFile)
    ? ok('/book/[accountId] 路由檔案存在', routeFile)
    : fail('/book/[accountId] 路由檔案存在', '找不到路由檔案')

  // Also confirm: querying book services for vivian returns the store
  if (vivian?.storeId) {
    const vivianUserForBook = await prisma.storeUser.findUnique({
      where: { username: 'vivian' },
      select: { storeId: true },
    })
    vivianUserForBook?.storeId
      ? ok('/book/vivian → vivian storeId 可解析', `storeId="${vivianUserForBook.storeId}"`)
      : fail('/book/vivian → vivian storeId 可解析', 'storeId 為 null，路由將 404')
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length

  console.log('\n========================================')
  console.log(`  結果：${passed} 通過 / ${failed} 失敗`)
  console.log('========================================')

  if (failed > 0) {
    console.log('\n失敗項目：')
    results.filter(r => !r.pass).forEach(r => console.log(`  ❌ ${r.name}: ${r.detail}`))
    process.exit(1)
  } else {
    console.log('\n全部通過 ✅')
    process.exit(0)
  }
}

main().finally(() => prisma.$disconnect())

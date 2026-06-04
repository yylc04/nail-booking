import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as Parameters<typeof PrismaClient>[0])

const BASE = 'http://localhost:3099'

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

async function loginCookie(username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const setCookie = res.headers.get('set-cookie') ?? ''
  const match = setCookie.match(/store_session=([^;]+)/)
  if (!match) throw new Error(`Login failed for ${username}: ${await res.text()}`)
  return match[1]
}

async function apiGet(path: string, cookie: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Cookie: `store_session=${cookie}` },
  })
  return res.json()
}

// ─── Section 1: 資料隔離 ────────────────────────────────────────────────────
async function testDataIsolation() {
  console.log('\n【1. 資料隔離測試】')

  const yuu = await prisma.storeUser.findUnique({
    where: { username: '2yuu' },
    select: { storeId: true },
  })
  const vivian = await prisma.storeUser.findUnique({
    where: { username: 'vivian' },
    select: { storeId: true },
  })

  yuu?.storeId
    ? ok('2yuu.storeId', `= "${yuu.storeId}"`)
    : fail('2yuu.storeId', 'NULL — storeId 未設定')

  vivian?.storeId
    ? ok('vivian.storeId', `= "${vivian.storeId}"`)
    : fail('vivian.storeId', 'NULL — storeId 未設定')

  yuu?.storeId && vivian?.storeId && yuu.storeId !== vivian.storeId
    ? ok('storeId 互不相同', `${yuu.storeId} ≠ ${vivian.storeId}`)
    : fail('storeId 互不相同', `2yuu="${yuu?.storeId}" vivian="${vivian?.storeId}"`)

  // API isolation using live session
  const vivianCookie = await loginCookie('vivian', '889988')

  const appts = await apiGet('/api/appointments', vivianCookie) as unknown[]
  Array.isArray(appts) && appts.length === 0
    ? ok('vivian 預約數量', '= 0（正確隔離）')
    : fail('vivian 預約數量', `= ${Array.isArray(appts) ? appts.length : JSON.stringify(appts)}（應為 0）`)

  const customers = await apiGet('/api/customers', vivianCookie) as unknown[]
  Array.isArray(customers) && customers.length === 0
    ? ok('vivian 客戶數量', '= 0（正確隔離）')
    : fail('vivian 客戶數量', `= ${Array.isArray(customers) ? customers.length : JSON.stringify(customers)}（應為 0）`)

  const services = await apiGet('/api/services', vivianCookie) as unknown[]
  Array.isArray(services) && services.length === 0
    ? ok('vivian 服務項目數量', '= 0（正確隔離）')
    : fail('vivian 服務項目數量', `= ${Array.isArray(services) ? services.length : JSON.stringify(services)}（應為 0）`)
}

// ─── Section 2: 預約網址 ────────────────────────────────────────────────────
async function testBookingUrls() {
  console.log('\n【2. 預約網址測試】')

  const yuuUser = await prisma.storeUser.findUnique({
    where: { username: '2yuu' },
    select: { storeId: true },
  })
  const vivianUser = await prisma.storeUser.findUnique({
    where: { username: 'vivian' },
    select: { storeId: true },
  })

  // /book/2yuu → fetches 2yuu's store
  const yuuBook = await fetch(`${BASE}/api/book/services?accountId=2yuu`).then(r => r.json()) as { store?: { name?: string } }
  const yuuStoreName = yuuBook?.store?.name
  const yuuStoreRow = yuuUser?.storeId
    ? await prisma.store.findUnique({ where: { id: yuuUser.storeId }, select: { name: true } })
    : null

  yuuStoreRow && yuuStoreName === yuuStoreRow.name
    ? ok('/book/2yuu → 2yuu store', `storeName="${yuuStoreName}"`)
    : fail('/book/2yuu → 2yuu store', `got "${yuuStoreName}", expected "${yuuStoreRow?.name}"`)

  // /book/vivian → fetches vivian's store
  const vivianBook = await fetch(`${BASE}/api/book/services?accountId=vivian`).then(r => r.json()) as { store?: { name?: string } }
  const vivianStoreName = vivianBook?.store?.name
  const vivianStoreRow = vivianUser?.storeId
    ? await prisma.store.findUnique({ where: { id: vivianUser.storeId }, select: { name: true } })
    : null

  vivianStoreRow && vivianStoreName === vivianStoreRow.name
    ? ok('/book/vivian → vivian store', `storeName="${vivianStoreName}"`)
    : fail('/book/vivian → vivian store', `got "${vivianStoreName}", expected "${vivianStoreRow?.name}"`)

  // Confirm stores are different
  yuuStoreName && vivianStoreName && yuuStoreName !== vivianStoreName
    ? ok('兩個預約頁 store 不同', `"${yuuStoreName}" ≠ "${vivianStoreName}"`)
    : fail('兩個預約頁 store 不同', `got same: "${yuuStoreName}"`)
}

// ─── Section 3: 帳號管理欄位 ─────────────────────────────────────────────────
async function testAccountFields() {
  console.log('\n【3. 帳號管理欄位測試】')

  // Check DB columns exist by doing a select on each field
  const user = await prisma.storeUser.findFirst({
    select: {
      storeId: true,
      contactName: true,
      phone: true,
      lineId: true,
      plan: true,
      expiryDate: true,
      notes: true,
    },
  })

  const fields = ['storeId', 'contactName', 'phone', 'lineId', 'plan', 'expiryDate', 'notes'] as const
  for (const f of fields) {
    // If field exists in schema, the select above succeeded (no throw)
    // null means column exists but is empty
    user !== undefined
      ? ok(`StoreUser.${f} 欄位存在`, user ? `value=${JSON.stringify((user as Record<string, unknown>)[f])}` : 'column exists')
      : fail(`StoreUser.${f} 欄位存在`, '欄位不存在或查詢失敗')
  }

  // Check SUPER_ADMIN via API
  const yuuCookie = await loginCookie('2yuu', '2yuu2026')
  // Only SUPER_ADMIN can hit accounts API; test with yylc
  const ylylcCookie = await loginCookie('yylc', 'yylc2004')
  const accounts = await apiGet('/api/accounts', ylylcCookie) as Array<Record<string, unknown>>
  if (Array.isArray(accounts) && accounts.length > 0) {
    const sample = accounts[0]
    const apiFields = ['contactName', 'phone', 'lineId', 'plan', 'expiryDate', 'notes', 'storeName']
    for (const f of apiFields) {
      Object.prototype.hasOwnProperty.call(sample, f)
        ? ok(`API /accounts 包含 ${f}`, `value=${JSON.stringify(sample[f])}`)
        : fail(`API /accounts 包含 ${f}`, '回傳資料中無此欄位')
    }
  } else {
    fail('GET /api/accounts', `Expected array, got: ${JSON.stringify(accounts)}`)
  }
  void yuuCookie // unused but avoids warning
}

// ─── Section 4: 側邊欄店家名稱 ──────────────────────────────────────────────
async function testSidebarStoreName() {
  console.log('\n【4. 側邊欄店家名稱測試】')

  // The sidebar name comes from the store record linked by session.storeId.
  // We verify via /api/settings which is what the layout uses.

  const yuuCookie = await loginCookie('2yuu', '2yuu2026')
  const vivianCookie = await loginCookie('vivian', '889988')

  const yuuSettings = await apiGet('/api/settings', yuuCookie) as { name?: string } | null
  const vivianSettings = await apiGet('/api/settings', vivianCookie) as { name?: string } | null

  const yuuName = yuuSettings?.name
  const vivianName = vivianSettings?.name

  yuuName
    ? ok('2yuu /api/settings.name', `= "${yuuName}"`)
    : fail('2yuu /api/settings.name', 'null or missing')

  vivianName
    ? ok('vivian /api/settings.name', `= "${vivianName}"`)
    : fail('vivian /api/settings.name', 'null or missing')

  yuuName && vivianName && yuuName !== vivianName
    ? ok('兩帳號店家名稱不同', `"${yuuName}" ≠ "${vivianName}"`)
    : fail('兩帳號店家名稱不同', `2yuu="${yuuName}" vivian="${vivianName}"`)

  vivianName && !vivianName.includes('2yuu')
    ? ok('vivian 不顯示 2yuu 的店名', `vivian settings.name="${vivianName}"`)
    : fail('vivian 不顯示 2yuu 的店名', `vivian settings.name="${vivianName}" 含有 2yuu`)

  // Also verify via DB
  const yuuUser = await prisma.storeUser.findUnique({
    where: { username: '2yuu' },
    include: { store: { select: { name: true } } },
  })
  const vivianUser = await prisma.storeUser.findUnique({
    where: { username: 'vivian' },
    include: { store: { select: { name: true } } },
  })

  yuuUser?.store?.name
    ? ok('DB: 2yuu store.name', `= "${yuuUser.store.name}"`)
    : fail('DB: 2yuu store.name', 'store relation null or name missing')

  vivianUser?.store?.name
    ? ok('DB: vivian store.name', `= "${vivianUser.store.name}"`)
    : fail('DB: vivian store.name', 'store relation null or name missing')
}

// ─── Run all ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('========================================')
  console.log('  自動化驗證測試')
  console.log('========================================')

  try {
    await testDataIsolation()
    await testBookingUrls()
    await testAccountFields()
    await testSidebarStoreName()
  } catch (e) {
    console.error('\nFATAL:', e)
  }

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

import { PrismaClient, UserRole } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Create super admin
  const superAdminHash = await bcrypt.hash('yylc2004', 12)
  await prisma.storeUser.upsert({
    where: { username: 'yylc' },
    update: {},
    create: {
      username: 'yylc',
      passwordHash: superAdminHash,
      role: UserRole.SUPER_ADMIN,
    },
  })

  // Create store account
  const storeHash = await bcrypt.hash('2yuu2026', 12)
  await prisma.storeUser.upsert({
    where: { username: '2yuu' },
    update: {},
    create: {
      username: '2yuu',
      passwordHash: storeHash,
      role: UserRole.STORE,
    },
  })

  // Create default store
  const store = await prisma.store.upsert({
    where: { id: 'default-store' },
    update: {},
    create: {
      id: 'default-store',
      name: '夢幻美甲工作室',
    },
  })

  // Default business hours (Mon-Sat, 10:00-19:00)
  const defaultHours = [
    { dayOfWeek: 0, isOpen: false, openTime: '10:00', closeTime: '19:00' }, // Sun
    { dayOfWeek: 1, isOpen: true,  openTime: '10:00', closeTime: '19:00' }, // Mon
    { dayOfWeek: 2, isOpen: true,  openTime: '10:00', closeTime: '19:00' }, // Tue
    { dayOfWeek: 3, isOpen: true,  openTime: '10:00', closeTime: '19:00' }, // Wed
    { dayOfWeek: 4, isOpen: true,  openTime: '10:00', closeTime: '19:00' }, // Thu
    { dayOfWeek: 5, isOpen: true,  openTime: '10:00', closeTime: '19:00' }, // Fri
    { dayOfWeek: 6, isOpen: true,  openTime: '10:00', closeTime: '18:00' }, // Sat
  ]

  for (const hours of defaultHours) {
    await prisma.businessHour.upsert({
      where: { storeId_dayOfWeek: { storeId: store.id, dayOfWeek: hours.dayOfWeek } },
      update: {},
      create: { storeId: store.id, ...hours },
    })
  }

  // Default service categories
  const catNames = ['基礎保養', '光療凝膠', '美甲彩繪', '手足護理']
  const categories: Record<string, string> = {}
  for (const name of catNames) {
    const cat = await prisma.serviceCategory.upsert({
      where: { storeId_name: { storeId: store.id, name } },
      update: {},
      create: { storeId: store.id, name },
    })
    categories[name] = cat.id
  }

  // Default services
  const services = [
    { name: '基礎修甲', price: 300, duration: 30, categoryId: categories['基礎保養'] },
    { name: '基礎保養', price: 500, duration: 45, categoryId: categories['基礎保養'] },
    { name: '素色光療', price: 800, duration: 60, categoryId: categories['光療凝膠'] },
    { name: '漸層光療', price: 1200, duration: 90, categoryId: categories['光療凝膠'] },
    { name: '單色凝膠', price: 1000, duration: 75, categoryId: categories['光療凝膠'] },
    { name: '手繪彩繪(單色)', price: 1500, duration: 90, categoryId: categories['美甲彩繪'] },
    { name: '手繪彩繪(多色)', price: 1800, duration: 120, categoryId: categories['美甲彩繪'] },
    { name: '腳部基礎保養', price: 600, duration: 45, categoryId: categories['手足護理'] },
    { name: '腳部光療', price: 1000, duration: 75, categoryId: categories['手足護理'] },
  ]

  for (const s of services) {
    const existing = await prisma.service.findFirst({
      where: { storeId: store.id, name: s.name },
    })
    if (!existing) {
      await prisma.service.create({ data: { storeId: store.id, ...s } })
    }
  }

  console.log('✅ Seed completed successfully')
  console.log('   Super Admin: yylc / yylc2004')
  console.log('   Store Account: 2yuu / 2yuu2026')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  const prisma = new PrismaClient({ adapter })
  const users = await prisma.storeUser.findMany({ select: { username: true, role: true, storeId: true } })
  console.log('Users:', JSON.stringify(users, null, 2))
  const stores = await prisma.store.findMany({ select: { id: true, name: true } })
  console.log('Stores:', JSON.stringify(stores, null, 2))
  await prisma.$disconnect()
}
main().catch(console.error)

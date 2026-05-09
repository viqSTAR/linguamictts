require('dotenv').config();
const prisma = require('./src/utils/prisma');

async function clearDB() {
  try {
    console.log('Clearing database...');
    // Delete in reverse order of dependencies
    await prisma.creditTransaction.deleteMany({});
    await prisma.usageLog.deleteMany({});
    await prisma.apiKey.deleteMany({});
    await prisma.user.deleteMany({});
    console.log('All users, API keys, usage logs, and credit transactions have been deleted.');
  } catch (error) {
    console.error('Error clearing database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearDB();

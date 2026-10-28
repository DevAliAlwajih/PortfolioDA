import * as path from 'path';
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';

// Load .env from the backend directory (same approach as the seed)
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config({ path: envPath });
}

const prisma = new PrismaClient();

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function main() {
  const arg = (process.argv[2] ?? '').trim().toLowerCase();

  if (!arg) {
    console.error('Usage: npm run admin:set-email -- new.address@example.com');
    process.exit(1);
  }

  if (!isValidEmail(arg)) {
    console.error(`Error: "${arg}" is not a valid email address.`);
    process.exit(1);
  }

  const newEmail = arg;

  const admins = await prisma.admin.findMany();

  if (admins.length !== 1) {
    console.error(
      `Error: expected exactly 1 admin row, found ${admins.length}. ` +
        'Run `npm run seed` to create the first admin, or investigate duplicate rows.',
    );
    process.exit(1);
  }

  const admin = admins[0];

  if (admin.email === newEmail) {
    console.error(`Error: the admin email is already "${newEmail}". No change made.`);
    process.exit(1);
  }

  const oldEmail = admin.email;

  await prisma.admin.update({
    where: { id: admin.id },
    data: {
      email: newEmail,
      resetCode: null,
      resetExpires: null,
      tokenVersion: { increment: 1 },
    },
  });

  console.log(`Admin email changed: ${oldEmail} -> ${newEmail}`);
}

main().finally(() => prisma.$disconnect());

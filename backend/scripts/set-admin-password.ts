import * as path from 'path';
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Load .env from the backend directory (same approach as seed and set-admin-email)
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config({ path: envPath });
}

const prisma = new PrismaClient();

async function main() {
  const newPassword = process.env.NEW_ADMIN_PASSWORD ?? '';

  if (newPassword.length < 8) {
    console.error(
      'Error: NEW_ADMIN_PASSWORD environment variable must be set and at least 8 characters long.',
    );
    process.exit(1);
  }

  const admins = await prisma.admin.findMany();

  if (admins.length !== 1) {
    console.error(
      `Error: expected exactly 1 admin row, found ${admins.length}. ` +
        'Run `npm run seed` to create the first admin, or investigate duplicate rows.',
    );
    process.exit(1);
  }

  const admin = admins[0];

  await prisma.admin.update({
    where: { id: admin.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, 12),
      resetCode: null,
      resetExpires: null,
      tokenVersion: { increment: 1 },
    },
  });

  console.log('Admin password updated');
}

main().finally(() => prisma.$disconnect());

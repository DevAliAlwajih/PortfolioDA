import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const existingCount = await prisma.admin.count();
  if (existingCount > 0) {
    console.log('Admin already exists, skipping');
  } else {
    const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || '';
    if (!email || password.length < 8) {
      throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters) in .env first');
    }
    await prisma.admin.create({
      data: { email, passwordHash: await bcrypt.hash(password, 12) },
    });
    console.log(`Admin ready: ${email}`);
  }
  await prisma.profile.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      nameAr: 'Dev.Ali',
      nameEn: 'Dev.Ali',
      aboutAr: 'مطوّر ويب متكامل. عدّل هذا النص من لوحة الإدارة.',
      aboutEn: 'Full stack web developer. Edit this text from the admin panel.',
      visionAr: 'أبني برمجيات واضحة وسريعة تخدم الناس بلغتهم.',
      visionEn: 'I build clear, fast software that serves people in their own language.',
    },
  });
}

main().finally(() => prisma.$disconnect());

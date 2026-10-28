import * as path from 'path';
import * as fs from 'fs';

// Load .env
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config({ path: envPath });
}

import * as nodemailer from 'nodemailer';

async function main() {
  const to = (process.argv[2] ?? '').trim();
  if (!to) {
    console.error('Usage: npm run mail:test -- you@example.com');
    process.exit(1);
  }

  if (!process.env.SMTP_HOST) {
    console.error('SMTP_HOST is not set. Check your .env file.');
    process.exit(1);
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  try {
    await transport.sendMail({
      from: process.env.MAIL_FROM || 'Portfolio <no-reply@localhost>',
      to,
      subject: 'Portfolio – SMTP test',
      text: `This is a test email from the Portfolio backend.\nSent at: ${new Date().toISOString()}`,
    });
    console.log(`✓ Test email sent to ${to}`);
  } catch (err: any) {
    console.error(`✗ Failed to send: ${err.message}`);
    process.exit(1);
  }
}

main();

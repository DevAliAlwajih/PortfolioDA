# Portfolio (عربي / English)

NestJS + Prisma + PostgreSQL backend, React (Vite) frontend.

## Run locally

```bash
# 1. Database
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env        # then edit JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, SMTP_*
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed                # creates your admin account and the empty profile
npm run start:dev           # http://localhost:5000/api

# 3. Frontend (second terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

- Public site: `/`
- Admin panel: `/admin` (also linked as "الإدارة" at the top of the home page)

## Deploy as one server

```bash
cd frontend && npm install && npm run build
cd ../backend && npm install && npx prisma generate && npx prisma migrate deploy && npm run seed
npm run build && npm start
```

The backend serves `frontend/dist` and `/uploads` itself. Put it behind HTTPS (nginx, Caddy, etc.).

## What the admin can do

- Profile tab: photo, name (ar/en), phone, About, Vision.
- Works: add, edit and delete works and apps (web, mobile, desktop). Each has title, image, version,
  short description, link, intro, usage policy, usage steps (text + image), screenshots and downloadable files.
  The "Visit" button opens the work's own page.
- Links (title + URL), Contacts (title + number), extra sections (title + text). Use the order field to arrange items.
- Reviews: visitors submit name, email, stars and comment. New reviews stay hidden until you approve them.
  Emails are returned only by the admin API, never by the public one.
- Account: change password.

## Login and password reset

Email + password. "Forgot password" emails a 6-digit code valid for 15 minutes.
Without SMTP settings the code is printed in the backend console, which is enough for local use.
Login, reset and review submission are rate limited.

## Notes

- Set a long random `JWT_SECRET`; the server refuses to start without one.
- Uploads go to `backend/uploads` (200 MB limit per file; HTML, JS, PHP and SVG files are rejected).
  Back this folder up together with your database.
- Link fields accept only `http(s)://`, `tel:` and `mailto:` addresses.

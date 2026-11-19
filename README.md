# Aksara Bimbel — Backend API

Backend terpisah untuk aplikasi absensi bimbel. **Next.js API Routes** + **Prisma/Postgres (Supabase)** + JWT auth.

## Fitur

- API REST untuk: login/register/logout, absensi, data murid (CRUD + import/export Excel), data guru, rekap absensi
- Autentikasi JWT (access token 8 jam), role: `ADMIN`, `GURU`
- Keamanan: rate limit login, CSRF guard, security headers
- Prisma ORM dengan Supabase Postgres

## Prasyarat

- Node.js **>= 20.9** (disarankan 22)
- Database Postgres (Supabase) dengan URL koneksi

## Memulai

```bash
npm install
cp .env.example .env   # isi DATABASE_URL, JWT_SECRET
npx prisma generate
npm run dev
```

Server jalan di `http://localhost:3001`.

## Perintah

| Perintah                    | Fungsi                           |
| --------------------------- | -------------------------------- |
| `npm run dev`               | Server pengembangan (port 3001)  |
| `npm run build`             | Build produksi                   |
| `npm start`                 | Jalankan hasil build             |
| `npm run lint`              | ESLint                           |
| `npm run format`            | Prettier (menulis)               |
| `npm run format:check`      | Prettier (cek)                   |
| `npx prisma generate`       | Generate Prisma Client           |
| `npx prisma migrate deploy` | Apply migration ke production DB |

## Variabel Lingkungan

Rujuk `.env.example`:

| Variabel              | Keterangan                                  |
| --------------------- | ------------------------------------------- |
| `DATABASE_URL`        | URL koneksi Postgres (Supabase)             |
| `NODE_ENV`            | `development` \| `production`               |
| `JWT_SECRET`          | Kunci penandatanganan JWT (min 32 char)     |
| `ALLOWED_DEV_ORIGINS` | Origin tambahan untuk `next dev` (opsional) |

## Struktur

```
routes/          API route handlers (absensi, auth, murid, users)
lib/             Server-only: jwt, hash, rate-limit, api-guard, prisma
prisma/          Schema Prisma + migrations
```

## Deploy

- **Railway/Render**: Set env vars, run `npm run build` + `npm start`
- **Vercel**: API-only project, `prisma generate` di build step
- CORS: Allow frontend origin (production domain)

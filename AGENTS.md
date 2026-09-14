# AGENTS.md — AI Assistant Working Guide
## 2Menit Photobooth Kasir (kasir-app)

> Baca file ini **sepenuhnya** sebelum menulis kode apa pun di repo ini.
> File ini adalah **sumber kebenaran tunggal** untuk AI assistant yang bekerja
> di codebase ini. CLAUDE.md yang lama sudah di-rename jadi file ini.

---

## 1. Project Overview

**Product:** 2Menit Photobooth Kasir — aplikasi kasir internal untuk bisnis
photobooth. Crew mencatat transaksi di lokasi event; admin cabang mengelola
operasional per-kota; superadmin memantau semua cabang dan keuangan.

**Type:** Web app (browser-based, no native mobile). **PWA** — installable,
offline-first untuk role USER (kasir).

**Key differentiator:** Multi-cabang (multi-city) dengan 3 tier role +
offline-first transaction queue dengan idempotent sync.

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript | SSR untuk auth-gated pages |
| Styling | Tailwind CSS + shadcn-style components | `components/ui/` primitives |
| Backend | Next.js API Routes | RESTful JSON, satu codebase |
| Database | PostgreSQL | via Prisma ORM |
| Auth | NextAuth.js v4 (credentials provider) | JWT session, role-based |
| Validation | Zod | semua input divalidasi via `lib/validations.ts` |
| Offline | IndexedDB (`idb`) + sync queue | PWA service worker |
| Export | ExcelJS (XLSX) | `lib/export.ts` |
| Deployment | Docker (docker-compose.yml) | Local dev pakai Postgres container |

---

## 3. Roles & Permissions Matrix

Ada **3 role**: `SUPERADMIN`, `ADMIN`, `USER`. Mapping path:

| Role | Base path | Akses |
|---|---|---|
| SUPERADMIN | `/superadmin/*` | Semua cabang, semua data |
| ADMIN | `/admin/*` | Scoped by `cityId` — lihat & kelola events/users/crew di kotanya saja |
| USER | `/user/*` | Kasir offline-capable, lihat event di mana dia di-assign sebagai crew |

### Permission Matrix (updated)

| Action | SUPERADMIN | ADMIN | USER |
|---|:---:|:---:|:---:|
| Login | ✅ | ✅ | ✅ |
| Create user account | ✅ | ✅ (role USER, same city) | ❌ |
| Edit user | ✅ | ✅ (USER, same city) | ❌ |
| Delete user | ✅ | ❌ | ❌ |
| Create event | ✅ | ✅ (own city) | ❌ |
| Edit event | ✅ | ✅ (own city) | ❌ |
| Delete event | ✅ | ✅ (own city, guarded) | ❌ |
| Fill transaction | ✅ | ✅ | ✅ (assigned event) |
| View own 10 latest transactions | ✅ | ✅ | ✅ |
| View ALL event recaps | ✅ | ✅ (own city) | ❌ |
| Download recap (XLSX) | ✅ | ✅ (own city) | ❌ |
| Manage cities | ✅ | ❌ | ❌ |
| Manage crew assignment | ✅ | ✅ (own city) | ❌ |

**Always enforce permissions server-side** via `lib/session.ts` guards. Never
rely only on hidden UI elements.

---

## 4. Project Structure (CURRENT)

```
kasir-app/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (providers, theme)
│   ├── page.tsx                  # Redirect → /dashboard or /login
│   ├── dashboard/page.tsx        # Role-based redirect hub
│   ├── login/                    # Login page + form
│   ├── admin/                    # ADMIN area (per-cabang)
│   │   ├── layout.tsx
│   │   ├── dashboard/
│   │   ├── events/ (+ [id]/, [id]/edit, create)
│   │   ├── crew/                 # Crew management
│   │   ├── recaps/
│   │   └── profile/
│   ├── superadmin/               # SUPERADMIN area
│   │   ├── layout.tsx
│   │   ├── dashboard/
│   │   ├── cities/               # City CRUD
│   │   ├── events/ (+ [id]/, [id]/edit, create)
│   │   ├── users/                # User CRUD (all cities)
│   │   ├── recaps/
│   │   └── profile/
│   ├── user/                     # USER area (kasir)
│   │   ├── dashboard/
│   │   └── events/[id]/          # Transaction input
│   └── api/                      # API Routes (lihat §6)
├── components/
│   ├── ui/                       # Primitives (button, input, table, field, dialog)
│   ├── forms/                    # Form components
│   ├── app-shell.tsx             # Shared layout shell
│   ├── event-card.tsx            # Event list card
│   ├── offline-badge.tsx         # Online/offline status indicator
│   ├── service-worker-register.tsx
│   └── ...                       # Lihat FILEMAP.md untuk detail
├── lib/                          # Core logic (lihat FILEMAP.md)
│   ├── prisma.ts                 # Prisma client singleton
│   ├── auth.ts                   # NextAuth config + lockout logic
│   ├── session.ts                # Session helpers + role guards
│   ├── api.ts                    # ok()/fail()/handle() response envelope
│   ├── validations.ts            # Zod schemas untuk semua input
│   ├── pricing.ts                # Pricing calculation (BIASA/PISAH)
│   ├── recap.ts                  # Recap aggregation logic
│   ├── export.ts                 # XLSX generation
│   ├── format.ts                 # Date/currency formatting (WIB)
│   ├── offline-db.ts             # IndexedDB schema + helpers
│   ├── sync-queue.ts             # Offline sync queue logic
│   ├── use-offline-sync.ts       # React hook untuk sync
│   ├── client.ts                 # Fetch wrapper (client-side)
│   └── utils.ts                  # cn() class merger
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts                   # Production seed (superadmin only)
│   ├── seed-graph.ts             # Demo data dengan relationships
│   ├── seed-multi-cabang.ts      # Multi-city demo seed
│   └── migrations/               # 5 migrations (lihat §5)
├── types/
│   └── next-auth.d.ts           # Module augmentation untuk session
├── public/
│   ├── manifest.json             # PWA manifest
│   ├── sw.js                     # Service worker
│   └── simple-logo-2menit.png
├── middleware.ts                 # Route protection (page-level)
├── AGENTS.md                     ← you are here
├── FILEMAP.md                    # Peta file eksplisit (path → deskripsi)
├── PROGRESS.md                   # Changelog perubahan
├── README.md                     # Setup instructions
├── DEPLOY.md                     # Deployment guide
├── docker-compose.yml            # Postgres container untuk local dev
├── requirement.md                # Business requirements (original)
├── SRS.md                        # Software Requirements Spec
└── design.md                     # Design system & UI decisions
```

---

## 5. Database Schema (Prisma) — Current State

### Models
- **User** — dengan `cityId` (nullable, null untuk SUPERADMIN), `failedLoginAttempts`
  & `lockedUntil` untuk lockout logic.
- **City** — representasi cabang/kota (e.g. "Jember", "Jakarta"). Unik by name.
- **Event** — dengan `eventDateStart`/`eventDateEnd` (date range), `pricingType`
  (BIASA/PISAH), `copyPrice`, add-on fields, `allowCash`/`allowQris` toggles,
  `cityId`.
- **EventCrew** — junction User ↔ Event dengan `attended` flag.
- **Transaction** — dengan `clientTempId` (untuk idempotent offline sync),
  `addOnQty`/`addOnUnitPrice` snapshot, `userId` nullable.

### Enums
- `Role`: SUPERADMIN | ADMIN | USER
- `EventStatus`: UPCOMING | ONGOING | DONE | CANCELLED
- `PaymentMethod`: CASH | QRIS
- `PricingType`: BIASA (flat price) | PISAH (first print vs copy price)

### Migrations (chronological)
1. `0_init` — initial schema (User, Event, EventCrew, Transaction)
2. `20260705175819_event_date_range` — `eventDate` → `eventDateStart`/`eventDateEnd`
3. `20260712053000_add_payment_method_toggles` — `allowCash`, `allowQris`
4. `20260824222500_add_city_and_admin_role` — City model, `cityId` pada User & Event
5. `20260830000000_add_client_temp_id` — `clientTempId` untuk offline sync idempotency

> Setelah ubah `schema.prisma`: `npx prisma migrate dev --name <name>` lalu
> `npx prisma generate`. Jangan lupa update seed files kalau perlu.

---

## 6. API Endpoints (Current)

Semua API routes pakai pattern: `export const X = handle(async (req, ctx) => { ... })`.
Response envelope: `{ success: true, data }` atau `{ success: false, error, ...fieldErrors }`.

```
POST   /api/auth/[...nextauth]          → NextAuth handler (login, logout, session)

GET    /api/cities                       → [SUPERADMIN] list all cities
POST   /api/cities                       → [SUPERADMIN] create city
PUT    /api/cities/:id                   → [SUPERADMIN] update city

GET    /api/events                       → list events (filtered by role + cityId)
POST   /api/events                       → [ADMIN+] create event (auto-tag cityId)
GET    /api/events/:id                   → event detail + crew (+ transactions for SA)
PUT    /api/events/:id                   → [ADMIN+] edit event
PUT    /api/events/:id/crew              → update crew attendance

GET    /api/transactions?eventId=...     → list (USER: latest 10 only, DESC)
POST   /api/transactions                 → create transaction (server computes total)
POST   /api/transactions/batch            → offline sync: batch create with clientTempId
PUT    /api/transactions/:id             → edit transaction

GET    /api/recaps/event/:id             → [ADMIN+] per-event recap
GET    /api/recaps/monthly?month=&year=  → [ADMIN+] monthly recap (scoped by city)
GET    /api/recaps/yearly?year=          → [ADMIN+] yearly recap (scoped by city)
GET    /api/recaps/export?type=...        → [ADMIN+] download XLSX

GET    /api/users                         → [ADMIN+] list users (scoped by city for ADMIN)
POST   /api/users                         → [ADMIN+] create user
PUT    /api/users/:id                     → [ADMIN+] edit user

POST   /api/profile/password              → change own password
```

### Role guards (`lib/session.ts`)
```typescript
requireUser()              // any authenticated user → throws 401
requireRole("SUPERADMIN")  // specific role → throws 403
requireSuperadmin()        // = requireRole("SUPERADMIN")
requireAdmin()             // = requireRole("ADMIN")
requireAdminOrSuperadmin() // ADMIN or SUPERADMIN → throws 403
```

---

## 7. Key Business Logic

### Pricing Calculation (`lib/pricing.ts`)
```
BIASA: total = printCount × pricePerPrint
PISAH: total = (1 × pricePerPrint) + (max(0, printCount - 1) × copyPrice)
```
Add-on: `addOnQty × addOnUnitPrice` dijumlah ke total.

**Total selalu dihitung server-side.** Client kirim `printCount`, `paymentMethod`,
`addOnQty` saja. Jangan pernah trust `total` dari client.

### Recap Calculation (`lib/recap.ts`)
```
totalPrints      = SUM(transactions.printCount)
totalRevenue     = SUM(transactions.total)
cashRevenue      = SUM(WHERE paymentMethod = CASH)
qrisRevenue      = SUM(WHERE paymentMethod = QRIS)
transactionCount = COUNT(transactions)
crewAttended     = COUNT(eventCrew WHERE attended = true)
```
Cancelled events **dikecualikan** dari monthly/yearly recap.

### Offline Sync (`lib/sync-queue.ts`, `lib/offline-db.ts`)
- Transaction dibuat offline → disimpan di IndexedDB dengan `clientTempId`.
- Saat online, `POST /api/transactions/batch` kirim semua queued transactions.
- Server cek `clientTempId` untuk idempotency (dedup). Client dapat response
  mapping `clientTempId → serverId`.
- Hook `use-offline-sync.ts` auto-trigger sync saat online + interval.

### Auth Lockout (`lib/auth.ts`)
- 5 failed attempts → akun terkunci 15 menit (`lockedUntil`).
- `failedLoginAttempts` reset ke 0 setelah lock triggered.
- Error message **generic** — tidak reveal field mana yang salah.

### Date/Time
- Semua tanggal disimpan sebagai UTC di DB.
- Display pakai `Asia/Jakarta` (WIB) via `lib/format.ts`.
- `eventDateStart`/`eventDateEnd` adalah date range (bisa multi-day event).
- `startTime`/`endTime` optional precise time (WIB).

---

## 8. Coding Conventions

### TypeScript
- **Strict mode** — no `any`. Gunakan `unknown` + type guard kalau perlu.
- Module augmentation untuk NextAuth session ada di `types/next-auth.d.ts`.

### API Response Pattern
```typescript
// Success
ok(data)                              // 200
ok(data, 201)                         // 201 Created

// Error
fail("message", 400)                  // 400 Bad Request
fail("message", 400, { fieldErrors })// 400 with field errors (from Zod)
unauthorized()                         // 401
forbidden()                           // 403
notFound("Data")                      // 404

// Wrapper — always use `handle()`:
export const POST = handle(async (req) => { ... });
```

### Validation
- Semua input body divalidasi via Zod schemas di `lib/validations.ts`.
- ZodError otomatis di-catch oleh `handle()` → 400 + `fieldErrors`.

### Currency
- Selalu **integer Rupiah** (no decimals). `pricePerPrint = 5000`, bukan `50.00`.
- Display: `formatCurrency()` di `lib/format.ts` → `"Rp5.000"`.

### Component Pattern
- Server Components by default. `"use client"` hanya untuk interaktif (forms,
  hooks, event handlers).
- Shared UI primitives di `components/ui/`.
- Layout shell: `AppShell` component (`components/app-shell.tsx`).

### Environment
- `.env` untuk local. `.env.example` sebagai template.
- `DATABASE_URL` (pooled) + `DIRECT_URL` (direct) untuk Prisma.
- `NEXTAUTH_SECRET` + `NEXTAUTH_URL` wajib.
- Jangan hardcode secrets. Jangan commit `.env`.

---

## 9. Pitfalls (Bug yang Pernah Terjadi)

> Bagian ini di-update setiap kali ada bug non-trivial yang diperbaiki.
> Tujuannya: jangan diulang.

1. **`pricingLabel` adalah Record, bukan function** (commit `b78ba18`)
   - `pricingLabel[event.pricingType]` — akses property, BUKAN `pricingLabel(x)`.
   - Kalau dipanggil sebagai function, runtime error.

2. **ADMIN redirect loop** (commit `7ea600e`)
   - Middleware redirect ADMIN ke `/dashboard`, tapi `/dashboard` tidak handle
     ADMIN role → infinite loop. Fix: `/dashboard` route ke `/admin/dashboard`
     untuk ADMIN.

3. **Offline sync tidak pernah auto-run** (commit `99e6620`)
   - Hook `use-offline-sync` tidak trigger karena dependency array salah /
   - event listener `online` tidak ter-pasang. Cek: `navigator.onLine` + event.

4. **Role selection di crew management** (commit `bb4ad5d`)
   - Dulu cuma bisa pilih role USER. Fix: dropdown bisa pilih ADMIN atau USER
     saat assign crew.

5. **UTF-8 BOM di migration SQL** (commit `f36c28d`)
   - Postgres menolak migration dengan BOM. Pastikan file `.sql` disimpan
     tanpa BOM (UTF-8 plain).

6. **Client-side `total` calculation**
   - JANGAN kirim `total` dari client. Server yang compute. Client kirim
     `printCount`, `paymentMethod`, `addOnQty` saja.

---

## 10. State Machines

### Event Status Flow
```
UPCOMING → ONGOING → DONE
                  ↘ CANCELLED
```
- Transition manual via edit event.
- `CANCELLED` events dikecualikan dari recaps (monthly/yearly).
- Delete event: guarded — cek apakah ada transactions. Kalau ada, tolak.

### Offline Sync State
```
[Online] ──create tx──→ IndexedDB ──sync──→ Server ──response──→ update IDB
    ↑                                                         │
    └──(offline)──────────────────────────────────────────────┘
```
- `clientTempId` (UUID client-generated) untuk idempotency.
- Server cek: kalau `clientTempId` sudah ada → skip, return existing `id`.

### Auth Lockout State
```
[Normal] ──failed login──→ attempts++ ──(attempts >= 5)──→ [Locked 15min]
                                                              │
                              ←──(after 15min)────────────────┘
```

---

## 11. UI Layout Decisions (Confirmed)

> Ini decision dari owner. Jangan ubah tanpa approval eksplisit.

### Event List (all roles)
- Display sebagai **vertical card list**, bukan table.
- Card shows: event name, status badge, date range, location, revenue (SA/Admin),
  action button.

### Event Detail Page
- Sections flow **top to bottom**:
  1. Event info card + KPI cards (same row)
  2. Crew attendance — horizontal pill badges
  3. **Transaction history — FULL WIDTH** (never side-by-side with crew)

### Transaction List (USER)
- 10 latest transactions, **DESC by `createdAt`** — newest at top.
- After save, appears at top without page reload.

### PWA
- Installable (manifest.json + service worker).
- Offline badge di header (`offline-badge.tsx`).
- Offline-first untuk transaction input saja. Other pages require online.

---

## 12. What AI Assistant Should NOT Do

- ❌ Generate `any` TypeScript types.
- ❌ Skip server-side role validation — bahkan kalau UI sudah hide button.
- ❌ Calculate `total` on frontend — always server-side.
- ❌ Store plaintext passwords.
- ❌ Expose other users' data to USER role.
- ❌ Add features not in `requirement.md` without confirmation.
- ❌ Mix frameworks (stick to Next.js App Router).
- ❌ Edit `schema.prisma` tanpa bikin migration.
- ❌ Hardcode secrets atau commit `.env`.
- ❌ Break UI layout decisions di §11 tanpa approval.
- ❌ Rename enum values tanpa cek semua references (query, display, migration).

---

## 13. Workflow: Cara Kerja AI di Repo Ini

Sebelum mulai task, baca urutan berikut:
1. **AGENTS.md** (file ini) — context & constraints.
2. **PROGRESS.md** — tau sampai mana pengerjaan, apa yang terakhir diubah.
3. **FILEMAP.md** — tau file mana yang relevant untuk task lo.

Saat mulai task:
1. Identifikasi file yang perlu diubah via FILEMAP.md.
2. Kalau perlu ubah schema → bikin migration + update seed.
3. Kalau perlu ubah API → update `lib/validations.ts` + route + `lib/*.ts`.
4. Kalau perlu ubah UI → cek `components/ui/` dulu sekanjutnya ada primitive.
5. Setelah selesai → update PROGRESS.md dengan entry baru.

---

## 14. Useful Commands

```bash
# Dev
npm run dev                          # Next.js dev server
docker compose up -d                 # Start Postgres container

# Database
npm run db:generate                  # prisma generate
npm run db:migrate                   # prisma migrate dev (create + apply migration)
npm run db:push                      # prisma db push (dev only, no migration)
npm run db:seed                      # Seed production (superadmin only)
npm run db:seed:graph                # Seed demo data
npm run db:studio                    # Prisma Studio GUI

# Build & Check
npm run build                        # prisma generate + migrate deploy + next build
npm run typecheck                    # tsc --noEmit
npm run lint                         # next lint
```

---

## 15. Related Documents

- **FILEMAP.md** — peta file eksplisit (path → module → role akses → deskripsi).
- **PROGRESS.md** — changelog perubahan per commit.
- **requirement.md** — business requirements (original spec dari owner).
- **SRS.md** — Software Requirements Specification (formal).
- **design.md** — design system, color tokens, layout decisions.
- **DEPLOY.md** — deployment instructions.
- **README.md** — setup instructions untuk developer baru.

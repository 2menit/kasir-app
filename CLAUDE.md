# CLAUDE.md — AI Assistant Guide
## Photobooth Cashier Web App

This file tells Claude (or any AI assistant) everything it needs to know to
work effectively on this codebase. Read it fully before writing any code.

---

## 1. Project Overview

**Product:** Photobooth Cashier Web Application
**Type:** Web app (browser-based, no native mobile)
**Purpose:** Internal operations tool for a photobooth business. Crew members
record transactions at events; the superadmin monitors all events and finances.

---

## 2. Tech Stack (Recommended)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript | SSR for auth-gated pages |
| Styling | Tailwind CSS + shadcn/ui | Keep UI clean and fast |
| Backend | Next.js API Routes (or separate Express) | RESTful JSON API |
| Database | PostgreSQL | via Prisma ORM |
| Auth | NextAuth.js (credentials provider) | JWT session, role-based |
| File Export | ExcelJS (XLSX) / PDFKit | For recap downloads |
| Deployment | Vercel (frontend) + Railway/Supabase (DB) | Or Docker monorepo |

> If the team prefers a different stack, update this section and keep it
> consistent. Never mix frameworks mid-project.

---

## 3. Roles & Permissions Matrix

| Action | superadmin | user (crew) |
|---|:---:|:---:|
| Login | ✅ | ✅ |
| Create user account | ✅ | ❌ |
| Create event | ✅ | ❌ |
| Edit event (status, crew attendance) | ✅ | ✅ (own event only) |
| Fill transaction in event | ✅ | ✅ |
| View own 10 latest transactions | ✅ | ✅ |
| View ALL event recaps | ✅ | ❌ |
| View per-event recap | ✅ | ❌ |
| Download recap (XLSX/PDF) | ✅ | ❌ |
| Delete user | ✅ | ❌ |

**Always enforce permissions server-side.** Never rely only on hidden UI elements.

---

## 4. Project Structure

```
photobooth-cashier/
├── app/                        # Next.js App Router
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (superadmin)/
│   │   ├── dashboard/page.tsx
│   │   ├── users/page.tsx
│   │   ├── events/page.tsx
│   │   ├── events/[id]/page.tsx
│   │   └── recaps/page.tsx
│   ├── (user)/
│   │   ├── dashboard/page.tsx
│   │   └── events/[id]/page.tsx
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── users/route.ts
│       ├── events/route.ts
│       ├── transactions/route.ts
│       └── recaps/route.ts
├── components/
│   ├── ui/                     # shadcn/ui primitives
│   ├── forms/
│   └── tables/
├── lib/
│   ├── prisma.ts
│   ├── auth.ts
│   └── export.ts               # XLSX + PDF generation
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── types/
│   └── index.ts
├── CLAUDE.md                   ← you are here
├── requirement.md
├── SRS.md
└── .env.example
```

---

## 5. Database Schema (Prisma)

```prisma
model User {
  id          String        @id @default(cuid())
  name        String
  username    String        @unique
  password    String        // bcrypt hashed
  role        Role          @default(USER)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  crewEvents  EventCrew[]
  transactions Transaction[]
}

enum Role {
  SUPERADMIN
  USER
}

model Event {
  id          String        @id @default(cuid())
  name        String        // event name e.g. "Wedding Rizal & Ayu"
  location    String
  eventDate   DateTime
  package     String        // e.g. "Paket Gold"
  pricePerPrint Int         // base price per print (Rp)
  status      EventStatus   @default(UPCOMING)
  notes       String?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  crew        EventCrew[]
  transactions Transaction[]
}

enum EventStatus {
  UPCOMING
  ONGOING
  DONE
  CANCELLED
}

model EventCrew {
  id        String   @id @default(cuid())
  event     Event    @relation(fields: [eventId], references: [id])
  eventId   String
  user      User     @relation(fields: [userId], references: [id])
  userId    String
  attended  Boolean  @default(false)

  @@unique([eventId, userId])
}

model Transaction {
  id            String          @id @default(cuid())
  event         Event           @relation(fields: [eventId], references: [id])
  eventId       String
  user          User            @relation(fields: [userId], references: [id])  // who input
  userId        String
  printCount    Int             // number of prints
  paymentMethod PaymentMethod
  total         Int             // pricePerPrint × printCount (in Rp)
  note          String?
  createdAt     DateTime        @default(now())
}

enum PaymentMethod {
  CASH
  QRIS
}
```

---

## 6. API Endpoints Summary

```
POST   /api/auth/login                  → login, returns session token
POST   /api/auth/logout

GET    /api/users                       → [superadmin] list all users
POST   /api/users                       → [superadmin] create user
PUT    /api/users/:id                   → [superadmin] edit user
DELETE /api/users/:id                   → [superadmin] delete user

GET    /api/events                      → list events (filtered by role)
POST   /api/events                      → [superadmin] create event
GET    /api/events/:id                  → event detail + crew + transactions
PUT    /api/events/:id                  → [superadmin] edit event
PUT    /api/events/:id/crew             → update crew attendance

GET    /api/transactions?eventId=...    → list (user: latest 10 only)
POST   /api/transactions                → create transaction
PUT    /api/transactions/:id            → edit transaction

GET    /api/recaps/event/:id            → [superadmin] per-event recap
GET    /api/recaps/monthly?month=&year= → [superadmin] monthly recap
GET    /api/recaps/export?type=event&id=... → [superadmin] download file
GET    /api/recaps/export?type=monthly&month=&year=
```

---

## 7. Key Business Logic

### Transaction Total Formula
```
total = printCount × event.pricePerPrint
```
This is calculated **server-side** and stored. Never trust client-sent `total`.

### Recap Calculation (per event)
```
totalPrints     = SUM(transactions.printCount)
totalRevenue    = SUM(transactions.total)
cashRevenue     = SUM(transactions.total WHERE paymentMethod = CASH)
qrisRevenue     = SUM(transactions.total WHERE paymentMethod = QRIS)
transactionCount = COUNT(transactions)
crewAttended    = COUNT(eventCrew WHERE attended = true)
```

### Monthly Recap
Group events by `eventDate` month. Aggregate same fields above per event,
then sum across all events in the month.

### User data restriction
- A `USER` hitting `GET /api/transactions` always receives **max 10 records**,
  ordered by `createdAt DESC`, regardless of query params.
- Server must enforce this — never rely on frontend pagination alone.

---

## 8. Auth & Security Rules

1. **All API routes** require a valid session — return `401` if unauthenticated.
2. Role check on every protected endpoint — return `403` if unauthorized.
3. Passwords hashed with **bcrypt** (saltRounds = 12).
4. Session token stored in **httpOnly cookie** (not localStorage).
5. CSRF protection enabled for mutating endpoints.
6. Superadmin cannot delete themselves.
7. Username must be unique; reject with `409` if duplicate.

---

## 9. Export Format Rules

### XLSX Recap
- Use **ExcelJS** library.
- Sheet 1: Summary (event name, date, total revenue, total prints, crew count).
- Sheet 2: Transaction detail (timestamp, crew who input, print count, method, total).
- Apply currency format `"Rp"#,##0` to all monetary cells.
- Filename: `recap_[event-name]_[date].xlsx` or `recap_[month]-[year].xlsx`.

### Download trigger
- Endpoint streams the file directly with correct `Content-Disposition` header.
- Frontend uses `<a href download>` or `window.open` — no third-party service.

---

## 10. Coding Conventions

- **TypeScript strict mode** — no `any`.
- All dates stored as UTC in DB; display in `Asia/Jakarta` timezone.
- Currency always in **integer Rupiah** (no decimals).
- API responses follow this shape:
  ```json
  { "success": true, "data": { ... } }
  { "success": false, "error": "message" }
  ```
- Use `zod` for all request body validation in API routes.
- Environment variables in `.env` — never hardcode secrets.

---

## 11. UI Layout Decisions

These are confirmed design decisions from the owner. Do not change without explicit approval.

### Event List (both roles)
- Events are displayed as **vertical card list**, not a table.
- Each card shows: event name, status badge, package badge, date, location, revenue (SA only), action button.
- Applies to: `/superadmin/events` and `/user/dashboard`.

### Superadmin — Event Detail Page (`/superadmin/events/[id]`)
Page sections flow **top to bottom** in this exact order:
1. Event info card + 4 KPI cards (same row)
2. Crew attendance — compact horizontal section (one pill badge per crew member)
3. **Riwayat Transaksi — full width** (100% page width, NOT split alongside crew)

Crew and transactions must **never** be placed side-by-side. The transaction table needs full width to display all columns legibly.

### User Cashier — Transaction List (`/user/events/[id]`)
- The 10 latest transactions are sorted **descending by `createdAt`** — newest at the **top**, oldest at the **bottom**.
- API query: `ORDER BY createdAt DESC LIMIT 10`.
- After saving a new transaction, it appears immediately at the top of the list without a page reload.
- Row index 1 = most recent; row index 10 = oldest in the visible window.

---

## 12. What Claude Should NOT Do

- Do not generate `any` TypeScript types.
- Do not skip server-side role validation — even if UI already hides the button.
- Do not calculate `total` on the frontend — always server-side.
- Do not store plaintext passwords.
- Do not expose other users' data to `USER` role accounts.
- Do not add features not listed in `requirement.md` without confirmation.

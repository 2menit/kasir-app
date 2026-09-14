# PROGRESS.md — Changelog Kasir-App

> Log perubahan per commit. Update file ini setiap selesai task.
> Format: `### [YYYY-MM-DD] commit-short-hash — type: title`

---

## Overview

Project: **2Menit Photobooth Kasir**
Repo: `/mnt/d/HAIKAL NURIL/2menit/kasir-app`
Total commits: 24 (per `2026-09-14`)

## Phase Summary

| Fase | Status | Deskripsi |
|---|---|---|
| Fase 1 — Foundation | ✅ Done | Initial setup: Next.js + Prisma + NextAuth + basic CRUD |
| Fase 2 — Event Management | ✅ Done | Event CRUD, scheduling, pricing config |
| Fase 3 — Transaction & Recap | ✅ Done | Transaction input, recap calculation, Excel export |
| Fase 4 — Multi-Cabang | ✅ Done | City model, ADMIN role, city-scoped data |
| Fase 5 — Crew & City Scope | ✅ Done | Crew assignment, dropdown kota, admin auto-tag cityId |
| Fase 6 — Admin Area | ✅ Done | Admin pages: dashboard, events, crew, recap, profile |
| Fase 7 — Recap Enhancement | ✅ Done | Transaction-based recap, city filter |
| Fase 8 — Offline-First PWA | ✅ Done | IndexedDB, sync queue, idempotent batch sync, service worker |
| Fase 9 — Documentation | ✅ Done | AGENTS.md, FILEMAP.md, PROGRESS.md |

---

## Changelog (newest first)

### [2026-09-15] feat: revenue split (kita vs panitia) di level event

**Feature:** Setiap event bisa punya skema pembagian hasil antara "kita" dan
"panitia". Persentase harus total 100%. Nominal rupiah dihitung otomatis dari
total revenue event.
**Key decisions:**
- `splitEnabled` (boolean, default false) — toggle on/off per event.
- `splitKitaPercent` + `splitPanitiaPercent` (int, default 80/20).
- Validasi cross-field di Zod: kalau `splitEnabled=true`, sum harus 100.
- Nominal dihitung di display layer (event detail page), bukan disimpan di DB.
- Recap (monthly/yearly) tetap 100% total — tidak dihitung dari split.
**Files:**
- `prisma/schema.prisma` (3 field baru di Event)
- `prisma/migrations/20260915000000_add_revenue_split/migration.sql`
- `lib/validations.ts` (field + superRefine)
- `lib/recap.ts` (expose split fields di EventRecap type)
- `app/api/events/route.ts` (create + list response)
- `app/api/events/[id]/route.ts` (update)
- `components/forms/event-form.tsx` (UI input persentase + validasi visual)
- `components/event-card.tsx` (badge "Bagi Hasil 80/20")
- `app/superadmin/events/[id]/page.tsx` (nominal rupiah kita & panitia)
- `app/admin/events/[id]/page.tsx` (nominal rupiah kita & panitia)
- `app/superadmin/events/[id]/edit/page.tsx` (pass split ke initial form)
- `app/admin/events/[id]/edit/page.tsx` (pass split ke initial form)
- `app/superadmin/events/page.tsx` + `app/superadmin/events/events-browser.tsx`
  (pass split ke EventListItem)
- `app/admin/events/page.tsx` (pass split ke EventListItem)
**Migration:** `20260915000000_add_revenue_split`

---

### [2026-09-14] `99e6620` — fix: perbaiki sinkronisasi offline yang tidak pernah berjalan otomatis

**Problem:** Hook `use-offline-sync` tidak auto-trigger sync saat online.
**Fix:** Perbaiki dependency array + event listener `online`/`offline`.
**Files:** `lib/use-offline-sync.ts`, `lib/sync-queue.ts`

---

### [2026-09-12] `7ea600e` — fix(auth): route ADMIN role to /admin/dashboard, break redirect loop

**Problem:** ADMIN login → redirect ke `/dashboard` → `/dashboard` tidak handle
ADMIN → infinite redirect loop.
**Fix:** `/dashboard` sekarang redirect ADMIN ke `/admin/dashboard`.
**Files:** `app/dashboard/page.tsx`, `middleware.ts`

---

### [2026-09-12] `d53851c` — feat: offline-first transaction queue with idempotent sync

**Feature:** Kasir (USER) bisa input transaction saat offline. Data disimpan di
IndexedDB, auto-sync saat online.
**Key decisions:**
- `clientTempId` (UUID) untuk idempotency — server cek duplikat.
- `POST /api/transactions/batch` untuk sync multiple transactions sekaligus.
- Hook `use-offline-sync` auto-sync setiap 30s saat online.
- Service worker (`public/sw.js`) untuk PWA install.
**Files:** `lib/offline-db.ts`, `lib/sync-queue.ts`, `lib/use-offline-sync.ts`,
`app/api/transactions/batch/route.ts`, `components/offline-badge.tsx`,
`components/service-worker-register.tsx`, `public/sw.js`, `public/manifest.json`
**Migration:** `20260830000000_add_client_temp_id` (add `clientTempId` to Transaction)

---

### [2026-08-29] `bb4ad5d` — fix(multi-cabang): enable role selection (ADMIN/USER) in crew management

**Problem:** Crew management hanya bisa assign role USER, tidak bisa ADMIN.
**Fix:** Dropdown role saat assign crew bisa pilih ADMIN atau USER.
**Files:** `app/admin/crew/admin-crew-manager.tsx`, `app/superadmin/...`

---

### [2026-08-29] `215452e` — chore: gitignore .claude/ dan planning docs

**Files:** `.gitignore`

---

### [2026-08-25] `f6829d7` — feat(fase-4): event form & delete button redirect props untuk admin

**Feature:** Event form dan delete button support redirect prop agar admin area
bisa redirect ke `/admin/events` setelah action.
**Files:** `components/forms/`, `components/delete-event-button.tsx`

---

### [2026-07-05] `b78ba18` — fix(fase-6): pricingLabel dipanggil sebagai function padahal Record

**Bug:** `pricingLabel` adalah `Record<PricingType, string>`, dipanggil sebagai
`pricingLabel(type)` → runtime error.
**Fix:** Ubah ke `pricingLabel[event.pricingType]` (property access).
**Files:** `lib/pricing.ts`, components yang display pricing label.
**Pitfall:** Tercatat di AGENTS.md §9.1.

---

### [2026-07-05] `7b84865` — feat(fase-7): recap transaction-based + filter kota

**Feature:** Recap sekarang transaction-based (bukan crew-based). Tambah filter
per-kota untuk superadmin.
**Files:** `lib/recap.ts`, `app/api/recaps/*`, `app/superadmin/recaps/page.tsx`,
`app/admin/recaps/page.tsx`

---

### [2026-07-05] `c954be6` — feat(fase-6): admin area pages — dashboard, events, crew, recap, profile

**Feature:** Admin cabang area lengkap. Semua scoped by `cityId`.
**Files:** `app/admin/*` (dashboard, events, crew, recaps, profile, layout)

---

### [2026-06-25] `77904b6` — feat(fase-5): crew + city scope — dropdown kota, filter, admin auto-tag cityId

**Feature:** Crew assignment dengan city scope. Admin auto-tag `cityId` saat
create event (dari session).
**Files:** `app/admin/crew/*`, `app/api/events/route.ts`, `app/api/events/[id]/route.ts`

---

### [2026-06-04] `9c0dc1e` — feat: implement full event management CRUD with filtering, multi-city support, and validated event workflows

**Files:** `app/api/events/*`, `app/superadmin/events/*`, `app/admin/events/*`,
`lib/validations.ts`

---

### [2026-05-30] `11a0f30` — feat: implement multi-branch support by adding city management, authentication roles, and session integration

**Feature:** Multi-cabang. City model, ADMIN role, session inject `cityId`.
**Files:** `lib/auth.ts`, `lib/session.ts`, `app/api/cities/*`, `types/next-auth.d.ts`

---

### [2026-05-30] `064b46f` — feat: add City entity, assignable admin roles, and multi-branch data support to schema

**Migration:** `20260824222500_add_city_and_admin_role`
**Files:** `prisma/schema.prisma`

---

### [2026-05-30] `922cbfb` — feat: add allowCash and allowQris toggle columns to Event table

**Migration:** `20260712053000_add_payment_method_toggles`
**Files:** `prisma/schema.prisma`

---

### [2026-05-30] `5f2ccac` — feat: implement choosing payment method in event

**Feature:** Per-event payment method toggle (cash/qris).
**Files:** `app/api/events/*`, `lib/validations.ts`

---

### [2026-05-30] `90fef88` — feat: implement event management system including scheduling, pricing configurations, and admin CRUD operations

**Files:** `app/api/events/*`, `app/superadmin/events/*`, `lib/pricing.ts`

---

### [2026-05-30] `6f5ae16` — fix(mobile): hamburger nav + responsive KPI cards to stop overflow

**Fix:** Mobile layout overflow. Hamburger nav untuk mobile, KPI cards responsive.
**Files:** `components/mobile-nav.tsx`, `components/kpi-card.tsx`, `components/app-shell.tsx`

---

### [2026-05-30] `959d4d9` — feat: allow add-on-only transactions and copy-price reprints in cashier

**Feature:** Add-on (e.g. gantungan kunci) bisa dijual tanpa print. Copy-price
reprints untuk `PricingType.PISAH`.
**Files:** `lib/pricing.ts`, `app/api/transactions/route.ts`,
`lib/validations.ts`

---

### [2026-05-30] `9fda229` — feat: exclude cancelled events from recaps and add guarded event delete

**Feature:** `CANCELLED` events excluded dari monthly/yearly recap. Event delete
guarded — cek transactions dulu.
**Files:** `lib/recap.ts`, `app/api/events/[id]/route.ts`

---

### [2026-05-30] `2f39acd` — feat: rebrand to 2Menit Photobooth Kasir with custom logo

**Files:** `public/simple-logo-2menit.png`, `components/app-shell.tsx`,
`app/layout.tsx`, `public/manifest.json`

---

### [2026-05-30] `f36c28d` — fix: strip UTF-8 BOM from 0_init migration so Postgres can apply it

**Bug:** Migration `0_init` gagal karena UTF-8 BOM.
**Fix:** Strip BOM dari file SQL.
**Pitfall:** Tercatat di AGENTS.md §9.5.

---

### [2026-05-30] `6ed9eae` — feat: implement event management, transaction tracking, and financial recap reporting with Prisma schema

**Feature:** Core feature set: events, transactions, recaps.
**Files:** `prisma/schema.prisma`, `lib/recap.ts`, `app/api/recaps/*`

---

### [2026-05-30] `ab8e75c` — feat: implement full-stack cashier application with transaction management, secure API routes, and Excel export functionality

**Feature:** Full-stack app. Transaction CRUD, API routes dengan role guard,
Excel export via ExcelJS.
**Files:** `app/api/transactions/*`, `lib/export.ts`, `lib/api.ts`,
`lib/session.ts`

---

### [2026-05-30] `9bbe66a` — Initial commit

**Files:** Project setup, basic structure.

# FILEMAP.md — Peta File Kasir-App

> Referensi cepat: path → module → role akses → deskripsi.
> Update file ini setiap kali ada file baru/dihapus.

---

## Root Config

| File | Deskripsi |
|---|---|
| `package.json` | Deps: Next 14, Prisma 5, NextAuth 4, Zod, idb, ExcelJS, bcryptjs. Scripts: dev, build, db:*. |
| `tsconfig.json` | TS strict config. `@/*` → root import alias. |
| `next.config.mjs` | Next.js config (standar). |
| `tailwind.config.ts` | Tailwind config dengan custom color tokens (canvas, surface-soft, hairline, muted). |
| `postcss.config.mjs` | PostCSS (tailwind + autoprefixer). |
| `middleware.ts` | Route protection: `/superadmin/*` → SUPERADMIN, `/admin/*` → ADMIN, `/user/*` → USER, `/dashboard` → all. |
| `docker-compose.yml` | Postgres 15 container untuk local dev (port 5433). |
| `.env.example` | Template env vars (DB, NextAuth, seed superadmin). |
| `.mcp.json` | MCP server config (untuk AI tools). |
| `.gitignore` | Ignore node_modules, .next, .env, .claude/, planning docs. |

## `app/` — Next.js App Router Pages

### Shared
| Path | Deskripsi |
|---|---|
| `app/layout.tsx` | Root layout: `<html>`, providers (NextAuth, ThemeProvider, Toaster), service-worker-register. |
| `app/page.tsx` | Root → redirect ke `/dashboard` atau `/login`. |
| `app/dashboard/page.tsx` | Role-based redirect: SA→`/superadmin/dashboard`, ADMIN→`/admin/dashboard`, USER→`/user/dashboard`. |
| `app/login/page.tsx` | Login page (server component). |
| `app/login/login-form.tsx` | Login form (client) — username + password, NextAuth signIn. |
| `app/globals.css` | Global styles + Tailwind directives + custom CSS variables. |

### `app/admin/` — ADMIN area (per-cabang)
| Path | Deskripsi |
|---|---|
| `admin/layout.tsx` | Layout shell untuk admin. Pakai `AppShell` dengan nav items admin. |
| `admin/page.tsx` | Redirect ke `/admin/dashboard`. |
| `admin/dashboard/page.tsx` | KPI cards, event list, recap summary. Scoped by `cityId`. |
| `admin/events/page.tsx` | Event list (cards). Filter by status. |
| `admin/events/create/page.tsx` | Form create event. `cityId` auto-tag dari session. |
| `admin/events/[id]/page.tsx` | Event detail + crew + transaction history. |
| `admin/events/[id]/edit/page.tsx` | Edit event form. |
| `admin/crew/page.tsx` | Crew management list. |
| `admin/crew/admin-crew-manager.tsx` | Client component: assign crew ke event, toggle role. |
| `admin/recaps/page.tsx` | Recap bulanan/tahunan. Filter by month/year. Scoped by city. |
| `admin/profile/page.tsx` | Profile view + change password. |

### `app/superadmin/` — SUPERADMIN area
| Path | Deskripsi |
|---|---|
| `superadmin/layout.tsx` | Layout shell untuk superadmin. Nav items: dashboard, events, users, cities, recaps. |
| `superadmin/page.tsx` | Redirect ke `/superadmin/dashboard`. |
| `superadmin/dashboard/page.tsx` | KPI all-cabang, event list, revenue chart. |
| `superadmin/cities/page.tsx` | City CRUD page. |
| `superadmin/cities/cities-manager.tsx` | Client component: create/edit/delete city. |
| `superadmin/events/page.tsx` | Event list all cities. Filter by city + status. |
| `superadmin/events/events-browser.tsx` | Client component: event browser dengan filter. |
| `superadmin/events/create/page.tsx` | Form create event (pilih city). |
| `superadmin/events/[id]/page.tsx` | Event detail + crew + transactions. |
| `superadmin/events/[id]/edit/page.tsx` | Edit event form. |
| `superadmin/users/page.tsx` | User CRUD (all cities). |
| `superadmin/recaps/page.tsx` | Recap all-cabang. Filter by city + month/year. |
| `superadmin/profile/page.tsx` | Profile + change password. |

### `app/user/` — USER area (kasir)
| Path | Deskripsi |
|---|---|
| `user/dashboard/page.tsx` | Event list di mana user ini adalah crew. |
| `user/events/[id]/page.tsx` | Transaction input form + 10 latest transactions. Offline-capable. |

## `app/api/` — API Routes

### Auth
| Path | Method | Role | Deskripsi |
|---|---|---|---|
| `api/auth/[...nextauth]/route.ts` | GET,POST | public | NextAuth handler (login, logout, session). |

### Cities
| Path | Method | Role | Deskripsi |
|---|---|---|---|
| `api/cities/route.ts` | GET | SUPERADMIN | List all cities with event/user counts. |
| `api/cities/route.ts` | POST | SUPERADMIN | Create city. |
| `api/cities/[id]/route.ts` | PUT | SUPERADMIN | Update city name. |

### Events
| Path | Method | Role | Deskripsi |
|---|---|---|---|
| `api/events/route.ts` | GET | any auth | List events filtered by role (SA: all, ADMIN: own city, USER: assigned). |
| `api/events/route.ts` | POST | ADMIN+ | Create event. `cityId` from session (ADMIN) or body (SA). |
| `api/events/[id]/route.ts` | GET | any auth | Event detail + crew + transactions (SA/Admin). |
| `api/events/[id]/route.ts` | PUT | ADMIN+ | Edit event. Guarded: cityId must match for ADMIN. |
| `api/events/[id]/crew/route.ts` | PUT | ADMIN+ | Update crew attendance + assignment. |

### Transactions
| Path | Method | Role | Deskripsi |
|---|---|---|---|
| `api/transactions/route.ts` | GET | any auth | List (USER: latest 10 DESC, ADMIN: by city, SA: all). |
| `api/transactions/route.ts` | POST | any auth | Create transaction. Server computes total. |
| `api/transactions/batch/route.ts` | POST | any auth | Offline sync: batch create with `clientTempId` (idempotent). |
| `api/transactions/[id]/route.ts` | PUT | ADMIN+ | Edit transaction. |

### Recaps
| Path | Method | Role | Deskripsi |
|---|---|---|---|
| `api/recaps/event/[id]/route.ts` | GET | ADMIN+ | Per-event recap (totals, crew, transactions). |
| `api/recaps/monthly/route.ts` | GET | ADMIN+ | Monthly recap scoped by city. |
| `api/recaps/yearly/route.ts` | GET | ADMIN+ | Yearly recap scoped by city. |
| `api/recaps/export/route.ts` | GET | ADMIN+ | Download XLSX (event or monthly). |

### Users
| Path | Method | Role | Deskripsi |
|---|---|---|---|
| `api/users/route.ts` | GET | ADMIN+ | List users (ADMIN: own city, SA: all). |
| `api/users/route.ts` | POST | ADMIN+ | Create user (ADMIN: role USER same city, SA: any). |
| `api/users/[id]/route.ts` | PUT | ADMIN+ | Edit user. Guarded: cityId match for ADMIN. |

### Profile
| Path | Method | Role | Deskripsi |
|---|---|---|---|
| `api/profile/password/route.ts` | POST | any auth | Change own password. Verify old, hash new. |

## `lib/` — Core Logic

| File | Deskripsi |
|---|---|
| `lib/prisma.ts` | Prisma client singleton. `prisma` export. |
| `lib/auth.ts` | NextAuth config: credentials provider, JWT session (8h), login lockout (5 attempts → 15min lock), callback untuk inject `role` & `cityId` ke token/session. |
| `lib/session.ts` | `getCurrentUser()`, `requireUser()`, `requireRole()`, `requireSuperadmin()`, `requireAdmin()`, `requireAdminOrSuperadmin()`, `HttpError` class. |
| `lib/api.ts` | Response envelope: `ok()`, `fail()`, `unauthorized()`, `forbidden()`, `notFound()`, `zodErrorResponse()`, `handle()` wrapper. |
| `lib/validations.ts` | Zod schemas: `loginSchema`, `createUserSchema`, `updateUserSchema`, `createEventSchema`, `updateEventSchema`, `createTransactionSchema`, `batchTransactionSchema`, `createCitySchema`, `updateCitySchema`, `changePasswordSchema`. |
| `lib/pricing.ts` | `computeTotal(event, printCount, addOnQty)` → total dalam Rupiah. Handle BIASA & PISAH. |
| `lib/recap.ts` | `getEventRecap()`, `getMonthlyRecap()`, `getYearlyRecap()`. Agregasi transaction + crew. |
| `lib/export.ts` | `generateEventXlsx()`, `generateMonthlyXlsx()`. ExcelJS. 2 sheets: summary + detail. |
| `lib/format.ts` | `formatCurrency()`, `formatDateWIB()`, `formatDateRangeWIB()`, `formatTimeRangeWIB()`, `isoDateWIB()`, `combineWibDateTime()`. Pakai `date-fns-tz`. |
| `lib/offline-db.ts` | IndexedDB schema (via `idb`): `transactions` store dengan `clientTempId` index. `putTransaction()`, `getPendingTransactions()`, `clearPending()`. |
| `lib/sync-queue.ts` | `syncPendingTransactions()`: ambil dari IDB → POST /api/transactions/batch → update IDB dengan serverId. |
| `lib/use-offline-sync.ts` | React hook: `useOfflineSync()`. Auto-sync saat online + interval (30s). Expose `isOnline`, `pendingCount`, `syncNow()`. |
| `lib/client.ts` | Client-side fetch wrapper. `apiFetch()` dengan error handling. |
| `lib/utils.ts` | `cn()` — clsx + tailwind-merge. |

## `components/` — React Components

| File | Deskripsi |
|---|---|
| `app-shell.tsx` | Shared layout: header (logo, nav, profile, theme toggle, mobile nav), main content area. |
| `mobile-nav.tsx` | Hamburger menu untuk mobile. |
| `nav-links.tsx` | Nav item list renderer. `NavItem` type. |
| `event-card.tsx` | Event card untuk list. Props: event, role, href. |
| `event-sections.tsx` | Event detail page sections (info, crew, transactions). |
| `kpi-card.tsx` | KPI card component (label, value, icon). |
| `revenue-bar-chart.tsx` | Simple bar chart untuk revenue (CSS-based, no chart lib). |
| `month-picker.tsx` | Month + year picker untuk recap filter. |
| `download-recap-button.tsx` | Button trigger download XLSX. |
| `delete-event-button.tsx` | Delete event dengan konfirmasi. Guarded. |
| `profile-view.tsx` | Profile display + change password form. |
| `offline-badge.tsx` | Online/offline status indicator di header. |
| `service-worker-register.tsx` | Register `sw.js` (PWA). |
| `logout-button.tsx` | Logout button (NextAuth signOut). |
| `theme-toggle.tsx` | Dark/light theme toggle. |
| `providers.tsx` | NextAuth SessionProvider + ThemeProvider wrapper. |
| `forms/` | Form components (event form, transaction form, dll). |
| `ui/` | Primitives: `button.tsx`, `input.tsx`, `field.tsx`, `table.tsx`, `dialog.tsx`, dll. shadcn-style. |

## `prisma/` — Database

| File | Deskripsi |
|---|---|
| `schema.prisma` | 5 models (User, City, Event, EventCrew, Transaction), 4 enums (Role, EventStatus, PaymentMethod, PricingType). |
| `seed.ts` | Production seed: superadmin only (dari env vars). |
| `seed-graph.ts` | Demo seed: events + crew + transactions dengan relationships. |
| `seed-multi-cabang.ts` | Multi-city demo: 2+ cities dengan admin + crew masing-masing. |
| `migrations/` | 6 migration folders: `0_init`, `event_date_range`, `add_payment_method_toggles`, `add_city_and_admin_role`, `add_client_temp_id`, `add_revenue_split` (lihat AGENTS.md §5). |

## `types/`

| File | Deskripsi |
|---|---|
| `next-auth.d.ts` | Module augmentation: tambah `role` & `cityId` ke NextAuth `User` & `Session` interface. |

## `public/`

| File | Deskripsi |
|---|---|
| `manifest.json` | PWA manifest (name, icons, theme color, display: standalone). |
| `sw.js` | Service worker (cache strategies). |
| `simple-logo-2menit.png` | Logo 2Menit Photobooth. |

## Docs

| File | Deskripsi |
|---|---|
| `AGENTS.md` | AI assistant working guide (baca ini dulu). |
| `FILEMAP.md` | File ini. |
| `PROGRESS.md` | Changelog perubahan per commit. |
| `README.md` | Setup instructions untuk developer baru. |
| `DEPLOY.md` | Deployment guide (Docker, env vars, migration). |
| `requirement.md` | Business requirements (original spec). |
| `SRS.md` | Software Requirements Specification. |
| `design.md` | Design system: color tokens, typography, layout rules. |
| `dev.log` | Dev log (manual notes). |

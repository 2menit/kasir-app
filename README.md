# Photobooth Cashier

Internal operations web app for a photobooth business. Crew record print
transactions at events; the superadmin manages events, crew, and downloads
financial recaps.

Built per [`CLAUDE.md`](CLAUDE.md), [`requirement.md`](requirement.md), and
[`SRS.md`](SRS.md). UI follows the Coinbase-inspired system in
[`design.md`](design.md) — white canvas, ink text, a single brand blue
(`#0052ff`), pill CTAs, `rounded-xl` cards, Inter for text and JetBrains Mono
for numbers.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript (strict) |
| Styling | Tailwind CSS (design tokens) + lucide-react + sonner |
| Database | PostgreSQL via Prisma ORM |
| Auth | NextAuth (credentials, JWT session, httpOnly cookie) |
| Validation | Zod (server-side on every route) |
| Export | ExcelJS (XLSX) |

## Prerequisites

- Node.js 20+
- Docker (for the local PostgreSQL) — or your own Postgres instance

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env          # then edit NEXTAUTH_SECRET for production

# 3. Start PostgreSQL (host port 5433 -> container 5432)
docker compose up -d

# 4. Create the schema
npm run db:push               # or: npm run db:migrate

# 5. Seed superadmin + demo data
npm run db:seed

# 6. Run
npm run dev                   # http://localhost:3000
```

### Seeded accounts

| Role | Username | Password |
|---|---|---|
| Superadmin | `superadmin` | `superadmin123` |
| Crew | `budi` / `siti` / `andi` | `crew1234` |

> Change these via `.env` (`SEED_SUPERADMIN_*`) before seeding, and rotate
> `NEXTAUTH_SECRET` before any real deployment.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Generate Prisma client + production build |
| `npm run start` | Run the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | Sync schema to DB (no migration history) |
| `npm run db:migrate` | Create + apply a dev migration |
| `npm run db:seed` | Seed superadmin, crew, and demo events |
| `npm run db:studio` | Open Prisma Studio |

## Project Structure

```
app/
  login/                     # credentials login (dark editorial panel)
  dashboard/                 # role router -> superadmin or user area
  superadmin/                # dashboard, users, events, events/[id](/edit), recaps
  user/                      # assigned events + cashier (events/[id])
  api/                       # users, events, events/[id]/crew, transactions, recaps, export
components/                  # app shell, cards, forms, UI primitives
lib/                         # prisma, auth, session guards, validations, format, recap, export
prisma/                      # schema.prisma + seed.ts
middleware.ts                # session + role-based route protection
```

## Roles & Permissions

Enforced **server-side** on every API route (`lib/session.ts` guards) and at the
page layer via `middleware.ts`.

| Capability | Superadmin | Crew |
|---|:--:|:--:|
| Manage users / events | ✅ | ❌ |
| View all events + revenue | ✅ | assigned only |
| Fill transactions (ONGOING events) | ✅ | assigned only |
| View transactions | all | own event, latest 10 |
| Recaps + XLSX download | ✅ | ❌ |
| Toggle own attendance | ✅ | ✅ |

## Notes & deviations from the spec

These are intentional and faithful to the requirements:

- **`Transaction.userId` is nullable** with `onDelete: SetNull` so transaction
  history survives crew deletion (SRS §6.2). Crew assignments cascade-delete.
- **`User.failedLoginAttempts` / `lockedUntil`** were added to implement the
  5-attempts → 15-minute lockout (REQ-AUTH-01).
- **Docker maps Postgres to host port `5433`** to avoid clashing with a local
  Postgres on 5432; `DATABASE_URL` matches.
- All money is integer Rupiah; `total` is always computed server-side
  (`printCount × event.pricePerPrint`). Timestamps stored UTC, displayed WIB.

# Software Requirements Specification (SRS)
## Photobooth Cashier Web Application

---

| Field | Value |
|---|---|
| **Document Version** | 1.0.0 |
| **Date** | May 2025 |
| **Status** | Draft |
| **Platform** | Web Application |
| **Prepared for** | Photobooth Studio Owner |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [System Features](#3-system-features)
4. [External Interface Requirements](#4-external-interface-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Data Requirements](#6-data-requirements)
7. [System Constraints](#7-system-constraints)
8. [Appendix — Use Case Diagrams](#8-appendix--use-case-diagrams)

---

## 1. Introduction

### 1.1 Purpose
This document specifies the complete software requirements for the **Photobooth Cashier Web Application** — an internal business tool for managing photobooth events, recording transactions made by crew at each event, and generating financial recap reports for the business owner.

### 1.2 Scope
The system is a **browser-based web application** accessible from any device with a modern web browser and internet connection. It is intended for internal use only — not accessible to end customers.

**In scope:**
- User authentication and role management
- Event creation and management
- Transaction recording at events (cashier flow)
- Crew attendance tracking
- Financial recap generation and XLSX export

**Out of scope:**
- Customer-facing booking or payment portal
- Inventory management
- Payroll processing
- SMS / WhatsApp notification to customers

### 1.3 Definitions

| Term | Definition |
|---|---|
| **Superadmin** | Business owner; has full system access |
| **User / Crew** | Photobooth crew member assigned to events |
| **Event** | A photobooth booking at a specific date, location, and package |
| **Transaction** | A single print purchase by a customer at an event |
| **Recap** | Aggregated financial summary of one or more events |
| **pricePerPrint** | The unit price per print set per event (in Rupiah) |
| **QRIS** | Indonesian QR-code payment standard (GoPay, OVO, Dana, etc.) |

### 1.4 References
- `requirement.md` — detailed functional requirements with I/O specs
- `CLAUDE.md` — developer and AI assistant guide

---

## 2. Overall Description

### 2.1 Product Perspective
The system is a standalone web application. It connects to a PostgreSQL database, handles server-side rendering and API calls, and produces downloadable XLSX files for financial reporting.

```
┌──────────────────────────────────────────────────────────┐
│                     Web Browser                          │
│          (superadmin laptop / crew smartphone)           │
└─────────────────────┬────────────────────────────────────┘
                      │  HTTPS
┌─────────────────────▼────────────────────────────────────┐
│               Next.js Web Server                         │
│     ┌─────────────────┐  ┌────────────────────────┐      │
│     │   Page Routes   │  │      API Routes        │      │
│     │  (SSR + Auth)   │  │  (REST JSON + Auth)    │      │
│     └─────────────────┘  └──────────┬─────────────┘      │
└────────────────────────────────────┼───────────────────────┘
                                     │ Prisma ORM
┌────────────────────────────────────▼───────────────────────┐
│                   PostgreSQL Database                       │
│    Users | Events | EventCrew | Transactions               │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 User Classes

#### Superadmin
- Typically 1 person (business owner)
- Uses laptop/desktop primarily
- Needs to quickly see financial summaries and export reports
- Creates events before crew arrive at the venue

#### User (Crew)
- Multiple crew members (2–10 typical)
- Uses **smartphone** at event venues
- Needs a fast, simple form to record each print transaction
- Does not need to see financial aggregates

### 2.3 Assumptions & Dependencies
1. All crew have a smartphone with a modern browser (Chrome/Safari).
2. The event venue has cellular data or WiFi connectivity.
3. Superadmin creates events and assigns crew **before** the event date.
4. Only one currency is used: **Indonesian Rupiah (IDR)**.
5. The system does not process actual payments — it only records which method was used.

---

## 3. System Features

### 3.1 Authentication Module

#### 3.1.1 Description
Secure login system with role-based access control. Two roles exist: `SUPERADMIN` and `USER`. Sessions are managed via server-side cookies.

#### 3.1.2 Functional Requirements

**FR-AUTH-1: Login**
- The system shall provide a login form with `username` and `password` fields.
- On valid credentials, the system shall create a session and redirect to the role-appropriate dashboard.
- On invalid credentials, the system shall display: *"Username atau password salah"* without specifying which field is wrong.
- After 5 consecutive failed attempts, the system shall lock the account for 15 minutes and display a lockout message.

**FR-AUTH-2: Session Management**
- Sessions shall be stored in an httpOnly cookie (not accessible via JavaScript).
- Sessions shall expire after 8 hours of inactivity.
- On session expiry, the user shall be redirected to the login page.

**FR-AUTH-3: Logout**
- Any authenticated user can log out.
- On logout, the session cookie shall be invalidated server-side.

---

### 3.2 User Management (Superadmin Only)

#### 3.2.1 Description
The superadmin manages crew accounts. Crew accounts have the `USER` role and are created manually — there is no self-registration.

#### 3.2.2 Functional Requirements

**FR-USER-1: Create Crew Account**
- Superadmin can create a new user with: full name, username, password.
- Username must be unique; system rejects duplicates with a specific error.
- Password is bcrypt-hashed before storage.
- New account role is always `USER`.

**FR-USER-2: Edit User**
- Superadmin can update name, username, and optionally reset password.
- If password field is left blank on edit, existing password is unchanged.

**FR-USER-3: Delete User**
- Superadmin can delete a crew account.
- System shows a confirmation dialog before deletion.
- Superadmin cannot delete their own account.
- Deleted users are removed from future event assignments but historical transaction records are preserved.

**FR-USER-4: List Users**
- Superadmin can view all crew accounts in a table.
- Table columns: No. | Name | Username | Created At | Actions

---

### 3.3 Event Management

#### 3.3.1 Description
Events represent photobooth bookings. Superadmin creates and manages events. Crew are assigned to events and record transactions during them.

#### 3.3.2 Functional Requirements

**FR-EVENT-1: Create Event**
- Superadmin can create an event with:
  - Event name (required)
  - Location / venue (required)
  - Event date (required)
  - Package name (required, from predefined list or free text)
  - Price per print in Rp (required)
  - Initial status: UPCOMING
  - Optional crew assignment (multi-select from user list)
  - Optional notes

**FR-EVENT-2: Edit Event**
- Superadmin can edit all event fields.
- Superadmin can update the event status (UPCOMING → ONGOING → DONE / CANCELLED).
- Superadmin can update crew attendance: mark each assigned crew member as `attended = true/false`.

**FR-EVENT-3: View Event List**
- Both roles can view their relevant events:
  - Superadmin: ALL events
  - User: ONLY events they are assigned to
- Superadmin list is filterable by: status, month/year, search by name.
- Table columns: Event Name | Date | Location | Package | Status | (Superadmin also: Revenue) | Actions

**FR-EVENT-4: View Event Detail**
- Event detail page shows all event info + assigned crew + transaction list.
- Superadmin sees full transaction list + financial summary.
- User sees their input form + last 10 transactions only.

---

### 3.4 Transaction Module (Cashier)

#### 3.4.1 Description
The core cashier functionality. Crew members record each customer print order at an event. Each record is called a **Transaction**.

#### 3.4.2 Functional Requirements

**FR-TXN-1: Create Transaction**
- Authenticated user (any role) can create a transaction on any ONGOING event they are assigned to.
- Input fields:
  - `printCount` — integer, min 1 (required)
  - `paymentMethod` — select: CASH or QRIS (required)
  - `note` — free text, max 500 chars (optional)
- The system calculates `total = printCount × event.pricePerPrint` server-side.
- The system sets `createdAt = server timestamp (UTC)`.
- On success, a confirmation card is shown with: print count, payment method, total (Rp), time.

**FR-TXN-2: View Transactions (User)**
- User can view the **10 most recent** transactions for the current event.
- Ordered newest-first.
- Columns: No. | Time (WIB) | Prints | Method | Total (Rp) | Note
- The 10-row limit is enforced server-side.

**FR-TXN-3: View Transactions (Superadmin)**
- Superadmin can view ALL transactions for any event without limit.
- Same columns as user, plus: Crew Name (who input it).

---

### 3.5 Crew Attendance

#### 3.5.1 Functional Requirements

**FR-CREW-1: User Updates Own Attendance**
- On the event page, each crew member sees a toggle for their own attendance.
- Toggling saves `EventCrew.attended` to DB immediately.
- A user cannot toggle another crew member's attendance.

**FR-CREW-2: Superadmin Updates Any Attendance**
- On the event edit page, superadmin can set `attended` for each assigned crew member.

---

### 3.6 Recap & Reports (Superadmin Only)

#### 3.6.1 Description
Financial summaries for the superadmin. Users have no access to any recap feature.

#### 3.6.2 Functional Requirements

**FR-RECAP-1: Per-Event Recap (View)**
- Superadmin can view a recap for a single event.
- Displays:
  - Event info (name, date, location, package)
  - Total transaction count
  - Total print count
  - Total revenue (Rp)
  - Revenue breakdown: Cash (Rp) vs QRIS (Rp)
  - Crew list with attendance status
  - Full transaction detail table

**FR-RECAP-2: Monthly Recap (View)**
- Superadmin selects a **month** (1–12) and **year** (YYYY) from dropdowns.
- System displays a summary table of all events in that period:
  - One row per event: name, date, location, package, transaction count, total prints, total revenue
  - Footer row with column totals
- System also shows overall period totals: total revenue, total prints, total events.

**FR-RECAP-3: Quarterly Recap (View)**
- Superadmin selects a **quarter** (Q1–Q4) and **year**.
- System aggregates events from the 3 months of that quarter.
- Same layout as monthly recap.

**FR-RECAP-4: Download Per-Event Recap (XLSX)**
- Superadmin can download a `.xlsx` file for a specific event.
- File structure:
  - **Sheet 1 — Summary:** Event name, date, location, package, pricePerPrint, total revenue, cash revenue, QRIS revenue, total prints, crew count, crew attendance list.
  - **Sheet 2 — Transactions:** No., Timestamp (WIB), Crew Name, Prints, Method, Total (Rp), Note.
- Filename: `recap_[event-name]_[YYYY-MM-DD].xlsx`

**FR-RECAP-5: Download Monthly Recap (XLSX)**
- Superadmin can download a `.xlsx` for a selected month+year.
- File structure:
  - **Sheet 1 — Monthly Summary:** Month/Year header, one row per event with all metrics, totals row.
  - **Sheet 2 — All Transactions:** All transactions across all events in that month.
- Filename: `recap_bulan_[YYYY-MM].xlsx`

---

## 4. External Interface Requirements

### 4.1 User Interface

| Screen | Accessible By | Description |
|---|---|---|
| `/login` | All | Login form |
| `/dashboard` | Both | Redirects to role-specific dashboard |
| `/superadmin/dashboard` | Superadmin | KPI overview + event list |
| `/superadmin/users` | Superadmin | Crew management CRUD table |
| `/superadmin/events` | Superadmin | All events list with filters |
| `/superadmin/events/create` | Superadmin | Create event form |
| `/superadmin/events/[id]` | Superadmin | Event detail + recap |
| `/superadmin/events/[id]/edit` | Superadmin | Edit event + crew attendance |
| `/superadmin/recaps` | Superadmin | Monthly/quarterly recap viewer + download |
| `/user/dashboard` | User | Assigned events list |
| `/user/events/[id]` | User | Transaction input form + last 10 records |

**UI Design Principles:**
- Clean, minimal interface.
- Mobile-first: crew use this on phones at events.
- Transaction input form must be usable with one hand.
- Primary action buttons must be large (min 44px tap target).
- Currency always displayed as: `Rp1.500.000` (dot as thousand separator).

### 4.2 API Interface
All API endpoints accept and return `application/json`.  
Authentication via session cookie on all endpoints.  
See `CLAUDE.md § 6` for full endpoint table.

### 4.3 Database Interface
PostgreSQL via Prisma ORM.  
See `CLAUDE.md § 5` for full schema.

### 4.4 Export Interface
XLSX files generated server-side using ExcelJS.  
Delivered as binary stream with headers:
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="recap_....xlsx"
```

---

## 5. Non-Functional Requirements

### 5.1 Performance
| ID | Requirement |
|---|---|
| NFR-P1 | Page initial load: < 2 seconds on 4G mobile |
| NFR-P2 | Transaction save API: < 500ms response |
| NFR-P3 | XLSX export: < 5 seconds for events with up to 1,000 transactions |
| NFR-P4 | Recap page load: < 3 seconds for monthly summaries |

### 5.2 Reliability
| ID | Requirement |
|---|---|
| NFR-R1 | System uptime: 99% (excludes planned maintenance) |
| NFR-R2 | No data loss on transaction save — use DB transactions for atomicity |
| NFR-R3 | Failed API calls must return structured errors, not crash the UI |

### 5.3 Security
| ID | Requirement |
|---|---|
| NFR-S1 | All traffic over HTTPS |
| NFR-S2 | Passwords hashed with bcrypt (rounds = 12) |
| NFR-S3 | Session in httpOnly + SameSite=Strict cookie |
| NFR-S4 | All inputs validated server-side with Zod |
| NFR-S5 | SQL injection prevented via Prisma parameterized queries |
| NFR-S6 | Role authorization on every API route |
| NFR-S7 | Rate limit on `/api/auth/login`: max 10 req/minute per IP |

### 5.4 Usability
| ID | Requirement |
|---|---|
| NFR-U1 | Mobile-responsive minimum width: 375px |
| NFR-U2 | Browser support: Chrome 100+, Firefox 100+, Safari 15+, Edge 100+ |
| NFR-U3 | Language: Bahasa Indonesia (all UI labels, messages, errors) |
| NFR-U4 | Transaction form completable in < 10 seconds by trained crew |

### 5.5 Maintainability
| ID | Requirement |
|---|---|
| NFR-M1 | TypeScript strict mode, no `any` |
| NFR-M2 | All environment config via `.env` (no hardcoded secrets) |
| NFR-M3 | Prisma migrations versioned in source control |

---

## 6. Data Requirements

### 6.1 Data Entities

```
User
  id, name, username, password (hashed), role, createdAt, updatedAt

Event
  id, name, location, eventDate, package, pricePerPrint,
  status, notes, createdAt, updatedAt

EventCrew (join table)
  id, eventId, userId, attended

Transaction
  id, eventId, userId, printCount, paymentMethod,
  total, note, createdAt
```

### 6.2 Data Retention
- Transaction records are permanent — never deleted even if a user is deleted.
- Historical `userId` on transactions is preserved (set to null if user deleted).

### 6.3 Data Volume (Expected)
| Entity | Estimate |
|---|---|
| Users | < 20 |
| Events per year | 50–200 |
| Transactions per event | 5–100 |
| Total transactions per year | 500–5,000 |

---

## 7. System Constraints

1. **No customer-facing features** — this is an internal tool only.
2. **No real payment processing** — system records method only.
3. **Single currency** — IDR only, integer values.
4. **No offline mode** — requires internet; no service worker or local cache for transactions.
5. **Superadmin is seeded** — the first superadmin account is created via a DB seed script, not through the UI.
6. **User role cannot be changed via UI** — role is set at creation and cannot be upgraded through the app.

---

## 8. Appendix — Use Case Diagrams (Text)

### Superadmin Use Cases
```
Superadmin
  │
  ├── [UC-01] Login / Logout
  ├── [UC-02] Create Crew Account
  ├── [UC-03] Edit / Delete Crew Account
  ├── [UC-04] Create Event
  ├── [UC-05] Edit Event (fields + status + crew attendance)
  ├── [UC-06] View Event List (all, with filters)
  ├── [UC-07] View Event Detail + Transactions
  ├── [UC-08] Fill Transaction (same as crew)
  ├── [UC-09] View Per-Event Recap
  ├── [UC-10] View Monthly / Quarterly Recap
  └── [UC-11] Download Recap as XLSX
```

### User (Crew) Use Cases
```
User
  │
  ├── [UC-01] Login / Logout
  ├── [UC-02] View Assigned Events
  ├── [UC-03] View Event Detail
  ├── [UC-04] Fill Transaction (printCount, paymentMethod, note)
  ├── [UC-05] View Last 10 Transactions in Event
  └── [UC-06] Update Own Attendance Status
```

### Use Case: Fill Transaction (Detailed Flow)

```
ACTOR: User (Crew)

Preconditions:
  - User is logged in
  - User is assigned to the event
  - Event status = ONGOING

Main Flow:
  1. User navigates to their event page
  2. User sees the transaction input form
  3. User enters printCount (number spinner or input)
  4. User selects paymentMethod (CASH or QRIS button)
  5. User optionally enters a note
  6. User taps "Simpan" / Save button
  7. System validates input server-side
  8. System computes total = printCount × event.pricePerPrint
  9. System saves transaction with server timestamp
  10. System returns success response
  11. UI shows confirmation card: prints, method, total (Rp), time
  12. New transaction appears at top of the 10-row list

Alternate Flow A (validation fail):
  7a. System returns 400 with field-level errors
  7b. UI displays inline error messages; form stays open

Alternate Flow B (event not ONGOING):
  3b. System returns 403; UI shows: "Transaksi hanya bisa dilakukan saat event berlangsung"

Postconditions:
  - Transaction stored in DB
  - Event's total revenue increases accordingly
  - Superadmin can see the new transaction in their recap
```

---

*End of SRS Document*
*For questions, refer to `requirement.md` (functional detail) or `CLAUDE.md` (technical guide).*

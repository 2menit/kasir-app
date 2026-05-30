# requirement.md
## Photobooth Cashier Web App — Functional Requirements

> **Version:** 1.0.0
> **Last updated:** May 2025
> **Platform:** Web (browser-based)

---

## 1. Authentication

### REQ-AUTH-01 — Login
| | |
|---|---|
| **Actor** | Superadmin, User |
| **Input** | `username` (string), `password` (string) |
| **Process** | Validate credentials against DB; compare bcrypt hash |
| **Output (success)** | Session cookie set; redirect to role-based dashboard |
| **Output (fail)** | Error message: *"Username atau password salah"* |
| **Constraint** | Max 5 failed attempts → lock account for 15 minutes |

### REQ-AUTH-02 — Logout
| | |
|---|---|
| **Actor** | Superadmin, User |
| **Input** | Click logout button |
| **Output** | Session destroyed; redirect to `/login` |

---

## 2. Superadmin — User Management

### REQ-SA-01 — Create User (Crew Account)
| | |
|---|---|
| **Actor** | Superadmin |
| **Input** | `name` (string, required), `username` (string, unique, required), `password` (string, min 8 chars, required), `role` = USER |
| **Validation** | Username must be alphanumeric + underscore only; no spaces; unique |
| **Output (success)** | New user saved to DB; success toast shown; user appears in user list |
| **Output (fail)** | Error if username already exists → *"Username sudah digunakan"* |

### REQ-SA-02 — Edit User
| | |
|---|---|
| **Actor** | Superadmin |
| **Input** | `name`, `username`, `password` (optional — only update if filled) |
| **Output** | User record updated in DB |

### REQ-SA-03 — Delete User
| | |
|---|---|
| **Actor** | Superadmin |
| **Input** | User ID (from list) |
| **Constraint** | Cannot delete self; confirm dialog before delete |
| **Output** | User removed from DB; removed from any future event assignments |

---

## 3. Superadmin — Event Management

### REQ-SA-04 — Create Event
| | |
|---|---|
| **Actor** | Superadmin |
| **Input** | See table below |
| **Output (success)** | Event saved; event appears in event list |
| **Output (fail)** | Validation errors shown inline per field |

**Create Event Input Fields:**

| Field | Type | Required | Notes |
|---|---|:---:|---|
| `name` | string | ✅ | Event name, e.g. "Wedding Rizal & Ayu" |
| `location` | string | ✅ | Venue name / address |
| `eventDate` | date | ✅ | Date of the event |
| `package` | string (select) | ✅ | e.g. Paket Bronze, Silver, Gold, Platinum |
| `pricePerPrint` | integer (Rp) | ✅ | Price per print for this event |
| `status` | enum | ✅ | UPCOMING / ONGOING / DONE / CANCELLED |
| `crew` | User[] (multi-select) | ❌ | Assign crew members to this event |
| `notes` | string | ❌ | Additional notes |

### REQ-SA-05 — Edit Event
| | |
|---|---|
| **Actor** | Superadmin |
| **Input** | Any field from REQ-SA-04 + crew attendance status per member |
| **Crew Attendance Input** | Per crew: `attended` (boolean toggle — present / absent) |
| **Output** | Event record updated in DB including crew attendance |

### REQ-SA-06 — View Event List
| | |
|---|---|
| **Actor** | Superadmin |
| **Input** | Optional filters: `status`, `month`, `search by name` |
| **Output** | List of event **cards** (not a table) with: name, date, location, package badge, status badge, total revenue, action button |
| **UI Note** | Each event is rendered as a card component. Cards stack vertically. Status and package displayed as color-coded pill badges inside the card. |

---

## 4. Superadmin — Recap & Reports

### REQ-SA-07 — View Per-Event Recap
| | |
|---|---|
| **Actor** | Superadmin |
| **Input** | Event ID (via URL param) |
| **Output** | Recap page showing: |
| | • Event name, date, location, package |
| | • Total transactions |
| | • Total prints |
| | • Total revenue (Rp) |
| | • Revenue by payment method: Cash (Rp) vs QRIS (Rp) |
| | • Crew list + attendance status |
| | • Transaction detail table (timestamp, crew, prints, method, total, note) |
| **UI Layout** | Page flows top-to-bottom in this order: |
| | 1. Event info card + 4 KPI cards (same row) |
| | 2. Crew attendance — compact horizontal section (pill badges per crew member) |
| | 3. **Riwayat Transaksi — full width**, spanning the entire page width |
| **UI Note** | Crew and transactions are NOT placed side-by-side. Transactions table must be full width to show all columns clearly. |

### REQ-SA-08 — View Monthly / Quarterly Recap
| | |
|---|---|
| **Actor** | Superadmin |
| **Input** | `month` (1–12), `year` (YYYY) — dynamic, user picks from dropdown |
| **Output** | Summary table: one row per event in selected month, columns: |
| | Event Name, Date, Location, Package, Transactions, Total Prints, Total Revenue |
| | **Footer row:** totals for prints and revenue |
| | Revenue breakdown chart (optional): Cash vs QRIS bar |

> **Quarterly:** user picks "Quarter" + year → system maps Q1=Jan–Mar, Q2=Apr–Jun, Q3=Jul–Sep, Q4=Oct–Dec and aggregates.

### REQ-SA-09 — Download Recap (XLSX)
| | |
|---|---|
| **Actor** | Superadmin |
| **Input** | Download type: `event` (with event ID) OR `monthly` (with month + year) |
| **Output** | `.xlsx` file downloaded in browser |
| **File – Per Event** | Sheet 1: Event summary; Sheet 2: Transaction detail |
| **File – Monthly** | Sheet 1: Monthly summary (all events); Sheet 2: Per-event breakdown |
| **Filename format** | `recap_[event-slug]_[YYYY-MM-DD].xlsx` or `recap_bulan_[YYYY-MM].xlsx` |
| **Currency format** | All Rp values formatted as `Rp1.500.000` (Indonesian number format) |

---

## 5. User (Crew) — Transaction Input

### REQ-U-01 — Fill Transaction at Event
| | |
|---|---|
| **Actor** | User (crew) |
| **Trigger** | User is assigned to an event AND event status is ONGOING |
| **Input** | See table below |
| **Output (success)** | Transaction saved; appears at top of transaction list for that event |
| **Output (fail)** | Inline validation errors |

**Transaction Input Fields:**

| Field | Type | Required | Notes |
|---|---|:---:|---|
| `printCount` | integer | ✅ | Number of prints ordered (min 1) |
| `paymentMethod` | enum (select) | ✅ | CASH or QRIS |
| `note` | string | ❌ | Optional customer note |
| `total` | integer (Rp) | auto | Calculated server-side: `printCount × event.pricePerPrint` |
| `createdAt` | datetime | auto | Set by server at save time |
| `userId` | string | auto | From current session |
| `eventId` | string | auto | From current event context |

**Display after save:**
Show a **confirmation card** with: print count, payment method, total (Rp), timestamp.

### REQ-U-02 — View Latest 10 Transactions (per event)
| | |
|---|---|
| **Actor** | User |
| **Input** | Event context (eventId from URL) |
| **Output** | List of max 10 rows, **sorted descending by `createdAt`** — newest transaction at the TOP, oldest at the BOTTOM |
| | Columns: Waktu \| Print \| Metode \| Total \| Catatan |
| **Constraint** | Hard limit of 10 — no pagination, no "load more" for users |
| **UI Note** | When a new transaction is saved, it immediately appears at the top of the list, pushing older entries down. Row #1 is always the most recent. |

### REQ-U-03 — Edit Crew Attendance (Self)
| | |
|---|---|
| **Actor** | User |
| **Input** | Toggle own attendance status for the event: Hadir / Tidak Hadir |
| **Constraint** | User can only edit their OWN attendance, not other crew members' |
| **Output** | `EventCrew.attended` updated in DB; UI reflects change immediately |

### REQ-U-04 — View Assigned Events
| | |
|---|---|
| **Actor** | User |
| **Input** | None (auto-filtered by session userId) |
| **Output** | List of event **cards** the user is assigned to, with: event name, date, location, status badge |
| **UI Note** | Same card layout as superadmin event list. ONGOING event is highlighted at the top with a "Buka Kasir" CTA button. |
| **Constraint** | Only shows events where user is in the crew list |

---

## 6. Shared Constraints

| ID | Rule |
|---|---|
| CON-01 | All pages require authentication — redirect to `/login` if no session |
| CON-02 | Role check on every API route — `403 Forbidden` if unauthorized |
| CON-03 | `total` is always computed server-side, never accepted from client |
| CON-04 | All monetary values stored as **integer Rupiah** (no decimals) |
| CON-05 | All timestamps stored as UTC; displayed as **WIB (UTC+7)** |
| CON-06 | Passwords stored as **bcrypt** hash (rounds = 12) |
| CON-07 | User role cannot access any `/superadmin/*` routes or recap APIs |

---

## 7. Input Validation Rules

| Field | Rule |
|---|---|
| `username` | 3–30 chars, alphanumeric + underscore, no spaces, unique |
| `password` | Min 8 chars |
| `name` | 2–100 chars, required |
| `printCount` | Integer, min 1, max 999 |
| `pricePerPrint` | Integer, min 1000 (Rp1.000), max 10.000.000 (Rp10 juta) |
| `eventDate` | Valid date, not null |
| `note` | Max 500 chars |
| `status` | Must be one of: UPCOMING, ONGOING, DONE, CANCELLED |
| `paymentMethod` | Must be one of: CASH, QRIS |

---

## 8. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | Page load time < 2 seconds on standard broadband |
| NFR-02 | Works on Chrome, Firefox, Safari (latest 2 versions), Edge |
| NFR-03 | Mobile-responsive (min width 375px) — crew often use phones at events |
| NFR-04 | XLSX export completes in < 5 seconds for up to 1000 transactions |
| NFR-05 | Database must persist data across deployments |
| NFR-06 | All API errors return structured JSON `{ success: false, error: "..." }` |
| NFR-07 | No data from one user's session should be accessible to another user |

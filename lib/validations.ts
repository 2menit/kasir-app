import { z } from "zod";

// ── Primitives (requirement.md §7) ─────────────────────────────────────────
const username = z
  .string()
  .trim()
  .min(3, "Username minimal 3 karakter")
  .max(30, "Username maksimal 30 karakter")
  .regex(/^[a-zA-Z0-9_]+$/, "Username hanya boleh huruf, angka, dan underscore");

const password = z.string().min(8, "Password minimal 8 karakter");
const name = z
  .string()
  .trim()
  .min(2, "Nama minimal 2 karakter")
  .max(100, "Nama maksimal 100 karakter");

// Role enum — must match Prisma `enum Role` (SUPERADMIN, ADMIN, USER).
// Frontend only allows selecting ADMIN or USER; SUPERADMIN is reserved
// (set via seed only) and is filtered out of the role dropdown client-side.
export const RoleEnum = z.enum(["SUPERADMIN", "ADMIN", "USER"]);
export const EventStatusEnum = z.enum([
  "UPCOMING",
  "ONGOING",
  "DONE",
  "CANCELLED",
]);
export const PaymentMethodEnum = z.enum(["CASH", "QRIS"]);

// ── Auth ────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
});

// ── Users ────────────────────────────────────────────────────────────────────
// cityId optional on create — superadmin picks the city; admin's cityId is
// auto-assigned server-side (see app/api/users/route.ts).
// role optional on create/update — only SUPERADMIN may set ADMIN; an ADMIN
// creating a crew always gets USER server-side regardless of body.role.
export const createUserSchema = z.object({
  name,
  username,
  password,
  role: RoleEnum.optional(),
  cityId: z.string().trim().min(1, "Kota wajib dipilih").optional(),
});

export const updateUserSchema = z.object({
  name,
  username,
  // Optional on edit — only updates when provided/non-empty.
  password: z.union([password, z.literal("")]).optional(),
  role: RoleEnum.optional(),
  cityId: z.string().trim().min(1, "Kota wajib dipilih").optional(),
});

// ── Profile (self password change) ───────────────────────────────────────────
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Password saat ini wajib diisi"),
  newPassword: password,
});

// ── Events ───────────────────────────────────────────────────────────────────
export const PricingTypeEnum = z.enum(["BIASA", "PISAH"]);

const priceField = (label: string) =>
  z
    .coerce.number()
    .int(`${label} harus bilangan bulat`)
    .min(1000, `${label} minimal Rp1.000`)
    .max(10_000_000, `${label} maksimal Rp10.000.000`);

const timeField = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Format jam tidak valid (HH:MM)")
  .optional()
  .or(z.literal(""));

const eventBase = {
  name: z.string().trim().min(2, "Nama event minimal 2 karakter").max(150),
  location: z.string().trim().min(2, "Lokasi wajib diisi").max(200),
  eventDateStart: z.coerce.date({ errorMap: () => ({ message: "Tanggal mulai tidak valid" }) }),
  eventDateEnd: z.coerce.date({ errorMap: () => ({ message: "Tanggal selesai tidak valid" }) }),
  startTime: timeField,
  endTime: timeField,
  pricingType: PricingTypeEnum.default("BIASA"),
  pricePerPrint: priceField("Harga"),
  // Required only when pricingType = PISAH (enforced by refine below).
  copyPrice: z.union([priceField("Harga salinan"), z.null()]).optional(),
  // Optional per-event add-on (e.g. gantungan kunci)
  addOnEnabled: z.boolean().optional().default(false),
  addOnName: z.string().trim().max(50).optional().or(z.literal("")),
  addOnPrice: z.union([priceField("Harga add-on"), z.null()]).optional(),
  // Per-event payment method toggles
  allowCash: z.boolean().optional().default(true),
  allowQris: z.boolean().optional().default(true),
  // Revenue split (kita vs panitia) — must total 100 when enabled
  splitEnabled: z.boolean().optional().default(false),
  splitKitaPercent: z.coerce
    .number()
    .int("Persentase harus bilangan bulat")
    .min(0, "Persentase minimal 0")
    .max(100, "Persentase maksimal 100")
    .optional()
    .default(80),
  splitPanitiaPercent: z.coerce
    .number()
    .int("Persentase harus bilangan bulat")
    .min(0, "Persentase minimal 0")
    .max(100, "Persentase maksimal 100")
    .optional()
    .default(20),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  crewIds: z.array(z.string()).optional().default([]),
  cityId: z.string().min(1, "Kota wajib diisi").optional(),
};

/** Shared cross-field rules for create/edit. */
function refineEvent<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.superRefine((val, ctx) => {
    const v = val as {
      eventDateStart?: Date;
      eventDateEnd?: Date;
      pricingType?: string;
      copyPrice?: number | null;
      addOnEnabled?: boolean;
      addOnName?: string;
      addOnPrice?: number | null;
      startTime?: string;
      endTime?: string;
    };
    if (v.eventDateStart && v.eventDateEnd && v.eventDateEnd < v.eventDateStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eventDateEnd"],
        message: "Tanggal selesai harus sama atau setelah tanggal mulai",
      });
    }
    if (v.pricingType === "PISAH" && (v.copyPrice == null || v.copyPrice <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["copyPrice"],
        message: "Harga salinan wajib diisi untuk skema Pisah",
      });
    }
    if (v.addOnEnabled) {
      if (!v.addOnName || v.addOnName.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["addOnName"],
          message: "Nama add-on wajib diisi",
        });
      }
      if (v.addOnPrice == null || v.addOnPrice <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["addOnPrice"],
          message: "Harga add-on wajib diisi",
        });
      }
    }
    if (v.startTime && v.endTime && v.endTime <= v.startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "Jam selesai harus setelah jam mulai",
      });
    }
    // At least one payment method must be enabled
    const vPay = val as { allowCash?: boolean; allowQris?: boolean };
    if (!vPay.allowCash && !vPay.allowQris) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["allowCash"],
        message: "Minimal satu metode pembayaran harus aktif",
      });
    }
    // Revenue split: when enabled, kita + panitia must total 100
    const vSplit = val as {
      splitEnabled?: boolean;
      splitKitaPercent?: number;
      splitPanitiaPercent?: number;
    };
    if (vSplit.splitEnabled) {
      const sum = (vSplit.splitKitaPercent ?? 0) + (vSplit.splitPanitiaPercent ?? 0);
      if (sum !== 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["splitPanitiaPercent"],
          message: `Total persentase harus 100% (saat ini ${sum}%)`,
        });
      }
    }
  });
}

export const createEventSchema = refineEvent(
  z.object({
    ...eventBase,
    status: EventStatusEnum.default("UPCOMING"),
  })
);

export const updateEventSchema = refineEvent(
  z.object({
    ...eventBase,
    status: EventStatusEnum,
    // Crew attendance map: { userId: attended }
    attendance: z.record(z.string(), z.boolean()).optional(),
  })
);

// ── Crew attendance (self toggle) ────────────────────────────────────────────
export const selfAttendanceSchema = z.object({
  attended: z.boolean(),
});

// ── Transactions ─────────────────────────────────────────────────────────────
const addOnQty = z
  .coerce.number()
  .int("Jumlah add-on harus bilangan bulat")
  .min(0)
  .max(999)
  .optional()
  .default(0);

// printCount may be 0 (e.g. add-on only); the "≥ 1 item" rule is enforced by
// the refine below (print + add-on must total at least 1).
const printCount = z
  .coerce.number()
  .int("Jumlah print harus bilangan bulat")
  .min(0)
  .max(999, "Maksimal 999 print");

// charge all prints at the copy price (PISAH reprints/salinan)
const copyOnly = z.boolean().optional().default(false);

// At least one item (print or add-on) must be present.
function requireAtLeastOneItem(
  v: { printCount: number; addOnQty?: number },
  ctx: z.RefinementCtx
) {
  if (v.printCount + (v.addOnQty ?? 0) < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["printCount"],
      message: "Minimal 1 item (cetak atau add-on)",
    });
  }
}

export const createTransactionSchema = z
  .object({
    eventId: z.string().min(1, "Event wajib diisi"),
    printCount,
    paymentMethod: PaymentMethodEnum,
    addOnQty,
    copyOnly,
    note: z.string().trim().max(500, "Catatan maksimal 500 karakter").optional().or(z.literal("")),
  })
  .superRefine(requireAtLeastOneItem);

export const updateTransactionSchema = z
  .object({
    printCount,
    paymentMethod: PaymentMethodEnum,
    addOnQty,
    copyOnly,
    note: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .superRefine(requireAtLeastOneItem);

// ── Recap query ──────────────────────────────────────────────────────────────
export const monthlyRecapSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

export const quarterlyRecapSchema = z.object({
  quarter: z.coerce.number().int().min(1).max(4),
  year: z.coerce.number().int().min(2000).max(2100),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

// ── Cities ───────────────────────────────────────────────────────────────────
export const createCitySchema = z.object({
  name: z.string().trim().min(2, "Nama kota minimal 2 karakter").max(100),
});

export const updateCitySchema = z.object({
  name: z.string().trim().min(2, "Nama kota minimal 2 karakter").max(100),
});

export type CreateCityInput = z.infer<typeof createCitySchema>;
export type UpdateCityInput = z.infer<typeof updateCitySchema>;

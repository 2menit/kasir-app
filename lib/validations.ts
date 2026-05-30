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

export const RoleEnum = z.enum(["SUPERADMIN", "USER"]);
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
export const createUserSchema = z.object({
  name,
  username,
  password,
});

export const updateUserSchema = z.object({
  name,
  username,
  // Optional on edit — only updates when provided/non-empty.
  password: z.union([password, z.literal("")]).optional(),
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
  eventDate: z.coerce.date({ errorMap: () => ({ message: "Tanggal tidak valid" }) }),
  startTime: timeField,
  endTime: timeField,
  pricingType: PricingTypeEnum.default("BIASA"),
  pricePerPrint: priceField("Harga"),
  // Required only when pricingType = PISAH (enforced by refine below).
  copyPrice: z.union([priceField("Harga salinan"), z.null()]).optional(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  crewIds: z.array(z.string()).optional().default([]),
};

/** Shared cross-field rules for create/edit. */
function refineEvent<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.superRefine((val, ctx) => {
    const v = val as {
      pricingType?: string;
      copyPrice?: number | null;
      startTime?: string;
      endTime?: string;
    };
    if (v.pricingType === "PISAH" && (v.copyPrice == null || v.copyPrice <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["copyPrice"],
        message: "Harga salinan wajib diisi untuk skema Pisah",
      });
    }
    if (v.startTime && v.endTime && v.endTime <= v.startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "Jam selesai harus setelah jam mulai",
      });
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
export const createTransactionSchema = z.object({
  eventId: z.string().min(1, "Event wajib diisi"),
  printCount: z
    .coerce.number()
    .int("Jumlah print harus bilangan bulat")
    .min(1, "Minimal 1 print")
    .max(999, "Maksimal 999 print"),
  paymentMethod: PaymentMethodEnum,
  note: z.string().trim().max(500, "Catatan maksimal 500 karakter").optional().or(z.literal("")),
});

export const updateTransactionSchema = z.object({
  printCount: z.coerce.number().int().min(1).max(999),
  paymentMethod: PaymentMethodEnum,
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

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

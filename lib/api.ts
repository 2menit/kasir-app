import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "@/lib/session";

/** Standard success envelope: { success: true, data }. */
export function ok<T>(data: T, init?: number | ResponseInit) {
  const responseInit = typeof init === "number" ? { status: init } : init;
  return NextResponse.json({ success: true, data }, responseInit);
}

/** Standard error envelope: { success: false, error }. */
export function fail(error: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, ...extra }, { status });
}

export const unauthorized = () => fail("Tidak terautentikasi", 401);
export const forbidden = () => fail("Akses ditolak", 403);
export const notFound = (what = "Data") => fail(`${what} tidak ditemukan`, 404);

/** Turn a ZodError into a flat field-error map for inline form display. */
export function zodErrorResponse(error: ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  const first = error.issues[0]?.message ?? "Input tidak valid";
  return fail(first, 400, { fieldErrors });
}

/**
 * Wrap an async route handler so thrown ZodErrors and unexpected errors
 * become structured JSON instead of crashing the route (NFR-R3 / NFR-06).
 */
export function handle<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ZodError) return zodErrorResponse(err);
      if (err instanceof HttpError) return fail(err.message, err.status);
      console.error("[api] unhandled error:", err);
      return fail("Terjadi kesalahan pada server", 500);
    }
  };
}

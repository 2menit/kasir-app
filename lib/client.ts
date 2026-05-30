"use client";

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

/** Typed fetch wrapper for client components hitting our JSON API. */
export async function apiFetch<T = unknown>(
  input: string,
  init?: RequestInit
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(input, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const json = (await res.json().catch(() => null)) as ApiResult<T> | null;
    if (!json) {
      return { success: false, error: "Respons server tidak valid" };
    }
    return json;
  } catch {
    return { success: false, error: "Tidak dapat terhubung ke server" };
  }
}

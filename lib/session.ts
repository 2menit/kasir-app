import { getServerSession } from "next-auth";
import type { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";

export type SessionUser = {
  id: string;
  name: string;
  username: string;
  role: Role;
};

/** Returns the current session user or null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

/** Error carrying an HTTP status, used by API route guards. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

/** Require any authenticated user (API context). Throws HttpError(401). */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Tidak terautentikasi");
  return user;
}

/** Require a specific role (API context). Throws 401/403. */
export async function requireRole(role: Role): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== role) throw new HttpError(403, "Akses ditolak");
  return user;
}

export const requireSuperadmin = () => requireRole("SUPERADMIN");

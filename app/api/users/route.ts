import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail, handle } from "@/lib/api";
import { requireAdminOrSuperadmin } from "@/lib/session";
import { createUserSchema } from "@/lib/validations";

const BCRYPT_ROUNDS = 12;

// GET /api/users — list crew/users scoped by city for admin
export const GET = handle(async () => {
  const me = await requireAdminOrSuperadmin();

  const where =
    me.role === "ADMIN"
      ? { role: "USER" as const, cityId: me.cityId }
      : undefined; // SUPERADMIN sees all users (incl. ADMIN)

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      cityId: true,
      createdAt: true,
      _count: { select: { crewEvents: true } },
    },
  });
  return ok(users);
});

// POST /api/users — [admin, superadmin] create crew account
export const POST = handle(async (req: NextRequest) => {
  const me = await requireAdminOrSuperadmin();
  const body = createUserSchema.parse(await req.json());

  const existing = await prisma.user.findUnique({
    where: { username: body.username },
  });
  if (existing) return fail("Username sudah digunakan", 409);

  // Role resolution:
  // - ADMIN may only create USER (ignore body.role).
  // - SUPERADMIN may create ADMIN or USER (default USER when omitted).
  // - SUPERADMIN can never be created here.
  const role: Role =
    me.role === "SUPERADMIN" && body.role === "ADMIN" ? "ADMIN" : "USER";

  // City resolution:
  // - ADMIN auto-assigns their own cityId.
  // - SUPERADMIN must supply cityId when creating an ADMIN (enforced),
  //   optional for USER (may be unassigned).
  let cityId: string | null;
  if (me.role === "ADMIN") {
    cityId = me.cityId;
  } else {
    cityId = body.cityId ?? null;
    if (role === "ADMIN" && !cityId) {
      return fail("Kota wajib dipilih untuk akun admin", 400);
    }
  }

  const user = await prisma.user.create({
    data: {
      name: body.name,
      username: body.username,
      password: await bcrypt.hash(body.password, BCRYPT_ROUNDS),
      role,
      cityId,
    },
    select: { id: true, name: true, username: true, role: true, cityId: true, createdAt: true },
  });
  return ok(user, 201);
});

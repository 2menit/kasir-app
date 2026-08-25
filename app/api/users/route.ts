import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
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
      : { role: "USER" as const };

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

  // Admin auto-assigns their own cityId; superadmin can supply cityId from body
  const cityId =
    me.role === "ADMIN" ? me.cityId : (body.cityId ?? null);

  const user = await prisma.user.create({
    data: {
      name: body.name,
      username: body.username,
      password: await bcrypt.hash(body.password, BCRYPT_ROUNDS),
      role: "USER",
      cityId,
    },
    select: { id: true, name: true, username: true, role: true, cityId: true, createdAt: true },
  });
  return ok(user, 201);
});

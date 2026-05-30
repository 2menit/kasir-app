import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, fail, handle } from "@/lib/api";
import { requireSuperadmin } from "@/lib/session";
import { createUserSchema } from "@/lib/validations";

const BCRYPT_ROUNDS = 12;

// GET /api/users — [superadmin] list all crew/users
export const GET = handle(async () => {
  await requireSuperadmin();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      createdAt: true,
      _count: { select: { crewEvents: true } },
    },
  });
  return ok(users);
});

// POST /api/users — [superadmin] create crew account
export const POST = handle(async (req: NextRequest) => {
  await requireSuperadmin();
  const body = createUserSchema.parse(await req.json());

  const existing = await prisma.user.findUnique({
    where: { username: body.username },
  });
  if (existing) return fail("Username sudah digunakan", 409);

  const user = await prisma.user.create({
    data: {
      name: body.name,
      username: body.username,
      password: await bcrypt.hash(body.password, BCRYPT_ROUNDS),
      role: "USER",
    },
    select: { id: true, name: true, username: true, role: true, createdAt: true },
  });
  return ok(user, 201);
});

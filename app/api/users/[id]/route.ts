import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, fail, notFound, forbidden, handle } from "@/lib/api";
import { requireAdminOrSuperadmin } from "@/lib/session";
import { updateUserSchema } from "@/lib/validations";

const BCRYPT_ROUNDS = 12;

type Ctx = { params: { id: string } };

// PUT /api/users/:id — [admin, superadmin] edit user (password optional)
export const PUT = handle(async (req: NextRequest, { params }: Ctx) => {
  const me = await requireAdminOrSuperadmin();
  const body = updateUserSchema.parse(await req.json());

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return notFound("User");

  // Admin can only edit crew in their own city
  if (me.role === "ADMIN" && target.cityId !== me.cityId) {
    return forbidden();
  }

  // Username uniqueness (excluding self)
  if (body.username !== target.username) {
    const dup = await prisma.user.findUnique({
      where: { username: body.username },
    });
    if (dup) return fail("Username sudah digunakan", 409);
  }

  const data: { name: string; username: string; password?: string } = {
    name: body.name,
    username: body.username,
  };
  if (body.password && body.password.length > 0) {
    data.password = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, username: true, role: true, cityId: true, createdAt: true },
  });
  return ok(user);
});

// DELETE /api/users/:id — [superadmin only] delete crew
export const DELETE = handle(async (_req: NextRequest, { params }: Ctx) => {
  const me = await requireAdminOrSuperadmin();

  // Admin cannot delete crew — only superadmin
  if (me.role === "ADMIN") {
    return forbidden();
  }

  if (me.id === params.id) {
    return fail("Tidak dapat menghapus akun sendiri", 400);
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return notFound("User");

  // Transactions keep their history (userId set null via onDelete: SetNull);
  // future crew assignments are removed via cascade.
  await prisma.user.delete({ where: { id: params.id } });
  return ok({ id: params.id });
});

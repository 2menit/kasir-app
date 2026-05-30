import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, fail, notFound, handle } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { changePasswordSchema } from "@/lib/validations";

const BCRYPT_ROUNDS = 12;

// PUT /api/profile/password — any authenticated user changes their OWN password
export const PUT = handle(async (req: NextRequest) => {
  const me = await requireUser();
  const { currentPassword, newPassword } = changePasswordSchema.parse(
    await req.json()
  );

  const user = await prisma.user.findUnique({ where: { id: me.id } });
  if (!user) return notFound("User");

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    return fail("Password saat ini salah", 400, {
      fieldErrors: { currentPassword: "Password saat ini salah" },
    });
  }

  // Reject a no-op change so the user knows nothing happened.
  if (await bcrypt.compare(newPassword, user.password)) {
    return fail("Password baru harus berbeda dari password lama", 400, {
      fieldErrors: { newPassword: "Password baru harus berbeda" },
    });
  }

  await prisma.user.update({
    where: { id: me.id },
    data: { password: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) },
  });

  return ok({ updated: true });
});

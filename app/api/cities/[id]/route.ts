import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, notFound, handle } from "@/lib/api";
import { requireSuperadmin } from "@/lib/session";
import { updateCitySchema } from "@/lib/validations";

type Ctx = { params: { id: string } };

// PUT /api/cities/:id — [superadmin] rename a city
export const PUT = handle(async (req: NextRequest, { params }: Ctx) => {
  await requireSuperadmin();
  const body = updateCitySchema.parse(await req.json());

  const target = await prisma.city.findUnique({ where: { id: params.id } });
  if (!target) return notFound("Kota");

  // Check name uniqueness (excluding self)
  if (body.name !== target.name) {
    const dup = await prisma.city.findUnique({
      where: { name: body.name },
    });
    if (dup) return fail("Nama kota sudah digunakan", 409);
  }

  const city = await prisma.city.update({
    where: { id: params.id },
    data: { name: body.name },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return ok(city);
});

// DELETE /api/cities/:id — [superadmin] delete a city
// Blocked if the city still has users or events assigned (require migration first).
export const DELETE = handle(async (_req: NextRequest, { params }: Ctx) => {
  await requireSuperadmin();

  const target = await prisma.city.findUnique({
    where: { id: params.id },
    include: { _count: { select: { users: true, events: true } } },
  });
  if (!target) return notFound("Kota");

  if (target._count.users > 0 || target._count.events > 0) {
    return fail(
      "Kota tidak dapat dihapus karena masih memiliki user atau event. Pindahkan terlebih dahulu.",
      409
    );
  }

  await prisma.city.delete({ where: { id: params.id } });
  return ok({ id: params.id });
});

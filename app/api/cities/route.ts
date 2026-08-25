import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, handle } from "@/lib/api";
import { requireSuperadmin } from "@/lib/session";
import { createCitySchema } from "@/lib/validations";

// GET /api/cities — [superadmin] list all cities with counts
export const GET = handle(async () => {
  await requireSuperadmin();
  const cities = await prisma.city.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { users: true, events: true } },
    },
  });
  const data = cities.map((c) => ({
    id: c.id,
    name: c.name,
    usersCount: c._count.users,
    eventsCount: c._count.events,
    createdAt: c.createdAt.toISOString(),
  }));
  return ok(data);
});

// POST /api/cities — [superadmin] create a new city
export const POST = handle(async (req: NextRequest) => {
  await requireSuperadmin();
  const body = createCitySchema.parse(await req.json());

  const existing = await prisma.city.findUnique({
    where: { name: body.name },
  });
  if (existing) return fail("Nama kota sudah digunakan", 409);

  const city = await prisma.city.create({
    data: { name: body.name },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return ok(city, 201);
});

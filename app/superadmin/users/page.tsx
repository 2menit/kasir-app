import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { UsersManager, type UserRow } from "./users-manager";
import type { CityOption } from "@/components/forms/event-form";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await getCurrentUser();
  const [users, cities] = await Promise.all([
    prisma.user.findMany({
      // Superadmin sees all crew + admins across cities
      where: { role: { in: ["USER", "ADMIN"] } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        cityId: true,
        city: { select: { name: true } },
        createdAt: true,
      },
    }),
    prisma.city.findMany({ orderBy: { name: "asc" } }),
  ]);

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    cityId: u.cityId,
    cityName: u.city?.name ?? null,
    createdAt: u.createdAt.toISOString(),
  }));

  const cityOptions: CityOption[] = cities.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <UsersManager
      initialUsers={rows}
      currentUserId={me!.id}
      currentUserRole={me!.role}
      cities={cityOptions}
    />
  );
}

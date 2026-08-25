import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { AdminCrewManager, type AdminUserRow } from "./admin-crew-manager";

export const dynamic = "force-dynamic";

export default async function AdminCrewPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/login");

  const [users, city] = await Promise.all([
    prisma.user.findMany({
      where: { role: "USER", cityId: user.cityId },
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
    user.cityId
      ? prisma.city.findUnique({
          where: { id: user.cityId },
          select: { name: true },
        })
      : Promise.resolve(null),
  ]);

  const rows: AdminUserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    cityName: u.city?.name ?? null,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <AdminCrewManager
      initialUsers={rows}
      currentUserId={user.id}
      cityName={city?.name ?? null}
    />
  );
}

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { CitiesManager, type CityRow } from "./cities-manager";

export const dynamic = "force-dynamic";

export default async function CitiesPage() {
  const me = await getCurrentUser();
  const cities = await prisma.city.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { users: true, events: true },
      },
    },
  });

  const rows: CityRow[] = cities.map((c) => ({
    id: c.id,
    name: c.name,
    usersCount: c._count.users,
    eventsCount: c._count.events,
    createdAt: c.createdAt.toISOString(),
  }));

  return <CitiesManager initialCities={rows} />;
}

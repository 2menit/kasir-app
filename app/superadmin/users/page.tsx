import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { UsersManager, type UserRow } from "./users-manager";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await getCurrentUser();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      createdAt: true,
    },
  });

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  }));

  return <UsersManager initialUsers={rows} currentUserId={me!.id} />;
}

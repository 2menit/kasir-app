import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const jember = await prisma.city.upsert({
    where: { name: "Jember" },
    update: {},
    create: { name: "Jember" },
  });
  const jakarta = await prisma.city.upsert({
    where: { name: "Jakarta" },
    update: {},
    create: { name: "Jakarta" },
  });
  const usersUpdated = await prisma.user.updateMany({
    where: { role: "USER", cityId: null },
    data: { cityId: jember.id },
  });
  const eventsUpdated = await prisma.event.updateMany({
    where: { cityId: null },
    data: { cityId: jember.id },
  });
  console.log(`Backfill completed successfully. Users updated: ${usersUpdated.count}, Events updated: ${eventsUpdated.count}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});

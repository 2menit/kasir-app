/**
 * Supplemental demo seed: spreads DONE events with transactions across many
 * months of the current year so the rekap revenue chart has data to show.
 * Idempotent — skips any event whose name already exists.
 *
 * Run: npm run db:seed:graph
 */
import { PrismaClient, EventStatus, PaymentMethod, Role } from "@prisma/client";

const prisma = new PrismaClient();

const YEAR = new Date().getFullYear();

// month is 1-based. Each entry becomes a DONE event with `txns` transactions.
const PLAN = [
  { month: 1, name: "Wedding Andi & Sari", location: "Gedung Kartini, Malang", pkg: "Paket Silver", price: 12000, txns: 8 },
  { month: 2, name: "Festival Imlek Kota", location: "Alun-alun Batu", pkg: "Paket Gold", price: 10000, txns: 12 },
  { month: 3, name: "Wisuda Universitas Brawijaya", location: "Graha Cakrawala, Malang", pkg: "Paket Gold", price: 15000, txns: 20 },
  { month: 4, name: "Ramadhan Bazaar 2026", location: "Mall Olympic Garden", pkg: "Paket Bronze", price: 8000, txns: 15 },
  { month: 6, name: "Wedding Dito & Mega", location: "Hotel Tugu, Malang", pkg: "Paket Platinum", price: 18000, txns: 10 },
  { month: 7, name: "Reuni Akbar SMA 5", location: "Harris Hotel, Malang", pkg: "Paket Silver", price: 12000, txns: 14 },
  { month: 9, name: "Pernikahan Yoga & Nisa", location: "Pendopo Agung, Malang", pkg: "Paket Platinum", price: 20000, txns: 9 },
  { month: 10, name: "Corporate Gala Dinner BNI", location: "Ijen Suites, Malang", pkg: "Paket Platinum", price: 25000, txns: 16 },
  { month: 12, name: "Perayaan Natal & Tahun Baru", location: "Atria Hotel, Malang", pkg: "Paket Gold", price: 15000, txns: 22 },
];

async function main() {
  const crew = await prisma.user.findMany({ where: { role: Role.USER } });
  if (crew.length === 0) {
    console.error("No crew found — run `npm run db:seed` first.");
    process.exit(1);
  }

  const methods: PaymentMethod[] = [PaymentMethod.CASH, PaymentMethod.QRIS];
  let created = 0;

  for (const [idx, p] of PLAN.entries()) {
    const existing = await prisma.event.findFirst({ where: { name: p.name } });
    if (existing) {
      console.log(`• Skip (exists): ${p.name}`);
      continue;
    }

    // Event date: 15th of the month at 10:00 WIB (03:00 UTC).
    const eventDate = new Date(Date.UTC(YEAR, p.month - 1, 15, 3, 0, 0));
    const c1 = crew[idx % crew.length]!;
    const c2 = crew[(idx + 1) % crew.length]!;

    const event = await prisma.event.create({
      data: {
        name: p.name,
        location: p.location,
        eventDate,
        pricePerPrint: p.price,
        status: EventStatus.DONE,
        crew: {
          create: [
            { userId: c1.id, attended: true },
            { userId: c2.id, attended: idx % 2 === 0 },
          ],
        },
      },
    });

    for (let i = 0; i < p.txns; i++) {
      const printCount = 1 + ((i + idx) % 4); // 1..4
      await prisma.transaction.create({
        data: {
          eventId: event.id,
          userId: i % 2 === 0 ? c1.id : c2.id,
          printCount,
          paymentMethod: methods[i % methods.length]!,
          total: printCount * p.price,
          note: i % 4 === 0 ? "Cetak ulang" : null,
          createdAt: new Date(eventDate.getTime() + i * 6 * 60 * 1000),
        },
      });
    }
    created++;
    console.log(`✔ ${p.name} (${p.txns} transaksi)`);
  }

  // ── One ONGOING event using the PISAH (split) pricing, with times ────────
  const pisahName = "Wedding Demo Harga Pisah";
  if (!(await prisma.event.findFirst({ where: { name: pisahName } }))) {
    const now = new Date();
    const start = new Date(now.getTime() - 60 * 60 * 1000); // started 1h ago
    const end = new Date(now.getTime() + 3 * 60 * 60 * 1000); // ends in 3h
    await prisma.event.create({
      data: {
        name: pisahName,
        location: "Ballroom Demo, Malang",
        eventDate: now,
        startTime: start,
        endTime: end,
        pricingType: "PISAH",
        pricePerPrint: 15000, // first print
        copyPrice: 10000, // each same-photo copy
        status: "ONGOING",
        crew: {
          create: [
            { userId: crew[0]!.id, attended: true },
            { userId: crew[1 % crew.length]!.id, attended: false },
          ],
        },
      },
    });
    console.log(`✔ ${pisahName} (ONGOING, skema PISAH 15k/10k)`);
  } else {
    console.log(`• Skip (exists): ${pisahName}`);
  }

  console.log(`\nDone. Created ${created} new event(s) across ${YEAR}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

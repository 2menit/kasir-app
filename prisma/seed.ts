import { PrismaClient, Role, EventStatus, PaymentMethod } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;

async function main() {
  const saName = process.env.SEED_SUPERADMIN_NAME ?? "Owner";
  const saUsername = process.env.SEED_SUPERADMIN_USERNAME ?? "superadmin";
  const saPassword = process.env.SEED_SUPERADMIN_PASSWORD ?? "password";

  // ── Superadmin (seeded, never created via UI — SRS §7.5) ────────────────
  const superadmin = await prisma.user.upsert({
    where: { username: saUsername },
    update: {},
    create: {
      name: saName,
      username: saUsername,
      password: await bcrypt.hash(saPassword, BCRYPT_ROUNDS),
      role: Role.SUPERADMIN,
    },
  });
  console.log(`✔ Superadmin ready: ${superadmin.username}`);

  // Production-safe: only seed the superadmin unless demo data is requested.
  if (process.env.SEED_DEMO !== "true") {
    console.log(
      "• SEED_DEMO not 'true' — skipping demo crew & events (production-safe)."
    );
    return;
  }

  // ── Demo crew accounts ──────────────────────────────────────────────────
  const crewSeed = [
    { name: "Budi Santoso", username: "budi" },
    { name: "Siti Aminah", username: "siti" },
    { name: "Andi Wijaya", username: "andi" },
  ];

  const crew = [];
  for (const c of crewSeed) {
    const u = await prisma.user.upsert({
      where: { username: c.username },
      update: {},
      create: {
        name: c.name,
        username: c.username,
        password: await bcrypt.hash("crew1234", BCRYPT_ROUNDS),
        role: Role.USER,
      },
    });
    crew.push(u);
  }
  console.log(`✔ Seeded ${crew.length} crew accounts (password: crew1234)`);

  // ── Demo events (idempotent guard) ──────────────────────────────────────
  const existingEvents = await prisma.event.count();
  if (existingEvents > 0) {
    console.log("• Events already present — skipping demo event seeding.");
    return;
  }

  const now = new Date();
  const ongoing = await prisma.event.create({
    data: {
      name: "Wedding Rizal & Ayu",
      location: "Gedung Graha Cakra, Malang",
      eventDateStart: now,
      eventDateEnd: now,
      pricePerPrint: 15000,
      status: EventStatus.ONGOING,
      notes: "Booth utama di lobby.",
      crew: {
        create: [
          { userId: crew[0]!.id, attended: true },
          { userId: crew[1]!.id, attended: true },
        ],
      },
    },
    include: { crew: true },
  });

  // Seed some transactions for the ongoing event
  const methods: PaymentMethod[] = [PaymentMethod.CASH, PaymentMethod.QRIS];
  for (let i = 0; i < 6; i++) {
    const printCount = 1 + (i % 4);
    await prisma.transaction.create({
      data: {
        eventId: ongoing.id,
        userId: ongoing.crew[i % ongoing.crew.length]!.userId,
        printCount,
        paymentMethod: methods[i % methods.length]!,
        total: printCount * ongoing.pricePerPrint,
        note: i % 3 === 0 ? "Cetak ulang" : null,
        createdAt: new Date(now.getTime() - i * 7 * 60 * 1000),
      },
    });
  }

  await prisma.event.create({
    data: {
      name: "Ulang Tahun ke-17 Dinda",
      location: "Hotel Santika, Surabaya",
      eventDateStart: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      eventDateEnd: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      pricePerPrint: 10000,
      status: EventStatus.UPCOMING,
      crew: { create: [{ userId: crew[2]!.id }] },
    },
  });

  await prisma.event.create({
    data: {
      name: "Gathering PT Maju Jaya",
      location: "Ballroom Whiz Prime, Malang",
      eventDateStart: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000),
      eventDateEnd: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000),
      pricePerPrint: 20000,
      status: EventStatus.DONE,
      crew: {
        create: [
          { userId: crew[0]!.id, attended: true },
          { userId: crew[2]!.id, attended: false },
        ],
      },
    },
  });

  console.log("✔ Seeded demo events + transactions");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

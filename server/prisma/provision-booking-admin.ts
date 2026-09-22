import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.BOOKING_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOKING_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Set BOOKING_ADMIN_EMAIL and BOOKING_ADMIN_PASSWORD before running this command.");
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    throw new Error(`Account ${email} already exists. No credentials or permissions were changed.`);
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      firstName: "Booking",
      lastName: "Admin",
      role: "BOOKING_ADMIN",
      isActive: true,
      emailVerified: true,
    },
  });
  console.log(`Created bookings-only admin account: ${email}`);
}

main()
  .catch((error) => {
    console.error("Booking admin provisioning failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

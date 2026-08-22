import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const publicDefaults = [
  { key: "site_name", value: "Fusion Turf", group: "general" },
  { key: "site_description", value: "Premium Turf Booking & League Management", group: "general" },
  { key: "site_logo_url", value: "", group: "general" },
  { key: "site_hero_url", value: "/hero-1440.webp", group: "general" },
  { key: "contact_email", value: "info@fusionturf.com", group: "contact" },
  { key: "contact_phone", value: "+91-9876543210", group: "contact" },
  { key: "social_facebook", value: "https://facebook.com/fusionleague", group: "social" },
  { key: "social_instagram", value: "https://instagram.com/fusionleague", group: "social" },
  { key: "social_twitter", value: "https://twitter.com/fusionleague", group: "social" },
  { key: "currency", value: "INR", group: "general" },
  { key: "timezone", value: "Asia/Kolkata", group: "general" },
  { key: "stat_teams", value: "6", group: "stats" },
  { key: "stat_players", value: "108+", group: "stats" },
  { key: "stat_matches", value: "40+", group: "stats" },
  { key: "stat_venues", value: "1", group: "stats" },
] as const;

async function main() {
  for (const setting of publicDefaults) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      create: setting,
      update: {},
    });
  }
  console.log("Safe seed complete: missing public settings were created; existing data was preserved.");
}

main()
  .catch((error) => {
    console.error("Safe seed error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

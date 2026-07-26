const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    const data = {
      name: "Test Season " + Date.now(),
      slug: "test-" + Date.now(),
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-03-31"),
      isActive: true,
      isCurrent: true,
    };
    console.log("Creating with data:", JSON.stringify(data, null, 2));
    const season = await prisma.season.create({ data });
    console.log("SUCCESS:", JSON.stringify(season, null, 2));
  } catch (err) {
    console.error("ERROR:", err.message);
    if (err.code) console.error("CODE:", err.code);
    if (err.meta) console.error("META:", JSON.stringify(err.meta));
  } finally {
    await prisma.$disconnect();
  }
}

main();

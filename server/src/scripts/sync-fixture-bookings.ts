import "dotenv/config";
import prisma from "../config/database.js";
import { syncUpcomingFixtureBookings } from "../services/fixture-bookings.js";

syncUpcomingFixtureBookings()
  .then((result) => {
    console.log(`Reserved ${result.synced} upcoming league fixture slots.`);
    if (result.failures.length) {
      console.error("Fixtures not reserved:", result.failures);
      process.exitCode = 1;
    }
  })
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });

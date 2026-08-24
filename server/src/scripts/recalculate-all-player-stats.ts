import "dotenv/config";
import prisma from "../config/database.js";
import { recalculateFriendlyPlayerStats, recalculatePlayerStats, recalculateTeamStats } from "../services/league-system.js";

async function main() {
  const seasons = await prisma.season.findMany({ select: { id: true, name: true } });
  for (const season of seasons) {
    await recalculatePlayerStats(season.id);
    await recalculateFriendlyPlayerStats(season.id);
    await recalculateTeamStats(season.id);
    console.log(`Recalculated statistics for ${season.name}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data
  const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname='public'
  `;
  for (const { tablename } of tablenames) {
    if (tablename !== "_prisma_migrations") {
      try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`);
      } catch { /* ignore */ }
    }
  }

  // ─── Users ───
  const passwordHash = await bcrypt.hash("password123", 12);
  const adminPasswordHash = await bcrypt.hash("Abdurahman.15", 12);

  const admin = await prisma.user.create({
    data: {
      email: "admin@fusionturf.com",
      passwordHash: adminPasswordHash,
      firstName: "Nuzair",
      lastName: "Admin",
      role: "SUPER_ADMIN",
      emailVerified: true,
    },
  });

  const customer = await prisma.user.create({
    data: {
      email: "user@example.com",
      passwordHash,
      firstName: "John",
      lastName: "Doe",
      role: "CUSTOMER",
      emailVerified: true,
      phone: "+919876543210",
    },
  });

  const bookingManager = await prisma.user.create({
    data: {
      email: "manager@fusionturf.com",
      passwordHash,
      firstName: "Booking",
      lastName: "Manager",
      role: "BOOKING_MANAGER",
      emailVerified: true,
    },
  });

  console.log("  ✅ Users created");

  // ─── Settings ───
  const settings = [
    { key: "site_name", value: "Fusion Turf", group: "general" },
    { key: "site_description", value: "Premium Turf Booking & League Management", group: "general" },
    { key: "site_logo_url", value: "", group: "general" },
    { key: "site_hero_url", value: "/hero.jpeg", group: "general" },
    { key: "contact_email", value: "info@fusionturf.com", group: "contact" },
    { key: "contact_phone", value: "+91-9876543210", group: "contact" },
    { key: "social_facebook", value: "https://facebook.com/fusionleague", group: "social" },
    { key: "social_instagram", value: "https://instagram.com/fusionleague", group: "social" },
    { key: "social_twitter", value: "https://twitter.com/fusionleague", group: "social" },
    { key: "currency", value: "INR", group: "general" },
    { key: "timezone", value: "Asia/Kolkata", group: "general" },
  ];

  for (const s of settings) {
    await prisma.setting.create({ data: s });
  }
  console.log("  ✅ Settings created");

  // ─── Season ───
  const season = await prisma.season.create({
    data: {
      name: "January - March 2026",
      slug: "january-march-2026",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-03-31"),
      isActive: true,
      isCurrent: true,
      description: "Jan-Mar 2026 Fusion League season",
      managedById: admin.id,
    },
  });

  const prevSeason = await prisma.season.create({
    data: {
      name: "October - December 2025",
      slug: "october-december-2025",
      startDate: new Date("2025-10-01"),
      endDate: new Date("2025-12-31"),
      isActive: false,
      isCurrent: false,
      description: "Oct-Dec 2025 Fusion League season",
    },
  });
  console.log("  ✅ Seasons created");

  // ─── Venue & Turfs ───
  const venue = await prisma.venue.create({
    data: {
      name: "Fusion Sports Arena",
      slug: "fusion-sports-arena",
      description: "State-of-the-art football turf facility with premium amenities",
      address: "123 Sports Complex, MG Road",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      latitude: 19.0760,
      longitude: 72.8777,
      phone: "+91-9876543210",
      email: "arena@fusionturf.com",
      coverImage: "https://images.unsplash.com/photo-1577223625816-6500cc85a8b5?w=1200",
      logo: "https://images.unsplash.com/photo-1560272564-c83b4b0c1e5b?w=200",
      openingTime: "06:00",
      closingTime: "23:00",
      workingHours: {
        create: Array.from({ length: 7 }, (_, i) => ({
          dayOfWeek: i,
          openTime: i === 0 ? "08:00" : "06:00",
          closeTime: "23:00",
          isClosed: false,
        })),
      },
    },
  });

  const turf1 = await prisma.turf.create({
    data: {
      venueId: venue.id,
      name: "Fusion 5-a-side",
      description: "Perfect for small-sided games",
      size: "5-a-side",
      surface: "Artificial Grass",
      basePrice: 50000,
      peakPrice: 100000,
      weekendPrice: 80000,
      capacity: 10,
      imageUrl: "https://images.unsplash.com/photo-1577223625816-6500cc85a8b5?w=600",
    },
  });

  const turf2 = await prisma.turf.create({
    data: {
      venueId: venue.id,
      name: "Fusion 7-a-side",
      description: "Ideal for competitive matches",
      size: "7-a-side",
      surface: "Artificial Grass",
      basePrice: 80000,
      peakPrice: 150000,
      weekendPrice: 120000,
      capacity: 14,
      imageUrl: "https://images.unsplash.com/photo-1459865264687-595d652de67e?w=600",
    },
  });

  // Additional Services
  const services = [
    { turfId: turf1.id, name: "Referee", price: 50000 },
    { turfId: turf1.id, name: "Water Bottles (per box)", price: 30000 },
    { turfId: turf1.id, name: "Practice Balls (set of 5)", price: 20000 },
    { turfId: turf2.id, name: "Referee", price: 50000 },
    { turfId: turf2.id, name: "Water Bottles (per box)", price: 30000 },
    { turfId: turf2.id, name: "Practice Balls (set of 5)", price: 20000 },
  ];

  for (const s of services) {
    await prisma.additionalService.create({ data: s });
  }

  console.log("  ✅ Venue & Turfs created");

  // ─── Competition ───
  const competition = await prisma.competition.create({
    data: {
      seasonId: season.id,
      name: "Fusion League Premier Division",
      slug: "premier-division",
      type: "LEAGUE",
    },
  });
  console.log("  ✅ Competition created");

  // ─── Teams ───
  const teamData = [
    { name: "FC Phoenix", slug: "fc-phoenix", shortName: "PHO", city: "Mumbai", foundedYear: 2015, homeStadium: "Phoenix Ground" },
    { name: "United Strikers", slug: "united-strikers", shortName: "UNI", city: "Delhi", foundedYear: 2016, homeStadium: "Striker Arena" },
    { name: "Royal Challengers FC", slug: "royal-challengers-fc", shortName: "RCF", city: "Bangalore", foundedYear: 2014, homeStadium: "RC Stadium" },
    { name: "Elite Warriors", slug: "elite-warriors", shortName: "ELI", city: "Chennai", foundedYear: 2017, homeStadium: "Warrior Park" },
    { name: "Thunderbolts FC", slug: "thunderbolts-fc", shortName: "THU", city: "Kolkata", foundedYear: 2018, homeStadium: "Thunder Arena" },
    { name: "Golden Eagles", slug: "golden-eagles", shortName: "GEA", city: "Hyderabad", foundedYear: 2015, homeStadium: "Eagles Nest" },
  ];

  const teams = [];
  for (const t of teamData) {
    const team = await prisma.team.create({
      data: { ...t, seasonId: season.id, description: `A premier football club from ${t.city}`, managedById: admin.id, socialLinks: { instagram: "#", twitter: "#" } },
    });
    teams.push(team);
  }
  console.log("  ✅ Teams created");

  // ─── Players ───
  const positions = ["GK", "CB", "LB", "RB", "CM", "CAM", "CDM", "LM", "RM", "LW", "RW", "ST", "CF"];
  const nationalities = ["India", "Brazil", "Argentina", "Spain", "Germany", "France", "England", "Portugal"];

  for (let t = 0; t < teams.length; t++) {
    for (let p = 1; p <= 18; p++) {
      const pos = positions[p % positions.length];
      await prisma.player.create({
        data: {
          seasonId: season.id,
          teamId: teams[t].id,
          firstName: `Player${t * 18 + p}`,
          lastName: ["Singh", "Kumar", "Patel", "Sharma", "Verma", "Das", "Nair", "Menon"][p % 8],
          slug: `player-${t * 18 + p}-${teams[t].slug}`,
          nationality: nationalities[p % nationalities.length],
          dateOfBirth: new Date(1990 + (p % 15), p % 12, p % 28),
          age: 22 + (p % 10),
          height: 165 + (p % 30),
          weight: 60 + (p % 30),
          preferredFoot: p % 3 === 0 ? "Left" : p % 3 === 1 ? "Right" : "Both",
          jerseyNumber: p,
          position: pos,
          photoUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=player${t * 18 + p}`,
          biography: `An experienced ${pos} with great vision and passing ability.`,
        },
      });
    }
  }
  console.log("  ✅ Players created");

  // ─── Staff ───
  for (const team of teams) {
    const roles = ["Head Coach", "Assistant Coach", "Goalkeeping Coach", "Physiotherapist", "Team Manager"];
    for (let i = 0; i < roles.length; i++) {
      await prisma.staff.create({
        data: {
          teamId: team.id,
          firstName: `${roles[i].split(" ")[0]}`,
          lastName: team.name.split(" ").pop() || "Staff",
          role: roles[i],
        },
      });
    }
  }
  console.log("  ✅ Staff created");

  // ─── Fixtures ───
  const fixtureStatuses = ["COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED", "SCHEDULED", "SCHEDULED", "LIVE"];

  for (let round = 1; round <= 10; round++) {
    for (let i = 0; i < teams.length; i += 2) {
      if (i + 1 >= teams.length) break;
      const homeTeam = teams[i];
      const awayTeam = teams[i + 1];
      const status = fixtureStatuses[round % fixtureStatuses.length] as any;
      const matchDate = new Date(2025, 8 + round, 10 + i);

      const homeScore = status === "COMPLETED" ? Math.floor(Math.random() * 5) : null;
      const awayScore = status === "COMPLETED" ? Math.floor(Math.random() * 4) : null;

      const fixture = await prisma.fixture.create({
        data: {
          seasonId: season.id,
          competitionId: competition.id,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          venueId: venue.id,
          matchDate,
          kickoffTime: "19:00",
          round,
          status,
          homeScore,
          awayScore,
          homePossession: status === "COMPLETED" ? 45 + Math.floor(Math.random() * 15) : null,
          awayPossession: status === "COMPLETED" ? 40 + Math.floor(Math.random() * 10) : null,
          homeShots: status === "COMPLETED" ? Math.floor(Math.random() * 15) + 5 : null,
          awayShots: status === "COMPLETED" ? Math.floor(Math.random() * 12) + 3 : null,
          homeShotsOnTarget: status === "COMPLETED" ? Math.floor(Math.random() * 8) : null,
          awayShotsOnTarget: status === "COMPLETED" ? Math.floor(Math.random() * 6) : null,
          homeCorners: status === "COMPLETED" ? Math.floor(Math.random() * 10) : null,
          awayCorners: status === "COMPLETED" ? Math.floor(Math.random() * 8) : null,
          homeFouls: status === "COMPLETED" ? Math.floor(Math.random() * 15) : null,
          awayFouls: status === "COMPLETED" ? Math.floor(Math.random() * 15) : null,
          homeOffsides: status === "COMPLETED" ? Math.floor(Math.random() * 5) : null,
          awayOffsides: status === "COMPLETED" ? Math.floor(Math.random() * 5) : null,
          stadium: venue.name,
          referee: "Ref. Sharma",
          isFeatured: round <= 2,
        },
      });

      // Add goals if completed
      if (status === "COMPLETED" && homeScore && awayScore) {
        for (let g = 0; g < homeScore; g++) {
          const player = await prisma.player.findFirst({
            where: { teamId: homeTeam.id, position: { in: ["ST", "CF", "LW", "RW", "CAM"] } },
          });
          if (player) {
            await prisma.goal.create({
              data: { fixtureId: fixture.id, playerId: player.id, minute: 10 + g * 15 },
            });
          }
        }
        for (let g = 0; g < awayScore; g++) {
          const player = await prisma.player.findFirst({
            where: { teamId: awayTeam.id, position: { in: ["ST", "CF", "LW", "RW", "CAM"] } },
          });
          if (player) {
            await prisma.goal.create({
              data: { fixtureId: fixture.id, playerId: player.id, minute: 20 + g * 20 },
            });
          }
        }
      }
    }
  }
  console.log("  ✅ Fixtures created");

  // ─── Standings ───
  for (let i = 0; i < teams.length; i++) {
    const played = 10;
    const wins = Math.floor(Math.random() * 7) + 1;
    const draws = Math.floor(Math.random() * 4);
    const losses = played - wins - draws;

    const form = Array.from({ length: 5 }, () => {
      const r = Math.random();
      return r > 0.6 ? "W" : r > 0.3 ? "D" : "L";
    }).join("");

    await prisma.standing.create({
      data: {
        seasonId: season.id,
        teamId: teams[i].id,
        position: i + 1,
        played,
        wins,
        draws,
        losses,
        goalsFor: wins * 2 + draws + Math.floor(Math.random() * 5),
        goalsAgainst: losses * 2 + Math.floor(Math.random() * 5),
        points: wins * 3 + draws,
        form,
      },
    });
  }
  console.log("  ✅ Standings created");

  // ─── Player Stats ───
  const allPlayers = await prisma.player.findMany({ where: { seasonId: season.id } });
  for (const player of allPlayers) {
    const apps = Math.floor(Math.random() * 10) + 1;
    await prisma.playerStat.create({
      data: {
        seasonId: season.id,
        playerId: player.id,
        teamId: player.teamId!,
        appearances: apps,
        goals: player.position === "ST" || player.position === "CF" ? Math.floor(Math.random() * 15) : Math.floor(Math.random() * 5),
        assists: Math.floor(Math.random() * 8),
        minutesPlayed: apps * 90,
        passAccuracy: 70 + Math.floor(Math.random() * 20),
        shots: Math.floor(Math.random() * 30) + 5,
        shotsOnTarget: Math.floor(Math.random() * 15) + 2,
        tackles: player.position === "CB" || player.position === "CDM" ? Math.floor(Math.random() * 40) + 10 : Math.floor(Math.random() * 20),
        interceptions: Math.floor(Math.random() * 30) + 5,
        fouls: Math.floor(Math.random() * 20),
        offsides: Math.floor(Math.random() * 10),
        yellowCards: Math.floor(Math.random() * 6),
        redCards: Math.floor(Math.random() * 2),
        saves: player.position === "GK" ? Math.floor(Math.random() * 50) + 10 : null,
        cleanSheets: player.position === "GK" ? Math.floor(Math.random() * 5) : null,
        goalsConceded: player.position === "GK" ? Math.floor(Math.random() * 20) : null,
        averageRating: 5 + Math.random() * 4,
      },
    });
  }
  console.log("  ✅ Player Stats created");

  // ─── Awards ───
  const awardsData = [
    { name: "Golden Boot", slug: "golden-boot", description: "Top goal scorer of the season" },
    { name: "Golden Glove", slug: "golden-glove", description: "Best goalkeeper of the season" },
    { name: "MVP", slug: "mvp", description: "Most Valuable Player of the season" },
    { name: "Best Defender", slug: "best-defender", description: "Best defensive player" },
    { name: "Best Midfielder", slug: "best-midfielder", description: "Best midfield player" },
    { name: "Young Player of the Year", slug: "young-player", description: "Best player under 21" },
    { name: "Fair Play Award", slug: "fair-play", description: "Best disciplinary record" },
    { name: "Goal of the Season", slug: "goal-of-season", description: "Best goal scored" },
    { name: "Fan Favorite", slug: "fan-favorite", description: "Most popular player" },
  ];

  for (const a of awardsData) {
    await prisma.award.create({
      data: {
        ...a,
        seasonId: season.id,
        managedById: admin.id,
        votingEnabled: Math.random() > 0.5,
        votingType: "REGISTERED_ONLY",
        voteFrequency: "ONCE",
      },
    });
  }
  console.log("  ✅ Awards created");

  // ─── News ───
  const newsData = [
    { title: "Fusion League Season 2025-2026 Kicks Off!", excerpt: "The most anticipated football league is back with a bang." },
    { title: "FC Phoenix Signs Star Playmaker", excerpt: "In a blockbuster transfer, FC Phoenix has secured the signature of..." },
    { title: "Golden Eagles Soar to the Top of the Table", excerpt: "With an impressive 5-match winning streak..." },
    { title: "Youth Academy Graduates Shine in First Team", excerpt: "Three academy graduates made their senior debuts..." },
    { title: "Record Attendance at Fusion Sports Arena", excerpt: "The stadium saw its biggest crowd of the season..." },
  ];

  for (const n of newsData) {
    await prisma.news.create({
      data: {
        ...n,
        slug: n.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        content: `<p>${n.excerpt} This is a detailed article about the latest happenings in the Fusion League. Stay tuned for more updates and exciting matches throughout the season.</p>`,
        imageUrl: "https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800",
        author: "Fusion League Staff",
        isPublished: true,
        publishedAt: new Date(),
        seasonId: season.id,
      },
    });
  }
  console.log("  ✅ News created");

  // ─── Coupons ───
  const coupons = [
    { code: "WELCOME10", discountType: "PERCENTAGE", discountValue: 10, maxUses: 100, minAmount: 50000 },
    { code: "FLAT200", discountType: "FIXED", discountValue: 20000, maxUses: 50, minAmount: 100000 },
    { code: "SUMMER25", discountType: "PERCENTAGE", discountValue: 25, maxUses: 200, expiresAt: new Date("2025-09-30") },
  ];

  for (const c of coupons) {
    await prisma.coupon.create({ data: c });
  }
  console.log("  ✅ Coupons created");

  // ─── Previous Season Data ───
  const prevTeams = [];
  for (const t of teamData.slice(0, 4)) {
    const team = await prisma.team.create({
      data: { ...t, seasonId: prevSeason.id, managedById: admin.id },
    });
    prevTeams.push(team);
  }

  for (const team of prevTeams) {
    await prisma.standing.create({
      data: {
        seasonId: prevSeason.id,
        teamId: team.id,
        position: prevTeams.indexOf(team) + 1,
        played: 8,
        wins: 5 - prevTeams.indexOf(team),
        draws: 2,
        losses: 1 + prevTeams.indexOf(team),
        goalsFor: 12 - prevTeams.indexOf(team) * 2,
        goalsAgainst: 5 + prevTeams.indexOf(team) * 2,
        points: (5 - prevTeams.indexOf(team)) * 3 + 2,
        form: "WWDLW",
      },
    });
  }

  // Previous winners
  const prevAwards = await prisma.award.findMany({ where: { seasonId: season.id }, take: 3 });
  const samplePlayers = await prisma.player.findMany({ take: 3 });
  for (let i = 0; i < Math.min(prevAwards.length, samplePlayers.length); i++) {
    await prisma.previousWinner.create({
      data: {
        awardId: prevAwards[i].id,
        playerId: samplePlayers[i].id,
        seasonId: prevSeason.id,
        year: "2024-2025",
      },
    });
  }

  console.log("  ✅ Previous season data created");

  // ─── Gallery ───
  const galleryImages = [
    "https://images.unsplash.com/photo-1459865264687-595d652de67e",
    "https://images.unsplash.com/photo-1577223625816-6500cc85a8b5",
    "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d",
    "https://images.unsplash.com/photo-1517466787929-bc90951d0974",
    "https://images.unsplash.com/photo-1560272564-c83b4b0c1e5b",
  ];

  for (const url of galleryImages) {
    await prisma.gallery.create({
      data: {
        seasonId: season.id,
        title: "Match Day Gallery",
        imageUrl: `${url}?w=800`,
        isActive: true,
      },
    });
  }

  // Venue Gallery
  for (const url of galleryImages) {
    await prisma.venueGallery.create({
      data: {
        venueId: venue.id,
        imageUrl: `${url}?w=800`,
        caption: "Premium Turf Facility",
      },
    });
  }
  console.log("  ✅ Gallery created");

  console.log("\n🎉 Database seeded successfully!");
  console.log("  Admin: admin@fusionturf.com / password123");
  console.log("  User:  user@example.com / password123");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

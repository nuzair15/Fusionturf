import { config } from "../config/index.js";
import prisma from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { aggregatePlayerTotals } from "../utils/player-totals.js";

const publicTeam = { id: true, name: true, slug: true, shortName: true, logoUrl: true, coverUrl: true } as const;
const publicPlayer = { id: true, firstName: true, lastName: true, slug: true, position: true, jerseyNumber: true, photoUrl: true, isActive: true } as const;
const stats = { id: true, seasonId: true, playerId: true, teamId: true, appearances: true, goals: true, assists: true, minutesPlayed: true, shots: true, shotsOnTarget: true, yellowCards: true, redCards: true, averageRating: true, player: { select: publicPlayer }, team: { select: publicTeam } } as const;

export async function getSeasonOverview(slug: string) {
  const season = await prisma.season.findFirst({ where: { slug, deletedAt: null, lifecycle: { not: "DRAFT" } }, select: { id: true, slug: true, name: true, startDate: true, endDate: true, lifecycle: true, isCurrent: true, description: true, updatedAt: true } });
  if (!season) throw new AppError("Published season not found", 404);
  const seasonId = season.id;
  const [teams, standings, fixtures, playerStats, friendlyStats, awards, competitions] = await Promise.all([
    prisma.team.findMany({ where: { seasonId, deletedAt: null }, select: { ...publicTeam, isActive: true, players: { where: { deletedAt: null }, select: publicPlayer, orderBy: { jerseyNumber: "asc" } }, staff: { where: { deletedAt: null }, select: { firstName: true, lastName: true, role: true } } }, orderBy: { name: "asc" } }),
    prisma.standing.findMany({ where: { seasonId, team: { deletedAt: null } }, select: { teamId: true, position: true, played: true, wins: true, draws: true, losses: true, goalsFor: true, goalsAgainst: true, goalDifference: true, points: true, form: true, team: { select: publicTeam } }, orderBy: { position: "asc" } }),
    prisma.fixture.findMany({ where: { seasonId, deletedAt: null }, orderBy: [{ matchDate: "asc" }, { id: "asc" }], select: {
      id: true, matchDate: true, scheduledDate: true, kickoffTime: true, status: true, homeScore: true, awayScore: true, isFriendly: true, round: true,
      homeTeam: { select: publicTeam }, awayTeam: { select: publicTeam }, competition: { select: { id: true, name: true, type: true } },
      manOfTheMatch: { select: publicPlayer },
      goals: { select: { minute: true, playerId: true, teamId: true, isOwnGoal: true, isPenalty: true, player: { select: publicPlayer } }, orderBy: { minute: "asc" } },
      assists: { select: { minute: true, playerId: true, teamId: true, player: { select: publicPlayer } }, orderBy: { minute: "asc" } },
      cards: { select: { minute: true, playerId: true, teamId: true, type: true, player: { select: publicPlayer } }, orderBy: { minute: "asc" } },
    } }),
    prisma.playerStat.findMany({ where: { seasonId, player: { deletedAt: null }, team: { deletedAt: null } }, select: { ...stats, saves: true, cleanSheets: true, goalsConceded: true } }),
    prisma.friendlyPlayerStat.findMany({ where: { seasonId, player: { deletedAt: null }, team: { deletedAt: null } }, select: stats }),
    prisma.award.findMany({ where: { seasonId, deletedAt: null, isActive: true }, select: { id: true, name: true, description: true, winnerAnnounced: true, winner: { select: publicPlayer }, winnerTeam: { select: publicTeam } }, orderBy: { name: "asc" } }),
    prisma.competition.findMany({ where: { seasonId, deletedAt: null }, select: { id: true, name: true, type: true, bracketStatus: true } }),
  ]);
  const completed = fixtures.filter(f => f.status === "COMPLETED");
  const ranked = aggregatePlayerTotals(playerStats).sort((a,b) => b.goals - a.goals || b.assists - a.assists);
  return { schemaVersion: "1.0", generatedAt: new Date().toISOString(), season,
    links: { website: `${config.frontendUrl.replace(/\/$/, "")}/league/seasons/${encodeURIComponent(slug)}`, html: `/api/league/seasons/${encodeURIComponent(slug)}/overview.html`, json: `/api/league/seasons/${encodeURIComponent(slug)}/overview` },
    summary: { teams: teams.length, players: teams.reduce((n,t) => n + t.players.length, 0), fixtures: fixtures.length, completed: completed.length, goals: completed.reduce((n,f) => n + (f.homeScore || 0) + (f.awayScore || 0), 0) },
    competitions, teams, standings, fixtures, playerStats: ranked, playerTeamStats: playerStats, friendlyStats: aggregatePlayerTotals(friendlyStats),
    awards: awards.map(a => ({ ...a, winner: a.winnerAnnounced ? a.winner : null, winnerTeam: a.winnerAnnounced ? a.winnerTeam : null })),
  };
}
export type SeasonOverview = Awaited<ReturnType<typeof getSeasonOverview>>;

export function escapeHtml(value: unknown): string { return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }
const e = escapeHtml;
const name = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`.trim();
const table = (head: string[], rows: unknown[][]) => `<table><thead><tr>${head.map(c => `<th>${e(c)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${e(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

export function seasonOverviewHtml(data: SeasonOverview) {
  const metadata = { "@context": "https://schema.org", "@type": "Dataset", name: `${data.season.name} football season`, description: "Public standings, results, squads, player statistics and announced awards.", dateModified: data.generatedAt, distribution: { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: data.links.json } };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(data.season.name)} — Fusion League season overview</title><meta name="description" content="${e(data.season.name)} standings, results, squads, player statistics and awards"><link rel="alternate" type="application/json" href="${e(data.links.json)}"><script type="application/ld+json">${JSON.stringify(metadata).replace(/</g,"\\u003c")}</script><style>body{font:16px system-ui;max-width:1100px;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#152136}a{color:#174faa}table{border-collapse:collapse;width:100%;margin:1rem 0;display:block;overflow:auto}th,td{border-bottom:1px solid #cbd5e1;padding:.5rem;text-align:left}details{border:1px solid #cbd5e1;padding:.8rem;margin:.5rem 0}small{color:#475569}</style></head><body><nav><a href="/api/league/seasons/index.html">All seasons</a> · <a href="${e(data.links.website)}">Interactive overview</a> · <a href="${e(data.links.json)}">Structured JSON</a></nav><main><h1>${e(data.season.name)}</h1><p>${e(data.season.startDate.toISOString().slice(0,10))} to ${e(data.season.endDate.toISOString().slice(0,10))} · ${e(data.season.lifecycle)}${data.season.isCurrent ? " · Current season" : ""}</p><p>${data.summary.teams} teams · ${data.summary.players} players · ${data.summary.completed}/${data.summary.fixtures} matches completed · ${data.summary.goals} goals</p><h2>Standings</h2>${table(["Position","Team","Played","Won","Drawn","Lost","GF","GA","GD","Points"],data.standings.map(s => [s.position,s.team.name,s.played,s.wins,s.draws,s.losses,s.goalsFor,s.goalsAgainst,s.goalDifference,s.points]))}<h2>Player statistics</h2>${table(["Player","Team(s)","Apps","Goals","Assists","Minutes","Yellow","Red"],data.playerStats.map(s => [name(s.player),s.team?.name,s.appearances,s.goals,s.assists,s.minutesPlayed,s.yellowCards,s.redCards]))}<h2>Friendly statistics</h2>${table(["Player","Team(s)","Apps","Goals","Assists"],data.friendlyStats.map(s => [name(s.player),s.team?.name,s.appearances,s.goals,s.assists]))}<h2>Fixtures and results</h2>${data.fixtures.map(f => `<details><summary>${e((f.scheduledDate || f.matchDate.toISOString().slice(0,10)))} ${e(f.kickoffTime)} · ${e(f.homeTeam.name)} ${e(f.homeScore ?? "–")}–${e(f.awayScore ?? "–")} ${e(f.awayTeam.name)} · ${e(f.status)}</summary><p>${e(f.competition?.name || (f.isFriendly ? "Friendly" : "League"))} · <a href="${e(config.frontendUrl.replace(/\/$/, ""))}/league/fixtures/${encodeURIComponent(f.id)}">Match page</a></p>${table(["Minute","Event","Player"],[...f.goals.map(g => [g.minute,g.isOwnGoal ? "Own goal" : g.isPenalty ? "Penalty goal" : "Goal",name(g.player)]),...f.assists.map(a => [a.minute,"Assist",name(a.player)]),...f.cards.map(c => [c.minute,c.type,name(c.player)])])}${f.manOfTheMatch ? `<p>Player of the match: ${e(name(f.manOfTheMatch))}</p>` : ""}</details>`).join("")}<h2>Teams and squads</h2>${data.teams.map(t => `<h3><a href="${e(config.frontendUrl.replace(/\/$/, ""))}/league/teams/${encodeURIComponent(t.slug)}">${e(t.name)}</a></h3>${table(["Player","Position","Jersey","Status"],t.players.map(p => [name(p),p.position,p.jerseyNumber,p.isActive ? "Active" : "Inactive"]))}<p>Staff: ${e(t.staff.map(s => `${name(s)} (${s.role})`).join(", ") || "None listed")}</p>`).join("")}<h2>Awards</h2>${table(["Award","Winner"],data.awards.map(a => [a.name,a.winner ? name(a.winner) : a.winnerTeam?.name || "Not announced"]))}</main><footer><small>Generated ${e(data.generatedAt)}. This public view contains no admin notes, account details or player inactivity reasons. Career totals and each season's statistics are separate.</small></footer></body></html>`;
}

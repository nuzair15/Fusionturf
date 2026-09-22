import type { Plugin } from "vite";

export function publicDiscovery(apiBase: string): Plugin {
  const base = apiBase.replace(/\/$/, "");
  const index = `${base}/league/seasons/index.html`;
  const text = `# Fusion League public data

> Football season history, standings, results, squads, player statistics and announced awards.

- [All published seasons, readable without JavaScript](${index})
- [Season list as JSON](${base}/league/seasons)

Each season in the index links to an HTML overview and a JSON overview. JSON uses schemaVersion 1.0 and contains generatedAt, season, summary, competitions, teams, standings, fixtures, playerStats, playerTeamStats, friendlyStats and awards.

Use each season's slug from the season list:
- HTML: ${base}/league/seasons/{slug}/overview.html
- JSON: ${base}/league/seasons/{slug}/overview

Only published seasons are available. Draft seasons, accounts, admin notes, payment records, and reasons for player inactivity are not exported. Season statistics are not career totals. Friendly statistics are separate from league statistics. A blank winner means the award has not been announced.
`;
  return {
    name: "public-league-discovery",
    generateBundle() { this.emitFile({ type: "asset", fileName: "llms.txt", source: text }); },
    configureServer(server) { server.middlewares.use("/llms.txt", (_req,res) => { res.setHeader("Content-Type","text/plain; charset=utf-8"); res.end(text); }); },
    transformIndexHtml(html) {
      const safe = index.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");
      return html.replace('<div id="root"></div>', `<div id="root"><p>Fusion Turf · <a href="${safe}">Read league seasons, results, standings and player statistics</a></p></div>`);
    },
  };
}

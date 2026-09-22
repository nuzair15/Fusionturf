import { describe, expect, it } from "vitest";
import { escapeHtml } from "./season-overview.js";
import { redactPublicMetadata, hideDraftSeasons, publicSeasonScope } from "../utils/public-season-scope.js";
import { aggregatePlayerTotals } from "../utils/player-totals.js";

describe("public season data", () => {
  it("preserves compound match filters when adding draft visibility restrictions", async () => {
    const clauses = [{ status: "COMPLETED" }, { isFriendly: true }];
    const result: any = await new Promise((resolve, reject) => publicSeasonScope({} as any, {} as any, () => {
      hideDraftSeasons({ model: "Fixture", action: "findMany", args: { where: { AND: clauses } }, dataPath: [], runInTransaction: false }, async params => params.args.where).then(resolve, reject);
    }));
    expect(result.AND).toEqual([...clauses, { season: { lifecycle: { not: "DRAFT" }, deletedAt: null } }]);
  });
  it("escapes editable names before publishing HTML", () => {
    expect(escapeHtml('<script>alert("x")</script> &')).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp;");
  });
  it("redacts activity reasons and rollover reports in nested public records", () => {
    const date = new Date();
    expect(redactPublicMetadata({ players: [{ firstName: "Alex", activityReason: "Medical detail", activityChangedAt: date }], rolloverReport: { createdById: "admin" }, startDate: date })).toEqual({ players: [{ firstName: "Alex" }], startDate: date });
  });
  it("ranks a transferred player once and keeps totals from both teams", () => {
    const rows = aggregatePlayerTotals([{ seasonId: "s", playerId: "p", goals: 3, appearances: 2, team: { id: "a", name: "A" } }, { seasonId: "s", playerId: "p", goals: 2, appearances: 1, team: { id: "b", name: "B" } }]);
    expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ goals: 5, appearances: 3, team: { name: "A / B" } });
  });
});

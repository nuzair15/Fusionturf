// Barrel re-export: keeps `import * as admin from "../controllers/admin.js"`
// working unchanged for routes/admin.ts, while the implementation lives in
// controllers/admin/<domain>.ts — one file per admin sub-area instead of a
// single 2,300+ line file.

export * from "./admin/auth.js";
export * from "./admin/seasons.js";
export * from "./admin/teams.js";
export * from "./admin/players.js";
export * from "./admin/competitions.js";
export * from "./admin/fixtures.js";
export * from "./admin/standings.js";
export * from "./admin/awards.js";
export * from "./admin/content.js";
export * from "./admin/commerce.js";
export * from "./admin/users.js";
export * from "./admin/suspensions.js";
export * from "./admin/live-match.js";
export * from "./admin/reviews.js";

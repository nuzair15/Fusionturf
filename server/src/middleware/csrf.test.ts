import { describe, expect, it, vi } from "vitest";
import { csrfProtection } from "./csrf.js";

function run(input: { method?: string; path?: string; cookie?: string; csrf?: string; authorization?: string }) {
  const req: any = {
    method: input.method || "POST",
    path: input.path || "/api/admin/settings",
    headers: { cookie: input.cookie, authorization: input.authorization },
    get: (name: string) => name.toLowerCase() === "x-xsrf-token" ? input.csrf : undefined,
  };
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  csrfProtection(req, res, next);
  return { res, next };
}

describe("csrfProtection", () => {
  it("rejects a cookie-authenticated mutation without the double-submit token", () => {
    const { res, next } = run({ cookie: "fusion_access=access; XSRF-TOKEN=secret" });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("accepts a matching double-submit token", () => {
    const { next } = run({ cookie: "fusion_access=access; XSRF-TOKEN=secret", csrf: "secret" });
    expect(next).toHaveBeenCalledOnce();
  });

  it("does not impose cookie CSRF checks on bearer or unauthenticated requests", () => {
    expect(run({ authorization: "Bearer token" }).next).toHaveBeenCalledOnce();
    expect(run({}).next).toHaveBeenCalledOnce();
  });
});

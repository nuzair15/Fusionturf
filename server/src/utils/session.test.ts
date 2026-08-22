import { describe, expect, it } from "vitest";
import { hashSessionToken, readCookie } from "./session.js";

describe("session utilities", () => {
  it("reads encoded cookie values without confusing similarly named cookies", () => {
    const req = { headers: { cookie: "fusion_access_extra=no; fusion_access=a%3Db%2Bc" } } as any;
    expect(readCookie(req, "fusion_access")).toBe("a=b+c");
  });

  it("stores only deterministic one-way refresh-token hashes", () => {
    expect(hashSessionToken("refresh-secret")).toHaveLength(64);
    expect(hashSessionToken("refresh-secret")).toBe(hashSessionToken("refresh-secret"));
    expect(hashSessionToken("refresh-secret")).not.toContain("refresh-secret");
  });
});

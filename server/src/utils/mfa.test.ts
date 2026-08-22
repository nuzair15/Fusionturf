import { describe, expect, it } from "vitest";
import { decryptMfaSecret, encryptMfaSecret, totp, verifyTotp } from "./mfa.js";

describe("privileged MFA", () => {
  it("matches the RFC 6238 SHA-1 test vector reduced to six digits", () => {
    expect(totp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59_000)).toBe("287082");
  });

  it("accepts only the small clock-drift window", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    const token = totp(secret, 90_000);
    expect(verifyTotp(secret, token, 90_000)).toBe(true);
    expect(verifyTotp(secret, token, 180_000)).toBe(false);
  });

  it("encrypts authenticator secrets at rest with authenticated encryption", () => {
    const encrypted = encryptMfaSecret("TOPSECRET");
    expect(encrypted).not.toContain("TOPSECRET");
    expect(decryptMfaSecret(encrypted)).toBe("TOPSECRET");
  });
});

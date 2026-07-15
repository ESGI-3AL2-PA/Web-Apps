import { afterEach, describe, expect, it, vi } from "vitest";
import { getJwtExpiry, isTokenExpiringSoon } from "./jwtExpiry";

/** Builds an unsigned JWT-shaped string whose payload carries the given claims. */
const makeToken = (payload: Record<string, unknown>): string => {
  const b64 = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_");
  return `${b64({ alg: "none" })}.${b64(payload)}.sig`;
};

describe("getJwtExpiry", () => {
  it("extracts the numeric exp claim", () => {
    expect(getJwtExpiry(makeToken({ exp: 1_700_000_000 }))).toBe(1_700_000_000);
  });

  it("returns null when exp is missing", () => {
    expect(getJwtExpiry(makeToken({ sub: "user-1" }))).toBeNull();
  });

  it("returns null when exp is not a number", () => {
    expect(getJwtExpiry(makeToken({ exp: "soon" }))).toBeNull();
  });

  it("returns null for a token without three segments", () => {
    expect(getJwtExpiry("not.a.jwt.token")).toBeNull();
    expect(getJwtExpiry("header.payload")).toBeNull();
  });

  it("returns null when the payload is not valid base64 JSON", () => {
    expect(getJwtExpiry("header.@@@.sig")).toBeNull();
  });
});

describe("isTokenExpiringSoon", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is false for a token comfortably in the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const exp = Math.floor(Date.now() / 1000) + 3600;
    expect(isTokenExpiringSoon(makeToken({ exp }))).toBe(false);
  });

  it("is true once the token is within the threshold window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const exp = Math.floor(Date.now() / 1000) + 30;
    expect(isTokenExpiringSoon(makeToken({ exp }))).toBe(true);
  });

  it("honours a custom threshold", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const exp = Math.floor(Date.now() / 1000) + 120;
    expect(isTokenExpiringSoon(makeToken({ exp }), 60)).toBe(false);
    expect(isTokenExpiringSoon(makeToken({ exp }), 300)).toBe(true);
  });

  it("treats a malformed / exp-less token as expiring (fail-safe)", () => {
    expect(isTokenExpiringSoon("garbage")).toBe(true);
    expect(isTokenExpiringSoon(makeToken({ sub: "user-1" }))).toBe(true);
  });
});

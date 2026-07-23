// Suite de tests des helpers d'expiration JWT (jwtExpiry.ts).
// Vérifie l'extraction du claim `exp` et la décision « expire bientôt », y compris les
// entrées malformées et le comportement fail-safe. Les horloges sont figées via les
// faux timers de Vitest pour rendre les seuils temporels déterministes.
import { afterEach, describe, expect, it, vi } from "vitest";
import { getJwtExpiry, isTokenExpiringSoon } from "./jwtExpiry";

/** Fabrique une chaîne au format JWT (non signée) dont le payload porte les claims donnés. */
const makeToken = (payload: Record<string, unknown>): string => {
  // Encodage base64url attendu par le décodeur (base64 standard puis + → -, / → _).
  const b64 = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_");
  return `${b64({ alg: "none" })}.${b64(payload)}.sig`;
};

describe("getJwtExpiry", () => {
  // Cas nominal : un `exp` numérique est retourné tel quel.
  it("extracts the numeric exp claim", () => {
    expect(getJwtExpiry(makeToken({ exp: 1_700_000_000 }))).toBe(1_700_000_000);
  });

  // Claim absent → null.
  it("returns null when exp is missing", () => {
    expect(getJwtExpiry(makeToken({ sub: "user-1" }))).toBeNull();
  });

  // `exp` présent mais du mauvais type (ici une chaîne) → null.
  it("returns null when exp is not a number", () => {
    expect(getJwtExpiry(makeToken({ exp: "soon" }))).toBeNull();
  });

  // Nombre de sections ≠ 3 (trop ou pas assez) → null.
  it("returns null for a token without three segments", () => {
    expect(getJwtExpiry("not.a.jwt.token")).toBeNull();
    expect(getJwtExpiry("header.payload")).toBeNull();
  });

  // Payload non décodable en base64/JSON → null (attrapé par le try/catch).
  it("returns null when the payload is not valid base64 JSON", () => {
    expect(getJwtExpiry("header.@@@.sig")).toBeNull();
  });
});

describe("isTokenExpiringSoon", () => {
  // Restaure l'horloge réelle après chaque test qui a posé de faux timers.
  afterEach(() => {
    vi.useRealTimers();
  });

  // Expiration largement au-delà du seuil → n'expire pas bientôt (false).
  it("is false for a token comfortably in the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const exp = Math.floor(Date.now() / 1000) + 3600;
    expect(isTokenExpiringSoon(makeToken({ exp }))).toBe(false);
  });

  // Expiration à 30 s, sous le seuil par défaut de 60 s → expire bientôt (true).
  it("is true once the token is within the threshold window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const exp = Math.floor(Date.now() / 1000) + 30;
    expect(isTokenExpiringSoon(makeToken({ exp }))).toBe(true);
  });

  // Le seuil est paramétrable : même token (exp à 120 s), false à 60 s mais true à 300 s.
  it("honours a custom threshold", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const exp = Math.floor(Date.now() / 1000) + 120;
    expect(isTokenExpiringSoon(makeToken({ exp }), 60)).toBe(false);
    expect(isTokenExpiringSoon(makeToken({ exp }), 300)).toBe(true);
  });

  // Fail-safe : token illisible ou sans `exp` est considéré comme expirant (true).
  it("treats a malformed / exp-less token as expiring (fail-safe)", () => {
    expect(isTokenExpiringSoon("garbage")).toBe(true);
    expect(isTokenExpiringSoon(makeToken({ sub: "user-1" }))).toBe(true);
  });
});

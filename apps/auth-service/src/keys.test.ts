import { calculateJwkThumbprint, exportJWK, generateKeyPair, exportPKCS8, exportSPKI, importSPKI } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildJwks, getJWKS, getKeyId, initKeys } from "./keys.js";
import { logger } from "./logger.js";

const thumbprintOf = async (spki: string) =>
  calculateJwkThumbprint(await exportJWK(await importSPKI(spki, "RS256")), "sha256");

const ENV_KEYS = [
  "AUTH_KEY_ID",
  "AUTH_KEY_ID_PREVIOUS",
  "AUTH_PRIVATE_KEY",
  "AUTH_PUBLIC_KEY",
  "AUTH_PUBLIC_KEY_PREVIOUS",
  "NODE_ENV",
] as const;

const genPem = async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
  return { priv: await exportPKCS8(privateKey), pub: await exportSPKI(publicKey) };
};

describe("buildJwks", () => {
  it("stamps kid + RS256/sig metadata onto each entry", () => {
    const jwks = buildJwks([
      { jwk: { kty: "RSA", n: "a", e: "AQAB" }, kid: "k1" },
      { jwk: { kty: "RSA", n: "b", e: "AQAB" }, kid: "k2" },
    ]);
    expect(jwks.keys).toHaveLength(2);
    expect(jwks.keys.map((k) => k.kid)).toEqual(["k1", "k2"]);
    expect(jwks.keys.every((k) => k.alg === "RS256" && k.use === "sig")).toBe(true);
  });
});

describe("initKeys", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    for (const k of ENV_KEYS) delete process.env[k];
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("defaults the kid to the key's JWK thumbprint and publishes exactly that key", async () => {
    const active = await genPem();
    process.env.AUTH_PRIVATE_KEY = active.priv;
    process.env.AUTH_PUBLIC_KEY = active.pub;

    await initKeys();

    expect(getKeyId()).toBe(await thumbprintOf(active.pub));
    expect(getJWKS().keys).toHaveLength(1);
    expect(getJWKS().keys[0]!.kid).toBe(getKeyId());
  });

  // The regression that matters: this is what makes "swapped the PEM, forgot to bump
  // the kid" impossible, which would otherwise 401 every consumer that cached by kid.
  it("gives two distinct keypairs two distinct default kids", async () => {
    const a = await genPem();
    process.env.AUTH_PRIVATE_KEY = a.priv;
    process.env.AUTH_PUBLIC_KEY = a.pub;
    await initKeys();
    const kidA = getKeyId();

    const b = await genPem();
    process.env.AUTH_PRIVATE_KEY = b.priv;
    process.env.AUTH_PUBLIC_KEY = b.pub;
    await initKeys();

    expect(getKeyId()).not.toBe(kidA);
  });

  it("keeps the same kid across restarts for the same key material", async () => {
    const active = await genPem();
    process.env.AUTH_PRIVATE_KEY = active.priv;
    process.env.AUTH_PUBLIC_KEY = active.pub;

    await initKeys();
    const first = getKeyId();
    await initKeys();

    expect(getKeyId()).toBe(first);
  });

  // Pinning is the escape hatch for a zero-disruption migration, so a mismatch warns
  // rather than refusing to boot — a boot loop is the outage class this change prevents.
  it("warns but does not throw when a pinned kid is not the key's thumbprint", async () => {
    const active = await genPem();
    process.env.AUTH_PRIVATE_KEY = active.priv;
    process.env.AUTH_PUBLIC_KEY = active.pub;
    process.env.AUTH_KEY_ID = "auth-1";
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => logger);

    await expect(initKeys()).resolves.toBeUndefined();

    expect(getKeyId()).toBe("auth-1");
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ pinned: "auth-1", thumbprint: await thumbprintOf(active.pub) }),
      expect.stringContaining("same kid"),
    );
    warn.mockRestore();
  });

  // The migration alias: one key published under both its thumbprint and the legacy
  // static kid, so tokens minted before the switch still verify while they drain.
  it("publishes one key under two kids when aliased to the legacy kid", async () => {
    const active = await genPem();
    process.env.AUTH_PRIVATE_KEY = active.priv;
    process.env.AUTH_PUBLIC_KEY = active.pub;
    process.env.AUTH_PUBLIC_KEY_PREVIOUS = active.pub;
    process.env.AUTH_KEY_ID_PREVIOUS = "auth-1";

    await initKeys();

    const keys = getJWKS().keys;
    expect(keys).toHaveLength(2);
    expect(keys[0]!.n).toBe(keys[1]!.n);
    expect(keys.map((k) => k.kid)).toEqual([await thumbprintOf(active.pub), "auth-1"]);
  });

  it("uses the configured AUTH_KEY_ID", async () => {
    process.env.AUTH_KEY_ID = "custom-42";
    await initKeys();
    expect(getKeyId()).toBe("custom-42");
    expect(getJWKS().keys[0]!.kid).toBe("custom-42");
  });

  it("publishes a previous verify-only key alongside the primary during rotation", async () => {
    const active = await genPem();
    const previous = await genPem();
    process.env.AUTH_PRIVATE_KEY = active.priv;
    process.env.AUTH_PUBLIC_KEY = active.pub;
    process.env.AUTH_KEY_ID = "auth-2";
    process.env.AUTH_PUBLIC_KEY_PREVIOUS = previous.pub;
    process.env.AUTH_KEY_ID_PREVIOUS = "auth-1";

    await initKeys();

    const kids = getJWKS().keys.map((k) => k.kid);
    expect(kids).toEqual(["auth-2", "auth-1"]);
    expect(getKeyId()).toBe("auth-2");
  });

  it("rejects a previous kid equal to the active kid", async () => {
    const active = await genPem();
    process.env.AUTH_PRIVATE_KEY = active.priv;
    process.env.AUTH_PUBLIC_KEY = active.pub;
    process.env.AUTH_KEY_ID = "auth-1";
    process.env.AUTH_PUBLIC_KEY_PREVIOUS = (await genPem()).pub;
    process.env.AUTH_KEY_ID_PREVIOUS = "auth-1";

    await expect(initKeys()).rejects.toThrow(/must differ/);
  });
});

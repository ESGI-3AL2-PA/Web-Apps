// Suite de tests de `withRetry` : vérifie le succès immédiat, la réussite après
// plusieurs rejets, et la propagation de la dernière erreur une fois les tentatives
// épuisées.
import { describe, it, expect, vi } from "vitest";
import { withRetry } from "./retry.js";

// Garde la suite rapide : aucune vraie attente de backoff.
const noWait = { minDelayMs: 0, maxDelayMs: 0 };

describe("withRetry", () => {
  // Succès dès le premier appel : la valeur est renvoyée sans réessayer.
  it("returns the result on first success without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn, noWait)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  // Réessaie jusqu'à ce que l'appel réussisse (ici après deux rejets).
  it("retries until the call succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue("ok");
    await expect(withRetry(fn, { ...noWait, retries: 5 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  // Après épuisement de toutes les tentatives, la dernière erreur est propagée.
  it("rethrows the last error after exhausting all attempts", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("still down"));
    await expect(withRetry(fn, { ...noWait, retries: 3 })).rejects.toThrow("still down");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

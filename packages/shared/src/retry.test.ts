import { describe, it, expect, vi } from "vitest";
import { withRetry } from "./retry.js";

// Keep the suite fast: no real backoff waits.
const noWait = { minDelayMs: 0, maxDelayMs: 0 };

describe("withRetry", () => {
  it("returns the result on first success without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn, noWait)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries until the call succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue("ok");
    await expect(withRetry(fn, { ...noWait, retries: 5 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("rethrows the last error after exhausting all attempts", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("still down"));
    await expect(withRetry(fn, { ...noWait, retries: 3 })).rejects.toThrow("still down");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

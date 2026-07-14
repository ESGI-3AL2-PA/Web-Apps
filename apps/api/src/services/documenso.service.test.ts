import { describe, expect, it } from "vitest";
import {
  assertAllowedDownloadUrl,
  documensoWebhookEventSchema,
  documensoWebhookReplayKey,
  WebhookReplayCache,
} from "./documenso.service.js";

describe("assertAllowedDownloadUrl (SSRF guard)", () => {
  const allowed = ["minio:9000", "documenso:3030"];

  it("accepts an http(s) URL on an allowlisted host and returns the parsed URL", () => {
    const url = assertAllowedDownloadUrl("http://minio:9000/documenso/signed.pdf?X-Amz-Signature=abc", allowed);
    expect(url.host).toBe("minio:9000");
  });

  it("rejects a host that is not on the allowlist (SSRF to internal address)", () => {
    expect(() => assertAllowedDownloadUrl("http://169.254.169.254/latest/meta-data", allowed)).toThrow(
      /non-allowlisted host/,
    );
  });

  it("rejects an allowlisted host reached over a non-http(s) scheme", () => {
    expect(() => assertAllowedDownloadUrl("file:///etc/passwd", allowed)).toThrow(/unsupported scheme/);
  });

  it("rejects a malformed URL", () => {
    expect(() => assertAllowedDownloadUrl("not a url", allowed)).toThrow(/malformed/);
  });
});

describe("documensoWebhookEventSchema", () => {
  it("accepts a well-formed event and keeps extra document fields", () => {
    const parsed = documensoWebhookEventSchema.safeParse({
      event: "DOCUMENT_COMPLETED",
      payload: { id: 42, status: "COMPLETED", title: "Contract" },
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.payload?.id).toBe(42);
  });

  it("rejects a body missing the event field", () => {
    expect(documensoWebhookEventSchema.safeParse({ payload: { id: 1 } }).success).toBe(false);
  });

  it("rejects a payload whose id is not a number", () => {
    expect(documensoWebhookEventSchema.safeParse({ event: "DOCUMENT_COMPLETED", payload: { id: "42" } }).success).toBe(
      false,
    );
  });
});

describe("WebhookReplayCache", () => {
  const key = documensoWebhookReplayKey({ event: "DOCUMENT_COMPLETED", payload: { id: 7, status: "COMPLETED" } });

  it("does not flag an unseen key, then flags it once remembered", () => {
    const cache = new WebhookReplayCache();
    expect(cache.has(key)).toBe(false);
    cache.remember(key);
    expect(cache.has(key)).toBe(true);
  });

  it("evicts an entry once its TTL has elapsed", () => {
    const cache = new WebhookReplayCache(-1); // already-expired TTL
    cache.remember(key);
    expect(cache.has(key)).toBe(false);
  });

  it("derives distinct keys for different documents / statuses", () => {
    const a = documensoWebhookReplayKey({ event: "DOCUMENT_COMPLETED", payload: { id: 1, status: "COMPLETED" } });
    const b = documensoWebhookReplayKey({ event: "DOCUMENT_COMPLETED", payload: { id: 2, status: "COMPLETED" } });
    expect(a).not.toBe(b);
  });
});

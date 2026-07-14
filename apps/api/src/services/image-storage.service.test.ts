import { describe, expect, it } from "vitest";
import { decodeImageBase64 } from "./image-storage.service.js";

const toDataUrl = (mime: string, bytes: Buffer): string => `data:${mime};base64,${bytes.toString("base64")}`;

describe("decodeImageBase64", () => {
  it("decodes a valid PNG data-URL to bytes + png ext + content type", () => {
    const raw = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = decodeImageBase64(toDataUrl("image/png", raw));

    expect(result).not.toBeNull();
    expect(result?.ext).toBe("png");
    expect(result?.contentType).toBe("image/png");
    expect(result?.bytes.equals(raw)).toBe(true);
  });

  it("maps image/jpeg to the jpg extension", () => {
    const raw = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const result = decodeImageBase64(toDataUrl("image/jpeg", raw));

    expect(result?.ext).toBe("jpg");
    expect(result?.contentType).toBe("image/jpeg");
  });

  it("rejects a non-image mime (data:text/html) as null", () => {
    const result = decodeImageBase64(toDataUrl("text/html", Buffer.from("<script>alert(1)</script>")));
    expect(result).toBeNull();
  });

  it("rejects an image mime with no ext mapping (svg+xml) as null", () => {
    const result = decodeImageBase64(toDataUrl("image/svg+xml", Buffer.from("<svg/>")));
    expect(result).toBeNull();
  });

  it("rejects a prefix-less raw base64 string as null", () => {
    const raw = Buffer.from([0x01, 0x02, 0x03]).toString("base64");
    expect(decodeImageBase64(raw)).toBeNull();
  });

  it("rejects an empty payload as null", () => {
    expect(decodeImageBase64("data:image/png;base64,")).toBeNull();
  });
});

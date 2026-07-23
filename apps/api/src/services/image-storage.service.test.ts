// Suite de tests (couche services) de decodeImageBase64 : vérifie qu'une data-URL image
// valide est décodée (octets + extension + content-type) et que tout ce qui n'est pas une
// image (mauvais mime, pas de préfixe, payload vide) est rejeté par un null.
import { describe, expect, it } from "vitest";
import { decodeImageBase64 } from "./image-storage.service.js";

// Fabrique une data-URL base64 à partir d'un mime et d'octets bruts, pour les cas de test.
const toDataUrl = (mime: string, bytes: Buffer): string => `data:${mime};base64,${bytes.toString("base64")}`;

describe("decodeImageBase64", () => {
  // Une data-URL PNG valide → octets décodés, extension "png", content-type "image/png".
  it("decodes a valid PNG data-URL to bytes + png ext + content type", () => {
    const raw = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = decodeImageBase64(toDataUrl("image/png", raw));

    expect(result).not.toBeNull();
    expect(result?.ext).toBe("png");
    expect(result?.contentType).toBe("image/png");
    expect(result?.bytes.equals(raw)).toBe(true);
  });

  // image/jpeg est mappé sur l'extension jpg.
  it("maps image/jpeg to the jpg extension", () => {
    const raw = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const result = decodeImageBase64(toDataUrl("image/jpeg", raw));

    expect(result?.ext).toBe("jpg");
    expect(result?.contentType).toBe("image/jpeg");
  });

  // Un mime non-image (data:text/html) est rejeté (null) — évite de stocker du HTML/JS.
  it("rejects a non-image mime (data:text/html) as null", () => {
    const result = decodeImageBase64(toDataUrl("text/html", Buffer.from("<script>alert(1)</script>")));
    expect(result).toBeNull();
  });

  // Un mime image sans mapping d'extension (svg+xml, vecteur d'attaque) est rejeté (null).
  it("rejects an image mime with no ext mapping (svg+xml) as null", () => {
    const result = decodeImageBase64(toDataUrl("image/svg+xml", Buffer.from("<svg/>")));
    expect(result).toBeNull();
  });

  // Un base64 brut sans préfixe data-URL est rejeté (null).
  it("rejects a prefix-less raw base64 string as null", () => {
    const raw = Buffer.from([0x01, 0x02, 0x03]).toString("base64");
    expect(decodeImageBase64(raw)).toBeNull();
  });

  // Un payload vide (préfixe présent mais aucun octet) est rejeté (null).
  it("rejects an empty payload as null", () => {
    expect(decodeImageBase64("data:image/png;base64,")).toBeNull();
  });
});

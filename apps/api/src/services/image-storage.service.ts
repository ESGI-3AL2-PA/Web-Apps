import type { Readable } from "stream";
import * as Minio from "minio";

// Listing images are stored in self-hosted MinIO (same instance as voice messages,
// see media-storage.service.ts). Config falls back to the MESSAGES_MINIO_* vars so
// a single MinIO deployment serves both; override with LISTINGS_MINIO_* if needed.
const BUCKET = process.env.LISTINGS_MINIO_BUCKET ?? "listings";

const endpointUrl = new URL(
  process.env.LISTINGS_MINIO_ENDPOINT ?? process.env.MESSAGES_MINIO_ENDPOINT ?? "http://localhost:9000",
);
const useSSL = endpointUrl.protocol === "https:";

const minio = new Minio.Client({
  endPoint: endpointUrl.hostname,
  port: Number(endpointUrl.port) || (useSSL ? 443 : 80),
  useSSL,
  accessKey: process.env.LISTINGS_MINIO_ACCESS_KEY ?? process.env.MESSAGES_MINIO_ACCESS_KEY ?? "",
  secretKey: process.env.LISTINGS_MINIO_SECRET_KEY ?? process.env.MESSAGES_MINIO_SECRET_KEY ?? "",
});

// data-URL mime → file extension. The extension is baked into the object key so the
// GET handler can serve the right Content-Type without a metadata round-trip.
const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export const contentTypeForKey = (key: string): string => {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[ext] ?? "application/octet-stream";
};

// Auto-create the bucket on first use so we don't depend on compose-time provisioning.
let ensured = false;
const ensureBucket = async (): Promise<void> => {
  if (ensured) return;
  const exists = await minio.bucketExists(BUCKET).catch(() => false);
  if (!exists) {
    await minio.makeBucket(BUCKET);
  }
  ensured = true;
};

type DecodedImage = { bytes: Buffer; ext: string; contentType: string };

// Parse a `data:image/xxx;base64,....` URL (or raw base64 defaulting to png) into
// bytes + extension. Returns null for unsupported / malformed input.
export const decodeImageBase64 = (input: string): DecodedImage | null => {
  const match = input.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.*)$/s);
  const mime = (match?.[1] ?? "image/png").toLowerCase();
  const payload = match?.[2] ?? input;
  const ext = MIME_TO_EXT[mime];
  if (!ext) return null;
  const bytes = Buffer.from(payload, "base64");
  if (bytes.length === 0) return null;
  return { bytes, ext, contentType: EXT_TO_MIME[ext]! };
};

// Persist an image and return its object key (`<id>.<ext>`).
export const saveImage = async (id: string, image: DecodedImage): Promise<string> => {
  await ensureBucket();
  const key = `${id}.${image.ext}`;
  await minio.putObject(BUCKET, key, image.bytes, image.bytes.length, { "Content-Type": image.contentType });
  return key;
};

// Returns a readable stream of the image for the given key, or null if it is missing.
export const getImageStream = async (key: string): Promise<Readable | null> => {
  try {
    await ensureBucket();
    return await minio.getObject(BUCKET, key);
  } catch {
    return null; // NoSuchKey etc.
  }
};

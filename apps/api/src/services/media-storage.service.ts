import type { Readable } from "stream";
import * as Minio from "minio";

const AUDIO_CONTENT_TYPE = "audio/webm";

// Voice audio is stored in self-hosted MinIO — durable and multi-replica-safe.
// Config comes from MESSAGES_MINIO_* env; the bucket must exist (provisioned in compose).
const BUCKET = process.env.MESSAGES_MINIO_BUCKET ?? "messages";

const endpointUrl = new URL(process.env.MESSAGES_MINIO_ENDPOINT ?? "http://localhost:9000");
const useSSL = endpointUrl.protocol === "https:";

const minio = new Minio.Client({
  endPoint: endpointUrl.hostname,
  port: Number(endpointUrl.port) || (useSSL ? 443 : 80),
  useSSL,
  accessKey: process.env.MESSAGES_MINIO_ACCESS_KEY ?? "",
  secretKey: process.env.MESSAGES_MINIO_SECRET_KEY ?? "",
});

const objectName = (messageId: string): string => `${messageId}.webm`;

const decodeBase64 = (input: string): Buffer =>
  Buffer.from(input.replace(/^data:audio\/[a-zA-Z+-]+;base64,/, ""), "base64");

// Persist an audio clip (data-URL base64 or raw base64) under the message id.
export const saveAudioFromBase64 = async (messageId: string, base64Input: string): Promise<void> => {
  const bytes = decodeBase64(base64Input);
  await minio.putObject(BUCKET, objectName(messageId), bytes, bytes.length, { "Content-Type": AUDIO_CONTENT_TYPE });
};

export const deleteAudio = async (messageId: string): Promise<void> => {
  try {
    await minio.removeObject(BUCKET, objectName(messageId));
  } catch {
    // best-effort
  }
};

// Returns a readable stream of the audio for the given message, or null if it is missing.
export const getAudioStream = async (messageId: string): Promise<Readable | null> => {
  try {
    return await minio.getObject(BUCKET, objectName(messageId));
  } catch {
    return null; // NoSuchKey etc.
  }
};

export const AUDIO_MIME = AUDIO_CONTENT_TYPE;

// --- Message images ---------------------------------------------------------
// Stored in the SAME private bucket as voice notes (never the public `listings`
// bucket), keyed by message id so the participant-checked stream can find them.
// The `-image` suffix keeps them distinct from the `<id>.webm` audio objects.
const imageObjectName = (messageId: string): string => `${messageId}-image`;

// Persist a message image's decoded bytes. The content-type is stored as object
// metadata so the stream handler can serve it back without a message-doc field.
export const saveMessageImage = async (messageId: string, bytes: Buffer, contentType: string): Promise<void> => {
  await minio.putObject(BUCKET, imageObjectName(messageId), bytes, bytes.length, { "Content-Type": contentType });
};

// Returns the image stream + its stored content-type, or null if it is missing.
export const getMessageImage = async (messageId: string): Promise<{ stream: Readable; contentType: string } | null> => {
  try {
    const name = imageObjectName(messageId);
    const stat = await minio.statObject(BUCKET, name);
    const stream = await minio.getObject(BUCKET, name);
    return { stream, contentType: stat.metaData["content-type"] ?? "application/octet-stream" };
  } catch {
    return null; // NoSuchKey etc.
  }
};

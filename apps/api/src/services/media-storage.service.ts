import type { Readable } from "stream";
import * as Minio from "minio";

const AUDIO_CONTENT_TYPE = "audio/webm";

// Service (couche services) : stockage des médias de messagerie (notes vocales + images)
// dans MinIO self-hosted — durable et sûr en multi-réplicas. La config vient des variables
// d'env MESSAGES_MINIO_* ; le bucket doit exister (provisionné dans compose).
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

// Clé d'objet d'une note vocale, dérivée de l'id du message.
const objectName = (messageId: string): string => `${messageId}.webm`;

// Retire un éventuel préfixe de data-URL audio avant de décoder le base64 en octets.
const decodeBase64 = (input: string): Buffer =>
  Buffer.from(input.replace(/^data:audio\/[a-zA-Z+-]+;base64,/, ""), "base64");

/** Persiste un clip audio (data-URL base64 ou base64 brut) sous l'id du message. */
export const saveAudioFromBase64 = async (messageId: string, base64Input: string): Promise<void> => {
  const bytes = decodeBase64(base64Input);
  await minio.putObject(BUCKET, objectName(messageId), bytes, bytes.length, { "Content-Type": AUDIO_CONTENT_TYPE });
};

/** Suppression best-effort de la note vocale d'un message ; ne lève jamais. */
export const deleteAudio = async (messageId: string): Promise<void> => {
  try {
    await minio.removeObject(BUCKET, objectName(messageId));
  } catch {
    // best-effort
  }
};

/** Renvoie un flux lisible de l'audio du message donné, ou null s'il est absent. */
export const getAudioStream = async (messageId: string): Promise<Readable | null> => {
  try {
    return await minio.getObject(BUCKET, objectName(messageId));
  } catch {
    return null; // NoSuchKey, etc.
  }
};

export const AUDIO_MIME = AUDIO_CONTENT_TYPE;

// --- Images de message -------------------------------------------------------
// Stockées dans le MÊME bucket privé que les notes vocales (jamais le bucket public
// `listings`), indexées par id de message pour que le flux contrôlé par participant les
// retrouve. Le suffixe `-image` les distingue des objets audio `<id>.webm`.
const imageObjectName = (messageId: string): string => `${messageId}-image`;

/**
 * Persiste les octets décodés d'une image de message. Le content-type est stocké en
 * métadonnée d'objet pour que le handler de flux puisse le renvoyer sans champ dans le
 * document message.
 */
export const saveMessageImage = async (messageId: string, bytes: Buffer, contentType: string): Promise<void> => {
  await minio.putObject(BUCKET, imageObjectName(messageId), bytes, bytes.length, { "Content-Type": contentType });
};

/** Suppression best-effort de l'image d'un message ; ne lève jamais. */
export const deleteMessageImage = async (messageId: string): Promise<void> => {
  try {
    await minio.removeObject(BUCKET, imageObjectName(messageId));
  } catch {
    // best-effort
  }
};

/** Renvoie le flux de l'image + son content-type stocké, ou null si elle est absente. */
export const getMessageImage = async (messageId: string): Promise<{ stream: Readable; contentType: string } | null> => {
  try {
    const name = imageObjectName(messageId);
    // statObject d'abord pour récupérer le content-type stocké en métadonnée.
    const stat = await minio.statObject(BUCKET, name);
    const stream = await minio.getObject(BUCKET, name);
    return { stream, contentType: stat.metaData["content-type"] ?? "application/octet-stream" };
  } catch {
    return null; // NoSuchKey, etc.
  }
};

import type { Readable } from "stream";
import * as Minio from "minio";

// Service (couche services) : stockage des images d'annonces dans MinIO self-hosted
// (même instance que les messages vocaux, voir media-storage.service.ts). La config
// retombe sur les variables MESSAGES_MINIO_* pour qu'un unique déploiement MinIO serve
// les deux ; on peut surcharger via LISTINGS_MINIO_* au besoin.
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

// mime de data-URL → extension de fichier. L'extension est inscrite dans la clé de l'objet
// pour que le handler GET serve le bon Content-Type sans aller-retour de métadonnées.
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

/** Déduit le Content-Type à servir à partir de l'extension présente dans une clé d'objet. */
export const contentTypeForKey = (key: string): string => {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[ext] ?? "application/octet-stream";
};

// Crée le bucket automatiquement à la première utilisation pour ne pas dépendre d'un
// provisioning au moment du compose.
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

/**
 * Parse une URL `data:image/xxx;base64,....` en octets + extension. Exige un vrai
 * préfixe de data-URL image — un payload sans préfixe ou un mime non-image (text/plain,
 * svg, …) est rejeté (null) plutôt que stocké silencieusement en png.
 */
export const decodeImageBase64 = (input: string): DecodedImage | null => {
  // Capture le mime image et le corps base64 ; le flag `s` laisse `.` matcher les retours ligne.
  const match = input.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.*)$/s);
  if (!match) return null;
  const mime = match[1]!.toLowerCase();
  const ext = MIME_TO_EXT[mime];
  if (!ext) return null;
  const bytes = Buffer.from(match[2]!, "base64");
  if (bytes.length === 0) return null;
  return { bytes, ext, contentType: EXT_TO_MIME[ext]! };
};

/** Persiste une image et renvoie sa clé d'objet (`<id>.<ext>`). */
export const saveImage = async (id: string, image: DecodedImage): Promise<string> => {
  await ensureBucket();
  const key = `${id}.${image.ext}`;
  await minio.putObject(BUCKET, key, image.bytes, image.bytes.length, { "Content-Type": image.contentType });
  return key;
};

// Suppression best-effort d'un objet image. Ne lève jamais : le nettoyage des médias ne
// doit pas casser l'appelant (suppression d'annonce/de compte), à l'image de deleteAudio
// dans media-storage.
export const deleteImage = async (key: string): Promise<void> => {
  try {
    await minio.removeObject(BUCKET, key);
  } catch {
    // best-effort
  }
};

// Marqueur partagé avec l'URL stockée par le handler d'upload (`<base>/uploads/images/<key>`).
const IMAGE_URL_MARKER = "/uploads/images/";

/**
 * Déduit la clé d'objet MinIO à partir d'une URL d'image stockée. Renvoie null pour les
 * URL qui ne sont pas nos propres uploads, afin de ne jamais tenter de supprimer des
 * objets externes arbitraires.
 */
export const imageKeyFromUrl = (url: string): string | null => {
  const idx = url.lastIndexOf(IMAGE_URL_MARKER);
  if (idx === -1) return null;
  const key = url.slice(idx + IMAGE_URL_MARKER.length);
  return key.length > 0 ? key : null;
};

/** Renvoie un flux lisible de l'image pour la clé donnée, ou null si elle est absente. */
export const getImageStream = async (key: string): Promise<Readable | null> => {
  try {
    await ensureBucket();
    return await minio.getObject(BUCKET, key);
  } catch (err) {
    // Seul un véritable not-found devient null (→ 404). Tout autre échec (MinIO down,
    // auth, réseau) est relancé pour que la route remonte un 500 loggé plutôt qu'un faux 404.
    const code = (err as { code?: string } | null)?.code;
    if (code === "NoSuchKey" || code === "NotFound") return null;
    throw err;
  }
};

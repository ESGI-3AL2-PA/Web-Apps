// Service d'upload et de récupération d'images. Les images transitent en base64
// (data-URL) à l'upload, et sont re-téléchargées en blob authentifié au rendu.
import api from "./api";

// Lit un File et le convertit en data-URL base64 via FileReader (API asynchrone).
const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/** POST /uploads/images — envoie une data-URL base64, renvoie l'URL publique servie par l'api. */
export async function uploadImage(file: File): Promise<string> {
  const imageBase64 = await fileToDataUrl(file);
  const res = await api.post<{ url: string }>("/uploads/images", { imageBase64 });
  return res.data.url;
}

/** Uploade plusieurs fichiers en série (séquentiel, l'ordre du tableau est préservé). */
export async function uploadImages(files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    urls.push(await uploadImage(file));
  }
  return urls;
}

/**
 * GET /uploads/images/:key — récupère les octets d'une image (Bearer auto-attaché
 * par l'intercepteur axios). L'endpoint de service exige désormais un token valide :
 * les images sont donc téléchargées en blob (cf. AuthedImage) et non embarquées par URL.
 */
export async function fetchImageBlob(url: string): Promise<Blob> {
  const res = await api.get(url, { responseType: "blob" });
  return res.data as Blob;
}

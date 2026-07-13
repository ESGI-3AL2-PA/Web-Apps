import api from "./api";

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// POST /uploads/images — sends a base64 data-URL, returns the public image URL served by the api.
export async function uploadImage(file: File): Promise<string> {
  const imageBase64 = await fileToDataUrl(file);
  const res = await api.post<{ url: string }>("/uploads/images", { imageBase64 });
  return res.data.url;
}

// Upload several files, preserving order.
export async function uploadImages(files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    urls.push(await uploadImage(file));
  }
  return urls;
}

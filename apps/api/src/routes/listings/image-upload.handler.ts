import { randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";
import {
  decodeImageBase64,
  saveImage,
  getImageStream,
  contentTypeForKey,
} from "../../services/image-storage.service.js";

// Handlers bruts Express pour l'upload et le service d'images d'annonces
// (stockées via image-storage.service). L'upload prend une data-URL base64 et
// renvoie une URL publique ; le service streame le binaire.

// ~5 Mo décodés. base64 gonfle d'environ 4/3, donc 5 Mo ≈ 6.7M caractères.
const MAX_IMAGE_BASE64_LENGTH = 7_000_000;

// Base d'URL publique : préfère API_PUBLIC_URL (sans slash final), sinon reconstruit
// depuis le protocole et l'hôte de la requête.
const publicBase = (req: Request): string =>
  process.env.API_PUBLIC_URL?.replace(/\/$/, "") ?? `${req.protocol}://${req.get("host")}`;

// POST /uploads/images — body JSON { imageBase64: string (data-URL) } → { url }
export const imageUploadHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const { imageBase64 } = req.body ?? {};
    if (typeof imageBase64 !== "string" || imageBase64.length < 20) {
      res.status(400).json({ message: "imageBase64 manquant" });
      return;
    }
    if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      res.status(413).json({ message: "Image trop volumineuse (max ~5 Mo)" });
      return;
    }

    const decoded = decodeImageBase64(imageBase64);
    if (!decoded) {
      res.status(400).json({ message: "Format d'image non supporté (png, jpeg, webp, gif)" });
      return;
    }

    const key = await saveImage(randomUUID(), decoded);
    res.status(201).json({ url: `${publicBase(req)}/uploads/images/${key}` });
  } catch (err) {
    next(err);
  }
};

// GET /uploads/images/:key — streame le binaire. Protégé par auth au montage (sous
// requireAuth) : un token valide est requis, mais pas d'autorisation par annonce.
export const imageStreamHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    if (!key) {
      res.status(400).json({ message: "Missing image key" });
      return;
    }
    const stream = await getImageStream(key);
    if (!stream) {
      res.status(404).json({ message: "Image not found" });
      return;
    }
    res.setHeader("Content-Type", contentTypeForKey(key));
    // La clé est un UUID immuable : cache privé (par utilisateur) d'un an, immutable.
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    stream.on("error", (err) => next(err));
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
};

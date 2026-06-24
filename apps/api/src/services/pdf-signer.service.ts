import fs from "fs/promises";
import { PDFDocument } from "pdf-lib";
import {
  buildPdfPath,
  getSignaturePosition,
  type SignatureParty,
} from "./pdf-generator.service.js";

/**
 * Embarque une image de signature (PNG base64) dans le PDF d'un contract.
 *
 * Stratégie :
 *   - Si un PDF signé existe déjà (l'autre partie a déjà signé), on l'utilise
 *     comme source — pour cumuler les 2 signatures sur le même document final.
 *   - Sinon, on part de l'original.
 *   - On embed la signature dans le rectangle correspondant à la partie qui signe
 *     (provider à gauche, beneficiary à droite).
 *   - On écrit le résultat dans `{contractId}_signed.pdf` (overwrite).
 */
export const embedSignatureIntoPdf = async (params: {
  contractId: string;
  originalPath: string;
  existingSignedPath?: string;
  signatureBase64: string;
  party: SignatureParty;
}): Promise<{ signedPdfPath: string }> => {
  const { contractId, originalPath, existingSignedPath, signatureBase64, party } = params;

  // Source : PDF déjà signé s'il existe (= overlay de la 2e signature),
  // sinon l'original (= 1re signature).
  const sourcePath = existingSignedPath ?? originalPath;
  const sourceBytes = await fs.readFile(sourcePath);
  const pdfDoc = await PDFDocument.load(sourceBytes);

  // Décode la base64. Supporte les data-URLs "data:image/png;base64,..."
  const base64 = signatureBase64.replace(/^data:image\/png;base64,/, "");
  const sigBytes = Buffer.from(base64, "base64");
  const sigImage = await pdfDoc.embedPng(sigBytes);

  const pos = getSignaturePosition(party);
  // Petit padding intérieur pour que la signature ne touche pas les bords.
  const padding = 5;
  const pages = pdfDoc.getPages();
  const page = pages[0];
  page.drawImage(sigImage, {
    x: pos.x + padding,
    y: pos.y + padding,
    width: pos.width - 2 * padding,
    height: pos.height - 2 * padding,
  });

  const signedPdfPath = buildPdfPath(contractId, "signed");
  const signedBytes = await pdfDoc.save();
  await fs.writeFile(signedPdfPath, signedBytes);
  return { signedPdfPath };
};

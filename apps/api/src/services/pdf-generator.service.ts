import path from "path";
import fs from "fs/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Contract } from "../entities/contract.entity.js";
import type { User } from "../entities/user.entity.js";
import type { Listing } from "../entities/listing.entity.js";

// Racine du stockage. Configurable via env, défaut sous apps/api/storage/contracts.
const getStorageRoot = (): string => {
  const configured = process.env.CONTRACTS_STORAGE_PATH ?? "./storage/contracts";
  return path.resolve(configured);
};

const ensureStorageDir = async (): Promise<string> => {
  const root = getStorageRoot();
  await fs.mkdir(root, { recursive: true });
  return root;
};

export const buildPdfPath = (contractId: string, variant: "original" | "signed" = "original"): string => {
  const suffix = variant === "signed" ? "_signed" : "";
  return path.join(getStorageRoot(), `${contractId}${suffix}.pdf`);
};

const PAGE_WIDTH = 595; // A4 portrait
const PAGE_HEIGHT = 842;
const MARGIN_LEFT = 60;
const MARGIN_RIGHT = 60;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

export const SIGNATURE_POSITIONS = {
  titleY: 380,
  labelY: 350,
  boxY: 270,
  boxHeight: 70,
  boxWidth: 200,
  providerX: MARGIN_LEFT,
  beneficiaryX: MARGIN_LEFT + 200 + 30,
} as const;

export type SignatureParty = "provider" | "beneficiary";

export const getSignaturePosition = (party: SignatureParty) => {
  const { providerX, beneficiaryX, boxY, boxHeight, boxWidth } = SIGNATURE_POSITIONS;
  return {
    x: party === "provider" ? providerX : beneficiaryX,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
  };
};

export const generateContractPdf = async (params: {
  contract: Contract;
  provider: User;
  beneficiary: User;
  listing: Listing;
}): Promise<{ pdfPath: string }> => {
  const { contract, provider, beneficiary, listing } = params;

  await ensureStorageDir();
  const pdfPath = buildPdfPath(contract.id, "original");

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const colorBlack = rgb(0, 0, 0);
  const colorGray = rgb(0.4, 0.4, 0.4);
  const colorBorder = rgb(0.7, 0.7, 0.7);

  let cursorY = PAGE_HEIGHT - 60;

  // ── En-tête ─────────────────────────────────────────────────────────
  page.drawText("CONTRAT DE SERVICE", {
    x: MARGIN_LEFT,
    y: cursorY,
    size: 20,
    font: fontBold,
    color: colorBlack,
  });
  cursorY -= 24;
  page.drawText("Connected Neighbours", {
    x: MARGIN_LEFT,
    y: cursorY,
    size: 10,
    font,
    color: colorGray,
  });
  cursorY -= 16;
  page.drawText(`Reference : ${contract.id}`, {
    x: MARGIN_LEFT,
    y: cursorY,
    size: 9,
    font,
    color: colorGray,
  });
  cursorY -= 12;
  const dateFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(contract.createdAt));
  page.drawText(`Date : ${dateFr}`, {
    x: MARGIN_LEFT,
    y: cursorY,
    size: 9,
    font,
    color: colorGray,
  });

  cursorY -= 16;
  page.drawLine({
    start: { x: MARGIN_LEFT, y: cursorY },
    end: { x: MARGIN_LEFT + CONTENT_WIDTH, y: cursorY },
    thickness: 1,
    color: colorBorder,
  });
  cursorY -= 28;

  // ── Parties ─────────────────────────────────────────────────────────
  page.drawText("ENTRE LES SOUSSIGNES :", {
    x: MARGIN_LEFT,
    y: cursorY,
    size: 11,
    font: fontBold,
  });
  cursorY -= 22;

  page.drawText("Le Prestataire :", { x: MARGIN_LEFT, y: cursorY, size: 10, font: fontBold });
  cursorY -= 14;
  page.drawText(`${provider.firstName} ${provider.lastName}`, {
    x: MARGIN_LEFT + 16,
    y: cursorY,
    size: 10,
    font,
  });
  cursorY -= 12;
  page.drawText(`Email : ${provider.email}`, {
    x: MARGIN_LEFT + 16,
    y: cursorY,
    size: 9,
    font,
    color: colorGray,
  });
  if (provider.address) {
    cursorY -= 12;
    page.drawText(`Adresse : ${provider.address}`, {
      x: MARGIN_LEFT + 16,
      y: cursorY,
      size: 9,
      font,
      color: colorGray,
    });
  }
  cursorY -= 22;

  page.drawText("Et le Beneficiaire :", { x: MARGIN_LEFT, y: cursorY, size: 10, font: fontBold });
  cursorY -= 14;
  page.drawText(`${beneficiary.firstName} ${beneficiary.lastName}`, {
    x: MARGIN_LEFT + 16,
    y: cursorY,
    size: 10,
    font,
  });
  cursorY -= 12;
  page.drawText(`Email : ${beneficiary.email}`, {
    x: MARGIN_LEFT + 16,
    y: cursorY,
    size: 9,
    font,
    color: colorGray,
  });
  if (beneficiary.address) {
    cursorY -= 12;
    page.drawText(`Adresse : ${beneficiary.address}`, {
      x: MARGIN_LEFT + 16,
      y: cursorY,
      size: 9,
      font,
      color: colorGray,
    });
  }
  cursorY -= 28;

  // ── Objet ────────────────────────────────────────────────────────────
  page.drawText("OBJET DU CONTRAT :", { x: MARGIN_LEFT, y: cursorY, size: 11, font: fontBold });
  cursorY -= 18;
  page.drawText(`Service propose : ${listing.title}`, {
    x: MARGIN_LEFT,
    y: cursorY,
    size: 10,
    font,
  });
  cursorY -= 16;

  // Description word-wrap, cappée à 4 lignes pour ne pas déborder sur la zone signature
  const lines = wrapText(listing.description, 95).slice(0, 4);
  for (const line of lines) {
    page.drawText(line, { x: MARGIN_LEFT, y: cursorY, size: 9, font, color: colorBlack });
    cursorY -= 12;
  }
  cursorY -= 16;

  // ── Rémunération ─────────────────────────────────────────────────────
  page.drawText("REMUNERATION :", { x: MARGIN_LEFT, y: cursorY, size: 11, font: fontBold });
  cursorY -= 18;
  page.drawText(`${contract.price} points`, {
    x: MARGIN_LEFT,
    y: cursorY,
    size: 14,
    font: fontBold,
    color: colorBlack,
  });

  // ── Zones de signature (POSITIONS FIXES depuis SIGNATURE_POSITIONS) ──
  page.drawText("SIGNATURES :", {
    x: MARGIN_LEFT,
    y: SIGNATURE_POSITIONS.titleY,
    size: 11,
    font: fontBold,
  });

  // Provider (gauche)
  page.drawText("Le Prestataire :", {
    x: SIGNATURE_POSITIONS.providerX,
    y: SIGNATURE_POSITIONS.labelY,
    size: 9,
    font,
  });
  page.drawRectangle({
    x: SIGNATURE_POSITIONS.providerX,
    y: SIGNATURE_POSITIONS.boxY,
    width: SIGNATURE_POSITIONS.boxWidth,
    height: SIGNATURE_POSITIONS.boxHeight,
    borderColor: colorBorder,
    borderWidth: 0.8,
  });

  // Beneficiary (droite)
  page.drawText("Le Beneficiaire :", {
    x: SIGNATURE_POSITIONS.beneficiaryX,
    y: SIGNATURE_POSITIONS.labelY,
    size: 9,
    font,
  });
  page.drawRectangle({
    x: SIGNATURE_POSITIONS.beneficiaryX,
    y: SIGNATURE_POSITIONS.boxY,
    width: SIGNATURE_POSITIONS.boxWidth,
    height: SIGNATURE_POSITIONS.boxHeight,
    borderColor: colorBorder,
    borderWidth: 0.8,
  });

  // ── Pied de page ─────────────────────────────────────────────────────
  const footerY = 60;
  page.drawLine({
    start: { x: MARGIN_LEFT, y: footerY + 18 },
    end: { x: MARGIN_LEFT + CONTENT_WIDTH, y: footerY + 18 },
    thickness: 0.5,
    color: colorBorder,
  });
  page.drawText(
    "Ce contrat est genere automatiquement par Connected Neighbours. Les signatures sont apposees electroniquement.",
    { x: MARGIN_LEFT, y: footerY + 4, size: 7, font, color: colorGray },
  );
  page.drawText(`Document genere le ${dateFr} - Reference : ${contract.id}`, {
    x: MARGIN_LEFT,
    y: footerY - 6,
    size: 7,
    font,
    color: colorGray,
  });

  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(pdfPath, pdfBytes);

  return { pdfPath };
};

const wrapText = (text: string, maxChars: number): string[] => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
};

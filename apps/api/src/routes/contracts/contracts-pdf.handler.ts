import path from "path";
import fs from "fs";
import type { Request, Response, NextFunction } from "express";
import { resolve } from "../../repositories/container.js";

export const contractsPdfHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!id) {
      res.status(400).json({ message: "Missing contract id" });
      return;
    }

    const contract = await resolve("contract").getContractById(id);
    if (!contract) {
      res.status(404).json({ message: "Contract not found" });
      return;
    }

    // Authorization : seul provider, beneficiary ou un admin peut télécharger.
    const isParty = contract.providerId === user.sub || contract.beneficiaryId === user.sub;
    const isAdmin = user.role === "admin" || user.role === "superAdmin";
    if (!isParty && !isAdmin) {
      res.status(404).json({ message: "Contract not found" });
      return;
    }

    // Privilégie le signé. Si rien sur disque, 404 propre.
    const chosenPath = contract.signedPdfPath ?? contract.pdfPath;
    if (!chosenPath) {
      res.status(404).json({ message: "Aucun PDF disponible pour ce contract" });
      return;
    }

    const absolute = path.resolve(chosenPath);
    if (!fs.existsSync(absolute)) {
      res.status(404).json({ message: "Fichier PDF introuvable sur le serveur" });
      return;
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="contract-${id}${contract.signedPdfPath ? "-signed" : ""}.pdf"`,
    );
    res.sendFile(absolute);
  } catch (err) {
    next(err);
  }
};

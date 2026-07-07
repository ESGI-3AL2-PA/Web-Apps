import type { Request, Response } from "express";
import { resolve } from "../../repositories/container.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import { documensoService } from "../../services/documenso.service.js";

// Proxies the signed contract PDF from Documenso so the React front only ever talks
// to our api (never Documenso/S3 directly). Raw handler because it streams binary.
// Mounted below requireAuth, so req.user is set; authorization is checked here.
export const contractPdfHandler = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const contractRepo: IContractRepository = resolve("contract");
  const contract = await contractRepo.getContractById(req.params.id!);

  // 404 (not 403) on deny so we don't reveal which contracts exist.
  const isParty = contract && (contract.providerId === user.sub || contract.beneficiaryId === user.sub);
  const isAdmin = user.role === "admin" || user.role === "superAdmin";
  if (!contract || (!isParty && !isAdmin)) {
    res.status(404).json({ message: "Contract not found" });
    return;
  }
  if (contract.documensoDocumentId === null) {
    res.status(404).json({ message: "No document for this contract" });
    return;
  }

  const pdf = await documensoService.fetchSignedPdf(contract.documensoDocumentId);
  if (!pdf) {
    // Signed PDF only exists once every party has signed.
    res.status(409).json({ message: "Contract is not fully signed yet" });
    return;
  }
  res.setHeader("Content-Type", pdf.contentType);
  res.setHeader("Content-Disposition", `inline; filename="${pdf.filename}"`);
  res.send(pdf.body);
};

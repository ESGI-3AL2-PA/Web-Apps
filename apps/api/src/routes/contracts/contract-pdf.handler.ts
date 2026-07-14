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

  // 404 (not 403) on deny so we don't reveal which contracts exist. Mirrors the
  // authorize policy on GET /contracts/:id: parties always, superAdmin bypasses,
  // and a district admin only within their own district.
  const isParty = contract && (contract.providerId === user.sub || contract.beneficiaryId === user.sub);
  const isSuperAdmin = user.role === "superAdmin";
  const isDistrictAdmin =
    user.role === "admin" && !!user.adminDistrictId && contract?.districtId === user.adminDistrictId;
  if (!contract || (!isParty && !isSuperAdmin && !isDistrictAdmin)) {
    res.status(404).json({ message: "Contract not found" });
    return;
  }
  if (contract.documensoDocumentId === null) {
    res.status(404).json({ message: "No document for this contract" });
    return;
  }

  // Documenso can fail (e.g. the document was deleted, or is unreachable). Catch it so
  // a bad PDF request returns 502 instead of crashing the process on an unhandled rejection.
  let pdf: Awaited<ReturnType<typeof documensoService.fetchSignedPdf>>;
  try {
    pdf = await documensoService.fetchSignedPdf(contract.documensoDocumentId);
  } catch (err) {
    console.error("fetchSignedPdf failed:", err);
    res.status(502).json({ message: "Could not fetch the signed PDF" });
    return;
  }
  if (!pdf) {
    // Signed PDF only exists once every party has signed.
    res.status(409).json({ message: "Contract is not fully signed yet" });
    return;
  }
  // Strip CR/LF and quotes from the Documenso-provided name to avoid header injection/spoofing.
  const safeName =
    String(pdf.filename ?? "contract.pdf")
      .replace(/[\r\n"]/g, "")
      .trim() || "contract.pdf";
  res.setHeader("Content-Type", pdf.contentType);
  res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
  res.send(pdf.body);
};

import type { Request, Response } from "express";
import { resolve } from "../../repositories/container.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import { documensoService } from "../../services/documenso.service.js";

// Handler brut Express (route contrats) : proxifie le PDF signé du contrat depuis
// Documenso afin que le front React ne parle jamais qu'à notre api (jamais
// directement à Documenso/S3). Handler brut car il streame du binaire. Monté sous
// requireAuth : req.user est donc défini ; l'autorisation est vérifiée ici.
export const contractPdfHandler = async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const contractRepo: IContractRepository = resolve("contract");
  const contract = await contractRepo.getContractById(req.params.id!);

  // 404 (et non 403) en cas de refus, pour ne pas divulguer quels contrats existent.
  // Reflète la politique d'autorisation de GET /contracts/:id : les parties toujours,
  // le superAdmin passe outre, et un administrateur de quartier uniquement dans son quartier.
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

  // Documenso peut échouer (ex. document supprimé ou injoignable). On l'attrape pour
  // qu'une mauvaise requête PDF renvoie 502 au lieu de crasher le process sur un rejet non géré.
  let pdf: Awaited<ReturnType<typeof documensoService.fetchSignedPdf>>;
  try {
    pdf = await documensoService.fetchSignedPdf(contract.documensoDocumentId);
  } catch (err) {
    req.log.error({ err }, "fetchSignedPdf failed");
    res.status(502).json({ message: "Could not fetch the signed PDF" });
    return;
  }
  if (!pdf) {
    // Le PDF signé n'existe qu'une fois que chaque partie a signé.
    res.status(409).json({ message: "Contract is not fully signed yet" });
    return;
  }
  // Retire CR/LF et guillemets du nom fourni par Documenso pour éviter l'injection/spoofing d'en-tête.
  const safeName =
    String(pdf.filename ?? "contract.pdf")
      .replace(/[\r\n"]/g, "")
      .trim() || "contract.pdf";
  res.setHeader("Content-Type", pdf.contentType);
  res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
  res.send(pdf.body);
};

import type { Request, Response } from "express";
import { resolve } from "../../repositories/container.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import { documensoService } from "../../services/documenso.service.js";
import { handleDocumensoWebhookUseCase } from "../../use-cases/contracts/handle-documenso-webhook.use-case.js";

// Raw Express handler (not a ts-rest route) because Documenso is an external caller
// that authenticates with a shared secret, not our JWT. Mounted ABOVE requireAuth.
export const documensoWebhookHandler = async (req: Request, res: Response) => {
  const secret = req.header("X-Documenso-Secret");
  if (!documensoService.verifyWebhookSecret(secret)) {
    res.status(401).json({ message: "Invalid webhook secret" });
    return;
  }

  const contractRepo: IContractRepository = resolve("contract");
  const transactionRepo: ITransactionRepository = resolve("transaction");
  try {
    await handleDocumensoWebhookUseCase(contractRepo, transactionRepo)(req.body ?? {});
  } catch (err) {
    console.error("Documenso webhook handling failed:", err);
    // 500 so Documenso retries; the update is idempotent.
    res.status(500).json({ message: "Webhook processing failed" });
    return;
  }
  res.status(200).json({ received: true });
};

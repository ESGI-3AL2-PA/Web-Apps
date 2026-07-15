import type { Request, Response } from "express";
import { resolve } from "../../repositories/container.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import {
  documensoService,
  documensoWebhookEventSchema,
  documensoWebhookReplayCache,
  documensoWebhookReplayKey,
} from "../../services/documenso.service.js";
import { handleDocumensoWebhookUseCase } from "../../use-cases/contracts/handle-documenso-webhook.use-case.js";

// Raw Express handler (not a ts-rest route) because Documenso is an external caller
// that authenticates with a shared secret, not our JWT. Mounted ABOVE requireAuth.
export const documensoWebhookHandler = async (req: Request, res: Response) => {
  const secret = req.header("X-Documenso-Secret");
  if (!documensoService.verifyWebhookSecret(secret)) {
    res.status(401).json({ message: "Invalid webhook secret" });
    return;
  }

  // Documenso does not sign webhook bodies (Community Edition authenticates only with the
  // shared X-Documenso-Secret header above), so validate the payload shape and reject
  // anything malformed rather than passing an untrusted body straight to the use-case.
  const parsed = documensoWebhookEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Malformed webhook payload" });
    return;
  }
  const event = parsed.data;

  // Replay guard (defense-in-depth over the downstream atomic status gates): drop a
  // re-post of a delivery we already processed within the TTL, acknowledging it as normal.
  const replayKey = documensoWebhookReplayKey(event);
  if (documensoWebhookReplayCache.has(replayKey)) {
    res.status(200).json({ received: true, deduplicated: true });
    return;
  }

  const contractRepo: IContractRepository = resolve("contract");
  const transactionRepo: ITransactionRepository = resolve("transaction");
  try {
    await handleDocumensoWebhookUseCase(contractRepo, transactionRepo)(event);
  } catch (err) {
    req.log.error({ err }, "Documenso webhook handling failed");
    // 500 so Documenso retries; the update is idempotent.
    res.status(500).json({ message: "Webhook processing failed" });
    return;
  }
  // Only remember after a successful 200 so a delivery that previously 500'd (and is
  // retried by Documenso) is still reprocessed.
  documensoWebhookReplayCache.remember(replayKey);
  res.status(200).json({ received: true });
};

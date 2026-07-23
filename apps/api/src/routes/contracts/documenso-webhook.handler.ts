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

// Handler brut Express (pas une route ts-rest) car Documenso est un appelant externe
// qui s'authentifie avec un secret partagé, pas notre JWT. Monté AU-DESSUS de
// requireAuth. Reçoit les évènements de signature et met à jour le contrat + séquestre.
export const documensoWebhookHandler = async (req: Request, res: Response) => {
  // Authentifie l'appel via l'en-tête secret partagé (Documenso Community Edition).
  const secret = req.header("X-Documenso-Secret");
  if (!documensoService.verifyWebhookSecret(secret)) {
    res.status(401).json({ message: "Invalid webhook secret" });
    return;
  }

  // Documenso ne signe pas le corps des webhooks (la Community Edition ne s'authentifie
  // qu'avec l'en-tête partagé X-Documenso-Secret ci-dessus) : on valide donc la forme du
  // payload et on rejette tout ce qui est malformé, plutôt que de passer un corps non
  // fiable directement au cas d'usage.
  const parsed = documensoWebhookEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Malformed webhook payload" });
    return;
  }
  const event = parsed.data;

  // Garde anti-rejeu (défense en profondeur par-dessus les verrous de statut atomiques
  // en aval) : on écarte un renvoi d'une livraison déjà traitée dans le TTL, en
  // l'acquittant comme normale.
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
    // 500 pour que Documenso réessaie ; la mise à jour est idempotente.
    res.status(500).json({ message: "Webhook processing failed" });
    return;
  }
  // On ne mémorise qu'après un 200 réussi : ainsi une livraison qui a précédemment
  // renvoyé 500 (et que Documenso réessaie) est bien retraitée.
  documensoWebhookReplayCache.remember(replayKey);
  res.status(200).json({ received: true });
};

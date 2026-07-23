// Cas d'usage : création d'une transaction de points (mint / burn / transfert).
// Concentre TOUTE la logique d'autorisation et de mouvement de solde. Écrit à la fois
// le solde de l'utilisateur et le grand livre (ledger) dans une même transaction Mongo,
// afin qu'un échec ne laisse jamais de l'argent déplacé sans écriture correspondante.

import type { CreateTransactionDto } from "@repo/contracts";
import type { Transaction } from "../../entities/transaction.entity.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import { runInTransaction } from "../../repositories/tx.js";
import { logger } from "../../logger.js";

/** Résultat typé de la création : succès (avec les écritures) ou l'une des causes d'échec métier. */
export type CreateTransactionResult =
  | { kind: "ok"; entries: Transaction[] }
  | { kind: "insufficient-funds" }
  | { kind: "sender-not-found" }
  | { kind: "recipient-not-found" }
  | { kind: "forbidden" };

/**
 * Identité de l'initiateur du mouvement. L'autorisation (périmètre quartier, gating
 * mint/burn) est appliquée ici plutôt que dans le router, afin d'être couverte par les
 * tests unitaires.
 */
export interface TransactionActor {
  sub: string;
  role: string;
  adminDistrictId?: string | null;
}

// Levée à l'intérieur de la transaction pour l'avorter (rollback du débit) tout en
// remontant un résultat typé à l'appelant plutôt qu'une erreur brute.
type AbortKind = "insufficient-funds" | "recipient-not-found";
class TxAbort extends Error {
  constructor(readonly kind: AbortKind) {
    super(kind);
  }
}

export const createTransactionUseCase = (
  transactionRepository: ITransactionRepository,
  userRepository: IUserRepository,
) => {
  return async (data: CreateTransactionDto, actor: TransactionActor): Promise<CreateTransactionResult> => {
    const isSuperAdmin = actor.role === "superAdmin";
    const isDistrictAdmin = actor.role === "admin";

    // Les non-admins ne peuvent déplacer que leurs propres points : la source est forcée à
    // l'appelant, si bien qu'un corps de requête ne peut ni usurper un autre émetteur ni
    // créer des points depuis le système.
    const fromUserId = isSuperAdmin || isDistrictAdmin ? data.fromUserId : actor.sub;
    const { toUserId, amount, refId, refType } = data;

    // Mint (sans source) et burn (sans destination) créent ou détruisent de la valeur : ils
    // sont réservés au superAdmin. Un administrateur de quartier doit déplacer des points
    // entre deux utilisateurs existants.
    if (isDistrictAdmin && (!fromUserId || !toUserId || !actor.adminDistrictId)) {
      return { kind: "forbidden" };
    }

    // Le districtId de chaque écriture est dérivé côté serveur de l'utilisateur concerné :
    // le débit et le crédit d'un transfert peuvent appartenir à des quartiers différents.
    const fromUser = fromUserId ? await userRepository.getUserById(fromUserId) : null;
    if (fromUserId && !fromUser) return { kind: "sender-not-found" };

    const toUser = toUserId ? await userRepository.getUserById(toUserId) : null;
    if (toUserId && !toUser) return { kind: "recipient-not-found" };

    // Un administrateur de quartier ne peut toucher que des utilisateurs de son propre
    // quartier — le compte débité comme le compte crédité doivent appartenir à
    // actor.adminDistrictId.
    if (
      isDistrictAdmin &&
      (fromUser!.districtId !== actor.adminDistrictId || toUser!.districtId !== actor.adminDistrictId)
    ) {
      return { kind: "forbidden" };
    }

    // Déplace les soldes et écrit le ledger dans une même transaction, pour qu'un échec
    // après le débit ne laisse jamais de l'argent déplacé sans écritures correspondantes.
    // Sur un Mongo autonome (sans replica set), runInTransaction s'exécute séquentiellement
    // avec session=undefined ; là, on compense le débit à la main puisqu'il n'y a rien à
    // annuler.
    try {
      const outcome = await runInTransaction(async (session) => {
        const entries: Omit<Transaction, "id" | "createdAt">[] = [];

        // Débite d'abord la source de façon atomique ; abandonne sans effet de bord si le
        // solde est insuffisant (ferme la race entre vérification et écriture).
        if (fromUserId) {
          const debited = await transactionRepository.tryDebit(fromUserId, amount, session);
          if (!debited) throw new TxAbort("insufficient-funds");
          entries.push({
            userId: fromUserId,
            districtId: fromUser!.districtId,
            type: toUserId ? "transfer_out" : "debit",
            amount: -amount,
            refId,
            refType,
          });
        }

        if (toUserId) {
          const credited = await transactionRepository.adjustBalance(toUserId, amount, session);
          if (credited === null) {
            // Le destinataire a disparu après la pré-vérification — on annule (ou, sur un
            // Mongo autonome sans session, on rembourse le débit à la main).
            if (fromUserId && !session) await transactionRepository.adjustBalance(fromUserId, amount);
            throw new TxAbort("recipient-not-found");
          }
          entries.push({
            userId: toUserId,
            districtId: toUser!.districtId,
            type: fromUserId ? "transfer_in" : "credit",
            amount,
            refId,
            refType,
          });
        }

        return {
          kind: "ok" as const,
          entries: await transactionRepository.createTransactions(entries, session),
        };
      });

      // Piste d'audit : tout mouvement de solde initié par un admin est tracé. Aucune
      // collection d'audit dédiée n'existe encore (cf. note de PR), on émet donc une ligne
      // de log structurée identifiant l'acteur — information que les écritures du ledger
      // seules ne capturent pas.
      if (isSuperAdmin || isDistrictAdmin) {
        logger.info(
          {
            audit: "transaction.create",
            actorSub: actor.sub,
            actorRole: actor.role,
            fromUserId: fromUserId ?? null,
            toUserId: toUserId ?? null,
            amount,
          },
          "Admin-initiated balance movement",
        );
      }

      return outcome;
    } catch (err) {
      if (err instanceof TxAbort) return { kind: err.kind };
      throw err;
    }
  };
};

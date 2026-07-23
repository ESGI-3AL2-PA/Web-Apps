// Cas d'usage : suppression d'un compte utilisateur avec effacement en cascade (RGPD art. 17).
// Efface toutes les données rattachées à l'utilisateur (messages + médias, réponses de vote,
// notifications, annonces, événements, signalements, contrats en cours), pseudonymise le
// ledger, retire le nœud du graphe, supprime la ligne Mongo, puis demande à l'auth-service
// de purger les sessions. Distingue via un résultat typé : introuvable, effacement complet,
// ou effacement partiel (sessions non purgées).

import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";
import { logger } from "../../logger.js";
import type { IVoteRepository } from "../../repositories/Vote/vote.repository.js";
import type { INotificationRepository } from "../../repositories/Notification/notification.repository.js";
import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";
import type { IEventRepository } from "../../repositories/Event/event.repository.js";
import type { IIncidentRepository } from "../../repositories/Incident/incident.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import type { IDocumensoService } from "../../services/documenso.service.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";
import { deleteAudio, deleteMessageImage } from "../../services/media-storage.service.js";
import { deleteImage, imageKeyFromUrl } from "../../services/image-storage.service.js";
import { deleteContractUseCase } from "../contracts/delete-contract.use-case.js";

// Levée lorsqu'une suppression vise un compte superAdmin. Les superAdmins sont les
// opérateurs « bris de glace » globaux ; permettre la suppression de leur compte (même par
// eux-mêmes) risquerait de verrouiller toute l'administration de la plateforme, ce n'est
// donc jamais autorisé.
export class CannotDeleteSuperAdminError extends Error {
  constructor() {
    super("superAdmin accounts cannot be deleted");
    this.name = "CannotDeleteSuperAdminError";
  }
}

// Issue d'une tentative d'effacement. `sessions-purge-failed` signifie que les données
// personnelles Mongo + graphe ont bien été effacées mais que la purge des sessions côté
// auth-service (historique IP/UA conservé) n'a pas abouti après retries — un effacement
// PARTIEL que le router remonte en 5xx pour que l'appelant réessaie, plutôt qu'un faux 204
// (RGPD art. 17).
export type DeleteUserResult = { kind: "not-found" } | { kind: "ok" } | { kind: "sessions-purge-failed" };

// Retry borné pour la purge des sessions inter-services. Les tentatives sont espacées d'un
// petit backoff linéaire : un hoquet transitoire de l'auth-service est absorbé, une panne
// durable finit tout de même par remonter un échec plutôt que de laisser silencieusement
// des données personnelles.
const PURGE_MAX_ATTEMPTS = 3;
const PURGE_RETRY_BASE_MS = 200;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Demande à l'auth-service de supprimer définitivement les sessions (refresh tokens +
 * historique IP/UA) de l'utilisateur. Authentifie l'appel interne via `x-internal-token`.
 * Réessaie jusqu'à PURGE_MAX_ATTEMPTS fois avec backoff linéaire. Retourne `true` dès qu'une
 * tentative aboutit, `false` si toutes échouent.
 */
const purgeAuthSessions = async (userId: string): Promise<boolean> => {
  const authServiceUrl = process.env.AUTH_SERVICE_URL ?? "http://localhost:3001";
  for (let attempt = 1; attempt <= PURGE_MAX_ATTEMPTS; attempt++) {
    try {
      const purgeRes = await fetch(`${authServiceUrl}/internal/sessions/purge`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-token": process.env.INTERNAL_SERVICE_TOKEN ?? "",
        },
        body: JSON.stringify({ userId }),
      });
      if (purgeRes.ok) return true;
      logger.error(
        { userId, status: purgeRes.status, attempt, maxAttempts: PURGE_MAX_ATTEMPTS },
        "auth-service session purge failed",
      );
    } catch (err) {
      logger.error({ err, userId, attempt, maxAttempts: PURGE_MAX_ATTEMPTS }, "auth-service session purge errored");
    }
    if (attempt < PURGE_MAX_ATTEMPTS) await sleep(PURGE_RETRY_BASE_MS * attempt);
  }
  return false;
};

/** Ensemble des repositories et services requis par l'effacement en cascade. */
export interface DeleteUserDeps {
  userRepository: IUserRepository;
  graphRepository: IGraphRepository;
  conversationRepository: IConversationRepository;
  voteRepository: IVoteRepository;
  notificationRepository: INotificationRepository;
  listingRepository: IListingRepository;
  eventRepository: IEventRepository;
  incidentRepository: IIncidentRepository;
  transactionRepository: ITransactionRepository;
  contractRepository: IContractRepository;
  documenso: IDocumensoService;
}

/**
 * Factory du cas d'usage de suppression de compte en libre-service (la route restreint
 * l'appel à l'id de l'appelant lui-même). Le garde-fou superAdmin est appliqué ici aussi,
 * en défense en profondeur, pour tenir quelle que soit la portée de la route. Retourne un
 * DeleteUserResult permettant de distinguer un utilisateur absent, un effacement propre et
 * un effacement partiel (sessions auth non purgées).
 *
 * RGPD art. 17 : l'effacement doit se propager à chaque collection indexée sur
 * l'utilisateur — pas seulement la ligne `users` + le nœud graphe. On fan-out vers les
 * messages (médias vocaux inclus), réponses de vote, notifications, annonces, événements
 * (créés + inscriptions + interactions) et signalements, et on pseudonymise le ledger
 * d'escrow (exception de conservation comptable : garder l'écriture financière, couper le
 * lien d'identité).
 */
export const deleteUserUseCase = (deps: DeleteUserDeps) => {
  return async (params: { id: string }): Promise<DeleteUserResult> => {
    const {
      userRepository,
      graphRepository,
      conversationRepository,
      voteRepository,
      notificationRepository,
      listingRepository,
      eventRepository,
      incidentRepository,
      transactionRepository,
      contractRepository,
      documenso,
    } = deps;

    const id = params.id;
    const user = await userRepository.getUserById(id);
    if (!user) return { kind: "not-found" };
    if (user.role === "superAdmin") throw new CannotDeleteSuperAdminError();

    // Propage l'effacement AVANT de retirer la ligne utilisateur, pour qu'un échec en cours
    // de route laisse le compte intact et que la suppression puisse être réessayée sans risque.

    // Les messages d'abord : on a besoin des ids de messages médias avant que les lignes ne
    // disparaissent, afin de pouvoir aussi supprimer leurs objets stockés (notes vocales +
    // images de conversation) — tous deux indexés par id de message dans leurs buckets privés.
    const { audioIds, imageIds } = await conversationRepository.deleteUserMessages(id);
    await Promise.all([...audioIds.map((mid) => deleteAudio(mid)), ...imageIds.map((mid) => deleteMessageImage(mid))]);

    // Idem pour les images d'annonces et les photos de signalements : on collecte leurs clés
    // de stockage avant que les lignes ne disparaissent, pour retirer les objets de MinIO
    // après la cascade. imageKeyFromUrl renvoie null pour les URLs qui ne sont pas nos propres
    // uploads : les URLs de photos de signalement externes sont donc laissées intactes.
    const { data: authoredListings } = await listingRepository.getListings({ authorId: id, limit: 10_000 });
    const { data: reportedIncidents } = await incidentRepository.getIncidents({ reporterId: id, limit: 10_000 });
    const imageKeys = [
      ...authoredListings.flatMap((listing) => listing.images),
      ...reportedIncidents.map((incident) => incident.photoUrl).filter((u): u is string => u != null),
    ]
      .map(imageKeyFromUrl)
      .filter((k): k is string => k !== null);

    await Promise.all([
      voteRepository.deleteUserResponses(id),
      notificationRepository.deleteByRecipient(id),
      listingRepository.deleteByAuthor(id),
      eventRepository.deleteByCreator(id),
      eventRepository.removeUserFromAllEvents(id),
      eventRepository.deleteUserInteractions(id),
      incidentRepository.deleteByReporter(id),
      transactionRepository.pseudonymiseUser(id),
    ]);

    await Promise.all(imageKeys.map((k) => deleteImage(k)));

    // Contrats : efface les contrats en attente/brouillon de l'utilisateur — rembourse
    // l'escrow retenu, supprime le document Documenso (effacement distant best-effort) et
    // retire la ligne. Les contrats finalisés/rejetés sont CONSERVÉS au titre de l'exception
    // de conservation comptable/légale (art. 17(3)) ; le lien du ledger vers cet utilisateur
    // a été pseudonymisé plus haut.
    const { data: contracts } = await contractRepository.getContracts({ partyId: id, limit: 10_000 });
    const deleteContract = deleteContractUseCase(contractRepository, transactionRepository);
    for (const contract of contracts) {
      if (contract.signatureStatus === "pending" || contract.signatureStatus === "draft") {
        if (contract.documensoDocumentId !== null) {
          await documenso.deleteDocument(contract.documensoDocumentId).catch(() => {});
        }
        await deleteContract({ id: contract.id }); // rembourse l'escrow + supprime la ligne (atomique)
      }
    }

    // Effacement de la projection graphe (gdpr-M1) : s'exécute quel que soit le résultat de
    // la suppression Mongo. Le nœud graphe contient des données personnelles (User.name/email,
    // LIVES_IN.address) et DETACH DELETE est idempotent ; lier cet effacement à `deleted`
    // risquait d'orpheliner ces données si la suppression Mongo ne rapportait rien ou si le
    // process mourait entre les deux étapes. Un utilisateur supprimé n'est jamais reprojeté
    // (rebuild-graph lit Mongo).
    await syncGraph(`deleteUser(${id})`, () => graphRepository.deleteUser(id));

    const deleted = await userRepository.deleteUser(id);
    // L'utilisateur existait en début d'appel : un `false` ici traduit donc une race de
    // suppression concurrente — une autre requête a déjà effacé la ligne (et lancera sa
    // propre purge).
    if (!deleted) return { kind: "not-found" };

    // Effacement inter-services (gdpr-M2) : l'api ne possède aucune donnée d'auth, on demande
    // donc à l'auth-service de supprimer définitivement les sessions à refresh token de cet
    // utilisateur (historique IP/UA conservé inclus). L'art. 17 exige que cela se produise
    // réellement — on réessaie, et si l'échec persiste on remonte un échec partiel pour que
    // l'appelant reçoive un 5xx et réessaie, PAS un faux 204. L'effacement Mongo + graphe a
    // déjà eu lieu et n'est volontairement pas annulé ; les sessions résiduelles sont la
    // seule chose restant à réconcilier.
    const purged = await purgeAuthSessions(id);
    if (!purged) {
      logger.error({ userId: id, maxAttempts: PURGE_MAX_ATTEMPTS }, "erasure incomplete: auth sessions not purged");
      return { kind: "sessions-purge-failed" };
    }

    return { kind: "ok" };
  };
};

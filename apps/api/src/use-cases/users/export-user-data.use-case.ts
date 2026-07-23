import type { UserDataExportResponseDto } from "@repo/contracts";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";
import type { IContractRepository } from "../../repositories/Contract/contract.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import type { IEventRepository } from "../../repositories/Event/event.repository.js";
import type { IVoteRepository } from "../../repositories/Vote/vote.repository.js";
import type { IIncidentRepository } from "../../repositories/Incident/incident.repository.js";
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";
import type { INotificationRepository } from "../../repositories/Notification/notification.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";

/**
 * Cas d'usage d'export des données personnelles d'un utilisateur (couche use-case, domaine
 * users). Répond aux obligations RGPD d'accès (art. 15) et de portabilité (art. 20) : il
 * agrège dans un seul document JSON portable toutes les catégories de données que la
 * plateforme détient sur un utilisateur, en interrogeant tous les repositories concernés
 * plus l'historique de sessions détenu par l'auth-service.
 */

// Plafond généreux par collection : un export doit être complet, pas paginé. Un utilisateur
// unique reste réalistement bien en dessous de cette limite sur chaque collection.
const EXPORT_LIMIT = 10_000;

export interface ExportUserDataDeps {
  userRepository: IUserRepository;
  listingRepository: IListingRepository;
  contractRepository: IContractRepository;
  transactionRepository: ITransactionRepository;
  eventRepository: IEventRepository;
  voteRepository: IVoteRepository;
  incidentRepository: IIncidentRepository;
  conversationRepository: IConversationRepository;
  notificationRepository: INotificationRepository;
  graphRepository: IGraphRepository;
  /**
   * Inter-service : récupère l'historique des sessions (refresh tokens : IP / User-Agent /
   * horodatages) auprès de l'auth-service, qui détient toutes les données d'authentification.
   * Best-effort — doit se résoudre à `[]` (ne jamais throw) si l'auth-service est injoignable,
   * afin que le reste de l'export réussisse quand même.
   */
  fetchSessions: (userId: string) => Promise<unknown[]>;
}

/**
 * RGPD art. 15 (accès) + art. 20 (portabilité) : rassemble TOUTES les catégories de données
 * personnelles que la plateforme détient sur un utilisateur dans un unique document JSON
 * portable. Le routeur restreint l'appel à l'id du demandeur lui-même ; le cas d'usage se
 * contente d'agréger.
 *
 * Renvoie `null` si l'utilisateur n'existe pas (le routeur mappe ça sur un 404). Chaque source
 * est interrogée de façon défensive — une collection en échec produit une section vide plutôt
 * que de faire échouer l'export entier.
 */
export const exportUserDataUseCase = (deps: ExportUserDataDeps) => {
  return async ({ id }: { id: string }): Promise<UserDataExportResponseDto | null> => {
    const user = await deps.userRepository.getUserById(id);
    if (!user) return null;

    // Toutes les sections sont récupérées en parallèle ; chaque `.catch(() => [])` (ou `null`
    // pour le graphe) isole une source défaillante sans compromettre les autres.
    const [
      listings,
      contractsAsProvider,
      contractsAsBeneficiary,
      transactions,
      events,
      votes,
      incidents,
      conversations,
      notifications,
      graph,
      sessions,
    ] = await Promise.all([
      deps.listingRepository
        .getListings({ authorId: id, limit: EXPORT_LIMIT })
        .then((p) => p.data)
        .catch(() => []),
      deps.contractRepository
        .getContracts({ providerId: id, limit: EXPORT_LIMIT })
        .then((p) => p.data)
        .catch(() => []),
      deps.contractRepository
        .getContracts({ beneficiaryId: id, limit: EXPORT_LIMIT })
        .then((p) => p.data)
        .catch(() => []),
      deps.transactionRepository
        .getTransactions({ userId: id, limit: EXPORT_LIMIT })
        .then((p) => p.data)
        .catch(() => []),
      deps.eventRepository
        .getEvents({ creatorId: id, limit: EXPORT_LIMIT })
        .then((p) => p.data)
        .catch(() => []),
      deps.voteRepository
        .getVotes({ creatorId: id, limit: EXPORT_LIMIT })
        .then((p) => p.data)
        .catch(() => []),
      deps.incidentRepository
        .getIncidents({ reporterId: id, limit: EXPORT_LIMIT })
        .then((p) => p.data)
        .catch(() => []),
      deps.conversationRepository
        .getConversations({ participantId: id, limit: EXPORT_LIMIT })
        .then((p) => p.data)
        .catch(() => []),
      deps.notificationRepository
        .getNotifications({ recipientId: id, limit: EXPORT_LIMIT })
        .then((p) => p.data)
        .catch(() => []),
      deps.graphRepository.exportUserGraph(id).catch(() => null),
      deps.fetchSessions(id).catch(() => []),
    ]);

    // Les messages sont stockés par conversation. On récupère chaque fil auquel l'utilisateur
    // participe — il a déjà, en tant que participant, un accès en lecture à l'intégralité du
    // fil : le fil complet (ses propres textes + URLs de médias et la correspondance reçue)
    // constitue donc ses données personnelles.
    const messages = (
      await Promise.all(
        conversations.map((conversation) =>
          deps.conversationRepository
            .getMessages(conversation.id, { limit: EXPORT_LIMIT })
            .then((p) => p.data)
            .catch(() => []),
        ),
      )
    ).flat();

    // Ne jamais exporter de secrets, même dans un export limité à soi-même.
    const { passwordHash: _passwordHash, totpSecret: _totpSecret, ...userSafe } = user;

    return {
      exportedAt: new Date().toISOString(),
      user: userSafe,
      listings,
      contractsAsProvider,
      contractsAsBeneficiary,
      transactions,
      events,
      votes,
      incidents,
      conversations,
      messages,
      notifications,
      sessions,
      graph,
    } as UserDataExportResponseDto;
  };
};

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

// Generous per-collection cap: an export must be complete, not paginated. A single
// user realistically stays well under this across every collection.
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
   * Cross-service: pull the user's refresh-token session history (IP / User-Agent /
   * timestamps) from auth-service, which owns all auth data. Best-effort — must
   * resolve to `[]` (never throw) if auth-service is unreachable, so the rest of
   * the export still succeeds.
   */
  fetchSessions: (userId: string) => Promise<unknown[]>;
}

/**
 * GDPR Art. 15 (access) + Art. 20 (portability): gather EVERY category of personal
 * data the platform holds for one user into a single portable JSON document. The
 * route scopes this to the caller's own id; the use-case just aggregates.
 *
 * Returns `null` if the user does not exist (router maps to 404). Each source is
 * fetched defensively — one degraded collection yields an empty section rather than
 * failing the whole export.
 */
export const exportUserDataUseCase = (deps: ExportUserDataDeps) => {
  return async ({ id }: { id: string }): Promise<UserDataExportResponseDto | null> => {
    const user = await deps.userRepository.getUserById(id);
    if (!user) return null;

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

    // Messages live per-conversation. Pull each thread the user is in — they already
    // have participant read access to all of it, so the full thread (their own text +
    // media URLs and the correspondence they received) is their personal data.
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

    // Never export secrets, even in a self-scoped dump.
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

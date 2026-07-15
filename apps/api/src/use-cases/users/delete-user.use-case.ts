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
import { deleteAudio } from "../../services/media-storage.service.js";
import { deleteImage, imageKeyFromUrl } from "../../services/image-storage.service.js";
import { deleteContractUseCase } from "../contracts/delete-contract.use-case.js";

// Raised when a deletion targets a superAdmin account. superAdmins are the global
// break-glass operators; allowing their account to be removed (even by themselves)
// risks locking the whole platform out of administration, so it is never permitted.
export class CannotDeleteSuperAdminError extends Error {
  constructor() {
    super("superAdmin accounts cannot be deleted");
    this.name = "CannotDeleteSuperAdminError";
  }
}

// Outcome of an erasure attempt. `sessions-purge-failed` means the Mongo + graph PII
// was erased but the auth-service session purge (retained IP/UA history) did not
// complete after retries — a PARTIAL erasure the router surfaces as a 5xx so the
// caller retries, rather than a false 204 (GDPR Art. 17).
export type DeleteUserResult = { kind: "not-found" } | { kind: "ok" } | { kind: "sessions-purge-failed" };

// Bounded retry for the cross-service session purge. Attempts are spaced with a small
// linear backoff; a transient auth-service blip is absorbed, a sustained outage still
// surfaces as a failure rather than silently leaving PII behind.
const PURGE_MAX_ATTEMPTS = 3;
const PURGE_RETRY_BASE_MS = 200;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

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

// Self-service account deletion (the route scopes this to the caller's own id). The
// superAdmin guardrail is enforced here too, defence-in-depth, so it holds regardless
// of how the route is scoped. Returns a DeleteUserResult so the caller can distinguish a
// missing user, a clean erasure, and a partial erasure (auth sessions not purged).
//
// GDPR Art. 17: erasure must cascade across every collection keyed to the user — not
// just the `users` row + graph node. We fan out to messages (incl. voice media), vote
// responses, notifications, listings, events (created + registrations + interactions)
// and incidents, and pseudonymise the escrow ledger (accounting-retention exception:
// keep the financial record, sever the identity link).
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

    // Fan out erasure BEFORE removing the user row, so a mid-way failure leaves the
    // account intact and the deletion can be safely retried.

    // Messages first: we need the audio message ids before the rows are gone, so the
    // .webm files on disk can be removed too (deleteAudio was previously never called).
    const audioMessageIds = await conversationRepository.deleteUserMessages(id);
    await Promise.all(audioMessageIds.map((mid) => deleteAudio(mid)));

    // Same for listing images: collect their storage keys before the rows are gone,
    // so the objects can be removed from MinIO after the cascade.
    const { data: authoredListings } = await listingRepository.getListings({ authorId: id, limit: 10_000 });
    const imageKeys = authoredListings
      .flatMap((listing) => listing.images)
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

    // Contracts: erase the user's pending/draft contracts — refund the held escrow,
    // delete the Documenso document (best-effort remote erase), and remove the row.
    // Completed/rejected contracts are RETAINED under the accounting/legal-retention
    // exception (Art. 17(3)); the ledger link to this user was pseudonymised above.
    const { data: contracts } = await contractRepository.getContracts({ partyId: id, limit: 10_000 });
    const deleteContract = deleteContractUseCase(contractRepository, transactionRepository);
    for (const contract of contracts) {
      if (contract.signatureStatus === "pending" || contract.signatureStatus === "draft") {
        if (contract.documensoDocumentId !== null) {
          await documenso.deleteDocument(contract.documensoDocumentId).catch(() => {});
        }
        await deleteContract({ id: contract.id }); // refunds escrow + deletes the row (atomic)
      }
    }

    // Graph projection erasure (gdpr-M1): runs regardless of the Mongo delete result.
    // The graph node holds PII (User.name/email, LIVES_IN.address) and DETACH DELETE is
    // idempotent, so tying it to `deleted` risked orphaning that PII if the Mongo delete
    // reported nothing or the process died between the two steps. A deleted user is never
    // re-projected (rebuild-graph reads Mongo).
    await syncGraph(`deleteUser(${id})`, () => graphRepository.deleteUser(id));

    const deleted = await userRepository.deleteUser(id);
    // The user existed at the top of this call, so a false here is a concurrent-delete
    // race: another request already erased the row (and will run its own purge).
    if (!deleted) return { kind: "not-found" };

    // Cross-service erasure (gdpr-M2): the api owns no auth data, so ask auth-service to
    // hard-delete this user's refresh-token sessions (incl. retained IP/UA history).
    // Art. 17 requires this to actually happen — retry, and if it still fails we report a
    // partial failure so the caller gets a 5xx and retries, NOT a false 204. The Mongo +
    // graph erasure already ran and is intentionally not rolled back; the lingering
    // sessions are the only thing left to reconcile.
    const purged = await purgeAuthSessions(id);
    if (!purged) {
      logger.error({ userId: id, maxAttempts: PURGE_MAX_ATTEMPTS }, "erasure incomplete: auth sessions not purged");
      return { kind: "sessions-purge-failed" };
    }

    return { kind: "ok" };
  };
};

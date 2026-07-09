import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";
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
// of how the route is scoped. Returns false if the user no longer exists.
//
// GDPR Art. 17: erasure must cascade across every collection keyed to the user — not
// just the `users` row + graph node. We fan out to messages (incl. voice media), vote
// responses, notifications, listings, events (created + registrations + interactions)
// and incidents, and pseudonymise the escrow ledger (accounting-retention exception:
// keep the financial record, sever the identity link).
export const deleteUserUseCase = (deps: DeleteUserDeps) => {
  return async (params: { id: string }): Promise<boolean> => {
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
    if (!user) return false;
    if (user.role === "superAdmin") throw new CannotDeleteSuperAdminError();

    // Fan out erasure BEFORE removing the user row, so a mid-way failure leaves the
    // account intact and the deletion can be safely retried.

    // Messages first: we need the audio message ids before the rows are gone, so the
    // .webm files on disk can be removed too (deleteAudio was previously never called).
    const audioMessageIds = await conversationRepository.deleteUserMessages(id);
    await Promise.all(audioMessageIds.map((mid) => deleteAudio(mid)));

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

    const deleted = await userRepository.deleteUser(id);
    if (deleted) {
      // DETACH DELETE in Neo4j removes all the user's relationships too.
      await syncGraph(`deleteUser(${id})`, () => graphRepository.deleteUser(id));
    }
    return deleted;
  };
};

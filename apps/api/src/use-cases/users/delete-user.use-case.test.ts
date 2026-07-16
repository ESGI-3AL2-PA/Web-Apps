import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../../entities/user.entity.js";
import { deleteUserUseCase, type DeleteUserDeps } from "./delete-user.use-case.js";

// Keep the erasure fan-out off disk/network: no MinIO, no audio files.
vi.mock("../../services/media-storage.service.js", () => ({ deleteAudio: vi.fn(async () => {}) }));
vi.mock("../../services/image-storage.service.js", () => ({
  deleteImage: vi.fn(async () => {}),
  imageKeyFromUrl: vi.fn(() => null),
}));

const makeUser = (): User => ({ id: "u1", role: "user", districtId: "d1" }) as unknown as User;

// Full deps with empty/no-op repos; the two tests only care about the graph delete and
// the auth-session purge, so everything else just needs to resolve.
const makeDeps = (overrides: {
  deleteUser: () => Promise<boolean>;
  graphDeleteUser: () => Promise<void>;
}): DeleteUserDeps =>
  ({
    userRepository: {
      getUserById: vi.fn(async () => makeUser()),
      deleteUser: vi.fn(overrides.deleteUser),
    },
    graphRepository: { deleteUser: vi.fn(overrides.graphDeleteUser) },
    conversationRepository: { deleteUserMessages: vi.fn(async () => ({ audioIds: [], imageIds: [] })) },
    voteRepository: { deleteUserResponses: vi.fn(async () => {}) },
    notificationRepository: { deleteByRecipient: vi.fn(async () => {}) },
    listingRepository: {
      getListings: vi.fn(async () => ({ data: [] })),
      deleteByAuthor: vi.fn(async () => {}),
    },
    eventRepository: {
      deleteByCreator: vi.fn(async () => {}),
      removeUserFromAllEvents: vi.fn(async () => {}),
      deleteUserInteractions: vi.fn(async () => {}),
    },
    incidentRepository: {
      getIncidents: vi.fn(async () => ({ data: [] })),
      deleteByReporter: vi.fn(async () => {}),
    },
    transactionRepository: { pseudonymiseUser: vi.fn(async () => {}) },
    contractRepository: { getContracts: vi.fn(async () => ({ data: [] })) },
    documenso: { deleteDocument: vi.fn(async () => {}) },
  }) as unknown as DeleteUserDeps;

describe("deleteUserUseCase reliable erasure", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("gdpr-M1: erases the graph node even when the Mongo delete reports nothing", async () => {
    const graphDeleteUser = vi.fn(async () => {});
    const deps = makeDeps({ deleteUser: async () => false, graphDeleteUser });

    const result = await deleteUserUseCase(deps)({ id: "u1" });

    // Graph PII (name/email/address) must be gone regardless of the Mongo result.
    expect(graphDeleteUser).toHaveBeenCalledWith("u1");
    expect(result).toEqual({ kind: "not-found" });
  });

  it("gdpr-M2: returns a partial-failure result when session purge never succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500 }) as Response),
    );
    const deps = makeDeps({ deleteUser: async () => true, graphDeleteUser: async () => {} });

    const result = await deleteUserUseCase(deps)({ id: "u1" });

    // Bounded retry, then surface the failure instead of a false success (204).
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ kind: "sessions-purge-failed" });
  });

  it("returns ok once the session purge succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 204 }) as Response),
    );
    const deps = makeDeps({ deleteUser: async () => true, graphDeleteUser: async () => {} });

    const result = await deleteUserUseCase(deps)({ id: "u1" });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ kind: "ok" });
  });
});

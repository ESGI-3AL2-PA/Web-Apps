import { describe, expect, it, vi } from "vitest";
import type { User } from "../../entities/user.entity.js";
import { exportUserDataUseCase, type ExportUserDataDeps } from "./export-user-data.use-case.js";

const page = <T>(data: T[]) => ({ data, total: data.length, page: 1, limit: 10_000 });

const makeUser = (id: string): User =>
  ({
    id,
    email: "jane@example.com",
    passwordHash: "SECRET-HASH",
    totpSecret: "SECRET-TOTP",
    firstName: "Jane",
    lastName: "Doe",
    address: "1 rue de la Paix",
    role: "user",
    districtId: "d1",
  }) as unknown as User;

// A deps object whose every source returns a single tagged row, so the test can assert
// each section is wired to its own repository call.
const makeDeps = (user: User | null): ExportUserDataDeps =>
  ({
    userRepository: { getUserById: vi.fn(async () => user) },
    listingRepository: { getListings: vi.fn(async () => page([{ id: "listing-1" }])) },
    contractRepository: {
      getContracts: vi.fn(async (p: { providerId?: string; beneficiaryId?: string }) =>
        page([{ id: p.providerId ? "contract-provider" : "contract-beneficiary" }]),
      ),
    },
    transactionRepository: { getTransactions: vi.fn(async () => page([{ id: "tx-1" }])) },
    eventRepository: { getEvents: vi.fn(async () => page([{ id: "event-1" }])) },
    voteRepository: { getVotes: vi.fn(async () => page([{ id: "vote-1" }])) },
    incidentRepository: { getIncidents: vi.fn(async () => page([{ id: "incident-1" }])) },
    conversationRepository: {
      getConversations: vi.fn(async () => page([{ id: "conv-1" }])),
      getMessages: vi.fn(async () =>
        page([{ id: "msg-1", senderId: "u1", content: "hi", mediaUrl: "http://x/a.webm" }]),
      ),
    },
    notificationRepository: { getNotifications: vi.fn(async () => page([{ id: "notif-1" }])) },
    graphRepository: {
      exportUserGraph: vi.fn(async () => ({
        nodes: [{ labels: ["User"], properties: { userId: "u1" } }],
        relationships: [{ type: "LIVES_IN", direction: "out", properties: { address: "1 rue de la Paix" }, other: {} }],
      })),
    },
    fetchSessions: vi.fn(async () => [{ id: "sess-1", ip: "1.2.3.4", userAgent: "curl" }]),
  }) as unknown as ExportUserDataDeps;

describe("exportUserDataUseCase", () => {
  it("aggregates every personal-data category into one document", async () => {
    const deps = makeDeps(makeUser("u1"));
    const result = await exportUserDataUseCase(deps)({ id: "u1" });

    expect(result).not.toBeNull();
    expect(result!.listings).toEqual([{ id: "listing-1" }]);
    expect(result!.contractsAsProvider).toEqual([{ id: "contract-provider" }]);
    expect(result!.contractsAsBeneficiary).toEqual([{ id: "contract-beneficiary" }]);
    expect(result!.transactions).toEqual([{ id: "tx-1" }]);
    expect(result!.events).toEqual([{ id: "event-1" }]);
    expect(result!.votes).toEqual([{ id: "vote-1" }]);
    expect(result!.incidents).toEqual([{ id: "incident-1" }]);
    expect(result!.conversations).toEqual([{ id: "conv-1" }]);
    expect(result!.messages).toHaveLength(1);
    expect(result!.messages[0]).toMatchObject({ content: "hi", mediaUrl: "http://x/a.webm" });
    expect(result!.notifications).toEqual([{ id: "notif-1" }]);
    expect(result!.sessions).toEqual([{ id: "sess-1", ip: "1.2.3.4", userAgent: "curl" }]);
    expect(result!.graph!.relationships[0]).toMatchObject({ type: "LIVES_IN" });
    expect(result!.exportedAt).toEqual(expect.any(String));
  });

  it("includes the user PII but strips the password hash and TOTP secret", async () => {
    const deps = makeDeps(makeUser("u1"));
    const result = await exportUserDataUseCase(deps)({ id: "u1" });

    expect(result!.user).toMatchObject({ email: "jane@example.com", address: "1 rue de la Paix" });
    expect(result!.user).not.toHaveProperty("passwordHash");
    expect(result!.user).not.toHaveProperty("totpSecret");
  });

  it("pulls messages for every conversation the user participates in", async () => {
    const deps = makeDeps(makeUser("u1"));
    await exportUserDataUseCase(deps)({ id: "u1" });

    expect(deps.conversationRepository.getConversations).toHaveBeenCalledWith(
      expect.objectContaining({ participantId: "u1" }),
    );
    expect(deps.conversationRepository.getMessages).toHaveBeenCalledWith("conv-1", expect.objectContaining({}));
  });

  it("returns null when the user does not exist", async () => {
    const deps = makeDeps(null);
    const result = await exportUserDataUseCase(deps)({ id: "ghost" });
    expect(result).toBeNull();
  });

  it("degrades a failing source to an empty section instead of failing the export", async () => {
    const deps = makeDeps(makeUser("u1"));
    deps.notificationRepository.getNotifications = vi.fn(async () => {
      throw new Error("mongo down");
    });
    deps.fetchSessions = vi.fn(async () => {
      throw new Error("auth-service down");
    });

    const result = await exportUserDataUseCase(deps)({ id: "u1" });
    expect(result!.notifications).toEqual([]);
    expect(result!.sessions).toEqual([]);
    // Unaffected sections still populate.
    expect(result!.listings).toEqual([{ id: "listing-1" }]);
  });
});

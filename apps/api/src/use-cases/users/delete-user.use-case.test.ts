// Suite de tests du cas d'usage de suppression d'utilisateur : se concentre sur la
// FIABILITÉ de l'effacement (RGPD) — effacement du nœud graphe indépendant du résultat
// Mongo, et purge des sessions auth avec retry puis remontée d'un échec partiel.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../../entities/user.entity.js";
import { deleteUserUseCase, type DeleteUserDeps } from "./delete-user.use-case.js";

// Garde le fan-out d'effacement hors disque/réseau : ni MinIO, ni fichiers audio.
vi.mock("../../services/media-storage.service.js", () => ({ deleteAudio: vi.fn(async () => {}) }));
vi.mock("../../services/image-storage.service.js", () => ({
  deleteImage: vi.fn(async () => {}),
  imageKeyFromUrl: vi.fn(() => null),
}));

const makeUser = (): User => ({ id: "u1", role: "user", districtId: "d1" }) as unknown as User;

// Dépendances complètes avec des repos vides / no-op ; les tests ne s'intéressent qu'à la
// suppression graphe et à la purge des sessions auth, le reste doit juste se résoudre.
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

  // gdpr-M1 : le nœud graphe est effacé même quand la suppression Mongo ne rapporte rien.
  it("gdpr-M1: erases the graph node even when the Mongo delete reports nothing", async () => {
    const graphDeleteUser = vi.fn(async () => {});
    const deps = makeDeps({ deleteUser: async () => false, graphDeleteUser });

    const result = await deleteUserUseCase(deps)({ id: "u1" });

    // Les données personnelles du graphe (nom/email/adresse) doivent disparaître quel que
    // soit le résultat Mongo.
    expect(graphDeleteUser).toHaveBeenCalledWith("u1");
    expect(result).toEqual({ kind: "not-found" });
  });

  // gdpr-M2 : un échec persistant de la purge des sessions remonte un résultat d'échec partiel.
  it("gdpr-M2: returns a partial-failure result when session purge never succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500 }) as Response),
    );
    const deps = makeDeps({ deleteUser: async () => true, graphDeleteUser: async () => {} });

    const result = await deleteUserUseCase(deps)({ id: "u1" });

    // Retry borné, puis remontée de l'échec plutôt qu'un faux succès (204).
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ kind: "sessions-purge-failed" });
  });

  // Succès nominal : dès que la purge des sessions réussit, le résultat est `ok`.
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

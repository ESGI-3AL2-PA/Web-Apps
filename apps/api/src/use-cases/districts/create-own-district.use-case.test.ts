import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../../entities/user.entity.js";
import type { District } from "../../entities/district.entity.js";
import { InMemoryUserRepository } from "../../repositories/User/user.repository.in-memory.js";
import { createOwnDistrictUseCase, type CreateOwnDistrictDeps } from "./create-own-district.use-case.js";

// Geocode alice's address to a fixed point (no network).
vi.mock("../../services/address.service.js", () => ({
  getCoordinatesFromAddress: vi.fn(async () => ({ type: "Point", coordinates: [2.34, 48.86] })),
}));
import { getCoordinatesFromAddress } from "../../services/address.service.js";

const seedUser = async (repo: InMemoryUserRepository, over: Partial<User> = {}): Promise<User> =>
  repo.createUser({
    email: "alice@x.io",
    passwordHash: "h",
    firstName: "Alice",
    lastName: "A",
    address: "12 Rue des Abbesses, Paris",
    role: "user",
    districtId: "",
    balance: 0,
    banned: false,
    emailVerified: true,
    totpSecret: null,
    totpEnabled: false,
    ...over,
  } as unknown as Omit<User, "id" | "createdAt" | "updatedAt">);

const makeDeps = (repo: InMemoryUserRepository) => {
  const createDistrict = vi.fn(
    async (data: Omit<District, "id">): Promise<District> => ({ id: "d-new", ...data }) as District,
  );
  const createDistrictAdmin = vi.fn(async (data: { districtId: string; userId: string }) => ({
    id: "da-1",
    ...data,
    createdAt: "2026-07-14T00:00:00.000Z",
  }));
  const deps: CreateOwnDistrictDeps = {
    userRepository: repo,
    districtRepository: {
      createDistrict,
      deleteDistrict: vi.fn(async () => true),
    } as unknown as CreateOwnDistrictDeps["districtRepository"],
    graphRepository: { upsertDistrict: vi.fn(async () => {}) } as unknown as CreateOwnDistrictDeps["graphRepository"],
    districtAdminRepository: {
      findExisting: vi.fn(async () => null),
      createDistrictAdmin,
    } as unknown as CreateOwnDistrictDeps["districtAdminRepository"],
  };
  return { deps, createDistrict, createDistrictAdmin };
};

describe("createOwnDistrictUseCase", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a district from the address point and promotes the caller to admin", async () => {
    const repo = new InMemoryUserRepository();
    const alice = await seedUser(repo);
    const { deps, createDistrict, createDistrictAdmin } = makeDeps(repo);

    const result = await createOwnDistrictUseCase(deps)(alice.id);

    expect(result.kind).toBe("ok");
    // District seeded with a closed-ring box around [2.34, 48.86] and a temp name.
    const created = createDistrict.mock.calls[0]![0];
    expect(created.name).toBe("Alice's district");
    expect(created.startingPoints).toBe(0);
    expect(created.geoJson!.type).toBe("Polygon");
    expect((created.geoJson!.coordinates as number[][][])[0]).toHaveLength(5);
    // Linked as district admin + promoted to admin role.
    expect(createDistrictAdmin).toHaveBeenCalledWith({ districtId: "d-new", userId: alice.id });
    expect((await repo.getUserById(alice.id))!.role).toBe("admin");
  });

  it("refuses a user who already has a district", async () => {
    const repo = new InMemoryUserRepository();
    const bob = await seedUser(repo, { email: "bob@x.io", districtId: "d-existing" });
    const { deps, createDistrict } = makeDeps(repo);

    const result = await createOwnDistrictUseCase(deps)(bob.id);

    expect(result.kind).toBe("forbidden");
    expect(createDistrict).not.toHaveBeenCalled();
  });

  it("refuses a non-user (e.g. already an admin)", async () => {
    const repo = new InMemoryUserRepository();
    const adm = await seedUser(repo, { email: "adm@x.io", role: "admin" });
    const { deps } = makeDeps(repo);

    expect((await createOwnDistrictUseCase(deps)(adm.id)).kind).toBe("forbidden");
  });

  it("returns geocode-failed when the address can't be located", async () => {
    vi.mocked(getCoordinatesFromAddress).mockRejectedValueOnce(new Error("no result"));
    const repo = new InMemoryUserRepository();
    const alice = await seedUser(repo);
    const { deps, createDistrict } = makeDeps(repo);

    const result = await createOwnDistrictUseCase(deps)(alice.id);

    expect(result.kind).toBe("geocode-failed");
    expect(createDistrict).not.toHaveBeenCalled();
  });
});

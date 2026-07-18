import { describe, expect, it, vi } from "vitest";
import type { IUserRepository } from "../repositories/User/user.repository.js";
import { callerCanReadDistrict, resolveCallerListDistrict, resolveListDistrictScope } from "./district-scope.js";

const userRepo = (districtId: string | null) =>
  ({
    getUserById: vi.fn().mockResolvedValue(districtId === null ? null : { id: "u1", districtId }),
  }) as unknown as IUserRepository;

describe("resolveListDistrictScope", () => {
  it("confines an admin to their bound district, ignoring the requested one", () => {
    expect(resolveListDistrictScope({ role: "admin", adminDistrictId: "d1" }, "d2")).toEqual({ districtId: "d1" });
  });

  it("returns empty for an admin bound to no district", () => {
    expect(resolveListDistrictScope({ role: "admin" }, "d2")).toEqual({ empty: true });
  });

  it("honors the request for superAdmin", () => {
    expect(resolveListDistrictScope({ role: "superAdmin" }, "d2")).toEqual({ districtId: "d2" });
  });
});

describe("resolveCallerListDistrict", () => {
  it("confines a resident to their own district, ignoring the requested one", async () => {
    const scope = await resolveCallerListDistrict({ role: "user", sub: "u1" }, "d2", userRepo("d1"));
    expect(scope).toEqual({ districtId: "d1" });
  });

  it("returns empty rather than everything when a resident has no district", async () => {
    expect(await resolveCallerListDistrict({ role: "user", sub: "u1" }, "d2", userRepo(null))).toEqual({ empty: true });
  });

  it("does not hit the repository for privileged roles", async () => {
    const repo = userRepo("d1");
    expect(await resolveCallerListDistrict({ role: "superAdmin", sub: "s1" }, "d2", repo)).toEqual({
      districtId: "d2",
    });
    expect(repo.getUserById).not.toHaveBeenCalled();
  });
});

describe("callerCanReadDistrict", () => {
  it("lets a resident read a record in their own district", async () => {
    expect(await callerCanReadDistrict({ role: "user", sub: "u1" }, ["d1"], userRepo("d1"))).toBe(true);
  });

  it("denies a resident a record in a neighbouring district", async () => {
    expect(await callerCanReadDistrict({ role: "user", sub: "u1" }, ["d2"], userRepo("d1"))).toBe(false);
  });

  it("denies a resident whose account no longer exists", async () => {
    expect(await callerCanReadDistrict({ role: "user", sub: "u1" }, ["d1"], userRepo(null))).toBe(false);
  });

  it("scopes an admin to their bound district", async () => {
    const repo = userRepo("d9");
    expect(await callerCanReadDistrict({ role: "admin", adminDistrictId: "d1", sub: "a1" }, ["d1"], repo)).toBe(true);
    expect(await callerCanReadDistrict({ role: "admin", adminDistrictId: "d1", sub: "a1" }, ["d2"], repo)).toBe(false);
    expect(await callerCanReadDistrict({ role: "admin", sub: "a1" }, ["d1"], repo)).toBe(false);
  });

  it("lets superAdmin read any district", async () => {
    expect(await callerCanReadDistrict({ role: "superAdmin", sub: "s1" }, ["d2"], userRepo(null))).toBe(true);
  });

  it("matches any one of a multi-district record (votes)", async () => {
    expect(await callerCanReadDistrict({ role: "user", sub: "u1" }, ["d2", "d1"], userRepo("d1"))).toBe(true);
  });
});

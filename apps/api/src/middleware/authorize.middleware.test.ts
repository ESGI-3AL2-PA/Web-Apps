import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import type { AppRoute } from "@ts-rest/core";
import type { AuthPolicy, AuthScope } from "@repo/contracts";

// The middleware pulls every record loader through the DI container's `resolve`.
// Stub it so record-level tests never touch a real repository / Mongo.
vi.mock("../repositories/container.js", () => ({
  resolve: vi.fn(),
}));

import { resolve } from "../repositories/container.js";
import { authorize, hasRecordCheck, inDistrict, ownsRecord } from "./authorize.middleware.js";
import type { AuthUser } from "./auth.middleware.js";

const mockResolve = vi.mocked(resolve);

type Rec = Record<string, unknown>;

// Any loader (getUserById / getListingById / getConversationById / …) resolves to this one
// record, so the record-level branch runs without a concrete repository implementation.
const stubRecord = (rec: Rec | null): void => {
  mockResolve.mockReturnValue(new Proxy({}, { get: () => async () => rec }) as never);
};

const makeUser = (over: Partial<AuthUser> = {}): AuthUser => ({
  sub: "user-1",
  role: "user",
  aud: "api",
  adminDistrictId: null,
  ...over,
});

const makeRes = () => {
  const captured: { statusCode?: number; body?: { message?: string } } = {};
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(payload: { message?: string }) {
      captured.body = payload;
      return this;
    },
  };
  return { res: res as unknown as Response, captured };
};

const makeReq = (opts: {
  policy?: AuthPolicy;
  user?: AuthUser;
  params?: Record<string, string>;
  method?: string;
}): Request => {
  const route = opts.policy ? ({ metadata: { auth: opts.policy } } as unknown as AppRoute) : undefined;
  return {
    tsRestRoute: route,
    user: opts.user,
    params: opts.params ?? {},
    method: opts.method ?? "GET",
  } as unknown as Request;
};

// -----------------------------------------------------------------------------
// Pure predicates
// -----------------------------------------------------------------------------

describe("ownsRecord", () => {
  it("matches on a single ownerField", () => {
    expect(ownsRecord({ authorId: "user-1" }, { resource: "listing", ownerField: "authorId" }, "user-1")).toBe(true);
  });

  it("rejects when the ownerField value differs from the subject", () => {
    expect(ownsRecord({ authorId: "someone-else" }, { resource: "listing", ownerField: "authorId" }, "user-1")).toBe(
      false,
    );
  });

  it("matches when any field in the ownerFields OR-list equals the subject", () => {
    const scope: AuthScope = { resource: "contract", ownerFields: ["providerId", "beneficiaryId"] };
    expect(ownsRecord({ providerId: "x", beneficiaryId: "user-1" }, scope, "user-1")).toBe(true);
  });

  it("rejects when no ownerFields entry matches", () => {
    const scope: AuthScope = { resource: "contract", ownerFields: ["providerId", "beneficiaryId"] };
    expect(ownsRecord({ providerId: "x", beneficiaryId: "y" }, scope, "user-1")).toBe(false);
  });

  it("matches when the subject is in an ownerArrayField", () => {
    const scope: AuthScope = { resource: "conversation", ownerArrayField: "participants" };
    expect(ownsRecord({ participants: ["a", "user-1", "b"] }, scope, "user-1")).toBe(true);
  });

  it("rejects when the ownerArrayField does not contain the subject", () => {
    const scope: AuthScope = { resource: "conversation", ownerArrayField: "participants" };
    expect(ownsRecord({ participants: ["a", "b"] }, scope, "user-1")).toBe(false);
  });

  it("rejects when the ownerArrayField is present but not an array", () => {
    const scope: AuthScope = { resource: "conversation", ownerArrayField: "participants" };
    expect(ownsRecord({ participants: "user-1" }, scope, "user-1")).toBe(false);
  });

  it("rejects when the scope declares no owner fields at all", () => {
    expect(ownsRecord({ authorId: "user-1" }, { resource: "listing" }, "user-1")).toBe(false);
  });
});

describe("inDistrict", () => {
  it("degrades to false when adminDistrictId is null, even against a matching field", () => {
    const scope: AuthScope = { resource: "incident", districtField: "districtId" };
    expect(inDistrict({ districtId: "district-1" }, scope, null)).toBe(false);
  });

  it("a null adminDistrictId must NOT match a null record field", () => {
    const scope: AuthScope = { resource: "incident", districtField: "districtId" };
    expect(inDistrict({ districtId: null }, scope, null)).toBe(false);
  });

  it("matches when districtField equals adminDistrictId", () => {
    const scope: AuthScope = { resource: "incident", districtField: "districtId" };
    expect(inDistrict({ districtId: "district-1" }, scope, "district-1")).toBe(true);
  });

  it("rejects when districtField differs from adminDistrictId", () => {
    const scope: AuthScope = { resource: "incident", districtField: "districtId" };
    expect(inDistrict({ districtId: "district-2" }, scope, "district-1")).toBe(false);
  });

  it("matches when adminDistrictId is in a districtArrayField", () => {
    const scope: AuthScope = { resource: "vote", districtArrayField: "districtIds" };
    expect(inDistrict({ districtIds: ["district-1", "district-2"] }, scope, "district-1")).toBe(true);
  });

  it("rejects when adminDistrictId is absent from the districtArrayField", () => {
    const scope: AuthScope = { resource: "vote", districtArrayField: "districtIds" };
    expect(inDistrict({ districtIds: ["district-2"] }, scope, "district-1")).toBe(false);
  });

  it("rejects when the record has no district field at all", () => {
    const scope: AuthScope = { resource: "incident", districtField: "districtId" };
    expect(inDistrict({}, scope, "district-1")).toBe(false);
  });

  it("rejects when the districtArrayField is present but not an array", () => {
    const scope: AuthScope = { resource: "vote", districtArrayField: "districtIds" };
    expect(inDistrict({ districtIds: "district-1" }, scope, "district-1")).toBe(false);
  });
});

describe("hasRecordCheck", () => {
  it.each([
    ["ownerField", { resource: "listing", ownerField: "authorId" }],
    ["ownerFields", { resource: "contract", ownerFields: ["providerId"] }],
    ["ownerArrayField", { resource: "conversation", ownerArrayField: "participants" }],
    ["districtField", { resource: "incident", districtField: "districtId" }],
    ["districtArrayField", { resource: "vote", districtArrayField: "districtIds" }],
  ] as const)("is true when %s is set", (_label, scope) => {
    expect(hasRecordCheck(scope as AuthScope)).toBe(true);
  });

  it("is false for a selfParam-only scope (no record is loaded)", () => {
    expect(hasRecordCheck({ resource: "user", selfParam: "id" })).toBe(false);
  });

  it("is false for a bare resource scope", () => {
    expect(hasRecordCheck({ resource: "listing" })).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// Middleware wrapper (audience / role / selfParam / record decision)
// -----------------------------------------------------------------------------

describe("authorize middleware", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("lets a public route through without a user", async () => {
    const { res, captured } = makeRes();
    const next = vi.fn();
    await authorize(makeReq({ policy: { public: true } }), res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(captured.statusCode).toBeUndefined();
  });

  it("401s a non-public route with no authenticated user", async () => {
    const { res, captured } = makeRes();
    const next = vi.fn();
    await authorize(makeReq({ policy: { roles: ["user"] } }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(captured.statusCode).toBe(401);
  });

  it("403s on an audience mismatch", async () => {
    const { res, captured } = makeRes();
    const next = vi.fn();
    await authorize(makeReq({ policy: { audience: "api:internal" }, user: makeUser({ aud: "api" }) }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(captured.statusCode).toBe(403);
    expect(captured.body?.message).toBe("Forbidden");
  });

  it("403s when the caller's role is not allowed", async () => {
    const { res, captured } = makeRes();
    const next = vi.fn();
    await authorize(
      makeReq({ policy: { roles: ["admin"] }, user: makeUser({ role: "user" }), method: "POST" }),
      res,
      next,
    );
    expect(captured.statusCode).toBe(403);
    expect(captured.body?.message).toBe("Insufficient permissions");
  });

  it("lets an allowed role through when there is no scope", async () => {
    const { res, captured } = makeRes();
    const next = vi.fn();
    await authorize(makeReq({ policy: { roles: ["admin"] }, user: makeUser({ role: "admin" }) }), res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(captured.statusCode).toBeUndefined();
  });

  it("readBypassesRoles lets a GET through despite an insufficient role", async () => {
    const { res, captured } = makeRes();
    const next = vi.fn();
    await authorize(
      makeReq({
        policy: { roles: ["admin"], readBypassesRoles: true },
        user: makeUser({ role: "user" }),
        method: "GET",
      }),
      res,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
    expect(captured.statusCode).toBeUndefined();
  });

  it("readBypassesRoles still enforces the role on a non-GET write", async () => {
    const { res, captured } = makeRes();
    const next = vi.fn();
    await authorize(
      makeReq({
        policy: { roles: ["admin"], readBypassesRoles: true },
        user: makeUser({ role: "user" }),
        method: "POST",
      }),
      res,
      next,
    );
    expect(next).not.toHaveBeenCalled();
    expect(captured.statusCode).toBe(403);
  });

  describe("selfParam", () => {
    const policy: AuthPolicy = { scope: { resource: "user", selfParam: "id" } };

    it("lets the subject act on their own id", async () => {
      const { res, captured } = makeRes();
      const next = vi.fn();
      await authorize(makeReq({ policy, user: makeUser({ sub: "user-1" }), params: { id: "user-1" } }), res, next);
      expect(next).toHaveBeenCalledOnce();
      expect(captured.statusCode).toBeUndefined();
    });

    it("403s when the target id does not match the subject", async () => {
      const { res, captured } = makeRes();
      const next = vi.fn();
      await authorize(makeReq({ policy, user: makeUser({ sub: "user-1" }), params: { id: "user-2" } }), res, next);
      expect(next).not.toHaveBeenCalled();
      expect(captured.statusCode).toBe(403);
    });

    it("404s (not 403) on a mismatch when notFoundOnDeny is set", async () => {
      const { res, captured } = makeRes();
      const next = vi.fn();
      const hidden: AuthPolicy = { scope: { resource: "user", selfParam: "id", notFoundOnDeny: true } };
      await authorize(
        makeReq({ policy: hidden, user: makeUser({ sub: "user-1" }), params: { id: "user-2" } }),
        res,
        next,
      );
      expect(captured.statusCode).toBe(404);
      expect(captured.body?.message).toBe("Not found");
    });

    it("a bypassRole may act on someone else's id", async () => {
      const { res, captured } = makeRes();
      const next = vi.fn();
      const withBypass: AuthPolicy = { scope: { resource: "user", selfParam: "id", bypassRoles: ["superAdmin"] } };
      await authorize(
        makeReq({
          policy: withBypass,
          user: makeUser({ sub: "admin-1", role: "superAdmin" }),
          params: { id: "user-2" },
        }),
        res,
        next,
      );
      expect(next).toHaveBeenCalledOnce();
      expect(captured.statusCode).toBeUndefined();
    });
  });

  describe("record-level ownership / district", () => {
    const ownedPolicy: AuthPolicy = { scope: { resource: "listing", ownerField: "authorId" } };

    it("skips the record load on a collection/create route with no id param", async () => {
      const { res, captured } = makeRes();
      const next = vi.fn();
      await authorize(makeReq({ policy: ownedPolicy, user: makeUser(), params: {} }), res, next);
      expect(next).toHaveBeenCalledOnce();
      expect(mockResolve).not.toHaveBeenCalled();
      expect(captured.statusCode).toBeUndefined();
    });

    it("404s when the record does not exist", async () => {
      stubRecord(null);
      const { res, captured } = makeRes();
      const next = vi.fn();
      await authorize(makeReq({ policy: ownedPolicy, user: makeUser(), params: { id: "listing-1" } }), res, next);
      expect(next).not.toHaveBeenCalled();
      expect(captured.statusCode).toBe(404);
    });

    it("allows the owner and hands the loaded record to the handler", async () => {
      stubRecord({ authorId: "user-1", title: "hi" });
      const req = makeReq({ policy: ownedPolicy, user: makeUser({ sub: "user-1" }), params: { id: "listing-1" } });
      const { res, captured } = makeRes();
      const next = vi.fn();
      await authorize(req, res, next);
      expect(next).toHaveBeenCalledOnce();
      expect(captured.statusCode).toBeUndefined();
      expect((req as { authRecord?: unknown }).authRecord).toEqual({ authorId: "user-1", title: "hi" });
    });

    it("403s a non-owner when notFoundOnDeny is not set", async () => {
      stubRecord({ authorId: "someone-else" });
      const { res, captured } = makeRes();
      const next = vi.fn();
      await authorize(
        makeReq({ policy: ownedPolicy, user: makeUser({ sub: "user-1" }), params: { id: "listing-1" } }),
        res,
        next,
      );
      expect(captured.statusCode).toBe(403);
      expect(captured.body?.message).toBe("Forbidden");
    });

    it("404s (info-hiding, not 403) a non-owner when notFoundOnDeny is set", async () => {
      stubRecord({ authorId: "someone-else" });
      const hidden: AuthPolicy = { scope: { resource: "listing", ownerField: "authorId", notFoundOnDeny: true } };
      const { res, captured } = makeRes();
      const next = vi.fn();
      await authorize(
        makeReq({ policy: hidden, user: makeUser({ sub: "user-1" }), params: { id: "listing-1" } }),
        res,
        next,
      );
      expect(captured.statusCode).toBe(404);
      expect(captured.body?.message).toBe("Not found");
    });

    it("a district admin is granted moderation access to a record in their own district", async () => {
      stubRecord({ authorId: "someone-else", districtId: "district-1" });
      const policy: AuthPolicy = {
        scope: { resource: "incident", ownerField: "authorId", districtField: "districtId" },
      };
      const { res, captured } = makeRes();
      const next = vi.fn();
      await authorize(
        makeReq({
          policy,
          user: makeUser({ sub: "admin-1", role: "admin", adminDistrictId: "district-1" }),
          params: { id: "incident-1" },
        }),
        res,
        next,
      );
      expect(next).toHaveBeenCalledOnce();
      expect(captured.statusCode).toBeUndefined();
    });

    it("a district admin is denied on a record in another district", async () => {
      stubRecord({ authorId: "someone-else", districtId: "district-2" });
      const policy: AuthPolicy = {
        scope: { resource: "incident", ownerField: "authorId", districtField: "districtId" },
      };
      const { res, captured } = makeRes();
      const next = vi.fn();
      await authorize(
        makeReq({
          policy,
          user: makeUser({ sub: "admin-1", role: "admin", adminDistrictId: "district-1" }),
          params: { id: "incident-1" },
        }),
        res,
        next,
      );
      expect(next).not.toHaveBeenCalled();
      expect(captured.statusCode).toBe(403);
    });

    it("a bypassRole (superAdmin) is allowed without owning the record", async () => {
      stubRecord({ authorId: "someone-else" });
      const policy: AuthPolicy = {
        scope: { resource: "listing", ownerField: "authorId", bypassRoles: ["superAdmin"] },
      };
      const { res, captured } = makeRes();
      const next = vi.fn();
      await authorize(
        makeReq({ policy, user: makeUser({ sub: "root", role: "superAdmin" }), params: { id: "listing-1" } }),
        res,
        next,
      );
      expect(next).toHaveBeenCalledOnce();
      expect(captured.statusCode).toBeUndefined();
    });

    it("audits a district-grant moderation read of a conversation the admin is not in", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      stubRecord({ participants: ["a", "b"], districtId: "district-1" });
      const policy: AuthPolicy = {
        scope: { resource: "conversation", ownerArrayField: "participants", districtField: "districtId" },
      };
      const { res, captured } = makeRes();
      const next = vi.fn();
      await authorize(
        makeReq({
          policy,
          user: makeUser({ sub: "admin-1", role: "admin", adminDistrictId: "district-1" }),
          params: { id: "conv-1" },
          method: "GET",
        }),
        res,
        next,
      );
      expect(next).toHaveBeenCalledOnce();
      expect(captured.statusCode).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledOnce();
      const logged = JSON.parse((warnSpy.mock.calls[0]![0] as string) ?? "{}");
      expect(logged).toMatchObject({
        event: "moderation.conversation.read",
        actorSub: "admin-1",
        conversationId: "conv-1",
      });
    });

    it("does NOT audit when the caller is a participant (owner, not a district grant)", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      stubRecord({ participants: ["admin-1", "b"], districtId: "district-1" });
      const policy: AuthPolicy = {
        scope: { resource: "conversation", ownerArrayField: "participants", districtField: "districtId" },
      };
      const { res } = makeRes();
      const next = vi.fn();
      await authorize(
        makeReq({
          policy,
          user: makeUser({ sub: "admin-1", role: "admin", adminDistrictId: "district-1" }),
          params: { id: "conv-1" },
          method: "GET",
        }),
        res,
        next,
      );
      expect(next).toHaveBeenCalledOnce();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});

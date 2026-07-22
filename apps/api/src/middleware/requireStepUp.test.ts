import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import type { AppRoute } from "@ts-rest/core";
import type { AuthPolicy } from "@repo/contracts";

// jose is used both here (jwtVerify) and by auth.middleware at module load
// (createRemoteJWKSet). Provide both so importing the middleware doesn't blow up,
// and drive jwtVerify's outcome per test.
vi.mock("jose", () => ({
  createRemoteJWKSet: vi.fn(() => "jwks"),
  jwtVerify: vi.fn(),
}));

// auth.middleware's requireAuth pulls the user repo via resolve; never touched here.
vi.mock("../repositories/container.js", () => ({ resolve: vi.fn() }));

import { jwtVerify } from "jose";
import { requireStepUp } from "./requireStepUp.js";
import type { AuthUser } from "./auth.middleware.js";

const jwtVerifyMock = vi.mocked(jwtVerify);

const makeRes = () => {
  const captured: { statusCode?: number; body?: { message?: string; code?: string } } = {};
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(payload: { message?: string; code?: string }) {
      captured.body = payload;
      return this;
    },
  };
  return { res: res as unknown as Response, captured };
};

const makeReq = (opts: {
  policy?: AuthPolicy;
  user?: Partial<AuthUser>;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}): Request => {
  const route = opts.policy ? ({ metadata: { auth: opts.policy } } as unknown as AppRoute) : undefined;
  return {
    tsRestRoute: route,
    user: opts.user ? ({ sub: "user-1", role: "user", aud: "api", ...opts.user } as AuthUser) : { sub: "user-1" },
    body: opts.body ?? {},
    headers: opts.headers ?? {},
  } as unknown as Request;
};

const validPayload = { payload: { sub: "user-1" } } as unknown as Awaited<ReturnType<typeof jwtVerify>>;

describe("requireStepUp", () => {
  const prevEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "production";
    jwtVerifyMock.mockResolvedValue(validPayload);
  });

  afterEach(() => {
    process.env.NODE_ENV = prevEnv;
  });

  it("passes through when the route declares no step-up policy", async () => {
    const next = vi.fn();
    const { res, captured } = makeRes();
    await requireStepUp(makeReq({ policy: { audience: "api" } }), res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(captured.statusCode).toBeUndefined();
  });

  it("an 'always' route with no token is rejected 401 step_up_required", async () => {
    const next = vi.fn();
    const { res, captured } = makeRes();
    await requireStepUp(makeReq({ policy: { stepUp: { always: true } } }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(captured.statusCode).toBe(401);
    expect(captured.body?.code).toBe("step_up_required");
  });

  it("an 'always' route with a valid matching token passes", async () => {
    const next = vi.fn();
    const { res } = makeRes();
    await requireStepUp(
      makeReq({ policy: { stepUp: { always: true } }, headers: { "x-step-up-token": "good.jwt" } }),
      res,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects a token whose subject does not match the caller", async () => {
    jwtVerifyMock.mockResolvedValue({ payload: { sub: "someone-else" } } as unknown as Awaited<
      ReturnType<typeof jwtVerify>
    >);
    const next = vi.fn();
    const { res, captured } = makeRes();
    await requireStepUp(
      makeReq({ policy: { stepUp: { always: true } }, headers: { "x-step-up-token": "good.jwt" } }),
      res,
      next,
    );
    expect(next).not.toHaveBeenCalled();
    expect(captured.statusCode).toBe(401);
    expect(captured.body?.code).toBe("step_up_required");
  });

  it("rejects an unverifiable / expired token", async () => {
    jwtVerifyMock.mockRejectedValue(new Error("expired"));
    const next = vi.fn();
    const { res, captured } = makeRes();
    await requireStepUp(
      makeReq({ policy: { stepUp: { always: true } }, headers: { "x-step-up-token": "expired.jwt" } }),
      res,
      next,
    );
    expect(next).not.toHaveBeenCalled();
    expect(captured.statusCode).toBe(401);
  });

  it("whenBodyTouches: requires step-up only when the body sets a listed field", async () => {
    const policy: AuthPolicy = { stepUp: { whenBodyTouches: ["email", "address", "newPassword"] } };

    // Body touches only a non-sensitive field → no step-up needed.
    const next1 = vi.fn();
    const { res: res1, captured: cap1 } = makeRes();
    await requireStepUp(makeReq({ policy, body: { firstName: "Jo" } }), res1, next1);
    expect(next1).toHaveBeenCalledOnce();
    expect(cap1.statusCode).toBeUndefined();

    // Body touches a sensitive field with no token → rejected.
    const next2 = vi.fn();
    const { res: res2, captured: cap2 } = makeRes();
    await requireStepUp(makeReq({ policy, body: { email: "new@example.com" } }), res2, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(cap2.statusCode).toBe(401);
  });

  it("dev bypass: outside production a sensitive op never requires step-up", async () => {
    process.env.NODE_ENV = "development";
    const next = vi.fn();
    const { res, captured } = makeRes();
    await requireStepUp(makeReq({ policy: { stepUp: { always: true } } }), res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(captured.statusCode).toBeUndefined();
  });
});

import { initServer } from "@ts-rest/express";
import { usersContract } from "@repo/contracts";
import type { UserResponseDto } from "@repo/contracts";
import type { User } from "../../entities/user.entity.js";
import { resolve } from "../../repositories/container.js";
import { resolveListDistrictScope } from "../../middleware/district-scope.js";
import { documensoService } from "../../services/documenso.service.js";
import { getUsersUseCase } from "../../use-cases/users/get-users.use-case.js";
import { getUserByIdUseCase } from "../../use-cases/users/get-user-by-id.use-case.js";
import { createUserUseCase } from "../../use-cases/users/create-user.use-case.js";
import { updateUserUseCase } from "../../use-cases/users/update-user.use-case.js";
import { banUserUseCase } from "../../use-cases/users/ban-user.use-case.js";
import { deleteUserUseCase, CannotDeleteSuperAdminError } from "../../use-cases/users/delete-user.use-case.js";
import { exportUserDataUseCase } from "../../use-cases/users/export-user-data.use-case.js";

// Strip secrets (password hash + TOTP secret) from user responses.
const toDto = ({ passwordHash: _passwordHash, totpSecret: _totpSecret, ...rest }: User): UserResponseDto => rest;

// Cross-service read for the GDPR export: the api owns no auth data, so it asks
// auth-service for this user's refresh-token session history (IP/UA/timestamps).
// Best-effort — the export must still succeed if auth-service is unreachable.
const fetchUserSessions = async (userId: string): Promise<unknown[]> => {
  try {
    const authServiceUrl = process.env.AUTH_SERVICE_URL ?? "http://localhost:3001";
    const res = await fetch(`${authServiceUrl}/internal/sessions/export`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-token": process.env.INTERNAL_SERVICE_TOKEN ?? "",
      },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      console.error(`auth-service session export failed for user ${userId}: HTTP ${res.status}`);
      return [];
    }
    const body = (await res.json()) as { sessions?: unknown[] };
    return body.sessions ?? [];
  } catch (err) {
    console.error(`auth-service session export errored for user ${userId}:`, err);
    return [];
  }
};

const s = initServer();

export const usersRouter = s.router(usersContract, {
  getUsers: async ({ query: { page, limit, search, districtId, role }, req }) => {
    const scope = resolveListDistrictScope(req.user!, districtId);
    if ("empty" in scope) {
      return { status: 200, body: { data: [], total: 0, page, limit } };
    }
    const result = await getUsersUseCase(resolve("user"))({ search, districtId: scope.districtId, role, page, limit });
    return { status: 200, body: { ...result, data: result.data.map(toDto) } };
  },

  getUserById: async ({ params: { id } }) => {
    const user = await getUserByIdUseCase(resolve("user"))({ id });
    if (!user) {
      return { status: 404, body: { message: "User not found" } };
    }
    return { status: 200, body: toDto(user) };
  },

  exportUserData: async ({ params: { id } }) => {
    // Route scope (selfParam:"id") already restricts this to the caller's own id.
    const data = await exportUserDataUseCase({
      userRepository: resolve("user"),
      listingRepository: resolve("listing"),
      contractRepository: resolve("contract"),
      transactionRepository: resolve("transaction"),
      eventRepository: resolve("event"),
      voteRepository: resolve("vote"),
      incidentRepository: resolve("incident"),
      conversationRepository: resolve("conversation"),
      notificationRepository: resolve("notification"),
      graphRepository: resolve("graph"),
      fetchSessions: fetchUserSessions,
    })({ id });
    if (!data) {
      return { status: 404, body: { message: "User not found" } };
    }
    return { status: 200, body: data };
  },

  createUser: async ({ body }) => {
    const newUser = await createUserUseCase(resolve("user"), resolve("district"), resolve("graph"))({ ...body });
    return { status: 201, body: toDto(newUser) };
  },

  updateUser: async ({ params: { id }, body }) => {
    const result = await updateUserUseCase(resolve("user"), resolve("graph"))(id, body);
    if (result.kind === "not-found") {
      return { status: 404, body: { message: "User not found" } };
    }
    if (result.kind === "wrong-password") {
      return { status: 401, body: { message: "Current password is incorrect" } };
    }
    return { status: 200, body: toDto(result.user) };
  },

  banUser: async ({ params: { id }, body: { banned } }) => {
    const result = await banUserUseCase(resolve("user"))(id, banned);
    if (result.kind === "not-found") {
      return { status: 404, body: { message: "User not found" } };
    }
    if (result.kind === "forbidden") {
      return { status: 403, body: { message: "Only regular users can be banned" } };
    }
    return { status: 200, body: toDto(result.user) };
  },

  deleteUser: async ({ params: { id } }) => {
    // Route scope already restricts this to the caller's own id; the use-case adds the
    // superAdmin guardrail. Graph projection cleanup (DETACH DELETE) happens in the use-case.
    try {
      const deleted = await deleteUserUseCase({
        userRepository: resolve("user"),
        graphRepository: resolve("graph"),
        conversationRepository: resolve("conversation"),
        voteRepository: resolve("vote"),
        notificationRepository: resolve("notification"),
        listingRepository: resolve("listing"),
        eventRepository: resolve("event"),
        incidentRepository: resolve("incident"),
        transactionRepository: resolve("transaction"),
        contractRepository: resolve("contract"),
        documenso: documensoService,
      })({ id });
      if (!deleted) {
        return { status: 404, body: { message: "User not found" } };
      }
      return { status: 204, body: undefined };
    } catch (err) {
      if (err instanceof CannotDeleteSuperAdminError) {
        return { status: 403, body: { message: err.message } };
      }
      throw err;
    }
  },
});

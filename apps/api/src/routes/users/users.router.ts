/**
 * Router ts-rest des utilisateurs.
 *
 * Couche router : CRUD users, gestion d'appartenance à un quartier (rejoindre,
 * créer le sien, se faire exclure), modération (ban), export RGPD et suppression
 * de compte (droit à l'effacement, Art. 17). Chaque réponse passe par `toDto`
 * pour ne jamais fuiter les secrets. Toute la logique métier vit dans les cas
 * d'usage ; ce fichier ne fait que router + mapper les résultats en codes HTTP.
 */
import { initServer } from "@ts-rest/express";
import { logger } from "@repo/shared";
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
import { kickFromDistrictUseCase } from "../../use-cases/users/kick-from-district.use-case.js";
import { resolveMyDistrictUseCase } from "../../use-cases/users/resolve-my-district.use-case.js";
import { createOwnDistrictUseCase } from "../../use-cases/districts/create-own-district.use-case.js";
import { seedDefaultTagsUseCase } from "../../use-cases/tags/seed-default-tags.use-case.js";
import type { MembershipDeps } from "../../use-cases/users/district-membership.use-case.js";
import { deleteUserUseCase, CannotDeleteSuperAdminError } from "../../use-cases/users/delete-user.use-case.js";
import { exportUserDataUseCase } from "../../use-cases/users/export-user-data.use-case.js";

// Retire les secrets (hash du mot de passe + secret TOTP) des réponses user.
const toDto = ({ passwordHash: _passwordHash, totpSecret: _totpSecret, ...rest }: User): UserResponseDto => rest;

/**
 * Lecture cross-service pour l'export RGPD : l'api ne détient aucune donnée d'auth,
 * elle demande donc à l'auth-service l'historique des sessions (refresh tokens :
 * IP / user-agent / timestamps) de ce user. Authentifié par `x-internal-token`.
 *
 * Best-effort : l'export doit réussir même si l'auth-service est injoignable — en
 * cas d'échec on log et on renvoie un tableau vide.
 */
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
      logger.error({ userId, status: res.status }, "auth-service session export failed");
      return [];
    }
    const body = (await res.json()) as { sessions?: unknown[] };
    return body.sessions ?? [];
  } catch (err) {
    logger.error({ err, userId }, "auth-service session export errored");
    return [];
  }
};

const s = initServer();

// Dépendances partagées par les cas d'usage d'appartenance à un quartier
// (rejoindre / créer / quitter) : un mouvement touche l'user, son ledger de
// points, le quartier et la projection graphe.
const membershipDeps = (): MembershipDeps => ({
  userRepository: resolve("user"),
  transactionRepository: resolve("transaction"),
  districtRepository: resolve("district"),
  graphRepository: resolve("graph"),
});

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
    // Le scope de route (selfParam:"id") restreint déjà l'accès au propre id de l'appelant.
    // Agrège toutes les données personnelles réparties dans les repositories (export RGPD).
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
    const newUser = await createUserUseCase(
      resolve("user"),
      resolve("district"),
      resolve("graph"),
      resolve("transaction"),
    )({ ...body });
    return { status: 201, body: toDto(newUser) };
  },

  updateUser: async ({ params: { id }, body }) => {
    const result = await updateUserUseCase(
      resolve("user"),
      resolve("graph"),
      resolve("district"),
      resolve("transaction"),
    )(id, body);
    if (result.kind === "not-found") {
      return { status: 404, body: { message: "User not found" } };
    }
    if (result.kind === "wrong-password") {
      return { status: 401, body: { message: "Current password is incorrect" } };
    }
    if (result.kind === "email-conflict") {
      return { status: 409, body: { message: "This email address is already in use" } };
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

  kickFromDistrict: async ({ params: { id } }) => {
    const result = await kickFromDistrictUseCase(membershipDeps())(id);
    if (result.kind === "not-found") {
      return { status: 404, body: { message: "User not found" } };
    }
    if (result.kind === "forbidden") {
      return { status: 403, body: { message: "Only regular users can be kicked from a district" } };
    }
    return { status: 200, body: toDto(result.user) };
  },

  resolveMyDistrict: async ({ body, req }) => {
    const result = await resolveMyDistrictUseCase(membershipDeps())(req.user!.sub, body.districtId);
    return {
      status: 200,
      body: {
        resolved: result.resolved,
        candidates: result.candidates.map((d) => ({ id: d.id, name: d.name })),
      },
    };
  },

  createOwnDistrict: async ({ req }) => {
    const result = await createOwnDistrictUseCase({
      userRepository: resolve("user"),
      districtRepository: resolve("district"),
      graphRepository: resolve("graph"),
      transactionRepository: resolve("transaction"),
      districtAdminRepository: resolve("districtAdmin"),
    })(req.user!.sub);
    if (result.kind === "forbidden") {
      return { status: 409, body: { message: "You already have a district or aren't eligible to create one." } };
    }
    if (result.kind === "geocode-failed") {
      return { status: 409, body: { message: "We couldn't locate your address — update it and try again." } };
    }
    // Injecte le jeu de tags par défaut sur le nouveau quartier, comme createDistrict.
    await seedDefaultTagsUseCase(resolve("tag"))(result.district.id);
    return { status: 201, body: result.district };
  },

  deleteUser: async ({ params: { id } }) => {
    // Le scope de route restreint déjà à l'id de l'appelant ; le cas d'usage ajoute
    // le garde-fou superAdmin (impossible de supprimer un superAdmin). Le nettoyage
    // de la projection graphe (DETACH DELETE) se fait dans le cas d'usage.
    try {
      const result = await deleteUserUseCase({
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
      if (result.kind === "not-found") {
        return { status: 404, body: { message: "User not found" } };
      }
      if (result.kind === "sessions-purge-failed") {
        // Données du compte effacées localement, mais la purge des sessions côté
        // auth-service a échoué → effacement partiel. On remonte un 5xx pour que
        // l'appelant réessaie (RGPD Art. 17).
        return {
          status: 502,
          body: { message: "Account data erased, but session cleanup did not complete — please retry." },
        };
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

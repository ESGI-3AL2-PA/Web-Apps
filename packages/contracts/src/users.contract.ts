import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  BadGatewayErrorSchema,
  BanUserDtoSchema,
  ConflictErrorSchema,
  CreateUserDtoSchema,
  DistrictResponseDtoSchema,
  ForbiddenErrorSchema,
  NotFoundErrorSchema,
  ResolveDistrictRequestDtoSchema,
  ResolveDistrictResponseDtoSchema,
  UnauthorizedErrorSchema,
  UpdateUserDtoSchema,
  UserParamsDtoSchema,
  UserQueryDtoSchema,
  UserResponseDtoSchema,
  UserDataExportResponseDtoSchema,
  PaginatedResponseDtoSchema,
} from "./DTO";
import { auth } from "./auth-meta";

const c = initContract();

/**
 * Contract ts-rest des utilisateurs.
 *
 * Couvre le CRUD utilisateur ainsi que des actions métier : modération (ban,
 * exclusion d'un quartier), conformité RGPD (export et suppression de compte),
 * et onboarding par quartier (résolution/adhésion et création de son propre
 * quartier). Les routes sensibles (identité, suppression, transaction) exigent
 * une revérification step-up TOTP. La création (createUser) est réservée au
 * token de service interne émis par l'auth-service.
 */
export const usersContract = c.router({
  // GET /users — liste paginée des utilisateurs. Admin/superAdmin uniquement.
  getUsers: {
    method: "GET",
    path: "/users",
    query: UserQueryDtoSchema,
    responses: {
      200: PaginatedResponseDtoSchema(UserResponseDtoSchema),
    },
    summary: "Get a paginated list of users",
    metadata: auth({ audience: "api", roles: ["admin", "superAdmin"] }),
  },

  // GET /users/:id — un utilisateur par son id. Lui-même (selfParam) ou admin (bypass superAdmin).
  getUserById: {
    method: "GET",
    path: "/users/:id",
    pathParams: UserParamsDtoSchema,
    responses: {
      200: UserResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Get a single user by ID (self or admin)",
    metadata: auth({
      audience: "api",
      scope: { resource: "user", selfParam: "id", bypassRoles: ["superAdmin"] },
    }),
  },

  // GET /users/:id/export — export RGPD complet des données personnelles. Soi-même uniquement.
  exportUserData: {
    method: "GET",
    path: "/users/:id/export",
    pathParams: UserParamsDtoSchema,
    responses: {
      200: UserDataExportResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    // RGPD Art. 15/20 : export serveur canonique de TOUTES les données personnelles de l'appelant
    // en un seul appel authentifié. Strictement limité à soi (selfParam:"id", AUCUN bypass admin —
    // cet export livre messages privés/sessions ; un admin n'a pas à tirer l'export complet d'un
    // autre utilisateur ici). notFoundOnDeny masque l'existence des autres utilisateurs.
    summary: "Export all of your personal data as a single JSON document (self only).",
    metadata: auth({
      audience: "api",
      scope: { resource: "user", selfParam: "id", notFoundOnDeny: true },
    }),
  },

  // POST /users — crée un utilisateur. Token de service interne uniquement (appelé par l'auth-service au register).
  createUser: {
    method: "POST",
    path: "/users",
    body: CreateUserDtoSchema,
    responses: {
      201: UserResponseDtoSchema,
    },
    summary: "Create a new user (internal service token only)",
    metadata: auth({ audience: "api:internal", roles: ["service"] }),
  },

  updateUser: {
    method: "PATCH",
    path: "/users/:id",
    pathParams: UserParamsDtoSchema,
    body: UpdateUserDtoSchema,
    responses: {
      200: UserResponseDtoSchema,
      401: UnauthorizedErrorSchema,
      404: NotFoundErrorSchema,
      409: ConflictErrorSchema,
    },
    summary: "Partially update a user (self or admin)",
    // PATCH /users/:id — mise à jour partielle. Soi-même (selfParam) ou admin (bypass superAdmin).
    metadata: auth({
      audience: "api",
      scope: { resource: "user", selfParam: "id", bypassRoles: ["superAdmin"] },
      // Les champs d'identité/récupération et de changement de quartier exigent un step-up TOTP frais en production.
      stepUp: { whenBodyTouches: ["email", "address", "newPassword"] },
    }),
  },

  // PATCH /users/:id/ban — bannit/débannit un utilisateur ordinaire. Admin limité à son quartier ; superAdmin n'importe lequel.
  banUser: {
    method: "PATCH",
    path: "/users/:id/ban",
    pathParams: UserParamsDtoSchema,
    body: BanUserDtoSchema,
    responses: {
      200: UserResponseDtoSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Ban or unban a regular user. Admins are scoped to their district; superAdmin any.",
    metadata: auth({
      audience: "api",
      roles: ["admin", "superAdmin"],
      scope: { resource: "user", districtField: "districtId", bypassRoles: ["superAdmin"] },
    }),
  },

  // POST /users/:id/kick — exclut un utilisateur ordinaire de son quartier. Admin limité à son quartier ; superAdmin n'importe lequel.
  kickFromDistrict: {
    method: "POST",
    path: "/users/:id/kick",
    pathParams: UserParamsDtoSchema,
    body: c.noBody(),
    responses: {
      200: UserResponseDtoSchema,
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
    },
    // Distinct du ban : retire un utilisateur ordinaire de son quartier et redistribue son solde
    // aux membres restants. Ne met PAS `banned`. Admins limités à leur quartier ; superAdmin
    // n'importe lequel (même politique que banUser).
    summary: "Kick a regular user from their district, redistributing their points to the remaining members.",
    metadata: auth({
      audience: "api",
      roles: ["admin", "superAdmin"],
      scope: { resource: "user", districtField: "districtId", bypassRoles: ["superAdmin"] },
    }),
  },

  // POST /users/me/resolve-district — résout et rejoint le quartier contenant son adresse. Soi-même.
  resolveMyDistrict: {
    method: "POST",
    path: "/users/me/resolve-district",
    body: ResolveDistrictRequestDtoSchema,
    responses: {
      200: ResolveDistrictResponseDtoSchema,
    },
    // Re-géocode l'adresse enregistrée de l'appelant et, si exactement un quartier le contient
    // (ou s'il en choisit un parmi plusieurs via body.districtId) et qu'il est sans quartier, l'y
    // fait adhérer (en lui octroyant les points de départ). Utilisé par l'affordance d'onboarding
    // « revérifier » / sélecteur de quartier. Tout utilisateur authentifié, limité à son propre sub.
    summary: "Resolve and join the district containing your address (self).",
    metadata: auth({ audience: "api" }),
  },

  // POST /users/me/district — crée son propre quartier depuis son adresse et en devient l'admin. Soi-même.
  createOwnDistrict: {
    method: "POST",
    path: "/users/me/district",
    body: c.noBody(),
    responses: {
      201: DistrictResponseDtoSchema,
      // A déjà un quartier / n'est pas un utilisateur ordinaire, ou l'adresse n'a pas pu être géocodée.
      409: ConflictErrorSchema,
    },
    // Onboarding en self-service : un utilisateur sans quartier crée un quartier actif sur son
    // adresse géocodée (boîte englobante provisoire + nom temporaire) et est promu son admin.
    // Le client le redirige ensuite dans l'app admin pour l'affiner. Le cas d'usage vérifie
    // role==="user" && absence de districtId.
    summary: "Create your own district from your address and become its admin (self).",
    metadata: auth({ audience: "api" }),
  },

  deleteUser: {
    method: "DELETE",
    path: "/users/:id",
    pathParams: UserParamsDtoSchema,
    body: c.noBody(),
    responses: {
      204: z.undefined(),
      403: ForbiddenErrorSchema,
      404: NotFoundErrorSchema,
      // Les données du compte ont été effacées localement mais une dépendance aval (purge des
      // sessions côté auth-service) n'a pas abouti — l'effacement n'est que partiel. Remonté au
      // lieu d'un faux 204 pour que l'appelant sache qu'il faut réessayer (RGPD Art. 17).
      502: BadGatewayErrorSchema,
    },
    // DELETE /users/:id — suppression de compte en self-service (effacement RGPD) : un utilisateur ne peut
    // supprimer QUE son propre compte — selfParam:"id", pas de bypass superAdmin (les admins ne peuvent pas
    // supprimer autrui par cette route ; le bannissement est l'outil de modération). Les comptes superAdmin
    // sont protégés par un garde-fou du cas d'usage. notFoundOnDeny masque l'existence d'autrui (404 et non 403).
    summary: "Delete your own account. superAdmin accounts cannot be deleted.",
    metadata: auth({
      audience: "api",
      scope: { resource: "user", selfParam: "id", notFoundOnDeny: true },
      stepUp: { always: true },
    }),
  },
});

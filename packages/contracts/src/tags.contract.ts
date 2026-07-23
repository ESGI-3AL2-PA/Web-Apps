import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  CreateTagDtoSchema,
  TagParamsDtoSchema,
  TagQueryDtoSchema,
  TagResponseDtoSchema,
  UpdateTagDtoSchema,
  NotFoundErrorSchema,
  BadRequestErrorSchema,
  ConflictErrorSchema,
  PaginatedResponseDtoSchema,
} from "./DTO";
import { auth } from "./auth-meta";

const c = initContract();

/**
 * Contract ts-rest des tags.
 *
 * Les lectures sont ouvertes à tout utilisateur authentifié. La création, la
 * mise à jour et la suppression sont réservées aux admins ; les modifications
 * sont en outre limitées au quartier du tag (bypass superAdmin).
 */
export const tagsContract = c.router({
  // GET /tags — liste paginée des tags. Tout utilisateur authentifié.
  getTags: {
    method: "GET",
    path: "/tags",
    query: TagQueryDtoSchema,
    responses: {
      200: PaginatedResponseDtoSchema(TagResponseDtoSchema),
    },
    summary: "Get a paginated list of tags",
    metadata: auth({ audience: "api" }),
  },

  getTagById: {
    method: "GET",
    path: "/tags/:id",
    pathParams: TagParamsDtoSchema,
    responses: {
      200: TagResponseDtoSchema,
      404: NotFoundErrorSchema,
    },
    summary: "Get a single tag by ID",
    // GET /tags/:id — un tag par son id. Tout utilisateur authentifié.
    // Les lectures sont ouvertes : la liste des tags (getTags) n'est pas restreinte par quartier,
    // donc limiter la lecture d'un tag isolé au quartier ne produisait qu'un 403 pour tout non-admin
    // (dont l'adminDistrictId est null), sans aucun bénéfice de sécurité.
    metadata: auth({ audience: "api" }),
  },

  // POST /tags — crée un tag. Admin uniquement.
  createTag: {
    method: "POST",
    path: "/tags",
    body: CreateTagDtoSchema,
    responses: {
      201: TagResponseDtoSchema,
      400: BadRequestErrorSchema,
      409: ConflictErrorSchema,
    },
    summary: "Create a new tag (admin only)",
    metadata: auth({ audience: "api", roles: ["admin", "superAdmin"] }),
  },

  // PATCH /tags/:id — mise à jour partielle. Admin du quartier du tag (bypass superAdmin).
  updateTag: {
    method: "PATCH",
    path: "/tags/:id",
    pathParams: TagParamsDtoSchema,
    body: UpdateTagDtoSchema,
    responses: {
      200: TagResponseDtoSchema,
      404: NotFoundErrorSchema,
      409: ConflictErrorSchema,
    },
    summary: "Partially update a tag (admin only)",
    metadata: auth({
      audience: "api",
      roles: ["admin", "superAdmin"],
      scope: {
        resource: "tag",
        districtField: "districtId",
        bypassRoles: ["superAdmin"],
      },
    }),
  },

  // DELETE /tags/:id — supprime un tag. Admin du quartier du tag (bypass superAdmin).
  deleteTag: {
    method: "DELETE",
    path: "/tags/:id",
    pathParams: TagParamsDtoSchema,
    body: c.noBody(),
    responses: {
      204: z.undefined(),
      404: NotFoundErrorSchema,
    },
    summary: "Delete a tag (admin only)",
    metadata: auth({
      audience: "api",
      roles: ["admin", "superAdmin"],
      scope: {
        resource: "tag",
        districtField: "districtId",
        bypassRoles: ["superAdmin"],
      },
    }),
  },
});

import { initServer } from "@ts-rest/express";
import { districtsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import { getDistrictsUseCase } from "../../use-cases/districts/get-districts.use-case.js";
import { getDistrictByIdUseCase } from "../../use-cases/districts/get-district-by-id.use-case.js";
import { createDistrictUseCase } from "../../use-cases/districts/create-district.use-case.js";
import { seedDefaultTagsUseCase } from "../../use-cases/tags/seed-default-tags.use-case.js";
import { updateDistrictUseCase } from "../../use-cases/districts/update-district.use-case.js";
import { deleteDistrictUseCase } from "../../use-cases/districts/delete-district.use-case.js";

const s = initServer();

/**
 * Router ts-rest des quartiers (l'unité territoriale racine : chaque annonce,
 * événement, signalement et utilisateur appartient à un quartier). Un quartier porte
 * une frontière géographique ; la modifier ne doit pas laisser de membres au-dehors.
 */

// Message 409 lisible lorsqu'une frontière laisserait des membres actuels en dehors.
const membersOutsideMessage = (outside: { id: string }[]): string =>
  `${outside.length} member(s) fall outside this boundary — kick or reassign them first.`;

export const districtsRouter = s.router(districtsContract, {
  // GET /districts — liste paginée (recherche par nom).
  getDistricts: async ({ query: { page, limit, search } }) => {
    const result = await getDistrictsUseCase(resolve("district"))({ search, page, limit });
    return { status: 200, body: result };
  },

  // GET /districts/:id — détail d'un quartier.
  getDistrictById: async ({ params: { id } }) => {
    const district = await getDistrictByIdUseCase(resolve("district"))({ id });
    if (!district) {
      return { status: 404, body: { message: "District not found" } };
    }
    return { status: 200, body: district };
  },

  // POST /districts — crée un quartier, puis amorce ses tags par défaut (seed).
  createDistrict: async ({ body }) => {
    const result = await createDistrictUseCase(resolve("district"), resolve("graph"), resolve("user"))(body);
    if (result.kind === "members-outside") {
      return { status: 409, body: { message: membersOutsideMessage(result.outside) } };
    }
    await seedDefaultTagsUseCase(resolve("tag"))(result.district.id);
    return { status: 201, body: result.district };
  },

  // PATCH /districts/:id — met à jour un quartier (dont sa frontière). 409 si la
  // nouvelle frontière exclut des membres existants.
  updateDistrict: async ({ params: { id }, body }) => {
    const result = await updateDistrictUseCase(resolve("district"), resolve("graph"), resolve("user"))(id, body);
    if (result.kind === "not-found") {
      return { status: 404, body: { message: "District not found" } };
    }
    if (result.kind === "members-outside") {
      return { status: 409, body: { message: membersOutsideMessage(result.outside) } };
    }
    return { status: 200, body: result.district };
  },

  // DELETE /districts/:id — supprime un quartier (et son nœud dans le graphe).
  deleteDistrict: async ({ params: { id } }) => {
    const deleted = await deleteDistrictUseCase(resolve("district"), resolve("graph"))({ id });
    if (!deleted) {
      return { status: 404, body: { message: "District not found" } };
    }
    return { status: 204, body: undefined };
  },
});

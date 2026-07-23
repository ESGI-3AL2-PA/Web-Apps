import { initServer } from "@ts-rest/express";
import { districtAdminsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import { listDistrictAdminsUseCase } from "../../use-cases/district-admins/list-district-admins.use-case.js";
import { getDistrictAdminUseCase } from "../../use-cases/district-admins/get-district-admin.use-case.js";
import {
  createDistrictAdminUseCase,
  DistrictAdminAlreadyExistsError,
} from "../../use-cases/district-admins/create-district-admin.use-case.js";
import { deleteDistrictAdminUseCase } from "../../use-cases/district-admins/delete-district-admin.use-case.js";
import type { MembershipDeps } from "../../use-cases/users/district-membership.use-case.js";

const s = initServer();

/**
 * Router ts-rest des affectations d'administrateur de quartier (qui gère quel
 * quartier). La promotion peut au passage rattacher l'utilisateur au quartier et
 * lui créditer ses points de bienvenue.
 */

// Dépendances pour le rattachement + crédit que la promotion effectue quand un
// utilisateur sans quartier devient administrateur de quartier (cf. createDistrictAdminUseCase).
const membershipDeps = (): MembershipDeps => ({
  userRepository: resolve("user"),
  transactionRepository: resolve("transaction"),
  districtRepository: resolve("district"),
  graphRepository: resolve("graph"),
});

export const districtAdminsRouter = s.router(districtAdminsContract, {
  // GET /district-admins — liste paginée des affectations (filtrable par quartier/utilisateur).
  getDistrictAdmins: async ({ query: { page, limit, districtId, userId } }) => {
    const result = await listDistrictAdminsUseCase(resolve("districtAdmin"))({
      districtId,
      userId,
      page,
      limit,
    });
    return { status: 200, body: result };
  },

  // GET /district-admins/:id — détail d'une affectation.
  getDistrictAdminById: async ({ params: { id } }) => {
    const row = await getDistrictAdminUseCase(resolve("districtAdmin"))({ id });
    if (!row) {
      return { status: 404, body: { message: "District-admin assignment not found" } };
    }
    return { status: 200, body: row };
  },

  // POST /district-admins — promeut un utilisateur administrateur d'un quartier.
  createDistrictAdmin: async ({ body }) => {
    try {
      const created = await createDistrictAdminUseCase(resolve("districtAdmin"), membershipDeps())(body);
      return { status: 201, body: created };
    } catch (err) {
      // Cet utilisateur est déjà administrateur de ce quartier.
      if (err instanceof DistrictAdminAlreadyExistsError) {
        return { status: 409, body: { message: err.message } };
      }
      throw err;
    }
  },

  // DELETE /district-admins/:id — révoque une affectation d'administrateur de quartier.
  deleteDistrictAdmin: async ({ params: { id } }) => {
    const deleted = await deleteDistrictAdminUseCase(resolve("districtAdmin"), resolve("user"))({ id });
    if (!deleted) {
      return { status: 404, body: { message: "District-admin assignment not found" } };
    }
    return { status: 204, body: undefined };
  },
});

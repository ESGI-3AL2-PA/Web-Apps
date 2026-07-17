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

// Deps for the join+grant the promotion performs when a district-less user becomes
// a district admin (see createDistrictAdminUseCase).
const membershipDeps = (): MembershipDeps => ({
  userRepository: resolve("user"),
  transactionRepository: resolve("transaction"),
  districtRepository: resolve("district"),
  graphRepository: resolve("graph"),
});

export const districtAdminsRouter = s.router(districtAdminsContract, {
  getDistrictAdmins: async ({ query: { page, limit, districtId, userId } }) => {
    const result = await listDistrictAdminsUseCase(resolve("districtAdmin"))({
      districtId,
      userId,
      page,
      limit,
    });
    return { status: 200, body: result };
  },

  getDistrictAdminById: async ({ params: { id } }) => {
    const row = await getDistrictAdminUseCase(resolve("districtAdmin"))({ id });
    if (!row) {
      return { status: 404, body: { message: "District-admin assignment not found" } };
    }
    return { status: 200, body: row };
  },

  createDistrictAdmin: async ({ body }) => {
    try {
      const created = await createDistrictAdminUseCase(resolve("districtAdmin"), membershipDeps())(body);
      return { status: 201, body: created };
    } catch (err) {
      if (err instanceof DistrictAdminAlreadyExistsError) {
        return { status: 409, body: { message: err.message } };
      }
      throw err;
    }
  },

  deleteDistrictAdmin: async ({ params: { id } }) => {
    const deleted = await deleteDistrictAdminUseCase(resolve("districtAdmin"), resolve("user"))({ id });
    if (!deleted) {
      return { status: 404, body: { message: "District-admin assignment not found" } };
    }
    return { status: 204, body: undefined };
  },
});

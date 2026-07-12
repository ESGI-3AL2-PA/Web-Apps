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

export const districtsRouter = s.router(districtsContract, {
  getDistricts: async ({ query: { page, limit, search } }) => {
    const result = await getDistrictsUseCase(resolve("district"))({ search, page, limit });
    return { status: 200, body: result };
  },

  getDistrictById: async ({ params: { id } }) => {
    const district = await getDistrictByIdUseCase(resolve("district"))({ id });
    if (!district) {
      return { status: 404, body: { message: "District not found" } };
    }
    return { status: 200, body: district };
  },

  createDistrict: async ({ body }) => {
    const newDistrict = await createDistrictUseCase(resolve("district"), resolve("graph"))(body);
    await seedDefaultTagsUseCase(resolve("tag"))(newDistrict.id);
    return { status: 201, body: newDistrict };
  },

  updateDistrict: async ({ params: { id }, body }) => {
    const district = await updateDistrictUseCase(resolve("district"), resolve("graph"))(id, body);
    if (!district) {
      return { status: 404, body: { message: "District not found" } };
    }
    return { status: 200, body: district };
  },

  deleteDistrict: async ({ params: { id } }) => {
    const deleted = await deleteDistrictUseCase(resolve("district"), resolve("graph"))({ id });
    if (!deleted) {
      return { status: 404, body: { message: "District not found" } };
    }
    return { status: 204, body: undefined };
  },
});

import { initServer } from "@ts-rest/express";
import { tagsContract } from "@repo/contracts";
import { resolve } from "../../repositories/container.js";
import { getTagsUseCase } from "../../use-cases/tags/get-tags.use-case.js";
import { getTagByIdUseCase } from "../../use-cases/tags/get-tag-by-id.use-case.js";
import { createTagUseCase } from "../../use-cases/tags/create-tag.use-case.js";
import { updateTagUseCase } from "../../use-cases/tags/update-tag.use-case.js";
import { deleteTagUseCase } from "../../use-cases/tags/delete-tag.use-case.js";

const s = initServer();

export const tagsRouter = s.router(tagsContract, {
  getTags: async ({ query: { page, limit, search } }) => {
    const result = await getTagsUseCase(resolve("tag"))({ search, page, limit });
    return { status: 200, body: result };
  },

  getTagById: async ({ params: { id } }) => {
    const tag = await getTagByIdUseCase(resolve("tag"))({ id });
    if (!tag) {
      return { status: 404, body: { message: "Tag not found" } };
    }
    return { status: 200, body: tag };
  },

  createTag: async ({ body }) => {
    const newTag = await createTagUseCase(resolve("tag"), resolve("graph"))(body);
    return { status: 201, body: newTag };
  },

  updateTag: async ({ params: { id }, body }) => {
    const tag = await updateTagUseCase(resolve("tag"), resolve("graph"))(id, body);
    if (!tag) {
      return { status: 404, body: { message: "Tag not found" } };
    }
    return { status: 200, body: tag };
  },

  deleteTag: async ({ params: { id } }) => {
    const deleted = await deleteTagUseCase(resolve("tag"), resolve("graph"))({ id });
    if (!deleted) {
      return { status: 404, body: { message: "Tag not found" } };
    }
    return { status: 204, body: undefined };
  },
});

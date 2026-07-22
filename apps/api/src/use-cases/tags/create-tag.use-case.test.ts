import { describe, expect, it, vi } from "vitest";
import type { Tag } from "../../entities/tag.entity.js";
import { createTagUseCase, TagConflictError } from "./create-tag.use-case.js";
import { updateTagUseCase } from "./update-tag.use-case.js";

const makeTag = (overrides: Partial<Tag> = {}): Tag => ({
  id: "tag-1",
  districtId: "district-1",
  name: "childcare",
  label: { fr: "Garde d'enfants", en: "Childcare" },
  ...overrides,
});

const makeRepo = (existing: Tag[] = []) => ({
  ensureIndexes: vi.fn(),
  getTags: vi.fn(),
  getTagById: vi.fn().mockResolvedValue(existing[0] ?? null),
  getTagsByNames: vi
    .fn()
    .mockImplementation(async (_d: string, names: string[]) => existing.filter((t) => names.includes(t.name))),
  createTag: vi.fn().mockImplementation(async (data: Omit<Tag, "id">) => ({ ...data, id: "tag-new" })),
  updateTag: vi.fn().mockImplementation(async (id: string, data: Partial<Tag>) => ({ ...makeTag(), id, ...data })),
  deleteTag: vi.fn(),
});

const graph = () => ({ upsertTag: vi.fn().mockResolvedValue(undefined) }) as never;

describe("createTagUseCase duplicate-key guard", () => {
  it("rejects a key that already exists in the district", async () => {
    const repo = makeRepo([makeTag()]);
    await expect(
      createTagUseCase(repo, graph())({ districtId: "district-1", name: "childcare", label: { fr: "X", en: "X" } }),
    ).rejects.toBeInstanceOf(TagConflictError);
    expect(repo.createTag).not.toHaveBeenCalled();
  });

  it("creates when the key is free", async () => {
    const repo = makeRepo([]);
    const tag = await createTagUseCase(
      repo,
      graph(),
    )({
      districtId: "district-1",
      name: "roofing",
      label: { fr: "Toiture", en: "Roofing" },
    });
    expect(tag.name).toBe("roofing");
    expect(repo.createTag).toHaveBeenCalled();
  });
});

describe("updateTagUseCase rename guard", () => {
  it("rejects renaming onto another tag's key", async () => {
    const self = makeTag({ id: "tag-1", name: "diy" });
    const other = makeTag({ id: "tag-2", name: "childcare" });
    const repo = makeRepo([self, other]);
    repo.getTagById.mockResolvedValue(self);
    await expect(updateTagUseCase(repo, graph())("tag-1", { name: "childcare" })).rejects.toBeInstanceOf(
      TagConflictError,
    );
    expect(repo.updateTag).not.toHaveBeenCalled();
  });

  it("allows a no-op rename to the tag's own key", async () => {
    const self = makeTag({ id: "tag-1", name: "childcare" });
    const repo = makeRepo([self]);
    repo.getTagById.mockResolvedValue(self);
    const tag = await updateTagUseCase(repo, graph())("tag-1", { name: "childcare" });
    expect(tag).not.toBeNull();
    expect(repo.updateTag).toHaveBeenCalled();
  });

  it("returns null when the tag being renamed is gone", async () => {
    const repo = makeRepo([]);
    repo.getTagById.mockResolvedValue(null);
    await expect(updateTagUseCase(repo, graph())("missing", { name: "x" })).resolves.toBeNull();
  });

  it("skips the conflict check when name is not being changed", async () => {
    const repo = makeRepo([makeTag()]);
    await updateTagUseCase(repo, graph())("tag-1", { label: { fr: "New", en: "New" } });
    expect(repo.getTagsByNames).not.toHaveBeenCalled();
  });
});

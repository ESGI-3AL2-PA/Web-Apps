import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "../../entities/conversation.entity.js";
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";
import { ImageAttachError } from "../../middleware/error-handler.js";
import { sendImageMessageUseCase } from "./send-image-message.use-case.js";

// Stub the object-storage layer so no real MinIO is touched. saveMessageImage
// succeeds; deleteMessageImage is a spy we assert the compensation calls.
const saveMessageImage = vi.fn(async (..._args: unknown[]) => {});
const deleteMessageImage = vi.fn(async (..._args: unknown[]) => {});
vi.mock("../../services/media-storage.service.js", () => ({
  saveMessageImage: (...args: unknown[]) => saveMessageImage(...args),
  deleteMessageImage: (...args: unknown[]) => deleteMessageImage(...args),
}));

const makeMessage = (id: string): Message =>
  ({ id, conversationId: "conv-1", senderId: "alice", type: "image", content: "[image]" }) as unknown as Message;

const makeRepo = (overrides: Partial<IConversationRepository>): IConversationRepository =>
  ({
    getConversationById: vi.fn(async () => ({
      id: "conv-1",
      districtId: "district-1",
      participants: ["alice", "bob"],
    })),
    createMessage: vi.fn(async () => makeMessage("msg-1")),
    attachMedia: vi.fn(async () => makeMessage("msg-1")),
    deleteMessage: vi.fn(async () => {}),
    ...overrides,
  }) as unknown as IConversationRepository;

const image = { bytes: Buffer.from("png-bytes"), contentType: "image/png" };

describe("sendImageMessageUseCase attach-failure compensation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes the stored image AND the message row, then throws ImageAttachError when attachMedia throws", async () => {
    const repo = makeRepo({
      attachMedia: vi.fn(async () => {
        throw new Error("mongo down");
      }),
    });

    await expect(sendImageMessageUseCase(repo)("conv-1", "alice", image)).rejects.toThrow("mongo down");

    expect(deleteMessageImage).toHaveBeenCalledWith("msg-1");
    expect(repo.deleteMessage).toHaveBeenCalledWith("msg-1");
  });

  it("deletes the stored image AND the message row, then throws ImageAttachError when attachMedia returns null", async () => {
    const repo = makeRepo({ attachMedia: vi.fn(async () => null) });

    await expect(sendImageMessageUseCase(repo)("conv-1", "alice", image)).rejects.toBeInstanceOf(ImageAttachError);

    expect(deleteMessageImage).toHaveBeenCalledWith("msg-1");
    expect(repo.deleteMessage).toHaveBeenCalledWith("msg-1");
  });

  it("returns the updated message and does NOT compensate on the happy path", async () => {
    const repo = makeRepo({ attachMedia: vi.fn(async () => makeMessage("msg-1")) });

    const result = await sendImageMessageUseCase(repo)("conv-1", "alice", image);

    expect(result?.message.id).toBe("msg-1");
    expect(result?.participants).toEqual(["alice", "bob"]);
    expect(deleteMessageImage).not.toHaveBeenCalled();
    expect(repo.deleteMessage).not.toHaveBeenCalled();
  });
});

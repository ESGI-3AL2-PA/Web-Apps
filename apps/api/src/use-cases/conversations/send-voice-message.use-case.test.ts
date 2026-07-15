import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Conversation, Message } from "../../entities/conversation.entity.js";
import type { IConversationRepository } from "../../repositories/Conversation/conversation.repository.js";
import { sendVoiceMessageUseCase, VoiceMediaAttachError } from "./send-voice-message.use-case.js";

const saveAudioFromBase64 = vi.fn();
const deleteAudio = vi.fn();

vi.mock("../../services/media-storage.service.js", () => ({
  saveAudioFromBase64: (...args: unknown[]) => saveAudioFromBase64(...args),
  deleteAudio: (...args: unknown[]) => deleteAudio(...args),
}));

const conversation: Conversation = {
  id: "conv-1",
  participants: ["alice", "bob"],
  districtId: "district-1",
  type: "direct",
  createdAt: "2026-07-14T00:00:00.000Z",
};

const message: Message = {
  id: "msg-1",
  senderId: "alice",
  conversationId: "conv-1",
  districtId: "district-1",
  type: "audio",
  content: "[message vocal]",
  read: false,
  createdAt: "2026-07-14T00:00:00.000Z",
};

const makeRepo = (overrides: Partial<IConversationRepository> = {}): IConversationRepository =>
  ({
    getConversationById: vi.fn().mockResolvedValue(conversation),
    createMessage: vi.fn().mockResolvedValue(message),
    attachMedia: vi.fn().mockResolvedValue({ ...message, mediaUrl: "/messages/msg-1/audio" }),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as unknown as IConversationRepository;

beforeEach(() => {
  saveAudioFromBase64.mockReset().mockResolvedValue(undefined);
  deleteAudio.mockReset().mockResolvedValue(undefined);
});

describe("sendVoiceMessageUseCase", () => {
  it("returns 404 (null) for a non-participant without creating a message", async () => {
    const repo = makeRepo();
    const result = await sendVoiceMessageUseCase(repo)("conv-1", "mallory", "base64");

    expect(result).toBeNull();
    expect(repo.createMessage).not.toHaveBeenCalled();
  });

  it("returns the message with mediaUrl on the happy path", async () => {
    const repo = makeRepo();
    const result = await sendVoiceMessageUseCase(repo)("conv-1", "alice", "base64");

    expect(result?.message.mediaUrl).toBe("/messages/msg-1/audio");
    expect(result?.participants).toEqual(["alice", "bob"]);
    expect(deleteAudio).not.toHaveBeenCalled();
    expect(repo.deleteMessage).not.toHaveBeenCalled();
  });

  it("compensates (delete row) and rethrows when the audio write fails", async () => {
    saveAudioFromBase64.mockRejectedValue(new Error("minio down"));
    const repo = makeRepo();

    await expect(sendVoiceMessageUseCase(repo)("conv-1", "alice", "base64")).rejects.toThrow("minio down");
    expect(repo.deleteMessage).toHaveBeenCalledWith("msg-1");
  });

  it("fully compensates and throws VoiceMediaAttachError when attachMedia returns null", async () => {
    const repo = makeRepo({ attachMedia: vi.fn().mockResolvedValue(null) });

    await expect(sendVoiceMessageUseCase(repo)("conv-1", "alice", "base64")).rejects.toBeInstanceOf(
      VoiceMediaAttachError,
    );
    expect(deleteAudio).toHaveBeenCalledWith("msg-1");
    expect(repo.deleteMessage).toHaveBeenCalledWith("msg-1");
  });

  it("fully compensates and rethrows when attachMedia throws", async () => {
    const repo = makeRepo({ attachMedia: vi.fn().mockRejectedValue(new Error("mongo write failed")) });

    await expect(sendVoiceMessageUseCase(repo)("conv-1", "alice", "base64")).rejects.toThrow("mongo write failed");
    expect(deleteAudio).toHaveBeenCalledWith("msg-1");
    expect(repo.deleteMessage).toHaveBeenCalledWith("msg-1");
  });
});

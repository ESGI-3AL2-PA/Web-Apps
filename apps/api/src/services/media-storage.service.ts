import path from "path";
import fs from "fs/promises";

const getStorageRoot = (): string => {
  const configured = process.env.MESSAGES_STORAGE_PATH ?? "./storage/messages";
  return path.resolve(configured);
};

const ensureStorageDir = async (): Promise<string> => {
  const root = getStorageRoot();
  await fs.mkdir(root, { recursive: true });
  return root;
};

export const buildAudioPath = (messageId: string): string => {
  return path.join(getStorageRoot(), `${messageId}.webm`);
};

// Sauve un audio (data-URL base64 ou base64 brut) sur disque sous storage/messages/{id}.webm
export const saveAudioFromBase64 = async (
  messageId: string,
  base64Input: string,
): Promise<{ audioPath: string }> => {
  await ensureStorageDir();
  const base64 = base64Input.replace(/^data:audio\/[a-zA-Z+-]+;base64,/, "");
  const bytes = Buffer.from(base64, "base64");
  const audioPath = buildAudioPath(messageId);
  await fs.writeFile(audioPath, bytes);
  return { audioPath };
};

export const deleteAudio = async (messageId: string): Promise<void> => {
  try {
    await fs.unlink(buildAudioPath(messageId));
  } catch {
    // best-effort
  }
};

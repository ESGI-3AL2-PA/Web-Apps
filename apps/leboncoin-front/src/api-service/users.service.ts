import api from "./api";

export type UserPublic = { id: string; firstName: string; lastName: string };

// GET /users/:id/public — minimal public profile (name), any authenticated user.
const publicCache = new Map<string, Promise<UserPublic>>();

export async function getUserPublic(id: string): Promise<UserPublic> {
  const cached = publicCache.get(id);
  if (cached) return cached;
  const p = (async () => {
    try {
      const res = await api.get<UserPublic>(`/users/${id}/public`);
      return res.data;
    } catch (err) {
      publicCache.delete(id);
      throw err;
    }
  })();
  publicCache.set(id, p);
  return p;
}

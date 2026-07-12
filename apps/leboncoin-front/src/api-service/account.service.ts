import { config } from "@repo/config";
import type { UserResponseDto } from "@repo/contracts";
import api from "./api";
import { getListings } from "./listings.service";

// Reuse the existing (unauthenticated) forgot-password flow to let a logged-in
// user reset their password by email — no dedicated change-password endpoint.
export async function requestPasswordReset(email: string): Promise<void> {
  await fetch(`${config.authServiceUrl}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export interface AccountExport {
  exportedAt: string;
  user: UserResponseDto;
  listings: unknown[];
}

// GDPR access: assemble the user's own data into a JSON document.
export async function exportMyData(userId: string): Promise<AccountExport> {
  const [user, listings] = await Promise.all([
    api.get<UserResponseDto>(`/users/${userId}`).then((r) => r.data),
    getListings({ authorId: userId, limit: 100 } as never)
      .then((page) => page.data)
      .catch(() => []),
  ]);
  return { exportedAt: new Date().toISOString(), user, listings };
}

// GDPR erasure: delete the caller's own account (self-service, backend-scoped).
export async function deleteAccount(userId: string): Promise<void> {
  await api.delete(`/users/${userId}`);
}

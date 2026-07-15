import { config } from "@repo/config";
import type { UserDataExportResponseDto } from "@repo/contracts";
import api from "./api";

// Reuse the existing (unauthenticated) forgot-password flow to let a logged-in
// user reset their password by email — no dedicated change-password endpoint.
export async function requestPasswordReset(email: string): Promise<void> {
  await fetch(`${config.authServiceUrl}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export type AccountExport = UserDataExportResponseDto;

// GDPR access (Art. 15/20): the api owns the canonical export. One authenticated,
// self-scoped call returns EVERY category of personal data — user PII, listings,
// contracts, transactions, events, votes, incidents, conversations + messages,
// notifications, refresh-token session history, and the Neo4j graph edges — data
// the client has no read route for on its own (messages of every thread, session
// IP/UA history, graph relationships) now included.
export async function exportMyData(userId: string): Promise<AccountExport> {
  const { data } = await api.get<AccountExport>(`/users/${userId}/export`);
  return data;
}

// GDPR erasure: delete the caller's own account (self-service, backend-scoped).
export async function deleteAccount(userId: string): Promise<void> {
  await api.delete(`/users/${userId}`);
}

import { config } from "@repo/config";
import type { EventQueryDto, ListingQueryDto, UserResponseDto, VoteQueryDto } from "@repo/contracts";
import api from "./api";
import { getListings } from "./listings.service";
import { getContracts } from "./contracts.service";
import { getEvents } from "./events.service";
import { getVotes } from "./votes.service";
import { getUserTransactions } from "./transactions.service";

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
  contractsAsProvider: unknown[];
  contractsAsBeneficiary: unknown[];
  events: unknown[];
  votes: unknown[];
  transactions: unknown[];
}

const emptyPage = { data: [] as unknown[] };

// GDPR access: assemble everything the user owns into a JSON document.
export async function exportMyData(userId: string): Promise<AccountExport> {
  const [user, listings, cProvider, cBenef, events, votes, transactions] = await Promise.all([
    api.get<UserResponseDto>(`/users/${userId}`).then((r) => r.data),
    getListings({ authorId: userId, limit: 200 } as ListingQueryDto)
      .then((p) => p.data)
      .catch(() => []),
    getContracts({ providerId: userId, limit: 200 })
      .then((p) => p.data)
      .catch(() => []),
    getContracts({ beneficiaryId: userId, limit: 200 })
      .then((p) => p.data)
      .catch(() => []),
    getEvents({ creatorId: userId, limit: 200 } as EventQueryDto).catch(() => []),
    getVotes({ creatorId: userId, limit: 200 } as VoteQueryDto).catch(() => []),
    getUserTransactions(userId, { limit: 500 } as never)
      .then((p) => p.data)
      .catch(() => emptyPage.data),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    user,
    listings,
    contractsAsProvider: cProvider,
    contractsAsBeneficiary: cBenef,
    events,
    votes,
    transactions,
  };
}

// GDPR erasure: delete the caller's own account (self-service, backend-scoped).
export async function deleteAccount(userId: string): Promise<void> {
  await api.delete(`/users/${userId}`);
}

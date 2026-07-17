import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import type { IDistrictRepository } from "../../repositories/District/district.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import type { Transaction } from "../../entities/transaction.entity.js";
import type { User } from "../../entities/user.entity.js";
import { runInTransaction } from "../../repositories/tx.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";
import { logger } from "../../logger.js";

// Shared dependency bundle for the join / leave / move district operations, which
// mutate both the user's `districtId` and the points ledger.
export interface MembershipDeps {
  userRepository: IUserRepository;
  transactionRepository: ITransactionRepository;
  districtRepository: IDistrictRepository;
  graphRepository: IGraphRepository;
}

// Credit a freshly-joined member their district's starting points through the ledger
// (a `system` credit) so the grant is auditable rather than a silent balance bump.
export const grantStartingPoints = async (
  transactionRepository: ITransactionRepository,
  userId: string,
  districtId: string,
  amount: number,
): Promise<void> => {
  if (amount <= 0) return;
  await runInTransaction(async (session) => {
    await transactionRepository.adjustBalance(userId, amount, session);
    await transactionRepository.createTransactions(
      [{ userId, districtId, type: "credit", amount, refType: "system" }],
      session,
    );
  });
};

// Assign a user to a district and grant its starting points. Returns the updated user
// (balance reflecting the grant), or null if the district or user is missing.
export const joinDistrict = async (deps: MembershipDeps, userId: string, districtId: string): Promise<User | null> => {
  const district = await deps.districtRepository.getDistrictById(districtId);
  if (!district) return null;

  const updated = await deps.userRepository.updateUser(userId, { districtId });
  if (!updated) return null;

  await grantStartingPoints(deps.transactionRepository, userId, districtId, district.startingPoints);

  // Best-effort projection of the new residence (no unlink for a prior LIVES_IN edge —
  // the graph is a reconcilable projection; a stale edge is tolerated until reset).
  await syncGraph(`linkUserLivesIn(${userId}->${districtId})`, () =>
    deps.graphRepository.linkUserLivesIn(userId, districtId, updated.updatedAt, updated.address),
  );

  // Re-read so the returned balance includes the granted starting points.
  return (await deps.userRepository.getUserById(userId)) ?? updated;
};

// Remove a user from their district, redistributing their whole balance evenly across
// the remaining members (largest-remainder: the integer remainder is handed out +1 each
// to the earliest members so the total is conserved). Sole member => balance is burned.
// Returns the updated (now district-less) user.
export const leaveDistrict = async (deps: MembershipDeps, userId: string): Promise<User | null> => {
  const leaver = await deps.userRepository.getUserById(userId);
  if (!leaver) return null;

  const districtId = leaver.districtId;
  if (!districtId) return leaver; // already district-less — nothing to redistribute

  const balance = leaver.balance;
  const others = (await deps.userRepository.findUsersByDistrict(districtId))
    .filter((u) => u.id !== userId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const n = others.length;

  if (balance > 0) {
    await runInTransaction(async (session) => {
      const entries: Omit<Transaction, "id" | "createdAt">[] = [];

      if (n > 0) {
        const base = Math.floor(balance / n);
        const remainder = balance - base * n;
        for (let i = 0; i < n; i++) {
          const member = others[i]!;
          const amount = base + (i < remainder ? 1 : 0);
          if (amount <= 0) continue;
          await deps.transactionRepository.adjustBalance(member.id, amount, session);
          entries.push({ userId: member.id, districtId, type: "transfer_in", amount, refType: "system" });
        }
      }

      // Zero the leaver's balance. tryDebit is atomic and guarded; balance === the amount
      // so it succeeds unless a concurrent write already moved it.
      const debited = await deps.transactionRepository.tryDebit(userId, balance, session);
      if (!debited) throw new Error(`leaveDistrict: failed to debit ${balance} tokens from ${userId}`);
      entries.push({ userId, districtId, type: n > 0 ? "transfer_out" : "debit", amount: -balance, refType: "system" });

      await deps.transactionRepository.createTransactions(entries, session);
    });

    if (n === 0) {
      logger.warn({ userId, districtId, amount: balance }, "leaveDistrict: sole member left — balance burned");
    }
  }

  return deps.userRepository.updateUser(userId, { districtId: "" });
};

// Leave the current district (if any) then join a new one (if given). Used when a user's
// address change re-resolves to a different district.
export const moveUserDistrict = async (
  deps: MembershipDeps,
  userId: string,
  newDistrictId: string | null,
): Promise<User | null> => {
  await leaveDistrict(deps, userId);
  if (newDistrictId) return joinDistrict(deps, userId, newDistrictId);
  return deps.userRepository.getUserById(userId);
};

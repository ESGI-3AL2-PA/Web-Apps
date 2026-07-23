import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import type { IDistrictRepository } from "../../repositories/District/district.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import type { Transaction } from "../../entities/transaction.entity.js";
import type { User } from "../../entities/user.entity.js";
import { runInTransaction } from "../../repositories/tx.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";
import { logger } from "../../logger.js";

/**
 * Cas d'usage partagés de la gestion d'appartenance à un quartier (rejoindre / quitter /
 * déménager). Ces opérations mutent à la fois le `districtId` de l'utilisateur ET le grand
 * livre des points (chaque mouvement de solde passe par une transaction auditable), et
 * projettent le résultat dans le graphe Neo4j en best-effort.
 */

// Ensemble de dépendances commun aux opérations rejoindre / quitter / déménager, qui
// touchent à la fois le `districtId` de l'utilisateur et le grand livre des points.
export interface MembershipDeps {
  userRepository: IUserRepository;
  transactionRepository: ITransactionRepository;
  districtRepository: IDistrictRepository;
  graphRepository: IGraphRepository;
}

/**
 * Crédite à un membre fraîchement arrivé les points de départ de son quartier en passant
 * par le grand livre (un crédit de type `system`), afin que l'octroi soit auditable plutôt
 * qu'un simple ajustement de solde silencieux. Ne fait rien si `amount <= 0`.
 * Le crédit du solde et l'écriture de la transaction sont faits dans une même transaction Mongo.
 */
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

/**
 * Rattache un utilisateur à un quartier et lui octroie les points de départ de celui-ci.
 * Renvoie l'utilisateur mis à jour (solde reflétant l'octroi), ou `null` si le quartier ou
 * l'utilisateur est introuvable.
 */
export const joinDistrict = async (deps: MembershipDeps, userId: string, districtId: string): Promise<User | null> => {
  const district = await deps.districtRepository.getDistrictById(districtId);
  if (!district) return null;

  const updated = await deps.userRepository.updateUser(userId, { districtId });
  if (!updated) return null;

  await grantStartingPoints(deps.transactionRepository, userId, districtId, district.startingPoints);

  // Projection best-effort de la nouvelle résidence (pas de suppression d'une éventuelle
  // arête LIVES_IN antérieure — le graphe est une projection réconciliable ; une arête
  // périmée est tolérée jusqu'au prochain reset).
  await syncGraph(`linkUserLivesIn(${userId}->${districtId})`, () =>
    deps.graphRepository.linkUserLivesIn(userId, districtId, updated.updatedAt, updated.address),
  );

  // Relecture pour que le solde renvoyé inclue les points de départ qui viennent d'être octroyés.
  return (await deps.userRepository.getUserById(userId)) ?? updated;
};

/**
 * Retire un utilisateur de son quartier en redistribuant l'intégralité de son solde à parts
 * égales entre les membres restants. La répartition suit la règle du plus fort reste :
 * le reste entier de la division est attribué à raison de +1 chacun aux membres les plus
 * anciens (tri par `createdAt`), de sorte que le total soit conservé au point près.
 * Si l'utilisateur est le seul membre, son solde est simplement brûlé (aucun destinataire).
 * Renvoie l'utilisateur mis à jour (désormais sans quartier).
 */
export const leaveDistrict = async (deps: MembershipDeps, userId: string): Promise<User | null> => {
  const leaver = await deps.userRepository.getUserById(userId);
  if (!leaver) return null;

  const districtId = leaver.districtId;
  if (!districtId) return leaver; // déjà sans quartier — rien à redistribuer

  const balance = leaver.balance;
  const others = (await deps.userRepository.findUsersByDistrict(districtId))
    .filter((u) => u.id !== userId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const n = others.length;

  if (balance > 0) {
    await runInTransaction(async (session) => {
      const entries: Omit<Transaction, "id" | "createdAt">[] = [];

      if (n > 0) {
        // Part de base identique pour tous, puis distribution du reste (plus fort reste).
        const base = Math.floor(balance / n);
        const remainder = balance - base * n;
        for (let i = 0; i < n; i++) {
          const member = others[i]!;
          // Les `remainder` premiers membres reçoivent +1 pour absorber le reste.
          const amount = base + (i < remainder ? 1 : 0);
          if (amount <= 0) continue;
          await deps.transactionRepository.adjustBalance(member.id, amount, session);
          entries.push({ userId: member.id, districtId, type: "transfer_in", amount, refType: "system" });
        }
      }

      // Remise à zéro du solde du partant. tryDebit est atomique et protégé ; comme on débite
      // exactement le solde courant, l'opération réussit sauf si une écriture concurrente l'a
      // déjà modifié entre-temps.
      const debited = await deps.transactionRepository.tryDebit(userId, balance, session);
      if (!debited) throw new Error(`leaveDistrict: failed to debit ${balance} tokens from ${userId}`);
      entries.push({ userId, districtId, type: n > 0 ? "transfer_out" : "debit", amount: -balance, refType: "system" });

      await deps.transactionRepository.createTransactions(entries, session);
    });

    if (n === 0) {
      logger.warn({ userId, districtId, amount: balance }, "leaveDistrict: sole member left — balance burned");
    }
  }

  // Détache l'utilisateur en vidant son `districtId`.
  return deps.userRepository.updateUser(userId, { districtId: "" });
};

/**
 * Quitte le quartier courant (s'il y en a un) puis rejoint un nouveau (si fourni).
 * Utilisé lorsqu'un changement d'adresse re-résout l'utilisateur vers un autre quartier.
 * Avec `newDistrictId === null`, l'utilisateur reste simplement sans quartier.
 */
export const moveUserDistrict = async (
  deps: MembershipDeps,
  userId: string,
  newDistrictId: string | null,
): Promise<User | null> => {
  await leaveDistrict(deps, userId);
  if (newDistrictId) return joinDistrict(deps, userId, newDistrictId);
  return deps.userRepository.getUserById(userId);
};

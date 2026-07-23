// Cas d'usage : création d'utilisateurs.
// Expose deux factories : `createUserUseCase` (inscription d'un membre : géocodage de
// l'adresse, rattachement automatique à un quartier et attribution des points de départ)
// et `createAdminUseCase` (création d'un compte admin, sans quartier ni points).
// Effets de bord communs : hachage argon2 du mot de passe et miroir du compte dans le graphe.

import argon2 from "argon2";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { IDistrictRepository } from "../../repositories/District/district.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import { logger } from "../../logger.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import type { User } from "../../entities/user.entity.js";
import { getCoordinatesFromAddress } from "../../services/address.service.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";
import { grantStartingPoints } from "./district-membership.use-case.js";

import type { CreateUserDto } from "@repo/contracts";

/**
 * Réplique un utilisateur dans le graphe : upsert du nœud User, puis, s'il a un quartier,
 * création de la relation LIVES_IN (avec date de création et adresse).
 */
const mirrorUserToGraph = async (graphRepository: IGraphRepository, user: User): Promise<void> => {
  await syncGraph(`upsertUser(${user.id})`, () =>
    graphRepository.upsertUser({
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      role: user.role,
    }),
  );
  if (user.districtId) {
    await syncGraph(`linkUserLivesIn(${user.id}->${user.districtId})`, () =>
      graphRepository.linkUserLivesIn(user.id, user.districtId, user.createdAt, user.address),
    );
  }
};

/**
 * Factory du cas d'usage d'inscription d'un membre (rôle `user`).
 * Étapes : géocodage de l'adresse, rattachement automatique au quartier qui la contient
 * (si un seul correspond), hachage argon2 du mot de passe, création en base, miroir dans
 * le graphe, puis crédit des points de départ du quartier.
 */
export const createUserUseCase = (
  userRepository: IUserRepository,
  districtRepository: IDistrictRepository,
  graphRepository: IGraphRepository,
  transactionRepository: ITransactionRepository,
) => {
  return async (data: CreateUserDto): Promise<User> => {
    const { password, ...rest } = data;

    // Géocode l'adresse et résout le(s) quartier(s) qui la contiennent. Best-effort : un
    // échec du géocodeur / de la requête géo laisse districtId vide plutôt que de bloquer
    // l'inscription.
    // Rattachement automatique uniquement si EXACTEMENT un quartier contient l'adresse — 0
    // (hors couverture) ou >1 (quartiers qui se chevauchent) laisse l'utilisateur sans
    // quartier, à charge pour lui d'en choisir un à l'onboarding (bouton « revérifier » /
    // sélecteur de quartier de l'écran d'accès refusé).
    let districtId = "";
    let startingPoints = 0;
    try {
      const coordinates = await getCoordinatesFromAddress(rest.address);
      const matches = await districtRepository.findDistrictsContaining(coordinates);
      if (matches.length === 1) {
        districtId = matches[0]!.id;
        startingPoints = matches[0]!.startingPoints;
      }
    } catch (err) {
      logger.error({ err }, "District resolution failed during user creation");
    }

    // Création avec les valeurs par défaut d'un nouveau membre : rôle `user`, solde 0, non
    // banni, email non vérifié, TOTP désactivé.

    const user = await userRepository.createUser({
      ...rest,
      passwordHash: await argon2.hash(password),
      role: "user",
      balance: 0,
      banned: false,
      districtId,
      emailVerified: false,
      totpSecret: null,
      totpEnabled: false,
    });

    await mirrorUserToGraph(graphRepository, user);

    // Crédite au nouveau membre les points de départ de son quartier (crédit au ledger).
    // On relit ensuite l'utilisateur pour renvoyer son solde à jour.
    if (districtId && startingPoints > 0) {
      await grantStartingPoints(transactionRepository, user.id, districtId, startingPoints);
      return (await userRepository.getUserById(user.id)) ?? user;
    }
    return user;
  };
};

/**
 * Factory du cas d'usage de création d'un compte administrateur (rôle `admin`).
 * Contrairement au membre : pas de géocodage, aucun quartier assigné, aucun point de
 * départ, et l'email est considéré comme déjà vérifié.
 */
export const createAdminUseCase = (userRepository: IUserRepository, graphRepository: IGraphRepository) => {
  return async (data: CreateUserDto): Promise<User> => {
    const { password, ...rest } = data;
    const user = await userRepository.createUser({
      ...rest,
      passwordHash: await argon2.hash(password),
      role: "admin",
      balance: 0,
      banned: false,
      districtId: "",
      emailVerified: true,
      totpSecret: null,
      totpEnabled: false,
    });

    await mirrorUserToGraph(graphRepository, user);
    return user;
  };
};

import argon2 from "argon2";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import type { IDistrictRepository } from "../../repositories/District/district.repository.js";
import type { ITransactionRepository } from "../../repositories/Transaction/transaction.repository.js";
import type { User } from "../../entities/user.entity.js";
import type { UpdateUserDto } from "@repo/contracts";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";
import { getCoordinatesFromAddress } from "../../services/address.service.js";
import { moveUserDistrict, type MembershipDeps } from "./district-membership.use-case.js";
import { logger } from "../../logger.js";

/**
 * Cas d'usage (domaine users) : met à jour le profil d'un utilisateur. Gère, en plus des champs
 * de profil, trois logiques sensibles : le changement de mot de passe (vérification argon2 de
 * l'ancien puis re-hash du nouveau), le changement d'email (qui force une re-vérification) et le
 * changement d'adresse (qui re-résout l'appartenance au quartier via `moveUserDistrict`).
 * Les attributs projetés sont mis en miroir dans le graphe Neo4j.
 */

// Résultat discriminé du cas d'usage : succès, cible introuvable, ancien mot de passe erroné,
// ou conflit sur l'email (adresse déjà prise).
export type UpdateUserResult =
  | { kind: "ok"; user: User }
  | { kind: "not-found" }
  | { kind: "wrong-password" }
  | { kind: "email-conflict" };

// Code d'erreur Mongo de clé dupliquée. L'index unique sur users.email est le vrai garde-fou
// contre deux comptes partageant une même adresse email ; une pré-vérification resterait sujette
// à une course avec une mise à jour concurrente.
const isDuplicateKeyError = (err: unknown): boolean =>
  typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === 11000;

export const updateUserUseCase = (
  userRepository: IUserRepository,
  graphRepository: IGraphRepository,
  districtRepository: IDistrictRepository,
  transactionRepository: ITransactionRepository,
) => {
  return async (id: string, data: UpdateUserDto): Promise<UpdateUserResult> => {
    const { currentPassword, newPassword } = data;

    // Liste blanche explicite — ne jamais laisser des champs privilégiés (role, balance,
    // emailVerified, districtId, totpSecret) être positionnés par cette voie depuis l'entrée
    // client, même si le DTO/la validation évolue. emailVerified n'est forcé (à false) que côté
    // serveur, plus bas.
    const update: Partial<Omit<User, "id" | "createdAt" | "updatedAt">> = {};
    if (data.firstName !== undefined) update.firstName = data.firstName;
    if (data.lastName !== undefined) update.lastName = data.lastName;
    if (data.email !== undefined) update.email = data.email;
    if (data.phone !== undefined) update.phone = data.phone;
    if (data.address !== undefined) update.address = data.address;
    if (data.lang !== undefined) update.lang = data.lang;

    // On a besoin de l'enregistrement courant pour vérifier un changement de mot de passe,
    // détecter un changement d'email, et détecter un changement d'adresse (qui re-résout le
    // quartier de l'utilisateur). On ne le charge que si l'un de ces cas est concerné.
    const existing =
      newPassword || data.email !== undefined || data.address !== undefined
        ? await userRepository.getUserById(id)
        : null;

    if (newPassword) {
      if (!existing) return { kind: "not-found" };

      // On exige la preuve de l'ancien mot de passe (argon2.verify) avant de re-hasher le nouveau.
      const valid = currentPassword ? await argon2.verify(existing.passwordHash, currentPassword) : false;
      if (!valid) return { kind: "wrong-password" };

      update.passwordHash = await argon2.hash(newPassword);
    }

    // Changer l'email invalide la vérification précédente : on force une re-vérification pour
    // qu'un utilisateur ne puisse pas transférer un statut « vérifié » sur une adresse qu'il ne
    // contrôle pas. L'api possède la collection users ; l'auth-service conditionne la connexion à
    // emailVerified et expose resendVerification.
    if (data.email !== undefined && existing && data.email !== existing.email) {
      update.emailVerified = false;
    }

    let updated: User | null;
    try {
      updated = await userRepository.updateUser(id, update);
    } catch (err) {
      // Course perdue face à l'index unique sur l'email (ou un doublon obsolète existe déjà).
      if (isDuplicateKeyError(err)) return { kind: "email-conflict" };
      throw err;
    }
    if (!updated) return { kind: "not-found" };
    let user = updated;

    // Mise en miroir dans Neo4j si l'un des attributs projetés a changé.
    if (update.firstName !== undefined || update.lastName !== undefined || update.email !== undefined) {
      await syncGraph(`upsertUser(${user.id})`, () =>
        graphRepository.upsertUser({
          id: user.id,
          name: `${user.firstName} ${user.lastName}`.trim(),
          email: user.email,
          role: user.role,
        }),
      );
    }

    // Une adresse modifiée re-résout le quartier. Si l'utilisateur reste dans son quartier
    // actuel, rien ne change. Sinon c'est un déménagement : quitter l'ancien quartier (en
    // redistribuant les points) et rejoindre le nouveau (en octroyant ses points de départ)
    // lorsqu'un seul contient la nouvelle adresse ; 0 (aucune couverture) ou un chevauchement
    // qui interdit un placement automatique le laisse sans quartier, à re-onboarder et choisir.
    // Un échec du géocodeur laisse l'appartenance intacte, pour qu'une erreur transitoire ne
    // puisse pas l'éjecter silencieusement.
    if (data.address !== undefined && existing && data.address !== existing.address) {
      let matches: Awaited<ReturnType<typeof districtRepository.findDistrictsContaining>> | undefined;
      try {
        const coordinates = await getCoordinatesFromAddress(data.address);
        matches = await districtRepository.findDistrictsContaining(coordinates);
      } catch (err) {
        logger.error({ err, userId: id }, "update-user: address re-resolution failed — district unchanged");
      }
      // `matches === undefined` => le géocodage a échoué : on ne touche pas à l'appartenance.
      if (matches !== undefined) {
        let newDistrictId: string | null;
        if (existing.districtId && matches.some((d) => d.id === existing.districtId)) {
          newDistrictId = existing.districtId; // toujours couvert par le quartier actuel — pas de déménagement
        } else if (matches.length === 1) {
          newDistrictId = matches[0]!.id;
        } else {
          newDistrictId = null; // aucune couverture, ou chevauchement nécessitant un choix — devient sans quartier
        }
        if (newDistrictId !== existing.districtId) {
          const deps: MembershipDeps = { userRepository, transactionRepository, districtRepository, graphRepository };
          const moved = await moveUserDistrict(deps, id, newDistrictId);
          if (moved) user = moved;
        }
      }
    }

    return { kind: "ok", user };
  };
};

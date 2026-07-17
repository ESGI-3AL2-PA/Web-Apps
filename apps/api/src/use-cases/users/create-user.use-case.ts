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

export const createUserUseCase = (
  userRepository: IUserRepository,
  districtRepository: IDistrictRepository,
  graphRepository: IGraphRepository,
  transactionRepository: ITransactionRepository,
) => {
  return async (data: CreateUserDto): Promise<User> => {
    const { password, ...rest } = data;

    // Geocode the address and resolve the containing district(s). Best-effort: a
    // geocoder/geo-query failure leaves districtId empty rather than blocking signup.
    // Auto-join only when exactly one district contains the address — 0 (no coverage) or
    // >1 (overlapping districts) leaves the user district-less so they pick one at
    // onboarding (the access-denied screen's "check again" / district picker).
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

    // Grant the resolved district's starting points to the new member (ledger credit).
    if (districtId && startingPoints > 0) {
      await grantStartingPoints(transactionRepository, user.id, districtId, startingPoints);
      return (await userRepository.getUserById(user.id)) ?? user;
    }
    return user;
  };
};

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

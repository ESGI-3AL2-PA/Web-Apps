import argon2 from "argon2";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { IDistrictRepository } from "../../repositories/District/district.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import type { User } from "../../entities/user.entity.js";
import { getCoordinatesFromAddress } from "../../services/address.service.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

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
) => {
  return async (data: CreateUserDto): Promise<User> => {
    const { password, ...rest } = data;

    // Geocode the address and resolve the containing district. Best-effort: a
    // geocoder/geo-query failure leaves districtId empty rather than blocking signup.
    let districtId = "";
    try {
      const coordinates = await getCoordinatesFromAddress(rest.address);
      const district = await districtRepository.findDistrictContaining(coordinates);
      districtId = district?.id ?? "";
    } catch (err) {
      console.error("District resolution failed during user creation:", err);
    }

    const user = await userRepository.createUser({
      ...rest,
      passwordHash: await argon2.hash(password),
      role: "user",
      balance: 0,
      districtId,
      emailVerified: false,
      totpSecret: null,
      totpEnabled: false,
    });

    await mirrorUserToGraph(graphRepository, user);
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
      districtId: "",
      emailVerified: true,
      totpSecret: null,
      totpEnabled: false,
    });

    await mirrorUserToGraph(graphRepository, user);
    return user;
  };
};

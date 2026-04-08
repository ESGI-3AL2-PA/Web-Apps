import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { User } from "../../entities/user.entity.js";
import { getCoordinatesFromAddress } from "../../services/address.service.js";

import type { CreateUserDto } from "@repo/contracts";

export const createUserUseCase = (userRepository: IUserRepository) => {
  return async (data: CreateUserDto): Promise<User> => {
    const { password, ...rest } = data;
    const coordinates = await getCoordinatesFromAddress(rest.address);
    console.log(coordinates);
    return await userRepository.createUser({
      ...rest,
      passwordHash: password,
      role: "user",
      balance: 0,
      districtId: "",
    });
  };
};

export const createAdminUseCase = (userRepository: IUserRepository) => {
  return async (data: CreateUserDto): Promise<User> => {
    const { password, ...rest } = data;
    return await userRepository.createUser({
      ...rest,
      passwordHash: password,
      role: "admin",
      balance: 0,
      districtId: "",
    });
  };
};

import { InMemoryUserRepository } from "./user.repository.in-memory.js";

const repositories = {
  user: new InMemoryUserRepository(),
} as const;

type Container = typeof repositories;

export const container: Container = repositories;

export type ContainerKeys = keyof Container;

export const resolve = <K extends ContainerKeys>(key: K): Container[K] => {
  return container[key];
};

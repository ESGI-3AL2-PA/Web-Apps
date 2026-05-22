import type { Db } from "mongodb";
import { MongoUserRepository } from "./User/user.repository.mongo.js";
import { MongoListingRepository } from "./Listing/listing.repository.mongo.js";
import { MongoContractRepository } from "./Contract/contract.repository.mongo.js";
import { MongoEventRepository } from "./Event/event.repository.mongo.js";
import { MongoIncidentRepository } from "./Incident/incident.repository.mongo.js";

let repositories: {
  user: MongoUserRepository;
  listing: MongoListingRepository;
  contract: MongoContractRepository;
  event: MongoEventRepository;
  incident: MongoIncidentRepository;
} | null = null;

export const initContainer = (db: Db) => {
  repositories = {
    user: new MongoUserRepository(db),
    listing: new MongoListingRepository(db),
    contract: new MongoContractRepository(db),
    event: new MongoEventRepository(db),
    incident: new MongoIncidentRepository(db),
  };
};

type Container = NonNullable<typeof repositories>;
export type ContainerKeys = keyof Container;

export const resolve = <K extends ContainerKeys>(key: K): Container[K] => {
  if (!repositories) throw new Error("Container not initialized — call initContainer(db) first");
  return (repositories as Container)[key];
};

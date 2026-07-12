import type { Db } from "mongodb";
import type { Driver } from "neo4j-driver";
import { MongoUserRepository } from "./User/user.repository.mongo.js";
import { MongoListingRepository } from "./Listing/listing.repository.mongo.js";
import { MongoContractRepository } from "./Contract/contract.repository.mongo.js";
import { MongoEventRepository } from "./Event/event.repository.mongo.js";
import { MongoIncidentRepository } from "./Incident/incident.repository.mongo.js";
import { MongoDistrictRepository } from "./District/district.repository.mongo.js";
import { MongoDistrictAdminRepository } from "./DistrictAdmin/district-admin.repository.mongo.js";
import { MongoTagRepository } from "./Tag/tag.repository.mongo.js";
import { MongoVoteRepository } from "./Vote/vote.repository.mongo.js";
import { MongoConversationRepository } from "./Conversation/conversation.repository.mongo.js";
import { MongoNotificationRepository } from "./Notification/notification.repository.mongo.js";
import { MongoTransactionRepository } from "./Transaction/transaction.repository.mongo.js";
import { Neo4jGraphRepository } from "./Graph/graph.repository.neo4j.js";

let repositories: {
  user: MongoUserRepository;
  listing: MongoListingRepository;
  contract: MongoContractRepository;
  event: MongoEventRepository;
  incident: MongoIncidentRepository;
  district: MongoDistrictRepository;
  districtAdmin: MongoDistrictAdminRepository;
  tag: MongoTagRepository;
  vote: MongoVoteRepository;
  conversation: MongoConversationRepository;
  notification: MongoNotificationRepository;
  transaction: MongoTransactionRepository;
  graph: Neo4jGraphRepository;
} | null = null;

export const initContainer = (db: Db, neo4jDriver: Driver) => {
  repositories = {
    user: new MongoUserRepository(db),
    listing: new MongoListingRepository(db),
    contract: new MongoContractRepository(db),
    event: new MongoEventRepository(db),
    incident: new MongoIncidentRepository(db),
    district: new MongoDistrictRepository(db),
    districtAdmin: new MongoDistrictAdminRepository(db),
    tag: new MongoTagRepository(db),
    vote: new MongoVoteRepository(db),
    conversation: new MongoConversationRepository(db),
    notification: new MongoNotificationRepository(db),
    transaction: new MongoTransactionRepository(db),
    graph: new Neo4jGraphRepository(neo4jDriver),
  };

  // Ensure required indexes exist (idempotent, non-blocking on startup).
  const withIndexes: Array<[string, { ensureIndexes(): Promise<void> }]> = [
    ["district", repositories.district],
    ["districtAdmin", repositories.districtAdmin],
    ["user", repositories.user],
    ["listing", repositories.listing],
    ["event", repositories.event],
    ["incident", repositories.incident],
    ["vote", repositories.vote],
    ["tag", repositories.tag],
    ["contract", repositories.contract],
    ["notification", repositories.notification],
    ["transaction", repositories.transaction],
    ["conversation", repositories.conversation],
  ];
  for (const [name, repo] of withIndexes) {
    void repo.ensureIndexes().catch((err) => console.error(`Failed to ensure ${name} indexes:`, err));
  }
};

type Container = NonNullable<typeof repositories>;
export type ContainerKeys = keyof Container;

export const resolve = <K extends ContainerKeys>(key: K): Container[K] => {
  if (!repositories) throw new Error("Container not initialized — call initContainer(db, neo4jDriver) first");
  return (repositories as Container)[key];
};

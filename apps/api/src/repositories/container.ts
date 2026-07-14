import type { Db } from "mongodb";
import type { Driver } from "neo4j-driver";
import type { SatanClient } from "@repo/satan";

import type { IUserRepository } from "./User/user.repository.js";
import type { IListingRepository } from "./Listing/listing.repository.js";
import type { IContractRepository } from "./Contract/contract.repository.js";
import type { IEventRepository } from "./Event/event.repository.js";
import type { IIncidentRepository } from "./Incident/incident.repository.js";
import type { IDistrictRepository } from "./District/district.repository.js";
import type { IDistrictAdminRepository } from "./DistrictAdmin/district-admin.repository.js";
import type { ITagRepository } from "./Tag/tag.repository.js";
import type { IVoteRepository } from "./Vote/vote.repository.js";
import type { IConversationRepository } from "./Conversation/conversation.repository.js";
import type { INotificationRepository } from "./Notification/notification.repository.js";
import type { ITransactionRepository } from "./Transaction/transaction.repository.js";

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

import { SatanUserRepository } from "./User/user.repository.satan.js";
import { SatanListingRepository } from "./Listing/listing.repository.satan.js";
import { SatanContractRepository } from "./Contract/contract.repository.satan.js";
import { SatanEventRepository } from "./Event/event.repository.satan.js";
import { SatanIncidentRepository } from "./Incident/incident.repository.satan.js";
import { SatanDistrictRepository } from "./District/district.repository.satan.js";
import { SatanDistrictAdminRepository } from "./DistrictAdmin/district-admin.repository.satan.js";
import { SatanTagRepository } from "./Tag/tag.repository.satan.js";
import { SatanVoteRepository } from "./Vote/vote.repository.satan.js";
import { SatanConversationRepository } from "./Conversation/conversation.repository.satan.js";
import { SatanNotificationRepository } from "./Notification/notification.repository.satan.js";
import { SatanTransactionRepository } from "./Transaction/transaction.repository.satan.js";

// Fields are typed by interface so either the Mongo or the SATAN implementation
// fits the same slot (see initContainer). The named type keeps resolve() typed
// (an inline `NonNullable<typeof repositories>` collapses to `never` under our TS pin).
type Container = {
  user: IUserRepository;
  listing: IListingRepository;
  contract: IContractRepository;
  event: IEventRepository;
  incident: IIncidentRepository;
  district: IDistrictRepository;
  districtAdmin: IDistrictAdminRepository;
  tag: ITagRepository;
  vote: IVoteRepository;
  conversation: IConversationRepository;
  notification: INotificationRepository;
  transaction: ITransactionRepository;
  graph: Neo4jGraphRepository;
};

let repositories: Container | null = null;

/**
 * Builds the repository container. When a SATAN client is supplied (and
 * `SATAN_REPOS` isn't `"false"`), each Mongo repo is wrapped in its SATAN-QL
 * counterpart, which answers the expressible queries through @repo/satan and
 * delegates the rest back to the Mongo repo it wraps.
 */
export const initContainer = (db: Db, neo4jDriver: Driver, satan?: SatanClient) => {
  const mongo = {
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
  };

  const useSatan = satan && process.env.SATAN_REPOS !== "false";

  repositories = {
    user: useSatan ? new SatanUserRepository(mongo.user, satan) : mongo.user,
    listing: useSatan ? new SatanListingRepository(mongo.listing, satan) : mongo.listing,
    contract: useSatan ? new SatanContractRepository(mongo.contract, satan) : mongo.contract,
    event: useSatan ? new SatanEventRepository(mongo.event, satan) : mongo.event,
    incident: useSatan ? new SatanIncidentRepository(mongo.incident, satan) : mongo.incident,
    district: useSatan ? new SatanDistrictRepository(mongo.district, satan) : mongo.district,
    districtAdmin: useSatan ? new SatanDistrictAdminRepository(mongo.districtAdmin, satan) : mongo.districtAdmin,
    tag: useSatan ? new SatanTagRepository(mongo.tag, satan) : mongo.tag,
    vote: useSatan ? new SatanVoteRepository(mongo.vote, satan) : mongo.vote,
    conversation: useSatan ? new SatanConversationRepository(mongo.conversation, satan) : mongo.conversation,
    notification: useSatan ? new SatanNotificationRepository(mongo.notification, satan) : mongo.notification,
    transaction: useSatan ? new SatanTransactionRepository(mongo.transaction, satan) : mongo.transaction,
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

export type ContainerKeys = keyof Container;

export const resolve = <K extends ContainerKeys>(key: K): Container[K] => {
  if (!repositories) throw new Error("Container not initialized — call initContainer(db, neo4jDriver) first");
  return repositories[key];
};

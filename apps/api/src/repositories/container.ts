import type { Db } from "mongodb";
import type { Driver } from "neo4j-driver";
import type { SatanClient } from "@repo/satan";
import { createContainer } from "@repo/shared";
import { logger } from "../logger.js";

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
import type { ICounterRepository } from "./Sync/counter.repository.js";
import type { ISyncStateRepository } from "./Sync/sync-state.repository.js";
import type { ISyncChangesRepository } from "./Sync/sync-changes.repository.js";
import type { ISyncConflictsRepository } from "./Sync/sync-conflicts.repository.js";
import type { ISyncWriterRepository } from "./Sync/sync-writer.repository.js";

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
import { MongoCounterRepository } from "./Sync/counter.repository.mongo.js";
import { MongoSyncStateRepository } from "./Sync/sync-state.repository.mongo.js";
import { MongoSyncChangesRepository } from "./Sync/sync-changes.repository.mongo.js";
import { MongoSyncConflictsRepository } from "./Sync/sync-conflicts.repository.mongo.js";
import { MongoSyncWriterRepository } from "./Sync/sync-writer.repository.mongo.js";

// Container d'injection de dépendances des repositories (couche infrastructure).
//
// Construit et enregistre chaque repository, puis expose `resolve(name)` pour que
// les handlers de routes récupèrent leurs dépendances par nom. Selon la config,
// chaque repository Mongo peut être enveloppé dans son homologue SATAN QL.

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

// Les champs sont typés par interface pour que l'implémentation Mongo ou SATAN
// occupe indifféremment le même emplacement (voir initContainer). Le type nommé
// garde resolve() correctement typé (un `NonNullable<typeof repositories>` inline
// s'effondre en `never` avec la version de TS épinglée du projet).
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
  // Synchronisation hors-ligne (H2 ↔ Mongo). Pas de variante SATAN — c'est de l'infrastructure, pas des requêtes métier.
  syncCounter: ICounterRepository;
  syncState: ISyncStateRepository;
  syncChanges: ISyncChangesRepository;
  syncConflicts: ISyncConflictsRepository;
  syncWriter: ISyncWriterRepository;
};

const { set, resolve } = createContainer<Container>();
export type ContainerKeys = keyof Container;
export { resolve };

/**
 * Construit le container de repositories. Lorsqu'un client SATAN est fourni (et
 * que `SATAN_REPOS` n'est pas `"false"`), chaque repo Mongo est enveloppé dans son
 * homologue SATAN QL, qui répond aux requêtes exprimables via @repo/satan et
 * délègue le reste au repo Mongo qu'il enveloppe.
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

  const syncCounter = new MongoCounterRepository(db);

  // Active l'enveloppe SATAN uniquement si un client est fourni et n'a pas été désactivé par l'env.
  const useSatan = satan && process.env.SATAN_REPOS !== "false";

  const repositories: Container = {
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
    syncCounter,
    syncState: new MongoSyncStateRepository(db),
    syncChanges: new MongoSyncChangesRepository(db, syncCounter),
    syncConflicts: new MongoSyncConflictsRepository(db),
    syncWriter: new MongoSyncWriterRepository(db),
  };
  set(repositories);

  // Garantit l'existence des index requis (idempotent, non bloquant au démarrage).
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
    ["syncChanges", repositories.syncChanges],
    ["syncConflicts", repositories.syncConflicts],
  ];
  // Lance chaque création d'index en arrière-plan ; un échec est loggé sans bloquer le boot.
  for (const [name, repo] of withIndexes) {
    void repo.ensureIndexes().catch((err) => logger.error({ err, name }, "Failed to ensure indexes"));
  }
};

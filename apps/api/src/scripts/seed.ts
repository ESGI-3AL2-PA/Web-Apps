/**
 * Script de seed — peuple MongoDB et Neo4j à partir d'un fichier de scénario NDJSON
 * situé dans le répertoire `seed-data/` à la racine du dépôt. Voir ce répertoire pour
 * le format attendu.
 *
 * Usage :
 *   npm run seed                    # depuis apps/api — utilise seed-data/demo.txt
 *   npm run seed -- minimal         # utilise seed-data/minimal.txt
 *   npm run seed -- ./scratch.txt   # chemin quelconque, résolu par rapport au cwd
 *   SEED_SCENARIO=minimal npm run seed
 *
 * DESTRUCTEUR. Chaque exécution supprime purement et simplement les collections seedées
 * — pas seulement les lignes qu'il possède — plus le trio de l'offline-sync, puis efface
 * et re-projette le graphe Neo4j. Tout ce que vous avez créé à la main dans ces
 * collections est perdu. Ce qu'il ne touche PAS : `refresh_tokens`, `contracts`,
 * `authorization_codes` et l'état des migrations.
 *
 * Deux conséquences à connaître :
 *   - `users` est droppée, or le superAdmin y vit mais est créé par le `seed-superadmin`
 *     de l'auth-service. Compose lance `auth-seed` après ce script pour cette raison ;
 *     à la main, exécutez-les dans le même ordre.
 *   - le flux de sync n'est reconstruit qu'au boot de l'api (`sync_state.seeded` le
 *     protège), donc redémarrez l'api ensuite sinon les clients desktop récupèrent un
 *     flux vide.
 */

import argon2 from "argon2";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Db } from "mongodb";
import { connectDB } from "../repositories/mongodb.connector.js";
import { connectNeo4j, closeNeo4j } from "../repositories/neo4j.connector.js";
import { Neo4jGraphRepository } from "../repositories/Graph/graph.repository.neo4j.js";
import { DROPPED_COLLECTIONS, loadSeedFile, MONGO_COLLECTIONS } from "./loader.js";
import type { SeedDataset, SeedDocument } from "./loader.js";

const seedPassword = process.env.SEED_PASSWORD ?? "Password123!";

// Les fichiers de scénario vivent à la racine du dépôt (`/seed-data/`). `src/scripts/`
// et `dist/scripts/` sont à la même profondeur sous `apps/api/`, donc remonter de quatre
// crans résout à l'identique sous tsx et sous node — et, contrairement à process.cwd(),
// peu importe que compose tourne depuis /app tandis que `npm run seed` tourne depuis apps/api.
const SEED_DATA_DIR = new URL("../../../../seed-data/", import.meta.url);

const resolveScenarioPath = (arg: string): URL => {
  if (arg.includes("/") || arg.includes("\\") || arg.endsWith(".txt")) {
    return new URL(arg, `file://${process.cwd()}/`);
  }
  return new URL(`${arg}.txt`, SEED_DATA_DIR);
};

const describeAvailableScenarios = async (): Promise<string> => {
  try {
    const entries = await readdir(SEED_DATA_DIR);
    const scenarios = entries.filter((e) => e.endsWith(".txt")).map((e) => e.replace(/\.txt$/, ""));
    return scenarios.length > 0 ? scenarios.join(", ") : "(none found)";
  } catch {
    return "(seed-data directory not found)";
  }
};

// ─── Mongo ────────────────────────────────────────────────────────────────────

// Le flux de l'offline-sync tient en trois collections couplées : le journal des
// changements, le curseur du watcher + son drapeau `seeded` à usage unique, et le
// compteur de séquence qui garde les indices de changement monotones. Dropper un
// sous-ensemble d'entre elles corrompt la sync desktop — videz le journal mais gardez
// le compteur, et les clients ayant déjà vu la séquence N ne reçoivent jamais le
// backfill, silencieusement. On ne les droppe donc que toutes ensemble, avec les
// données qu'elles reflètent. (SYNC_COLLECTIONS / DROPPED_COLLECTIONS vivent dans
// ./loader.js — importer ce module lancerait main(), la liste des drops doit donc
// être testable depuis ailleurs.)

const dropCollection = async (db: Db, name: string): Promise<boolean> => {
  try {
    await db.collection(name).drop();
    return true;
  } catch (err) {
    // 26 = NamespaceNotFound : rien à dropper sur une base neuve.
    if ((err as { code?: number }).code === 26) return false;
    throw err;
  }
};

const resetDatabases = async (db: Db, graph: Neo4jGraphRepository): Promise<void> => {
  const dropped: string[] = [];
  for (const name of DROPPED_COLLECTIONS) {
    if (await dropCollection(db, name)) dropped.push(name);
  }
  console.log(`  ✓ dropped ${dropped.length} collection(s): ${dropped.join(", ") || "(none existed)"}`);

  // Le graphe est une projection de Mongo : un effacement complet est sûr et c'est le
  // seul moyen de retirer les nœuds d'un scénario seedé précédemment — les upserts
  // ci-dessous sont tous des MERGE et ne suppriment jamais rien.
  await graph.reset();
  console.log("  ✓ wiped the Neo4j graph");
};

const seedCollection = async (db: Db, collectionName: string, documents: SeedDocument[]) => {
  if (documents.length === 0) return;
  // La collection vient d'être droppée, c'est donc un simple insert.
  await db.collection(collectionName).insertMany(documents as never);
  console.log(`  ✓ ${collectionName}: ${documents.length} document(s)`);
};

// ─── Projection du graphe Neo4j ─────────────────────────────────────────────
// Reflète le même dataset de seed dans Neo4j : nœuds (User, District, Tag, Listing,
// Event, Vote, Incident) et toutes les relations décrites dans
// documentation/MCD/neo4j.md. Idempotent grâce à MERGE.

// Les documents chargés sont du JSON non typé. Ces vues restreintes concentrent les
// casts en tête plutôt que de les disperser sur chaque appel de repository ci-dessous.
type DistrictRow = { _id: string; name: string };
type UserRow = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  districtId?: string;
  createdAt: string;
  address?: string;
};
type TagRow = { name: string; description: { en: string } };
type ListingRow = { _id: string; authorId: string; tags?: string[] };
type EventRow = {
  _id: string;
  title: string;
  eventDate: string;
  creatorId: string;
  districtId: string;
  createdAt: string;
  registrants?: string[];
};
type VoteRow = { _id: string; question: string; endDate: string; districtIds?: string[] };
type VoteResponseRow = { userId: string; voteId: string; chosenOption: string; votedAt: string };
type IncidentRow = { _id: string; category: string; status: string; reporterId: string; districtId: string };

const rows = <T>(data: SeedDataset, collection: (typeof MONGO_COLLECTIONS)[number]): T[] =>
  (data.collections.get(collection) ?? []) as unknown as T[];

const seedGraph = async (graph: Neo4jGraphRepository, data: SeedDataset): Promise<void> => {
  const districts = rows<DistrictRow>(data, "districts");
  const users = rows<UserRow>(data, "users");
  const tags = rows<TagRow>(data, "tags");
  const listings = rows<ListingRow>(data, "listings");
  const events = rows<EventRow>(data, "events");
  const votes = rows<VoteRow>(data, "votes");
  const voteResponses = rows<VoteResponseRow>(data, "vote_responses");
  const incidents = rows<IncidentRow>(data, "incidents");

  // ── Nœuds ───────────────────────────────────────────────────────────────
  for (const d of districts) {
    await graph.upsertDistrict({ id: d._id, name: d.name });
  }
  for (const u of users) {
    await graph.upsertUser({
      id: u._id,
      name: `${u.firstName} ${u.lastName}`,
      email: u.email,
      role: u.role,
    });
  }
  for (const t of tags) {
    await graph.upsertTag({ name: t.name, category: t.description.en });
  }
  for (const l of listings) {
    await graph.upsertListing({ id: l._id, category: l.tags?.[0] });
  }
  for (const e of events) {
    await graph.upsertEvent({ id: e._id, title: e.title, date: e.eventDate });
  }
  for (const v of votes) {
    await graph.upsertVote({ id: v._id, question: v.question, endDate: v.endDate });
  }
  for (const i of incidents) {
    await graph.upsertIncident({ id: i._id, category: i.category, status: i.status });
  }

  // ── Résidence ──────────────────────────────────────────────────────────
  for (const u of users) {
    if (u.districtId) {
      await graph.linkUserLivesIn(u._id, u.districtId, u.createdAt, u.address);
    }
  }

  // ── Annonces ───────────────────────────────────────────────────────────
  for (const l of listings) {
    await graph.linkUserPublishedListing(l.authorId, l._id);
    for (const tag of l.tags ?? []) {
      await graph.linkListingTagged(l._id, tag);
    }
  }

  // ── Événements ─────────────────────────────────────────────────────────
  for (const e of events) {
    await graph.linkUserCreatedEvent(e.creatorId, e._id);
    await graph.linkDistrictContainsEvent(e.districtId, e._id);
    for (const userId of e.registrants ?? []) {
      await graph.linkUserRegisteredForEvent(userId, e._id, e.createdAt, "registered");
    }
  }

  // ── Tags d'événements + signaux d'intérêt (les deux exclusivement Neo4j ;
  //    voir les blocs @graph du fichier de scénario pour leur raison d'être).
  for (const { eventId, tags: tagNames } of data.graph.eventTags) {
    for (const tagName of tagNames) {
      await graph.linkEventTagged(eventId, tagName);
    }
  }
  for (const sig of data.graph.interests) {
    // setUserInterestedInEvent au lieu de linkUserInterestedInEvent : on veut un
    // SET absolu (idempotent) pour pouvoir relancer `npm run seed` sans doubler
    // les scores à chaque exécution.
    await graph.setUserInterestedInEvent(sig.userId, sig.eventId, sig.score);
  }

  // ── Votes / sondages ───────────────────────────────────────────────────
  for (const v of votes) {
    for (const districtId of v.districtIds ?? []) {
      await graph.linkDistrictConcernsVote(districtId, v._id);
    }
  }
  for (const r of voteResponses) {
    await graph.linkUserVoted(r.userId, r.voteId, r.chosenOption, r.votedAt);
  }

  // ── Signalements ───────────────────────────────────────────────────────
  for (const i of incidents) {
    await graph.linkUserReportedIncident(i.reporterId, i._id);
    await graph.linkDistrictContainsIncident(i.districtId, i._id);
  }
};

const main = async () => {
  // Garde-fou : ceci DROPPE les collections seedées et le flux de sync, puis les
  // repeuple avec des comptes fictifs (y compris un admin). Sur une base de production
  // c'est une perte totale de données, pas un rafraîchissement — SEED_ALLOW_PRODUCTION
  // est la seule chose entre un NODE_ENV égaré et une prod vidée. Ne le définir que
  // pour effacer volontairement.
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "true") {
    console.error("❌  Refusing to seed with NODE_ENV=production (set SEED_ALLOW_PRODUCTION=true to override).");
    console.error("    This script drops collections; on a real database that is unrecoverable without a backup.");
    process.exit(1);
  }

  const scenario = process.argv[2] ?? process.env.SEED_SCENARIO ?? "demo";
  const scenarioPath = resolveScenarioPath(scenario);

  let dataset: SeedDataset;
  try {
    dataset = await loadSeedFile(fileURLToPath(scenarioPath), {
      now: new Date(),
      passwordHash: await argon2.hash(seedPassword),
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.error(`❌  Scenario "${scenario}" not found at ${fileURLToPath(scenarioPath)}.`);
      console.error(`    Available scenarios: ${await describeAvailableScenarios()}`);
    } else {
      console.error(`❌  ${(err as Error).message}`);
    }
    process.exit(1);
  }

  console.log(`🌱  Seeding databases (Mongo + Neo4j) from "${scenario}"...`);

  let driver: Awaited<ReturnType<typeof connectNeo4j>> | null = null;

  try {
    const db = await connectDB();
    driver = await connectNeo4j();
    const graph = new Neo4jGraphRepository(driver);

    // ── Reset ────────────────────────────────────────────────────────────
    // Les deux stores sont réinitialisés d'abord, ainsi un échec en cours de route
    // laisse tout vide plutôt que moitié-ancien/moitié-nouveau.
    console.log("\n🧹  Reset");
    await resetDatabases(db, graph);

    // ── Mongo ────────────────────────────────────────────────────────────
    console.log("\n📄  Mongo");
    for (const name of MONGO_COLLECTIONS) {
      await seedCollection(db, name, dataset.collections.get(name) ?? []);
    }
    console.warn(`  🔑 seeded users share password "${seedPassword}" (e.g. alice@example.com)`);
    console.log(`  ✅ ${dataset.totalDocuments} documents across ${dataset.collections.size} collections.`);

    // ── Neo4j ────────────────────────────────────────────────────────────
    console.log("\n🕸️  Neo4j");
    await seedGraph(graph, dataset);
    console.log(`  ✅ graph projection synced (nodes + relationships).`);

    console.log("\n✅  Seed complete.");
    console.warn("⚠️   Restart the api so it rebuilds the offline-sync feed (sync_state was dropped).");
    console.warn("⚠️   The superAdmin was dropped with `users` — run auth-service's seed:superadmin to restore it.");
  } catch (err) {
    console.error("\n❌  Seed failed:", err);
    process.exitCode = 1;
  } finally {
    if (driver) {
      await closeNeo4j().catch(() => undefined);
    }
    // Le client Mongo est un singleton dans mongodb.connector ; le processus va sortir,
    // ce qui ferme le socket. On garde ça simple pour reproduire le comportement
    // d'arrêt précédent.
    process.exit(process.exitCode ?? 0);
  }
};

void main();

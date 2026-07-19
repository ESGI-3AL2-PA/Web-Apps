/**
 * Seed script — populates MongoDB and Neo4j from an NDJSON scenario file under
 * the repo-root `seed-data/` directory. See that directory for the format.
 *
 * Usage:
 *   npm run seed                    # from apps/api — uses seed-data/demo.txt
 *   npm run seed -- minimal         # uses seed-data/minimal.txt
 *   npm run seed -- ./scratch.txt   # any path, resolved against the cwd
 *   SEED_SCENARIO=minimal npm run seed
 *
 * DESTRUCTIVE. Every run drops the seeded collections outright — not just the rows
 * it owns — plus the offline-sync trio, then wipes and re-projects the Neo4j graph.
 * Anything you created by hand in those collections is gone. What it does NOT touch:
 * `refresh_tokens`, `contracts`, `authorization_codes`, and the migration state.
 *
 * Two consequences worth knowing:
 *   - `users` is dropped, and the superAdmin lives there but is created by
 *     auth-service's `seed-superadmin`. Compose runs `auth-seed` after this script
 *     for that reason; run them in the same order by hand.
 *   - the sync feed is only rebuilt when the api boots (`sync_state.seeded` guards
 *     it), so restart the api afterwards or desktop clients pull an empty feed.
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

// Scenario files live at the repo root (`/seed-data/`). `src/scripts/` and
// `dist/scripts/` sit at the same depth under `apps/api/`, so four hops up resolves
// identically under tsx and under node — and, unlike process.cwd(), it does not care
// that compose runs from /app while `npm run seed` runs from apps/api.
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

// The offline-sync feed is three coupled collections: the change log, the watcher's
// cursor + one-shot `seeded` flag, and the sequence counter that keeps change indices
// monotonic. Dropping any subset of them corrupts desktop sync — clear the change log
// but keep the counter and clients that already saw seq N never receive the backfill,
// silently. So they are only ever dropped together, alongside the data they mirror.
// (SYNC_COLLECTIONS / DROPPED_COLLECTIONS live in ./loader.js — importing
// this module would run main(), so the drop list has to be testable from elsewhere.)

const dropCollection = async (db: Db, name: string): Promise<boolean> => {
  try {
    await db.collection(name).drop();
    return true;
  } catch (err) {
    // 26 = NamespaceNotFound: nothing to drop on a fresh database.
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

  // The graph is a projection of Mongo, so a full wipe is safe and is the only way to
  // clear nodes from a previously-seeded scenario — the upserts below are all MERGE
  // and never remove anything.
  await graph.reset();
  console.log("  ✓ wiped the Neo4j graph");
};

const seedCollection = async (db: Db, collectionName: string, documents: SeedDocument[]) => {
  if (documents.length === 0) return;
  // The collection was just dropped, so this is a plain insert.
  await db.collection(collectionName).insertMany(documents as never);
  console.log(`  ✓ ${collectionName}: ${documents.length} document(s)`);
};

// ─── Neo4j graph projection ─────────────────────────────────────────────────
// Mirrors the same seed dataset into Neo4j: nodes (User, District, Tag, Listing,
// Event, Vote, Incident) and all the relationships described in
// documentation/MCD/neo4j.md. Idempotent thanks to MERGE.

// Loaded documents are untyped JSON. These narrow views keep the casts at the top
// rather than scattered across every repository call below.
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

  // ── Nodes ───────────────────────────────────────────────────────────────
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

  // ── Residence ──────────────────────────────────────────────────────────
  for (const u of users) {
    if (u.districtId) {
      await graph.linkUserLivesIn(u._id, u.districtId, u.createdAt, u.address);
    }
  }

  // ── Listings ───────────────────────────────────────────────────────────
  for (const l of listings) {
    await graph.linkUserPublishedListing(l.authorId, l._id);
    for (const tag of l.tags ?? []) {
      await graph.linkListingTagged(l._id, tag);
    }
  }

  // ── Events ─────────────────────────────────────────────────────────────
  for (const e of events) {
    await graph.linkUserCreatedEvent(e.creatorId, e._id);
    await graph.linkDistrictContainsEvent(e.districtId, e._id);
    for (const userId of e.registrants ?? []) {
      await graph.linkUserRegisteredForEvent(userId, e._id, e.createdAt, "registered");
    }
  }

  // ── Event tags + interest signals (both Neo4j-only; see the @graph blocks
  //    in the scenario file for why they exist).
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

  // ── Votes ──────────────────────────────────────────────────────────────
  for (const v of votes) {
    for (const districtId of v.districtIds ?? []) {
      await graph.linkDistrictConcernsVote(districtId, v._id);
    }
  }
  for (const r of voteResponses) {
    await graph.linkUserVoted(r.userId, r.voteId, r.chosenOption, r.votedAt);
  }

  // ── Incidents ──────────────────────────────────────────────────────────
  for (const i of incidents) {
    await graph.linkUserReportedIncident(i.reporterId, i._id);
    await graph.linkDistrictContainsIncident(i.districtId, i._id);
  }
};

const main = async () => {
  // Guard: this DROPS the seeded collections and the sync feed, then repopulates them
  // with fake accounts (including an admin). Against a production database that is
  // total data loss, not a refresh — SEED_ALLOW_PRODUCTION is the only thing standing
  // between a stray NODE_ENV and an empty prod. Set it only to wipe on purpose.
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
    // Both stores go first, so a failure part-way leaves everything empty rather
    // than half-old/half-new.
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
    // Mongo client is a singleton inside mongodb.connector; the process will
    // exit which closes the socket. Keeping this simple to mirror the previous
    // shutdown behaviour.
    process.exit(process.exitCode ?? 0);
  }
};

void main();

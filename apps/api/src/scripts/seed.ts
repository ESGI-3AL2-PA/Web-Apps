/**
 * Seed script — populates MongoDB and Neo4j from an NDJSON scenario file under
 * `apps/api/seed-data/`. See that directory for the format.
 *
 * Usage:
 *   npm run seed                    # from apps/api — uses seed-data/demo.txt
 *   npm run seed -- minimal         # uses seed-data/minimal.txt
 *   npm run seed -- ./scratch.txt   # any path, resolved against the cwd
 *   SEED_SCENARIO=minimal npm run seed
 *
 * The script is idempotent: existing seeded documents (recognised by their
 * deterministic `_id`s) are removed before reinsertion. Other documents in the
 * collections are left untouched.
 */

import argon2 from "argon2";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Db } from "mongodb";
import { connectDB } from "../repositories/mongodb.connector.js";
import { connectNeo4j, closeNeo4j } from "../repositories/neo4j.connector.js";
import { Neo4jGraphRepository } from "../repositories/Graph/graph.repository.neo4j.js";
import { loadSeedFile, MONGO_COLLECTIONS } from "./seed-data/loader.js";
import type { SeedDataset, SeedDocument } from "./seed-data/loader.js";

const seedPassword = process.env.SEED_PASSWORD ?? "Password123!";

// `src/scripts/` and `dist/scripts/` sit at the same depth under `apps/api/`, so this
// resolves identically under tsx and under node — and, unlike process.cwd(), it does
// not care that compose runs from /app while `npm run seed` runs from apps/api.
const SEED_DATA_DIR = new URL("../../seed-data/", import.meta.url);

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

const seedCollection = async (db: Db, collectionName: string, documents: SeedDocument[]) => {
  if (documents.length === 0) return;
  const collection = db.collection(collectionName);
  const seededIds = documents.map((d) => d._id);
  await collection.deleteMany({ _id: { $in: seededIds as never } });
  await collection.insertMany(documents as never);
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
  // Guard: this wipes+repopulates demo data. Never run it against a production
  // database, where it would insert fake accounts (including an admin) and delete
  // rows by seed id. Set SEED_ALLOW_PRODUCTION=true to override intentionally.
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "true") {
    console.error("❌  Refusing to seed with NODE_ENV=production (set SEED_ALLOW_PRODUCTION=true to override).");
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

    // ── Mongo ────────────────────────────────────────────────────────────
    console.log("\n📄  Mongo");
    for (const name of MONGO_COLLECTIONS) {
      await seedCollection(db, name, dataset.collections.get(name) ?? []);
    }
    console.warn(`  🔑 seeded users share password "${seedPassword}" (e.g. alice@example.com)`);
    console.log(`  ✅ ${dataset.totalDocuments} documents across ${dataset.collections.size} collections.`);

    // ── Neo4j ────────────────────────────────────────────────────────────
    console.log("\n🕸️  Neo4j");
    driver = await connectNeo4j();
    await seedGraph(new Neo4jGraphRepository(driver), dataset);
    console.log(`  ✅ graph projection synced (nodes + relationships).`);

    console.log("\n✅  Seed complete.");
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

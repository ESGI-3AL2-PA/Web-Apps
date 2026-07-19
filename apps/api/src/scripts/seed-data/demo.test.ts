/**
 * Fixture test over the real `seed-data/demo.txt`.
 *
 * The old TS literals got referential integrity from the compiler — `ids.users.alice`
 * could not be mistyped. Plain JSON gives that up, so the guarantee is asserted here
 * instead: every id-shaped field in the shipped dataset must resolve to a document
 * that the same file defines.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSeedData } from "./loader.js";
import type { SeedDataset, TokenContext } from "./loader.js";

const ctx: TokenContext = {
  now: new Date("2026-07-19T12:00:00.000Z"),
  passwordHash: "$argon2id$fake",
};

const demoPath = new URL("../../../seed-data/demo.txt", import.meta.url);
const dataset: SeedDataset = parseSeedData(readFileSync(demoPath, "utf8"), ctx, "demo.txt");

const allIds = new Set([...dataset.collections.values()].flat().map((doc) => doc._id));

// Scalar fields that hold a single document id, and array fields that hold several.
const SCALAR_REFS = [
  "districtId",
  "userId",
  "authorId",
  "creatorId",
  "reporterId",
  "recipientId",
  "voteId",
  "eventId",
  "refId",
];
const ARRAY_REFS = ["districtIds", "participantIds", "registrants"];

describe("seed-data/demo.txt", () => {
  it("parses into the expected collection sizes", () => {
    const counts = Object.fromEntries([...dataset.collections].map(([name, docs]) => [name, docs.length]));

    expect(counts).toEqual({
      districts: 2,
      users: 5,
      district_admins: 1,
      tags: 8,
      listings: 5,
      events: 3,
      incidents: 3,
      votes: 6,
      vote_responses: 11,
      conversations: 2,
      messages: 4,
      notifications: 4,
      transactions: 2,
    });
    expect(dataset.totalDocuments).toBe(56);
  });

  it("carries the Neo4j-only signals the recommender needs", () => {
    expect(dataset.graph.eventTags).toHaveLength(3);
    expect(dataset.graph.interests).toHaveLength(9);
  });

  it("resolves every document reference to a document defined in the same file", () => {
    const dangling: string[] = [];

    for (const [collection, docs] of dataset.collections) {
      for (const doc of docs) {
        for (const key of SCALAR_REFS) {
          const value = doc[key];
          if (typeof value === "string" && value.startsWith("seed-") && !allIds.has(value)) {
            dangling.push(`${collection}/${doc._id}: ${key} -> ${value}`);
          }
        }
        for (const key of ARRAY_REFS) {
          for (const value of (doc[key] as string[] | undefined) ?? []) {
            if (!allIds.has(value)) dangling.push(`${collection}/${doc._id}: ${key} -> ${value}`);
          }
        }
      }
    }

    expect(dangling).toEqual([]);
  });

  it("resolves every graph-only reference", () => {
    const dangling: string[] = [];

    for (const signal of dataset.graph.interests) {
      if (!allIds.has(signal.userId)) dangling.push(`interests: userId -> ${signal.userId}`);
      if (!allIds.has(signal.eventId)) dangling.push(`interests: eventId -> ${signal.eventId}`);
    }
    for (const row of dataset.graph.eventTags) {
      if (!allIds.has(row.eventId)) dangling.push(`event_tags: eventId -> ${row.eventId}`);
    }

    expect(dangling).toEqual([]);
  });

  it("gives every demo user the resolved password hash", () => {
    const users = dataset.collections.get("users")!;

    expect(users.every((u) => u.passwordHash === ctx.passwordHash)).toBe(true);
  });

  it("leaves no unresolved token anywhere in the dataset", () => {
    expect(JSON.stringify([...dataset.collections.values()])).not.toMatch(/\{\{/);
  });
});

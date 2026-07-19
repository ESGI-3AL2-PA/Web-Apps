/**
 * Integrity checks that apply to *every* scenario file in `seed-data/`, not just demo.
 *
 * Hand-authored JSON has none of the compile-time safety the old TS literals had, so
 * each committed scenario is walked here: every id-shaped field must resolve, every
 * listing tag must be a defined tag, and every vote's `results` counts must match its
 * recorded responses. A new scenario file is picked up automatically.
 */

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSeedData } from "./loader.js";
import type { SeedDataset, TokenContext } from "./loader.js";

const ctx: TokenContext = {
  now: new Date("2026-07-19T12:00:00.000Z"),
  passwordHash: "$argon2id$fake",
};

const seedDir = new URL("../../../seed-data/", import.meta.url);
const scenarios = readdirSync(seedDir).filter((f) => f.endsWith(".txt"));

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
  "assignedTo",
  "senderId",
  "conversationId",
];
const ARRAY_REFS = ["districtIds", "participants", "registrants"];

const load = (file: string): SeedDataset => parseSeedData(readFileSync(new URL(file, seedDir), "utf8"), ctx, file);

it("finds at least the demo, demo-large and minimal scenarios", () => {
  expect(scenarios).toEqual(expect.arrayContaining(["demo.txt", "demo-large.txt", "minimal.txt"]));
});

describe.each(scenarios)("%s", (file) => {
  const data = load(file);
  const ids = new Set([...data.collections.values()].flat().map((doc) => doc._id));

  it("resolves every document and graph reference to a seeded _id", () => {
    const dangling: string[] = [];

    for (const [collection, docs] of data.collections) {
      for (const doc of docs) {
        for (const key of SCALAR_REFS) {
          const value = doc[key];
          if (typeof value === "string" && value.startsWith("seed-") && !ids.has(value)) {
            dangling.push(`${collection}/${doc._id}.${key} -> ${value}`);
          }
        }
        for (const key of ARRAY_REFS) {
          for (const value of (doc[key] as string[] | undefined) ?? []) {
            if (typeof value === "string" && value.startsWith("seed-") && !ids.has(value)) {
              dangling.push(`${collection}/${doc._id}.${key} -> ${value}`);
            }
          }
        }
      }
    }
    for (const s of data.graph.interests) {
      if (!ids.has(s.userId)) dangling.push(`interests.userId -> ${s.userId}`);
      if (!ids.has(s.eventId)) dangling.push(`interests.eventId -> ${s.eventId}`);
    }
    for (const t of data.graph.eventTags) {
      if (!ids.has(t.eventId)) dangling.push(`event_tags.eventId -> ${t.eventId}`);
    }

    expect(dangling).toEqual([]);
  });

  it("references only defined tag names from listings", () => {
    const tagNames = new Set((data.collections.get("tags") ?? []).map((t) => t.name as string));
    const undefinedTags: string[] = [];

    for (const listing of data.collections.get("listings") ?? []) {
      for (const tag of (listing.tags as string[] | undefined) ?? []) {
        if (!tagNames.has(tag)) undefinedTags.push(`${listing._id} -> "${tag}"`);
      }
    }

    expect(undefinedTags).toEqual([]);
  });

  it("keeps each vote's result counts in sync with its responses", () => {
    const responsesByVote = new Map<string, string[]>();
    for (const r of data.collections.get("vote_responses") ?? []) {
      const options = responsesByVote.get(r.voteId as string) ?? [];
      options.push(r.chosenOption as string);
      responsesByVote.set(r.voteId as string, options);
    }

    const mismatches: string[] = [];
    for (const vote of data.collections.get("votes") ?? []) {
      const chosen = responsesByVote.get(vote._id) ?? [];
      for (const result of vote.results as { option: string; count: number }[]) {
        const actual = chosen.filter((o) => o === result.option).length;
        if (actual !== result.count) {
          mismatches.push(`${vote._id}/"${result.option}": count=${result.count} but ${actual} response(s)`);
        }
      }
    }

    expect(mismatches).toEqual([]);
  });
});

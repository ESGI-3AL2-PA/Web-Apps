/**
 * Backfill script — migrates tag docs written before per-language labels existed.
 * For every tag missing `label`, sets it from the known default translations (by
 * `name`) or falls back to the raw name in both languages. A legacy string
 * `description` is wrapped into `{ fr, en }`.
 *
 * Usage:
 *   npm run tags:backfill        # from apps/api
 *   tsx src/scripts/backfill-tag-labels.ts
 *
 * Idempotent: docs already carrying an object `label` are left untouched.
 */

import { connectDB, closeDB } from "../repositories/mongodb.connector.js";
import { DEFAULT_TAGS } from "../use-cases/tags/default-tags.js";

type LegacyTagDoc = {
  _id: string;
  name: string;
  label?: { fr: string; en: string };
  description?: string | { fr?: string; en?: string };
};

const defaultsByName = new Map(DEFAULT_TAGS.map((t) => [t.name, t]));

const main = async (): Promise<void> => {
  const db = await connectDB();
  const collection = db.collection<LegacyTagDoc>("tags");

  const docs = await collection.find({}).toArray();
  let migrated = 0;

  for (const doc of docs) {
    const set: Partial<LegacyTagDoc> = {};

    if (!doc.label || typeof doc.label !== "object") {
      const preset = defaultsByName.get(doc.name);
      set.label = preset ? preset.label : { fr: doc.name, en: doc.name };
    }

    if (typeof doc.description === "string") {
      const preset = defaultsByName.get(doc.name);
      set.description = preset?.description ?? { fr: doc.description, en: doc.description };
    }

    if (Object.keys(set).length > 0) {
      await collection.updateOne({ _id: doc._id }, { $set: set });
      migrated++;
    }
  }

  console.warn(`✓  Tag label backfill complete: ${migrated}/${docs.length} tag(s) updated.`);
  await closeDB();
  process.exit(0);
};

void main().catch(async (err) => {
  console.error("Tag label backfill failed:", err);
  await closeDB().catch(() => {});
  process.exit(1);
});

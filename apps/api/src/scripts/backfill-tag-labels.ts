/**
 * Script de backfill — migre les documents tag écrits avant l'existence des labels
 * par langue. Pour chaque tag sans `label`, on le renseigne depuis les traductions
 * par défaut connues (indexées par `name`), sinon on retombe sur le nom brut dans
 * les deux langues. Une `description` héritée sous forme de chaîne est enveloppée
 * en `{ fr, en }`.
 *
 * Usage :
 *   npm run tags:backfill        # depuis apps/api
 *   tsx src/scripts/backfill-tag-labels.ts
 *
 * Idempotent : les documents portant déjà un `label` de type objet sont laissés intacts.
 */

import { connectDB, closeDB } from "../repositories/mongodb.connector.js";
import { DEFAULT_TAGS } from "../use-cases/tags/default-tags.js";

// Forme d'un document tag « historique » : `label` et `description` peuvent être
// absents ou (pour description) au format chaîne d'avant la bascule multilingue.
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

    // Label manquant ou non-objet → preset connu, sinon nom brut dans les deux langues.
    if (!doc.label || typeof doc.label !== "object") {
      const preset = defaultsByName.get(doc.name);
      set.label = preset ? preset.label : { fr: doc.name, en: doc.name };
    }

    // Description encore au format chaîne → on l'enveloppe en { fr, en }.
    if (typeof doc.description === "string") {
      const preset = defaultsByName.get(doc.name);
      set.description = preset?.description ?? { fr: doc.description, en: doc.description };
    }

    // On n'écrit que si quelque chose a réellement changé (préserve l'idempotence).
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

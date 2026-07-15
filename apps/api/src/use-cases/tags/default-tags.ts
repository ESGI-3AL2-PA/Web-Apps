import type { Tag } from "../../entities/tag.entity.js";

/**
 * Base set of tags every district should have available on creation.
 * Seeded idempotently by `name` — editing this list only adds missing tags,
 * it does not update or remove existing ones. `name` is the stable key;
 * `label`/`description` carry the per-language display text (fr/en).
 */
export const DEFAULT_TAGS: Array<Omit<Tag, "id" | "districtId">> = [
  {
    name: "plumbing",
    label: { fr: "Plomberie", en: "Plumbing" },
    description: { fr: "Plomberie et services liés à l'eau", en: "Plumbing and water-related services" },
  },
  {
    name: "electrical",
    label: { fr: "Électricité", en: "Electrical" },
    description: { fr: "Travaux et réparations électriques", en: "Electrical work and repairs" },
  },
  {
    name: "gardening",
    label: { fr: "Jardinage", en: "Gardening" },
    description: { fr: "Jardinage et entretien extérieur", en: "Gardening and outdoor maintenance" },
  },
  {
    name: "cleaning",
    label: { fr: "Ménage", en: "Cleaning" },
    description: { fr: "Ménage et entretien du logement", en: "Cleaning and housekeeping" },
  },
  {
    name: "moving",
    label: { fr: "Déménagement", en: "Moving" },
    description: { fr: "Déménagement et manutention", en: "Moving and heavy lifting" },
  },
  {
    name: "childcare",
    label: { fr: "Garde d'enfants", en: "Childcare" },
    description: { fr: "Baby-sitting et garde d'enfants", en: "Babysitting and childcare" },
  },
  {
    name: "tutoring",
    label: { fr: "Cours particuliers", en: "Tutoring" },
    description: { fr: "Cours et soutien scolaire", en: "Lessons and tutoring" },
  },
  {
    name: "pets",
    label: { fr: "Animaux", en: "Pets" },
    description: { fr: "Garde et promenade d'animaux", en: "Pet care and walking" },
  },
  {
    name: "diy",
    label: { fr: "Bricolage", en: "DIY" },
    description: { fr: "Bricolage, réparations et travaux manuels", en: "DIY, repairs and handiwork" },
  },
  {
    name: "transport",
    label: { fr: "Transport", en: "Transport" },
    description: { fr: "Trajets et transport", en: "Rides and transport" },
  },
];

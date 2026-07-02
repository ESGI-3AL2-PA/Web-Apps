import { randomUUID } from "crypto";
import argon2 from "argon2";
import type { Db, Document, OptionalId } from "mongodb";
import { connectDB, closeDB } from "./repositories/mongodb.connector.js";

/**
 * Populates the database with a large, internally-consistent set of realistic demo data:
 * districts (with GeoJSON boundaries), users, tags, listings, contracts, transactions,
 * events, incidents, votes (+ responses), conversations (+ messages) and notifications.
 *
 * Idempotent-ish: every run wipes the domain collections and re-seeds them. Real accounts are
 * preserved — only users whose email ends in the SEED_EMAIL_DOMAIN are removed, so a seeded
 * superAdmin (superadmin@local.dev) and any hand-made accounts survive.
 *
 * Every seeded user shares the same password (SEED_PASSWORD, default "Password!123"), hashed once.
 *
 * Run: `npm run seed -w apps/api`  (or `tsx src/seed.ts` from apps/api)
 */

const SEED_EMAIL_DOMAIN = "seed.local";
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "Password!123";

// ---------------------------------------------------------------------------
// Deterministic PRNG so re-runs produce the same dataset (easier to reason about
// while developing against it). Swap the seed to reshuffle everything.
// ---------------------------------------------------------------------------
let _s = 0x2545f491;
const rnd = (): number => {
  // xorshift32
  _s ^= _s << 13;
  _s ^= _s >>> 17;
  _s ^= _s << 5;
  // >>> 0 to keep it unsigned, then normalise to [0, 1)
  return (_s >>> 0) / 0xffffffff;
};
const int = (min: number, max: number): number => Math.floor(rnd() * (max - min + 1)) + min;
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]!;
const chance = (p: number): boolean => rnd() < p;
const sample = <T>(arr: readonly T[], n: number): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, Math.min(n, copy.length));
};

const now = Date.now();
const DAY = 86_400_000;
// ISO string `days` in the past (+ a random intra-day offset for spread).
const daysAgo = (days: number): string => new Date(now - days * DAY - Math.floor(rnd() * DAY)).toISOString();
// ISO string `days` in the future.
const daysAhead = (days: number): string => new Date(now + days * DAY + Math.floor(rnd() * DAY)).toISOString();

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------
const FIRST_NAMES = [
  "Camille",
  "Lucas",
  "Léa",
  "Hugo",
  "Emma",
  "Nathan",
  "Chloé",
  "Louis",
  "Manon",
  "Gabriel",
  "Sarah",
  "Jules",
  "Inès",
  "Adam",
  "Jade",
  "Raphaël",
  "Louise",
  "Arthur",
  "Alice",
  "Théo",
  "Lina",
  "Paul",
  "Rose",
  "Noah",
  "Anna",
  "Ethan",
  "Julia",
  "Tom",
  "Zoé",
  "Sacha",
  "Nina",
  "Maël",
  "Éva",
  "Liam",
  "Mila",
  "Timéo",
  "Lola",
  "Enzo",
  "Romane",
  "Aaron",
  "Yasmine",
  "Mehdi",
  "Fatou",
  "Karim",
  "Amina",
  "Sofiane",
  "Nadia",
  "Rayan",
  "Leïla",
  "Idris",
];
const LAST_NAMES = [
  "Martin",
  "Bernard",
  "Dubois",
  "Thomas",
  "Robert",
  "Richard",
  "Petit",
  "Durand",
  "Leroy",
  "Moreau",
  "Simon",
  "Laurent",
  "Lefebvre",
  "Michel",
  "Garcia",
  "David",
  "Bertrand",
  "Roux",
  "Vincent",
  "Fournier",
  "Morel",
  "Girard",
  "André",
  "Lefèvre",
  "Mercier",
  "Dupont",
  "Lambert",
  "Bonnet",
  "Rousseau",
  "Blanc",
  "Benali",
  "Traoré",
  "Nguyen",
  "Diallo",
  "Faure",
  "Chevalier",
  "Marchand",
  "Gauthier",
  "Perrin",
  "Roy",
];
const STREETS = [
  "rue de la République",
  "avenue Jean Jaurès",
  "rue Victor Hugo",
  "boulevard Voltaire",
  "rue des Lilas",
  "impasse du Marché",
  "place de la Mairie",
  "rue Gambetta",
  "allée des Tilleuls",
  "rue Pasteur",
  "chemin des Vignes",
  "rue de la Paix",
  "avenue de la Gare",
  "rue du Moulin",
];

// Six districts loosely mapped onto central-Paris coordinates. Each gets a small square GeoJSON
// Polygon (closed ring) so the 2dsphere index and $geoIntersects lookups have real geometry.
const DISTRICT_DEFS = [
  { name: "Centre-Ville", lng: 2.3488, lat: 48.8534 },
  { name: "Belleville", lng: 2.3765, lat: 48.8721 },
  { name: "Montmartre", lng: 2.3408, lat: 48.8867 },
  { name: "Bastille", lng: 2.3692, lat: 48.8532 },
  { name: "Latin", lng: 2.3444, lat: 48.8462 },
  { name: "Batignolles", lng: 2.3196, lat: 48.8874 },
] as const;

const square = (lng: number, lat: number, h = 0.012): { type: "Polygon"; coordinates: number[][][] } => ({
  type: "Polygon",
  // Counter-clockwise, closed ring.
  coordinates: [
    [
      [lng - h, lat - h],
      [lng + h, lat - h],
      [lng + h, lat + h],
      [lng - h, lat + h],
      [lng - h, lat - h],
    ],
  ],
});

const TAG_NAMES = [
  "Bricolage",
  "Jardinage",
  "Garde d'enfants",
  "Cours particuliers",
  "Informatique",
  "Cuisine",
  "Transport",
  "Ménage",
  "Prêt d'outils",
  "Covoiturage",
  "Animaux",
  "Couture",
  "Musique",
  "Sport",
  "Déménagement",
] as const;

const LISTING_OFFERS: Array<{ title: string; desc: string; tags: string[] }> = [
  {
    title: "Perceuse à prêter le week-end",
    desc: "Perceuse-visseuse Bosch en bon état, disponible le samedi et dimanche. Chargeur et embouts fournis.",
    tags: ["Prêt d'outils", "Bricolage"],
  },
  {
    title: "Cours de guitare pour débutants",
    desc: "Guitariste depuis 15 ans, je propose des cours d'initiation à domicile. Première séance offerte.",
    tags: ["Musique", "Cours particuliers"],
  },
  {
    title: "Garde d'enfants en soirée",
    desc: "Étudiante sérieuse et expérimentée, disponible en semaine après 18h pour garder vos enfants.",
    tags: ["Garde d'enfants"],
  },
  {
    title: "Aide au déménagement",
    desc: "Costaud et véhiculé (utilitaire), je peux vous aider à porter et transporter vos cartons.",
    tags: ["Déménagement", "Transport"],
  },
  {
    title: "Plats maison à partager",
    desc: "Je cuisine trop pour une personne — plats végétariens faits maison à récupérer chaque mardi.",
    tags: ["Cuisine"],
  },
  {
    title: "Dépannage informatique",
    desc: "Nettoyage, installation, sauvegarde de données. Windows, Mac et Linux. Patient et pédagogue.",
    tags: ["Informatique"],
  },
  {
    title: "Couture et retouches",
    desc: "Ourlets, reprises, petites retouches. Machine à coudre à disposition, travail soigné.",
    tags: ["Couture"],
  },
  {
    title: "Promenade de chiens",
    desc: "Amoureux des animaux, je promène votre chien en semaine dans le quartier. Tarif à la balade.",
    tags: ["Animaux", "Sport"],
  },
  {
    title: "Cours de soutien en maths",
    desc: "Niveau collège et lycée. Méthode, exercices et préparation aux contrôles.",
    tags: ["Cours particuliers"],
  },
  {
    title: "Tonte et entretien de jardin",
    desc: "Je propose tonte, taille de haies et petit entretien. Matériel fourni.",
    tags: ["Jardinage"],
  },
  {
    title: "Covoiturage domicile-travail",
    desc: "Trajet quotidien vers La Défense, départ 8h. Une place disponible, partage des frais.",
    tags: ["Covoiturage", "Transport"],
  },
  {
    title: "Ménage et repassage",
    desc: "Sérieuse et efficace, je propose quelques heures de ménage par semaine.",
    tags: ["Ménage"],
  },
];
const LISTING_REQUESTS: Array<{ title: string; desc: string; tags: string[] }> = [
  {
    title: "Cherche perceuse à emprunter",
    desc: "Besoin d'une perceuse pour un après-midi ce week-end afin de fixer des étagères.",
    tags: ["Prêt d'outils", "Bricolage"],
  },
  {
    title: "Recherche baby-sitter le mercredi",
    desc: "Pour deux enfants (5 et 8 ans), l'après-midi. Personne de confiance recherchée.",
    tags: ["Garde d'enfants"],
  },
  {
    title: "Besoin d'aide pour un déménagement",
    desc: "Studio au 3e sans ascenseur, samedi prochain. Deux bras supplémentaires bienvenus.",
    tags: ["Déménagement"],
  },
  {
    title: "Cherche prof d'anglais",
    desc: "Pour conversation, niveau intermédiaire, une heure par semaine.",
    tags: ["Cours particuliers"],
  },
  {
    title: "Quelqu'un pour garder mon chat ?",
    desc: "Absente une semaine en août, je cherche une personne pour nourrir mon chat.",
    tags: ["Animaux"],
  },
  {
    title: "Recherche covoiturage le vendredi",
    desc: "Vers la gare de Lyon, en fin d'après-midi. Participation aux frais bien sûr.",
    tags: ["Covoiturage", "Transport"],
  },
  {
    title: "Aide pour installer une imprimante",
    desc: "Je n'y arrive pas seule, un coup de main informatique serait précieux.",
    tags: ["Informatique"],
  },
  {
    title: "Cherche quelqu'un pour arroser mes plantes",
    desc: "Pendant mes vacances, deux passages par semaine suffisent.",
    tags: ["Jardinage"],
  },
];

const EVENT_DEFS = [
  {
    title: "Vide-grenier de quartier",
    desc: "Grande braderie annuelle : venez chiner, vendre et rencontrer vos voisins.",
    loc: "Place de la Mairie",
  },
  {
    title: "Atelier compostage",
    desc: "Apprenez à composter vos déchets organiques avec un maître-composteur.",
    loc: "Jardin partagé des Lilas",
  },
  {
    title: "Repas de quartier",
    desc: "Auberge espagnole : chacun apporte un plat à partager. Ambiance conviviale garantie.",
    loc: "Salle des fêtes",
  },
  {
    title: "Nettoyage collectif du parc",
    desc: "Opération propreté : gants et sacs fournis, goûter offert aux participants.",
    loc: "Parc central",
  },
  {
    title: "Concert acoustique en plein air",
    desc: "Des musiciens du quartier se produisent en fin d'après-midi. Entrée libre.",
    loc: "Kiosque du square",
  },
  {
    title: "Bourse aux vêtements",
    desc: "Donnez une seconde vie à vos vêtements. Dépôt le matin, vente l'après-midi.",
    loc: "Maison de quartier",
  },
  {
    title: "Atelier réparation vélo",
    desc: "Un mécanicien bénévole vous aide à remettre votre vélo en état.",
    loc: "Local associatif",
  },
  {
    title: "Café-rencontre nouveaux voisins",
    desc: "Vous venez d'emménager ? Venez faire connaissance autour d'un café.",
    loc: "Café de la Place",
  },
];

const INCIDENT_CATEGORIES = [
  "Voirie",
  "Éclairage",
  "Propreté",
  "Espaces verts",
  "Nuisances sonores",
  "Dégradations",
  "Sécurité",
] as const;
const INCIDENT_DEFS: Array<{ cat: string; desc: string }> = [
  { cat: "Éclairage", desc: "Lampadaire en panne depuis plusieurs jours, la rue est plongée dans le noir le soir." },
  { cat: "Voirie", desc: "Nid-de-poule important au milieu de la chaussée, dangereux pour les cyclistes." },
  { cat: "Propreté", desc: "Dépôt sauvage d'encombrants au coin de la rue, cela s'accumule depuis une semaine." },
  { cat: "Espaces verts", desc: "Arbre dont une grosse branche menace de tomber sur le trottoir." },
  { cat: "Nuisances sonores", desc: "Travaux qui commencent très tôt le matin, bien avant les horaires autorisés." },
  { cat: "Dégradations", desc: "Tags et graffitis sur le mur de l'école, à nettoyer." },
  { cat: "Sécurité", desc: "Feu piéton défectueux au carrefour, il ne passe plus au vert." },
  { cat: "Propreté", desc: "Corbeilles de rue débordantes qui n'ont pas été collectées." },
];

const VOTE_DEFS: Array<{ q: string; options: string[] }> = [
  {
    q: "Quel aménagement prioriser sur la place centrale ?",
    options: ["Aire de jeux", "Espace vert", "Marché couvert", "Parking vélos"],
  },
  { q: "Faut-il piétonniser la rue principale le dimanche ?", options: ["Oui", "Non", "Seulement l'été"] },
  {
    q: "Quel thème pour la fête de quartier cette année ?",
    options: ["Musique du monde", "Cinéma en plein air", "Gastronomie locale"],
  },
  {
    q: "Où installer les nouvelles bornes de recyclage ?",
    options: ["Près du marché", "Devant l'école", "À l'entrée du parc"],
  },
  { q: "Quel horaire pour le repas de quartier ?", options: ["Midi", "Soir"] },
  { q: "Faut-il créer un jardin partagé supplémentaire ?", options: ["Oui, urgent", "Oui, plus tard", "Non"] },
];

const MESSAGE_SNIPPETS = [
  "Bonjour ! Votre annonce m'intéresse, est-ce toujours disponible ?",
  "Oui bien sûr, quand seriez-vous disponible ?",
  "Parfait, on peut se retrouver ce week-end si vous voulez.",
  "Super, merci beaucoup pour votre aide !",
  "Pas de souci, c'est avec plaisir 🙂",
  "Est-ce que ça vous convient si je passe vers 14h ?",
  "Oui ça me va très bien, à tout à l'heure.",
  "Je vous confirme l'adresse en message privé.",
  "Merci encore, c'était vraiment sympa de votre part !",
  "N'hésitez pas si vous avez besoin d'autre chose.",
];

const NOTIF_TEMPLATES = {
  listing: {
    title: "Nouvelle annonce dans votre quartier",
    message: "Une annonce qui pourrait vous intéresser vient d'être publiée.",
  },
  contract: { title: "Contrat mis à jour", message: "Le statut de votre contrat a évolué." },
  event: { title: "Nouvel événement", message: "Un événement vient d'être organisé près de chez vous." },
  message: { title: "Nouveau message", message: "Vous avez reçu un nouveau message." },
  vote: { title: "Nouvelle consultation", message: "Un vote est ouvert dans votre quartier, donnez votre avis." },
  incident: { title: "Signalement mis à jour", message: "Le statut de votre signalement a changé." },
  system: { title: "Bienvenue 👋", message: "Bienvenue sur la plateforme de votre quartier !" },
} as const;

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------
const USERS_PER_DISTRICT = 12;

// Insert docs whose `_id` is a string uuid. The Mongo driver's default `Document` typing expects an
// ObjectId `_id`; the repositories sidestep this with typed collections, and here we do the same via
// a single cast at the boundary so the call sites stay clean.
const insertDocs = async (db: Db, name: string, docs: ReadonlyArray<Record<string, unknown>>): Promise<void> => {
  if (docs.length) await db.collection(name).insertMany(docs as OptionalId<Document>[]);
};

const seed = async (): Promise<void> => {
  const db = await connectDB();

  console.warn("Clearing previous seed data…");
  await Promise.all([
    db.collection("listings").deleteMany({}),
    db.collection("contracts").deleteMany({}),
    db.collection("events").deleteMany({}),
    db.collection("incidents").deleteMany({}),
    db.collection("districts").deleteMany({}),
    db.collection("tags").deleteMany({}),
    db.collection("votes").deleteMany({}),
    db.collection("vote_responses").deleteMany({}),
    db.collection("conversations").deleteMany({}),
    db.collection("messages").deleteMany({}),
    db.collection("notifications").deleteMany({}),
    db.collection("transactions").deleteMany({}),
    db.collection("district_admins").deleteMany({}),
    // Only remove previously-seeded users; leave real accounts (e.g. the superAdmin) intact.
    db.collection("users").deleteMany({ email: { $regex: `@${SEED_EMAIL_DOMAIN}$` } }),
  ]);

  // Everyone shares one password — hash it a single time.
  const passwordHash = await argon2.hash(SEED_PASSWORD);

  // --- Districts ---------------------------------------------------------
  const districts = DISTRICT_DEFS.map((d) => ({
    _id: randomUUID(),
    name: d.name,
    geoJson: square(d.lng, d.lat),
  }));
  await insertDocs(db, "districts", districts);

  // --- Tags (per district) ----------------------------------------------
  const tags = districts.flatMap((d) =>
    TAG_NAMES.map((name) => ({
      _id: randomUUID(),
      districtId: d._id,
      name,
      description: `Annonces et services : ${name.toLowerCase()}.`,
    })),
  );
  await insertDocs(db, "tags", tags);
  const tagsByDistrict = new Map<string, typeof tags>();
  for (const t of tags) {
    const list = tagsByDistrict.get(t.districtId) ?? [];
    list.push(t);
    tagsByDistrict.set(t.districtId, list);
  }

  // --- Users -------------------------------------------------------------
  type UserDoc = {
    _id: string;
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phone?: string;
    address: string;
    role: "user" | "admin" | "superAdmin";
    districtId: string;
    balance: number;
    banned: boolean;
    emailVerified: boolean;
    totpSecret: null;
    totpEnabled: boolean;
    createdAt: string;
    updatedAt: string;
  };

  const usedEmails = new Set<string>();
  const mkEmail = (first: string, last: string): string => {
    const base = `${first}.${last}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z.]/g, "");
    let email = `${base}@${SEED_EMAIL_DOMAIN}`;
    let n = 1;
    while (usedEmails.has(email)) email = `${base}${++n}@${SEED_EMAIL_DOMAIN}`;
    usedEmails.add(email);
    return email;
  };

  const users: UserDoc[] = [];
  const districtAdmins: Array<{ _id: string; userId: string; districtId: string; createdAt: string }> = [];

  for (const district of districts) {
    for (let i = 0; i < USERS_PER_DISTRICT; i++) {
      const firstName = pick(FIRST_NAMES);
      const lastName = pick(LAST_NAMES);
      const createdAt = daysAgo(int(30, 720));
      // First user of each district becomes its admin.
      const role: UserDoc["role"] = i === 0 ? "admin" : "user";
      const user: UserDoc = {
        _id: randomUUID(),
        email: mkEmail(firstName, lastName),
        passwordHash,
        firstName,
        lastName,
        phone: chance(0.7) ? `06 ${int(10, 99)} ${int(10, 99)} ${int(10, 99)} ${int(10, 99)}` : undefined,
        address: `${int(1, 120)} ${pick(STREETS)}`,
        role,
        districtId: district._id,
        balance: 0, // recomputed from transactions below
        banned: chance(0.04),
        emailVerified: chance(0.9),
        totpSecret: null,
        totpEnabled: false,
        createdAt,
        updatedAt: createdAt,
      };
      users.push(user);
      if (role === "admin") {
        districtAdmins.push({ _id: randomUUID(), userId: user._id, districtId: district._id, createdAt });
      }
    }
  }

  const usersByDistrict = new Map<string, UserDoc[]>();
  for (const u of users) {
    const list = usersByDistrict.get(u.districtId) ?? [];
    list.push(u);
    usersByDistrict.set(u.districtId, list);
  }

  // --- Listings ----------------------------------------------------------
  type ListingDoc = {
    _id: string;
    authorId: string;
    districtId: string;
    title: string;
    description: string;
    type: "offer" | "request";
    price: number;
    status: "active" | "closed" | "expired";
    tags: string[];
    createdAt: string;
    expiresAt?: string;
  };
  const listings: ListingDoc[] = [];

  for (const district of districts) {
    const districtUsers = usersByDistrict.get(district._id)!;
    const districtTags = tagsByDistrict.get(district._id)!;
    const tagByName = new Map<string, string>(districtTags.map((t) => [t.name, t._id]));
    const count = int(20, 30);
    for (let i = 0; i < count; i++) {
      const isOffer = chance(0.6);
      const def = isOffer ? pick(LISTING_OFFERS) : pick(LISTING_REQUESTS);
      const createdAt = daysAgo(int(1, 200));
      const status = pick(["active", "active", "active", "closed", "expired"] as const);
      listings.push({
        _id: randomUUID(),
        authorId: pick(districtUsers)._id,
        districtId: district._id,
        title: def.title,
        description: def.desc,
        type: isOffer ? "offer" : "request",
        price: chance(0.25) ? 0 : int(1, 20) * 5,
        status,
        tags: def.tags.map((n) => tagByName.get(n)).filter((x): x is string => Boolean(x)),
        createdAt,
        expiresAt: chance(0.6) ? new Date(new Date(createdAt).getTime() + int(30, 90) * DAY).toISOString() : undefined,
      });
    }
  }
  await insertDocs(db, "listings", listings);

  const listingsByDistrict = new Map<string, ListingDoc[]>();
  for (const l of listings) {
    const list = listingsByDistrict.get(l.districtId) ?? [];
    list.push(l);
    listingsByDistrict.set(l.districtId, list);
  }

  // --- Contracts + Transactions -----------------------------------------
  type ContractDoc = {
    _id: string;
    listingId: string;
    districtId: string;
    providerId: string;
    beneficiaryId: string;
    price: number;
    openSignDocumentId: string;
    openSignStatus: "draft" | "sent" | "partially_signed" | "signed" | "expired" | "declined";
    disputed: boolean;
    createdAt: string;
  };
  type TxDoc = {
    _id: string;
    userId: string;
    districtId: string;
    type: "credit" | "debit" | "transfer_in" | "transfer_out";
    amount: number;
    refId?: string;
    refType?: "contract" | "listing" | "event" | "manual" | "system";
    createdAt: string;
  };

  const contracts: ContractDoc[] = [];
  const transactions: TxDoc[] = [];
  const balances = new Map<string, number>();
  const addBalance = (userId: string, delta: number): void => {
    balances.set(userId, (balances.get(userId) ?? 0) + delta);
  };

  // Welcome credit for everyone.
  for (const u of users) {
    const amount = 500;
    transactions.push({
      _id: randomUUID(),
      userId: u._id,
      districtId: u.districtId,
      type: "credit",
      amount,
      refType: "system",
      createdAt: u.createdAt,
    });
    addBalance(u._id, amount);
  }

  for (const district of districts) {
    const districtUsers = usersByDistrict.get(district._id)!;
    const priced = (listingsByDistrict.get(district._id) ?? []).filter((l) => l.price > 0);
    const count = Math.min(priced.length, int(6, 12));
    for (const listing of sample(priced, count)) {
      const provider = users.find((u) => u._id === listing.authorId)!;
      // Beneficiary is anyone in the district other than the provider.
      const beneficiary = pick(districtUsers.filter((u) => u._id !== provider._id));
      const status = pick([
        "signed",
        "signed",
        "signed",
        "sent",
        "partially_signed",
        "draft",
        "declined",
        "expired",
      ] as const);
      const createdAt = daysAgo(int(1, 150));
      const contract: ContractDoc = {
        _id: randomUUID(),
        listingId: listing._id,
        districtId: district._id,
        providerId: provider._id,
        beneficiaryId: beneficiary._id,
        price: listing.price,
        openSignDocumentId: `os_${randomUUID().slice(0, 12)}`,
        openSignStatus: status,
        disputed: status === "signed" && chance(0.1),
        createdAt,
      };
      contracts.push(contract);

      // Only a signed contract moves money: beneficiary pays the provider.
      if (status === "signed") {
        transactions.push({
          _id: randomUUID(),
          userId: beneficiary._id,
          districtId: district._id,
          type: "transfer_out",
          amount: -contract.price,
          refId: contract._id,
          refType: "contract",
          createdAt,
        });
        addBalance(beneficiary._id, -contract.price);
        transactions.push({
          _id: randomUUID(),
          userId: provider._id,
          districtId: district._id,
          type: "transfer_in",
          amount: contract.price,
          refId: contract._id,
          refType: "contract",
          createdAt,
        });
        addBalance(provider._id, contract.price);
      }
    }
  }

  // A few manual top-ups / adjustments for realism.
  for (const u of sample(users, Math.floor(users.length * 0.3))) {
    const isCredit = chance(0.6);
    const amount = int(2, 20) * 10;
    transactions.push({
      _id: randomUUID(),
      userId: u._id,
      districtId: u.districtId,
      type: isCredit ? "credit" : "debit",
      amount: isCredit ? amount : -amount,
      refType: "manual",
      createdAt: daysAgo(int(1, 120)),
    });
    addBalance(u._id, isCredit ? amount : -amount);
  }

  await insertDocs(db, "contracts", contracts);
  await insertDocs(db, "transactions", transactions);

  // Persist reconciled balances back onto the users.
  for (const u of users) u.balance = balances.get(u._id) ?? 0;
  await insertDocs(db, "users", users);
  await insertDocs(db, "district_admins", districtAdmins);

  // --- Events ------------------------------------------------------------
  const events = [];
  for (const district of districts) {
    const districtUsers = usersByDistrict.get(district._id)!;
    const count = int(3, 5);
    for (let i = 0; i < count; i++) {
      const def = pick(EVENT_DEFS);
      const isPast = chance(0.4);
      const eventDate = isPast ? daysAgo(int(1, 120)) : daysAhead(int(1, 90));
      const totalSeats = int(10, 60);
      const registrants = sample(districtUsers, int(0, Math.min(totalSeats, districtUsers.length))).map((u) => u._id);
      const status: "upcoming" | "ongoing" | "completed" | "cancelled" = chance(0.08)
        ? "cancelled"
        : isPast
          ? "completed"
          : "upcoming";
      events.push({
        _id: randomUUID(),
        creatorId: pick(districtUsers)._id,
        districtId: district._id,
        title: def.title,
        description: def.desc,
        location: `${def.loc}, ${district.name}`,
        totalSeats,
        remainingSeats: Math.max(0, totalSeats - registrants.length),
        status,
        registrants,
        eventDate,
        createdAt: daysAgo(int(1, 150)),
      });
    }
  }
  await insertDocs(db, "events", events);

  // --- Incidents ---------------------------------------------------------
  const incidents = [];
  for (const district of districts) {
    const districtUsers = usersByDistrict.get(district._id)!;
    const admin = districtUsers.find((u) => u.role === "admin")!;
    const count = int(4, 7);
    for (let i = 0; i < count; i++) {
      const def = pick(INCIDENT_DEFS);
      const reporter = pick(districtUsers);
      const createdAt = daysAgo(int(1, 90));
      const finalStatus = pick(["open", "in_progress", "resolved", "closed"] as const);
      // Build a plausible status history up to the current status.
      const ladder: Array<"open" | "in_progress" | "resolved" | "closed"> = [
        "open",
        "in_progress",
        "resolved",
        "closed",
      ];
      const steps = ladder.slice(0, ladder.indexOf(finalStatus) + 1);
      let t = new Date(createdAt).getTime();
      const history = steps.map((status, idx) => {
        t += int(1, 5) * DAY;
        return {
          status,
          note: idx === 0 ? "Signalement enregistré." : `Passage au statut « ${status} ».`,
          updatedBy: idx === 0 ? reporter._id : admin._id,
          updatedAt: new Date(t).toISOString(),
        };
      });
      const assigned = finalStatus !== "open";
      incidents.push({
        _id: randomUUID(),
        reporterId: reporter._id,
        districtId: district._id,
        category: pick(INCIDENT_CATEGORIES),
        description: def.desc,
        photoUrl: chance(0.3) ? `https://picsum.photos/seed/${randomUUID().slice(0, 8)}/600/400` : undefined,
        status: finalStatus,
        history,
        assignedTo: assigned ? admin._id : undefined,
        createdAt,
        updatedAt: history[history.length - 1]!.updatedAt,
      });
    }
  }
  await insertDocs(db, "incidents", incidents);

  // --- Votes + responses -------------------------------------------------
  const votes = [];
  const voteResponses = [];
  for (const district of districts) {
    const districtUsers = usersByDistrict.get(district._id)!;
    const admin = districtUsers.find((u) => u.role === "admin")!;
    const count = int(1, 3);
    for (let i = 0; i < count; i++) {
      const def = pick(VOTE_DEFS);
      const status = pick(["open", "open", "closed", "draft"] as const);
      const startDate = daysAgo(int(5, 60));
      const endDate =
        status === "closed" ? daysAgo(int(1, 4)) : status === "open" ? daysAhead(int(3, 20)) : daysAhead(int(20, 40));
      const voteId = randomUUID();

      // Responses only exist for open/closed votes.
      const tally = new Map<string, number>(def.options.map((o) => [o, 0]));
      if (status !== "draft") {
        const voters = sample(districtUsers, int(0, districtUsers.length));
        for (const voter of voters) {
          const chosenOption = pick(def.options);
          tally.set(chosenOption, (tally.get(chosenOption) ?? 0) + 1);
          voteResponses.push({
            _id: randomUUID(),
            voteId,
            userId: voter._id,
            chosenOption,
            votedAt: daysAgo(int(1, 40)),
          });
        }
      }

      votes.push({
        _id: voteId,
        creatorId: admin._id,
        districtIds: [district._id],
        question: def.q,
        options: def.options,
        voteType: "single_choice" as const,
        status,
        results: def.options.map((option) => ({ option, count: tally.get(option) ?? 0 })),
        startDate,
        endDate,
      });
    }
  }
  await insertDocs(db, "votes", votes);
  await insertDocs(db, "vote_responses", voteResponses);

  // --- Conversations + messages -----------------------------------------
  const conversations = [];
  const messages = [];
  for (const district of districts) {
    const districtUsers = usersByDistrict.get(district._id)!;
    const count = int(6, 10);
    for (let i = 0; i < count; i++) {
      const isGroup = chance(0.25);
      const participants = isGroup
        ? sample(districtUsers, int(3, 5)).map((u) => u._id)
        : sample(districtUsers, 2).map((u) => u._id);
      if (participants.length < 2) continue;
      const conversationId = randomUUID();
      const createdAt = daysAgo(int(1, 90));

      const msgCount = int(2, 12);
      let t = new Date(createdAt).getTime();
      let lastMessageAt = createdAt;
      for (let m = 0; m < msgCount; m++) {
        t += int(1, 240) * 60_000; // minutes apart
        lastMessageAt = new Date(t).toISOString();
        messages.push({
          _id: randomUUID(),
          senderId: pick(participants),
          conversationId,
          districtId: district._id,
          type: "text" as const,
          content: pick(MESSAGE_SNIPPETS),
          read: chance(0.7),
          createdAt: lastMessageAt,
        });
      }

      conversations.push({
        _id: conversationId,
        participants,
        districtId: district._id,
        type: isGroup ? ("group" as const) : ("direct" as const),
        name: isGroup ? `Voisins de ${district.name} #${i + 1}` : undefined,
        lastMessageAt,
        createdAt,
      });
    }
  }
  await insertDocs(db, "conversations", conversations);
  await insertDocs(db, "messages", messages);

  // --- Notifications -----------------------------------------------------
  const notifications = [];
  const notifTypes = Object.keys(NOTIF_TEMPLATES) as Array<keyof typeof NOTIF_TEMPLATES>;
  for (const u of users) {
    const count = int(2, 8);
    for (let i = 0; i < count; i++) {
      const type = pick(notifTypes);
      const tpl = NOTIF_TEMPLATES[type];
      const refType =
        type === "message"
          ? "conversation"
          : type === "system"
            ? undefined
            : (type as "listing" | "contract" | "event" | "vote" | "incident");
      notifications.push({
        _id: randomUUID(),
        recipientId: u._id,
        districtId: u.districtId,
        type,
        title: tpl.title,
        message: tpl.message,
        refId: refType ? randomUUID() : undefined,
        refType,
        read: chance(0.5),
        createdAt: daysAgo(int(1, 60)),
      });
    }
  }
  await insertDocs(db, "notifications", notifications);

  // --- Summary -----------------------------------------------------------
  console.warn("Seed complete:");
  console.warn(`  districts        ${districts.length}`);
  console.warn(`  tags             ${tags.length}`);
  console.warn(`  users            ${users.length} (all password: "${SEED_PASSWORD}")`);
  console.warn(`  district admins  ${districtAdmins.length}`);
  console.warn(`  listings         ${listings.length}`);
  console.warn(`  contracts        ${contracts.length}`);
  console.warn(`  transactions     ${transactions.length}`);
  console.warn(`  events           ${events.length}`);
  console.warn(`  incidents        ${incidents.length}`);
  console.warn(`  votes            ${votes.length} (${voteResponses.length} responses)`);
  console.warn(`  conversations    ${conversations.length} (${messages.length} messages)`);
  console.warn(`  notifications    ${notifications.length}`);
  const sampleUser = users.find((u) => u.role === "admin");
  if (sampleUser) console.warn(`  sample admin login: ${sampleUser.email} / ${SEED_PASSWORD}`);

  await closeDB();
  process.exit(0);
};

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

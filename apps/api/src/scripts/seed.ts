/**
 * Seed script — populates MongoDB with sample data for every collection
 * defined in documentation/MCD/mongo.md.
 *
 * Usage:
 *   npm run seed              # from apps/api
 *   tsx src/scripts/seed.ts   # directly
 *
 * The script is idempotent: existing seeded documents (recognised by their
 * deterministic UUIDs) are removed before reinsertion. Other documents in the
 * collections are left untouched.
 */

import argon2 from "argon2";
import { connectDB } from "../repositories/mongodb.connector.js";
import { connectNeo4j, closeNeo4j } from "../repositories/neo4j.connector.js";
import { Neo4jGraphRepository } from "../repositories/Graph/graph.repository.neo4j.js";

const now = new Date().toISOString();
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const inOneMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

// ─── Deterministic IDs ────────────────────────────────────────────────────────
// Using readable IDs makes the seed easy to reason about and idempotent.
const ids = {
  districts: {
    montmartre: "seed-district-montmartre",
    marais: "seed-district-marais",
  },
  users: {
    admin: "seed-user-admin",
    alice: "seed-user-alice",
    bob: "seed-user-bob",
    charlie: "seed-user-charlie",
    diana: "seed-user-diana",
  },
  tags: {
    plumbing: "seed-tag-plumbing",
    babysitting: "seed-tag-babysitting",
    tutoring: "seed-tag-tutoring",
    gardening: "seed-tag-gardening",
    moving: "seed-tag-moving",
    cooking: "seed-tag-cooking",
    petCare: "seed-tag-pet-care",
    diy: "seed-tag-diy",
  },
  listings: {
    plumber: "seed-listing-plumber",
    babysitting: "seed-listing-babysitting",
    tutoring: "seed-listing-tutoring",
    movingHelp: "seed-listing-moving-help",
    gardenTools: "seed-listing-garden-tools",
  },
  events: {
    cleanup: "seed-event-cleanup",
    barbecue: "seed-event-barbecue",
    workshop: "seed-event-workshop",
  },
  incidents: {
    streetlight: "seed-incident-streetlight",
    graffiti: "seed-incident-graffiti",
    trash: "seed-incident-trash",
  },
  votes: {
    park: "seed-vote-park",
    market: "seed-vote-market",
    // Nouveaux votes pour tester les 3 nouvelles features
    toolsMulti: "seed-vote-tools-multi", // multiple_choice, ouvert
    greenClosed: "seed-vote-green-closed", // single_choice, status=closed
    eventExpired: "seed-vote-event-expired", // open mais endDate dans le passé → badge "Expiré"
    libraryDraft: "seed-vote-library-draft", // status=draft, pas encore lancé
  },
  voteResponses: {
    parkAlice: "seed-vote-response-park-alice",
    parkBob: "seed-vote-response-park-bob",
    parkCharlie: "seed-vote-response-park-charlie",
    marketAlice: "seed-vote-response-market-alice",
    // Multi-choice : Alice et Bob votent plusieurs options chacun
    toolsAliceHammer: "seed-vote-response-tools-alice-hammer",
    toolsAliceDrill: "seed-vote-response-tools-alice-drill",
    toolsBobDrill: "seed-vote-response-tools-bob-drill",
    toolsBobSaw: "seed-vote-response-tools-bob-saw",
    toolsCharlieHammer: "seed-vote-response-tools-charlie-hammer",
    // Vote clos : on garde des réponses historiques pour montrer les résultats
    greenClosedAlice: "seed-vote-response-green-alice",
    greenClosedDiana: "seed-vote-response-green-diana",
  },
  conversations: {
    aliceBob: "seed-conversation-alice-bob",
    group: "seed-conversation-group",
  },
  messages: {
    aliceBobHi: "seed-message-alice-bob-hi",
    aliceBobReply: "seed-message-alice-bob-reply",
    groupAnnouncement: "seed-message-group-announcement",
    groupReply: "seed-message-group-reply",
  },
  notifications: {
    welcomeAlice: "seed-notification-welcome-alice",
    eventCharlie: "seed-notification-event-charlie",
    voteDiana: "seed-notification-vote-diana",
    incidentAdmin: "seed-notification-incident-admin",
  },
  transactions: {
    aliceCreditWelcome: "seed-transaction-alice-credit",
    bobCreditWelcome: "seed-transaction-bob-credit",
  },
};

const allSeededIds = (obj: Record<string, Record<string, string>>) =>
  Object.values(obj).flatMap((entry) => Object.values(entry));

// ─── Seed data ────────────────────────────────────────────────────────────────

const districts = [
  {
    _id: ids.districts.montmartre,
    name: "Montmartre",
    geoJson: {
      type: "Polygon",
      coordinates: [
        [
          [2.338, 48.8855],
          [2.347, 48.8855],
          [2.347, 48.89],
          [2.338, 48.89],
          [2.338, 48.8855],
        ],
      ],
    },
  },
  {
    _id: ids.districts.marais,
    name: "Le Marais",
    geoJson: {
      type: "Polygon",
      coordinates: [
        [
          [2.354, 48.854],
          [2.365, 48.854],
          [2.365, 48.862],
          [2.354, 48.862],
          [2.354, 48.854],
        ],
      ],
    },
  },
];

// All seeded users share one known dev password so the demo accounts can log in.
// Override with SEED_PASSWORD. Only ever used by this local/dev seed script.
const seedPassword = process.env.SEED_PASSWORD ?? "Password123!";
const passwordHash = await argon2.hash(seedPassword);

const users = [
  {
    _id: ids.users.admin,
    email: "admin@connected-neighbours.local",
    passwordHash,
    emailVerified: true,
    firstName: "Admin",
    lastName: "Root",
    phone: "0600000001",
    address: "1 Rue de l'Administration, Paris",
    role: "admin",
    districtId: ids.districts.montmartre,
    balance: 0,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: ids.users.alice,
    email: "alice@example.com",
    passwordHash,
    emailVerified: true,
    firstName: "Alice",
    lastName: "Martin",
    phone: "0612345678",
    address: "12 Rue des Abbesses, Paris",
    role: "user",
    districtId: ids.districts.montmartre,
    balance: 20,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: ids.users.bob,
    email: "bob@example.com",
    passwordHash,
    emailVerified: true,
    firstName: "Bob",
    lastName: "Durand",
    phone: "0623456789",
    address: "34 Rue Lepic, Paris",
    role: "user",
    districtId: ids.districts.montmartre,
    balance: 15,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: ids.users.charlie,
    email: "charlie@example.com",
    passwordHash,
    emailVerified: true,
    firstName: "Charlie",
    lastName: "Dubois",
    phone: "0634567890",
    address: "5 Rue des Rosiers, Paris",
    role: "user",
    districtId: ids.districts.marais,
    balance: 8,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: ids.users.diana,
    email: "diana@example.com",
    passwordHash,
    emailVerified: true,
    firstName: "Diana",
    lastName: "Leroy",
    phone: "0645678901",
    address: "22 Rue Vieille du Temple, Paris",
    role: "user",
    districtId: ids.districts.marais,
    balance: 30,
    createdAt: now,
    updatedAt: now,
  },
];

const tags = [
  { _id: ids.tags.plumbing, name: "plumbing", description: "Plumbing repairs and installations" },
  { _id: ids.tags.babysitting, name: "babysitting", description: "Childcare services" },
  { _id: ids.tags.tutoring, name: "tutoring", description: "Private lessons and homework help" },
  { _id: ids.tags.gardening, name: "gardening", description: "Garden maintenance and landscaping" },
  { _id: ids.tags.moving, name: "moving", description: "Help with moves and heavy lifting" },
  { _id: ids.tags.cooking, name: "cooking", description: "Meal preparation and cooking classes" },
  { _id: ids.tags.petCare, name: "pet-care", description: "Dog walking, cat sitting, etc." },
  { _id: ids.tags.diy, name: "diy", description: "Do-it-yourself help and tools lending" },
];

const listings = [
  {
    _id: ids.listings.plumber,
    authorId: ids.users.bob,
    districtId: ids.districts.montmartre,
    title: "Petit bricolage et réparations du quotidien",
    description:
      "Je peux aider pour monter un meuble, fixer une étagère, changer une prise ou faire de petites réparations à la maison.",
    type: "offer",
    price: 10,
    status: "active",
    tags: ["diy"],
    createdAt: lastWeek,
    expiresAt: inOneMonth,
  },
  {
    _id: ids.listings.babysitting,
    authorId: ids.users.alice,
    districtId: ids.districts.montmartre,
    title: "Garde d'enfants ponctuelle en soirée",
    description:
      "Je cherche une personne de confiance pour garder deux enfants de 4 et 7 ans pendant une soirée, avec jeux et repas déjà préparés.",
    type: "offer",
    price: 4,
    status: "active",
    tags: ["babysitting"],
    createdAt: now,
    expiresAt: nextWeek,
  },
  {
    _id: ids.listings.tutoring,
    authorId: ids.users.diana,
    districtId: ids.districts.marais,
    title: "Atelier cuisine maison pour voisins",
    description:
      "Je propose un atelier cuisine pour apprendre à préparer un repas simple et convivial, idéal pour débutants ou familles.",
    type: "offer",
    price: 6,
    status: "active",
    tags: ["cooking"],
    createdAt: lastWeek,
    expiresAt: inOneMonth,
  },
  {
    _id: ids.listings.movingHelp,
    authorId: ids.users.charlie,
    districtId: ids.districts.marais,
    title: "Besoin d'aide pour transporter un canapé",
    description:
      "Je cherche une ou deux personnes pour m'aider à transporter un canapé du rez-de-chaussée jusqu'à un appartement voisin.",
    type: "offer",
    price: 0,
    status: "active",
    tags: ["moving"],
    createdAt: now,
    expiresAt: nextWeek,
  },
  {
    _id: ids.listings.gardenTools,
    authorId: ids.users.bob,
    districtId: ids.districts.montmartre,
    title: "Aide au jardinage et entretien de balcon",
    description:
      "Disponible pour arroser les plantes, rempoter, tailler quelques arbustes ou donner un coup de main sur un petit jardin ou un balcon.",
    type: "offer",
    price: 0,
    status: "active",
    tags: ["gardening"],
    createdAt: lastWeek,
  },
];

// Contracts are not seeded: a contract is only meaningful with a real Documenso
// document behind it (fake ids can't be signed and crash the PDF proxy). They are
// created at runtime via "Prendre ce service".

const events = [
  {
    _id: ids.events.cleanup,
    creatorId: ids.users.alice,
    districtId: ids.districts.montmartre,
    title: "Neighbourhood cleanup",
    description: "Let's clean up Place du Tertre and the surrounding streets together. Bags and gloves provided.",
    location: "Place du Tertre, Montmartre",
    totalSeats: 20,
    remainingSeats: 17,
    status: "upcoming",
    registrants: [ids.users.alice, ids.users.bob, ids.users.diana],
    eventDate: nextWeek,
    createdAt: now,
  },
  {
    _id: ids.events.barbecue,
    creatorId: ids.users.charlie,
    districtId: ids.districts.marais,
    title: "Summer barbecue in the courtyard",
    description: "Open BBQ for everyone in the building and surrounding neighbours. Bring something to share.",
    location: "Courtyard, 5 Rue des Rosiers",
    totalSeats: 30,
    remainingSeats: 28,
    status: "upcoming",
    registrants: [ids.users.charlie, ids.users.diana],
    eventDate: inOneMonth,
    createdAt: now,
  },
  {
    _id: ids.events.workshop,
    creatorId: ids.users.diana,
    districtId: ids.districts.marais,
    title: "DIY repair café workshop",
    description: "Bring broken small appliances or clothes — we'll repair them together.",
    location: "Community hall, 22 Rue Vieille du Temple",
    totalSeats: 15,
    remainingSeats: 15,
    status: "upcoming",
    registrants: [],
    eventDate: tomorrow,
    createdAt: now,
  },
];

const incidents = [
  {
    _id: ids.incidents.streetlight,
    reporterId: ids.users.alice,
    districtId: ids.districts.montmartre,
    category: "lighting",
    description: "Streetlight on Rue Lepic has been broken for 3 days.",
    status: "in_progress",
    history: [
      { status: "open", updatedBy: ids.users.alice, updatedAt: lastWeek },
      {
        status: "in_progress",
        note: "Contacted city services",
        updatedBy: ids.users.admin,
        updatedAt: now,
      },
    ],
    assignedTo: ids.users.admin,
    createdAt: lastWeek,
    updatedAt: now,
  },
  {
    _id: ids.incidents.graffiti,
    reporterId: ids.users.charlie,
    districtId: ids.districts.marais,
    category: "vandalism",
    description: "Graffiti on the wall of the playground.",
    photoUrl: "https://example.com/photos/graffiti.jpg",
    status: "open",
    history: [{ status: "open", updatedBy: ids.users.charlie, updatedAt: now }],
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: ids.incidents.trash,
    reporterId: ids.users.bob,
    districtId: ids.districts.montmartre,
    category: "cleanliness",
    description: "Overflowing trash bins at the corner of Rue des Abbesses.",
    status: "resolved",
    history: [
      { status: "open", updatedBy: ids.users.bob, updatedAt: lastWeek },
      {
        status: "resolved",
        note: "Bins were emptied by the city",
        updatedBy: ids.users.admin,
        updatedAt: now,
      },
    ],
    assignedTo: ids.users.admin,
    createdAt: lastWeek,
    updatedAt: now,
  },
];

const votes = [
  {
    _id: ids.votes.park,
    creatorId: ids.users.admin,
    districtIds: [ids.districts.montmartre],
    question: "Should we transform the parking lot on Rue des Abbesses into a community park?",
    options: ["yes", "no", "needs more thought"],
    voteType: "single_choice",
    status: "open",
    results: [
      { option: "yes", count: 2 },
      { option: "no", count: 0 },
      { option: "needs more thought", count: 1 },
    ],
    startDate: lastWeek,
    endDate: nextWeek,
  },
  {
    _id: ids.votes.market,
    creatorId: ids.users.admin,
    districtIds: [ids.districts.montmartre, ids.districts.marais],
    question: "Which day should the weekly neighbourhood market take place?",
    options: ["saturday", "sunday", "wednesday"],
    voteType: "single_choice",
    status: "open",
    results: [
      { option: "saturday", count: 1 },
      { option: "sunday", count: 0 },
      { option: "wednesday", count: 0 },
    ],
    startDate: now,
    endDate: inOneMonth,
  },

  // ─── Votes additionnels pour tester les 3 features ──────────────────────

  // 1. Vote multiple_choice ouvert — chaque user peut choisir plusieurs options.
  //    Les results reflètent les voteResponses ajoutées plus bas.
  {
    _id: ids.votes.toolsMulti,
    creatorId: ids.users.admin,
    districtIds: [ids.districts.montmartre],
    question: "Quels outils proposer en libre service au local du quartier ?",
    options: ["hammer", "drill", "saw", "ladder"],
    voteType: "multiple_choice",
    status: "open",
    results: [
      { option: "hammer", count: 2 }, // Alice + Charlie
      { option: "drill", count: 2 }, // Alice + Bob
      { option: "saw", count: 1 }, // Bob
      { option: "ladder", count: 0 },
    ],
    startDate: lastWeek,
    endDate: nextWeek,
  },

  // 2. Vote clos — montre que le formulaire est caché et qu'on ne peut plus voter.
  {
    _id: ids.votes.greenClosed,
    creatorId: ids.users.admin,
    districtIds: [ids.districts.marais],
    question: "Quel aménagement vert prioriser dans le quartier ?",
    options: ["park", "fountain", "playground"],
    voteType: "single_choice",
    status: "closed",
    results: [
      { option: "park", count: 1 }, // Alice
      { option: "fountain", count: 1 }, // Diana
      { option: "playground", count: 0 },
    ],
    startDate: lastMonth,
    endDate: lastWeek,
  },

  // 3. Vote "expiré" — status encore open mais endDate dépassée.
  //    Permet de tester le badge orange "Expiré" + désactivation du form.
  {
    _id: ids.votes.eventExpired,
    creatorId: ids.users.admin,
    districtIds: [ids.districts.montmartre],
    question: "Test : ce vote est techniquement ouvert mais sa deadline est dépassée",
    options: ["yes", "no"],
    voteType: "single_choice",
    status: "open",
    results: [
      { option: "yes", count: 0 },
      { option: "no", count: 0 },
    ],
    startDate: lastMonth,
    endDate: yesterday, // ← dépassée
  },

  // 4. Vote draft — pas encore lancé par l'admin (status=draft).
  //    Le user le voit dans le filtre "Brouillons" mais ne peut pas y répondre.
  {
    _id: ids.votes.libraryDraft,
    creatorId: ids.users.admin,
    districtIds: [ids.districts.marais],
    question: "Faut-il ouvrir une bibliothèque participative dans le quartier ?",
    options: ["yes", "no", "maybe"],
    voteType: "single_choice",
    status: "draft",
    results: [
      { option: "yes", count: 0 },
      { option: "no", count: 0 },
      { option: "maybe", count: 0 },
    ],
    startDate: nextWeek,
    endDate: inOneMonth,
  },
];

const voteResponses = [
  {
    _id: ids.voteResponses.parkAlice,
    voteId: ids.votes.park,
    userId: ids.users.alice,
    chosenOption: "yes",
    votedAt: now,
  },
  {
    _id: ids.voteResponses.parkBob,
    voteId: ids.votes.park,
    userId: ids.users.bob,
    chosenOption: "yes",
    votedAt: now,
  },
  {
    _id: ids.voteResponses.parkCharlie,
    voteId: ids.votes.park,
    userId: ids.users.charlie,
    chosenOption: "needs more thought",
    votedAt: now,
  },
  {
    _id: ids.voteResponses.marketAlice,
    voteId: ids.votes.market,
    userId: ids.users.alice,
    chosenOption: "saturday",
    votedAt: now,
  },

  // ─── Réponses pour le vote multi_choice tools ────────────────────────────
  // Alice a voté pour `hammer` ET `drill` (2 réponses distinctes).
  // Permet de tester l'affichage "Vous avez voté pour : hammer, drill".
  {
    _id: ids.voteResponses.toolsAliceHammer,
    voteId: ids.votes.toolsMulti,
    userId: ids.users.alice,
    chosenOption: "hammer",
    votedAt: lastWeek,
  },
  {
    _id: ids.voteResponses.toolsAliceDrill,
    voteId: ids.votes.toolsMulti,
    userId: ids.users.alice,
    chosenOption: "drill",
    votedAt: lastWeek,
  },
  // Bob : drill + saw
  {
    _id: ids.voteResponses.toolsBobDrill,
    voteId: ids.votes.toolsMulti,
    userId: ids.users.bob,
    chosenOption: "drill",
    votedAt: lastWeek,
  },
  {
    _id: ids.voteResponses.toolsBobSaw,
    voteId: ids.votes.toolsMulti,
    userId: ids.users.bob,
    chosenOption: "saw",
    votedAt: lastWeek,
  },
  // Charlie : hammer seul
  {
    _id: ids.voteResponses.toolsCharlieHammer,
    voteId: ids.votes.toolsMulti,
    userId: ids.users.charlie,
    chosenOption: "hammer",
    votedAt: lastWeek,
  },

  // ─── Réponses sur le vote clos (historique avant fermeture) ──────────────
  {
    _id: ids.voteResponses.greenClosedAlice,
    voteId: ids.votes.greenClosed,
    userId: ids.users.alice,
    chosenOption: "park",
    votedAt: lastMonth,
  },
  {
    _id: ids.voteResponses.greenClosedDiana,
    voteId: ids.votes.greenClosed,
    userId: ids.users.diana,
    chosenOption: "fountain",
    votedAt: lastMonth,
  },
];

const conversations = [
  {
    _id: ids.conversations.aliceBob,
    participants: [ids.users.alice, ids.users.bob],
    type: "direct",
    lastMessageAt: now,
    createdAt: lastWeek,
  },
  {
    _id: ids.conversations.group,
    participants: [ids.users.alice, ids.users.bob, ids.users.diana],
    type: "group",
    name: "Cleanup organisers",
    lastMessageAt: now,
    createdAt: lastWeek,
  },
];

const messages = [
  {
    _id: ids.messages.aliceBobHi,
    senderId: ids.users.alice,
    conversationId: ids.conversations.aliceBob,
    type: "text",
    content: "Hi Bob, are you free Saturday for the plumbing fix?",
    read: true,
    createdAt: lastWeek,
  },
  {
    _id: ids.messages.aliceBobReply,
    senderId: ids.users.bob,
    conversationId: ids.conversations.aliceBob,
    type: "text",
    content: "Yes, I can come by around 10am. Sending you the contract.",
    read: false,
    createdAt: now,
  },
  {
    _id: ids.messages.groupAnnouncement,
    senderId: ids.users.alice,
    conversationId: ids.conversations.group,
    type: "text",
    content: "Hey everyone, gloves and bags are ready for next week's cleanup!",
    read: true,
    createdAt: lastWeek,
  },
  {
    _id: ids.messages.groupReply,
    senderId: ids.users.diana,
    conversationId: ids.conversations.group,
    type: "text",
    content: "Great, I can bring extra trash bags too.",
    read: false,
    createdAt: now,
  },
];

const notifications = [
  {
    _id: ids.notifications.welcomeAlice,
    recipientId: ids.users.alice,
    type: "system",
    title: "Welcome to Connected Neighbours",
    message: "Your account is ready. Explore listings around you!",
    read: true,
    createdAt: lastWeek,
  },
  {
    _id: ids.notifications.eventCharlie,
    recipientId: ids.users.charlie,
    type: "event",
    title: "Reminder: BBQ tomorrow",
    message: "Don't forget the summer barbecue tomorrow at 7pm.",
    refId: ids.events.barbecue,
    refType: "event",
    read: false,
    createdAt: now,
  },
  {
    _id: ids.notifications.voteDiana,
    recipientId: ids.users.diana,
    type: "vote",
    title: "New vote available",
    message: "Vote about the weekly neighbourhood market is now open.",
    refId: ids.votes.market,
    refType: "vote",
    read: false,
    createdAt: now,
  },
  {
    _id: ids.notifications.incidentAdmin,
    recipientId: ids.users.admin,
    type: "incident",
    title: "New incident reported",
    message: "Charlie reported graffiti on the playground wall.",
    refId: ids.incidents.graffiti,
    refType: "incident",
    read: false,
    createdAt: now,
  },
];

const transactions = [
  {
    _id: ids.transactions.aliceCreditWelcome,
    userId: ids.users.alice,
    type: "credit",
    amount: 30,
    refType: "system",
    createdAt: lastWeek,
  },
  {
    _id: ids.transactions.bobCreditWelcome,
    userId: ids.users.bob,
    type: "credit",
    amount: 25,
    refType: "system",
    createdAt: lastWeek,
  },
];

// ─── Seeding logic ────────────────────────────────────────────────────────────

const seedCollection = async <T extends { _id: string }>(
  db: import("mongodb").Db,
  collectionName: string,
  documents: T[],
) => {
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

const seedGraph = async (graph: Neo4jGraphRepository): Promise<void> => {
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
    await graph.upsertTag({ name: t.name, category: t.description });
  }
  for (const l of listings) {
    await graph.upsertListing({ id: l._id, type: l.type });
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

  // ── Event tags (Neo4j only — le DTO Event n'a pas de champ `tags` côté
  //    Mongo pour l'instant, mais on enrichit le graphe pour que la reco
  //    puisse exploiter les similarités cross-tag).
  const eventTagMap: Record<string, string[]> = {
    [ids.events.cleanup]: ["gardening", "diy"],
    [ids.events.barbecue]: ["cooking"],
    [ids.events.workshop]: ["diy"],
  };
  for (const [eventId, tagNames] of Object.entries(eventTagMap)) {
    for (const tagName of tagNames) {
      await graph.linkEventTagged(eventId, tagName);
    }
  }

  // ── Interest signals (alimente INTERESTED_IN_EVENT pour le moteur de
  //    reco). Sans ces signaux le graphe est trop pauvre pour proposer des
  //    suggestions pertinentes. Voici une matrice qui crée des intersections
  //    suffisantes pour démontrer le collaborative filtering :
  //
  //      Alice   ❤️ cleanup(3), workshop(2)
  //      Bob     ❤️ cleanup(2), barbecue(1)
  //      Charlie ❤️ barbecue(3), cleanup(1)
  //      Diana   ❤️ cleanup(1), workshop(4), barbecue(2)
  //
  //    Conséquences attendues côté reco :
  //      • Bob   → workshop recommandé (Alice et Diana, qui aiment cleanup
  //               comme Bob, aiment aussi workshop)
  //      • Alice → barbecue recommandé (Bob/Charlie/Diana qui aiment cleanup
  //               comme Alice aiment aussi barbecue)
  //      • Charlie → workshop recommandé (Diana qui aime barbecue comme
  //                  Charlie aime aussi workshop)
  const interests: { userId: string; eventId: string; score: number }[] = [
    { userId: ids.users.alice, eventId: ids.events.cleanup, score: 3 },
    { userId: ids.users.alice, eventId: ids.events.workshop, score: 2 },
    { userId: ids.users.bob, eventId: ids.events.cleanup, score: 2 },
    { userId: ids.users.bob, eventId: ids.events.barbecue, score: 1 },
    { userId: ids.users.charlie, eventId: ids.events.barbecue, score: 3 },
    { userId: ids.users.charlie, eventId: ids.events.cleanup, score: 1 },
    { userId: ids.users.diana, eventId: ids.events.cleanup, score: 1 },
    { userId: ids.users.diana, eventId: ids.events.workshop, score: 4 },
    { userId: ids.users.diana, eventId: ids.events.barbecue, score: 2 },
  ];
  for (const sig of interests) {
    // setUserInterestedInEvent au lieu de linkUserInterestedInEvent : on
    // veut un SET absolu (idempotent) pour pouvoir relancer `npm run seed`
    // sans doubler les scores à chaque exécution.
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

  console.log("🌱  Seeding databases (Mongo + Neo4j)...");

  let mongoOk = false;
  let driver: Awaited<ReturnType<typeof connectNeo4j>> | null = null;

  try {
    const db = await connectDB();
    mongoOk = true;

    // ── Mongo ────────────────────────────────────────────────────────────
    console.log("\n📄  Mongo");
    await seedCollection(db, "districts", districts);
    await seedCollection(db, "users", users);
    console.warn(`  🔑 seeded users share password "${seedPassword}" (e.g. alice@example.com)`);
    await seedCollection(db, "tags", tags);
    await seedCollection(db, "listings", listings);
    await seedCollection(db, "events", events);
    await seedCollection(db, "incidents", incidents);
    await seedCollection(db, "votes", votes);
    await seedCollection(db, "vote_responses", voteResponses);
    await seedCollection(db, "conversations", conversations);
    await seedCollection(db, "messages", messages);
    await seedCollection(db, "notifications", notifications);
    await seedCollection(db, "transactions", transactions);

    const totalDocs =
      districts.length +
      users.length +
      tags.length +
      listings.length +
      events.length +
      incidents.length +
      votes.length +
      voteResponses.length +
      conversations.length +
      messages.length +
      notifications.length +
      transactions.length;

    console.log(`  ✅ ${totalDocs} documents across 13 collections.`);

    // ── Neo4j ────────────────────────────────────────────────────────────
    console.log("\n🕸️  Neo4j");
    driver = await connectNeo4j();
    const graph = new Neo4jGraphRepository(driver);
    await seedGraph(graph);
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
    void mongoOk;
    process.exit(process.exitCode ?? 0);
  }
};

// Silence the linter — `allSeededIds` is exported for tests/scripts that may
// want to know which IDs the seed touches.
export { allSeededIds, ids };

void main();

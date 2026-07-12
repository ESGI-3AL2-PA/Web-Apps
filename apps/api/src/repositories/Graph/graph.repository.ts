/**
 * Graph repository — Neo4j projection of the metier domain.
 *
 * Mongo is the source of truth for full documents; Neo4j stores the same
 * entities as nodes (with a minimal subset of attributes) plus all the
 * relationships needed for traversal queries and the recommendation engine.
 *
 * Sync is dual-write: every Mongo mutation is mirrored to Neo4j. To avoid
 * blocking the API when Neo4j is degraded, the use-cases wrap these calls
 * in best-effort try/catch (log + continue).
 */

export interface UserNode {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface DistrictNode {
  id: string;
  name: string;
}

export interface EventNode {
  id: string;
  title: string;
  category?: string;
  date: string;
}

export interface ListingNode {
  id: string;
  type: string;
  category?: string;
}

export interface VoteNode {
  id: string;
  question: string;
  endDate: string;
}

export interface IncidentNode {
  id: string;
  category: string;
  status: string;
}

export interface TagNode {
  name: string;
  category?: string;
}

export interface IGraphRepository {
  // ─── Projection maintenance ───────────────────────────────────────────────
  /** Wipe the entire projection (MATCH (n) DETACH DELETE n) — used by the
   *  reconciliation job before replaying the graph from Mongo. */
  reset(): Promise<void>;

  // ─── Nodes (upsert + delete) ──────────────────────────────────────────────
  upsertUser(node: UserNode): Promise<void>;
  deleteUser(id: string): Promise<void>;

  upsertDistrict(node: DistrictNode): Promise<void>;
  deleteDistrict(id: string): Promise<void>;

  upsertEvent(node: EventNode): Promise<void>;
  deleteEvent(id: string): Promise<void>;

  upsertListing(node: ListingNode): Promise<void>;
  deleteListing(id: string): Promise<void>;

  upsertVote(node: VoteNode): Promise<void>;
  deleteVote(id: string): Promise<void>;

  upsertIncident(node: IncidentNode): Promise<void>;
  deleteIncident(id: string): Promise<void>;

  upsertTag(node: TagNode): Promise<void>;
  deleteTag(name: string): Promise<void>;

  // ─── Residence ────────────────────────────────────────────────────────────
  linkUserLivesIn(userId: string, districtId: string, since?: string, address?: string): Promise<void>;

  // ─── Events ───────────────────────────────────────────────────────────────
  linkUserCreatedEvent(userId: string, eventId: string): Promise<void>;
  linkDistrictContainsEvent(districtId: string, eventId: string): Promise<void>;
  linkUserRegisteredForEvent(userId: string, eventId: string, registrationDate: string, status: string): Promise<void>;
  unlinkUserRegisteredForEvent(userId: string, eventId: string): Promise<void>;
  linkUserAttendedEvent(userId: string, eventId: string, rating?: number): Promise<void>;
  linkEventTagged(eventId: string, tagName: string): Promise<void>;
  /**
   * Upsert d'une relation INTERESTED_IN_EVENT (alimente le moteur de reco).
   * `scoreDelta` est ajouté au score existant (ou initialise si nouvelle relation).
   * Utiliser pour les clicks 👍/👎 qui doivent s'accumuler.
   */
  linkUserInterestedInEvent(userId: string, eventId: string, scoreDelta: number): Promise<void>;

  /**
   * Variante "set absolu" — écrase le score existant. Utiliser pour le seed
   * pour rester idempotent (sinon relancer `npm run seed` ferait doubler/tripler
   * les scores à chaque exécution).
   */
  setUserInterestedInEvent(userId: string, eventId: string, score: number): Promise<void>;

  /**
   * Moteur de recommandation — renvoie les IDs d'events recommandés pour
   * `userId`, ordonnés par pertinence descendante. Le calcul utilise du
   * collaborative filtering : on cherche des users avec des goûts similaires
   * (ayant aimé les mêmes events) puis on remonte ce qu'ils ont aussi aimé.
   * Exclut les events que l'user a déjà engagés.
   */
  getRecommendedEventIds(userId: string, limit: number): Promise<string[]>;

  // ─── Listings ─────────────────────────────────────────────────────────────
  linkUserPublishedListing(userId: string, listingId: string): Promise<void>;
  linkUserRepliedToListing(userId: string, listingId: string, replyDate: string): Promise<void>;
  linkListingTagged(listingId: string, tagName: string): Promise<void>;

  // ─── Services (generated from a paid listing → contract) ──────────────────
  linkListingGeneratesService(
    listingId: string,
    serviceId: string,
    pointsAmount: number,
    status: string,
  ): Promise<void>;
  linkUserOffersService(userId: string, serviceId: string, serviceDate: string): Promise<void>;
  linkUserBenefitsFromService(userId: string, serviceId: string, serviceDate: string, status: string): Promise<void>;

  // ─── Votes ────────────────────────────────────────────────────────────────
  linkUserVoted(userId: string, voteId: string, option: string, voteDate: string): Promise<void>;
  linkDistrictConcernsVote(districtId: string, voteId: string): Promise<void>;

  // ─── Incidents ────────────────────────────────────────────────────────────
  linkUserReportedIncident(userId: string, incidentId: string): Promise<void>;
  linkDistrictContainsIncident(districtId: string, incidentId: string): Promise<void>;

  // ─── Social network ───────────────────────────────────────────────────────
  linkUserKnows(userIdA: string, userIdB: string): Promise<void>;
}

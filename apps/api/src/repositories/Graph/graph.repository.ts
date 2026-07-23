/**
 * Repository graphe — projection Neo4j du domaine métier (interface + types).
 *
 * Mongo reste la source de vérité pour les documents complets ; Neo4j stocke
 * les mêmes entités sous forme de nodes (avec un sous-ensemble minimal
 * d'attributs) plus toutes les relations nécessaires aux requêtes de
 * traversée et au moteur de recommandation.
 *
 * La synchro est en dual-write : chaque mutation Mongo est répliquée dans
 * Neo4j. Pour ne pas bloquer l'API quand Neo4j est dégradé, les cas d'usage
 * enveloppent ces appels dans un try/catch best-effort (log + on continue).
 */

// ─── Types de nodes (sous-ensemble d'attributs projeté dans Neo4j) ──────────

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

/** Une relation touchant l'user exporté, aplatie pour un dump JSON portable. */
export interface UserGraphRelationship {
  type: string;
  direction: "out" | "in";
  properties: Record<string, unknown>;
  other: { labels: string[]; properties: Record<string, unknown> };
}

/** Le node de l'user plus chaque relation à laquelle il participe (export RGPD). */
export interface UserGraphExport {
  nodes: Array<{ labels: string[]; properties: Record<string, unknown> }>;
  relationships: UserGraphRelationship[];
}

export interface IGraphRepository {
  // ─── Maintenance de la projection ─────────────────────────────────────────
  /** Vide toute la projection (MATCH (n) DETACH DELETE n) — utilisé par le job
   *  de réconciliation avant de rejouer le graphe depuis Mongo. */
  reset(): Promise<void>;

  // ─── Export RGPD ──────────────────────────────────────────────────────────
  /** Tous les nodes + relations touchant cet user — LIVES_IN (adresse), le
   *  KNOWS social et chaque relation métier — pour l'export de données
   *  (art. 15/20). Lecture seule. */
  exportUserGraph(userId: string): Promise<UserGraphExport>;

  // ─── Nodes (upsert + suppression) ─────────────────────────────────────────
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

  // ─── Résidence ────────────────────────────────────────────────────────────
  linkUserLivesIn(userId: string, districtId: string, since?: string, address?: string): Promise<void>;

  // ─── Événements ───────────────────────────────────────────────────────────
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

  // ─── Annonces ─────────────────────────────────────────────────────────────
  linkUserPublishedListing(userId: string, listingId: string): Promise<void>;
  linkUserRepliedToListing(userId: string, listingId: string, replyDate: string): Promise<void>;
  linkListingTagged(listingId: string, tagName: string): Promise<void>;

  // ─── Services (générés par une annonce payante → contrat) ─────────────────
  linkListingGeneratesService(
    listingId: string,
    serviceId: string,
    pointsAmount: number,
    status: string,
  ): Promise<void>;
  linkUserOffersService(userId: string, serviceId: string, serviceDate: string): Promise<void>;
  linkUserBenefitsFromService(userId: string, serviceId: string, serviceDate: string, status: string): Promise<void>;

  // ─── Votes / sondages ─────────────────────────────────────────────────────
  linkUserVoted(userId: string, voteId: string, option: string, voteDate: string): Promise<void>;
  linkDistrictConcernsVote(districtId: string, voteId: string): Promise<void>;

  // ─── Signalements ─────────────────────────────────────────────────────────
  linkUserReportedIncident(userId: string, incidentId: string): Promise<void>;
  linkDistrictContainsIncident(districtId: string, incidentId: string): Promise<void>;

  // ─── Réseau social ────────────────────────────────────────────────────────
  linkUserKnows(userIdA: string, userIdB: string): Promise<void>;
}

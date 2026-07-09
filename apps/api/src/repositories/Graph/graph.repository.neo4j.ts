import neo4j, { type Driver } from "neo4j-driver";
import type {
  DistrictNode,
  EventNode,
  IGraphRepository,
  IncidentNode,
  ListingNode,
  TagNode,
  UserNode,
  VoteNode,
} from "./graph.repository.js";

/**
 * Neo4j-backed implementation of the graph projection.
 *
 * All write queries use MERGE (idempotent upsert) so seed/sync can re-run
 * without duplicating nodes or edges. Each method opens its own session and
 * closes it; for hot-path queries the caller can batch calls inside their own
 * session if needed.
 */
export class Neo4jGraphRepository implements IGraphRepository {
  constructor(private driver: Driver) {}

  private async run(cypher: string, params: object = {}): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(cypher, params as Record<string, unknown>);
    } finally {
      await session.close();
    }
  }

  // ─── Projection maintenance ───────────────────────────────────────────────

  async reset(): Promise<void> {
    await this.run(`MATCH (n) DETACH DELETE n`);
  }

  // ─── Nodes ──────────────────────────────────────────────────────────────

  async upsertUser(node: UserNode): Promise<void> {
    await this.run(
      `MERGE (u:User {userId: $id})
       SET u.name = $name, u.email = $email, u.role = $role`,
      node,
    );
  }

  async deleteUser(id: string): Promise<void> {
    await this.run(`MATCH (u:User {userId: $id}) DETACH DELETE u`, { id });
  }

  async upsertDistrict(node: DistrictNode): Promise<void> {
    await this.run(
      `MERGE (d:District {districtId: $id})
       SET d.name = $name`,
      node,
    );
  }

  async deleteDistrict(id: string): Promise<void> {
    await this.run(`MATCH (d:District {districtId: $id}) DETACH DELETE d`, { id });
  }

  async upsertEvent(node: EventNode): Promise<void> {
    // Neo4j requires every $param referenced in the Cypher to be present in the
    // params object, so optional fields must be explicitly nulled.
    await this.run(
      `MERGE (e:Event {eventId: $id})
       SET e.title = $title, e.category = $category, e.date = $date`,
      { ...node, category: node.category ?? null },
    );
  }

  async deleteEvent(id: string): Promise<void> {
    await this.run(`MATCH (e:Event {eventId: $id}) DETACH DELETE e`, { id });
  }

  async upsertListing(node: ListingNode): Promise<void> {
    await this.run(
      `MERGE (l:Listing {listingId: $id})
       SET l.type = $type, l.category = $category`,
      { ...node, category: node.category ?? null },
    );
  }

  async deleteListing(id: string): Promise<void> {
    await this.run(`MATCH (l:Listing {listingId: $id}) DETACH DELETE l`, { id });
  }

  async upsertVote(node: VoteNode): Promise<void> {
    await this.run(
      `MERGE (v:Vote {voteId: $id})
       SET v.question = $question, v.endDate = $endDate`,
      node,
    );
  }

  async deleteVote(id: string): Promise<void> {
    await this.run(`MATCH (v:Vote {voteId: $id}) DETACH DELETE v`, { id });
  }

  async upsertIncident(node: IncidentNode): Promise<void> {
    await this.run(
      `MERGE (i:Incident {incidentId: $id})
       SET i.category = $category, i.status = $status`,
      node,
    );
  }

  async deleteIncident(id: string): Promise<void> {
    await this.run(`MATCH (i:Incident {incidentId: $id}) DETACH DELETE i`, { id });
  }

  async upsertTag(node: TagNode): Promise<void> {
    await this.run(
      `MERGE (t:Tag {name: $name})
       SET t.category = $category`,
      { ...node, category: node.category ?? null },
    );
  }

  async deleteTag(name: string): Promise<void> {
    await this.run(`MATCH (t:Tag {name: $name}) DETACH DELETE t`, { name });
  }

  // ─── Residence ──────────────────────────────────────────────────────────

  async linkUserLivesIn(userId: string, districtId: string, since?: string, address?: string): Promise<void> {
    await this.run(
      `MATCH (u:User {userId: $userId})
       MATCH (d:District {districtId: $districtId})
       MERGE (u)-[r:LIVES_IN]->(d)
       SET r.since = COALESCE($since, r.since), r.address = COALESCE($address, r.address)`,
      { userId, districtId, since: since ?? null, address: address ?? null },
    );
  }

  // ─── Events ─────────────────────────────────────────────────────────────

  async linkUserCreatedEvent(userId: string, eventId: string): Promise<void> {
    await this.run(
      `MATCH (u:User {userId: $userId})
       MATCH (e:Event {eventId: $eventId})
       MERGE (u)-[:CREATED]->(e)`,
      { userId, eventId },
    );
  }

  async linkDistrictContainsEvent(districtId: string, eventId: string): Promise<void> {
    await this.run(
      `MATCH (d:District {districtId: $districtId})
       MATCH (e:Event {eventId: $eventId})
       MERGE (d)-[:CONTAINS]->(e)`,
      { districtId, eventId },
    );
  }

  async linkUserRegisteredForEvent(
    userId: string,
    eventId: string,
    registrationDate: string,
    status: string,
  ): Promise<void> {
    await this.run(
      `MATCH (u:User {userId: $userId})
       MATCH (e:Event {eventId: $eventId})
       MERGE (u)-[r:REGISTERED_FOR]->(e)
       SET r.registrationDate = $registrationDate, r.status = $status`,
      { userId, eventId, registrationDate, status },
    );
  }

  async unlinkUserRegisteredForEvent(userId: string, eventId: string): Promise<void> {
    await this.run(
      `MATCH (u:User {userId: $userId})-[r:REGISTERED_FOR]->(e:Event {eventId: $eventId})
       DELETE r`,
      { userId, eventId },
    );
  }

  async linkUserAttendedEvent(userId: string, eventId: string, rating?: number): Promise<void> {
    await this.run(
      `MATCH (u:User {userId: $userId})
       MATCH (e:Event {eventId: $eventId})
       MERGE (u)-[r:ATTENDED]->(e)
       SET r.rating = COALESCE($rating, r.rating)`,
      { userId, eventId, rating: rating ?? null },
    );
  }

  async linkEventTagged(eventId: string, tagName: string): Promise<void> {
    await this.run(
      `MATCH (e:Event {eventId: $eventId})
       MERGE (t:Tag {name: $tagName})
       MERGE (e)-[:TAGGED]->(t)`,
      { eventId, tagName },
    );
  }

  async linkUserInterestedInEvent(userId: string, eventId: string, scoreDelta: number): Promise<void> {
    // MERGE sur User & Event au lieu de MATCH : si l'un ou l'autre n'a pas
    // encore été synchronisé vers Neo4j (user créé via auth UI sans dual-write,
    // par ex.), on crée un node stub avec juste l'id. Les autres propriétés
    // (name, email, title…) seront enrichies au prochain upsert.
    // Sans ça, le MATCH échouait silencieusement et le MERGE de la relation
    // n'avait aucun effet.
    await this.run(
      `MERGE (u:User {userId: $userId})
       MERGE (e:Event {eventId: $eventId})
       MERGE (u)-[r:INTERESTED_IN_EVENT]->(e)
       ON CREATE SET r.score = $scoreDelta, r.updatedAt = $updatedAt
       ON MATCH  SET r.score = coalesce(r.score, 0) + $scoreDelta, r.updatedAt = $updatedAt`,
      { userId, eventId, scoreDelta, updatedAt: new Date().toISOString() },
    );
  }

  async setUserInterestedInEvent(userId: string, eventId: string, score: number): Promise<void> {
    // SET absolu (idempotent) — utilisé par le seed. Le score est écrasé,
    // pas accumulé.
    await this.run(
      `MERGE (u:User {userId: $userId})
       MERGE (e:Event {eventId: $eventId})
       MERGE (u)-[r:INTERESTED_IN_EVENT]->(e)
       SET r.score = $score, r.updatedAt = $updatedAt`,
      { userId, eventId, score, updatedAt: new Date().toISOString() },
    );
  }

  async getRecommendedEventIds(userId: string, limit: number): Promise<string[]> {
    // Collaborative filtering en 3 sauts :
    //   1. Events que l'user a aimés (score > 0)
    //   2. Autres users qui ont aimé les mêmes events (= goûts similaires)
    //   3. Events que ces autres users ont aussi aimés
    // On exclut ce que l'user a déjà engagé (interest / registered / attended).
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (u:User {userId: $userId})-[r1:INTERESTED_IN_EVENT]->(common:Event)
         WHERE r1.score > 0
         MATCH (common)<-[r2:INTERESTED_IN_EVENT]-(other:User)
         WHERE other.userId <> $userId AND r2.score > 0
         MATCH (other)-[r3:INTERESTED_IN_EVENT]->(reco:Event)
         WHERE reco.eventId <> common.eventId AND r3.score > 0
           AND NOT (u)-[:INTERESTED_IN_EVENT|REGISTERED_FOR|ATTENDED]->(reco)
         WITH reco.eventId AS eventId, sum(r3.score) AS relevance
         ORDER BY relevance DESC
         LIMIT $limit
         RETURN eventId`,
        { userId, limit: neo4j.int(limit) },
      );
      return result.records.map((r) => r.get("eventId") as string);
    } finally {
      await session.close();
    }
  }

  // ─── Listings ───────────────────────────────────────────────────────────

  async linkUserPublishedListing(userId: string, listingId: string): Promise<void> {
    await this.run(
      `MATCH (u:User {userId: $userId})
       MATCH (l:Listing {listingId: $listingId})
       MERGE (u)-[:PUBLISHED]->(l)`,
      { userId, listingId },
    );
  }

  async linkUserRepliedToListing(userId: string, listingId: string, replyDate: string): Promise<void> {
    await this.run(
      `MATCH (u:User {userId: $userId})
       MATCH (l:Listing {listingId: $listingId})
       MERGE (u)-[r:REPLIED_TO]->(l)
       SET r.replyDate = $replyDate`,
      { userId, listingId, replyDate },
    );
  }

  async linkListingTagged(listingId: string, tagName: string): Promise<void> {
    await this.run(
      `MATCH (l:Listing {listingId: $listingId})
       MERGE (t:Tag {name: $tagName})
       MERGE (l)-[:TAGGED]->(t)`,
      { listingId, tagName },
    );
  }

  // ─── Services ───────────────────────────────────────────────────────────

  async linkListingGeneratesService(
    listingId: string,
    serviceId: string,
    pointsAmount: number,
    status: string,
  ): Promise<void> {
    await this.run(
      `MATCH (l:Listing {listingId: $listingId})
       MERGE (s:Service {serviceId: $serviceId})
       SET s.pointsAmount = $pointsAmount, s.status = $status
       MERGE (l)-[:GENERATES]->(s)`,
      { listingId, serviceId, pointsAmount, status },
    );
  }

  async linkUserOffersService(userId: string, serviceId: string, serviceDate: string): Promise<void> {
    await this.run(
      `MATCH (u:User {userId: $userId})
       MATCH (s:Service {serviceId: $serviceId})
       MERGE (u)-[r:OFFERS]->(s)
       SET r.serviceDate = $serviceDate`,
      { userId, serviceId, serviceDate },
    );
  }

  async linkUserBenefitsFromService(
    userId: string,
    serviceId: string,
    serviceDate: string,
    status: string,
  ): Promise<void> {
    await this.run(
      `MATCH (u:User {userId: $userId})
       MATCH (s:Service {serviceId: $serviceId})
       MERGE (u)-[r:BENEFITS_FROM]->(s)
       SET r.serviceDate = $serviceDate, r.status = $status`,
      { userId, serviceId, serviceDate, status },
    );
  }

  // ─── Votes ──────────────────────────────────────────────────────────────

  async linkUserVoted(userId: string, voteId: string, option: string, voteDate: string): Promise<void> {
    await this.run(
      `MATCH (u:User {userId: $userId})
       MATCH (v:Vote {voteId: $voteId})
       MERGE (u)-[r:VOTED]->(v)
       SET r.option = $option, r.voteDate = $voteDate`,
      { userId, voteId, option, voteDate },
    );
  }

  async linkDistrictConcernsVote(districtId: string, voteId: string): Promise<void> {
    await this.run(
      `MATCH (d:District {districtId: $districtId})
       MATCH (v:Vote {voteId: $voteId})
       MERGE (d)-[:CONCERNS]->(v)`,
      { districtId, voteId },
    );
  }

  // ─── Incidents ──────────────────────────────────────────────────────────

  async linkUserReportedIncident(userId: string, incidentId: string): Promise<void> {
    await this.run(
      `MATCH (u:User {userId: $userId})
       MATCH (i:Incident {incidentId: $incidentId})
       MERGE (u)-[:REPORTED]->(i)`,
      { userId, incidentId },
    );
  }

  async linkDistrictContainsIncident(districtId: string, incidentId: string): Promise<void> {
    await this.run(
      `MATCH (d:District {districtId: $districtId})
       MATCH (i:Incident {incidentId: $incidentId})
       MERGE (d)-[:CONTAINS]->(i)`,
      { districtId, incidentId },
    );
  }

  // ─── Social ─────────────────────────────────────────────────────────────

  async linkUserKnows(userIdA: string, userIdB: string): Promise<void> {
    await this.run(
      `MATCH (a:User {userId: $a})
       MATCH (b:User {userId: $b})
       MERGE (a)-[:KNOWS]->(b)`,
      { a: userIdA, b: userIdB },
    );
  }
}

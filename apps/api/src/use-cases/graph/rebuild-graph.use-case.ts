import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { IDistrictRepository } from "../../repositories/District/district.repository.js";
import type { IEventRepository } from "../../repositories/Event/event.repository.js";
import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";
import type { IVoteRepository } from "../../repositories/Vote/vote.repository.js";
import type { IIncidentRepository } from "../../repositories/Incident/incident.repository.js";
import type { ITagRepository } from "../../repositories/Tag/tag.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";

// Fetch-all page size for the rebuild. The projection is small (a neighbourhood app);
// a single large page avoids threading pagination through every collection.
const ALL = 100_000;

export interface RebuildGraphDeps {
  userRepository: IUserRepository;
  districtRepository: IDistrictRepository;
  eventRepository: IEventRepository;
  listingRepository: IListingRepository;
  voteRepository: IVoteRepository;
  incidentRepository: IIncidentRepository;
  tagRepository: ITagRepository;
  graphRepository: IGraphRepository;
}

export interface RebuildGraphStats {
  users: number;
  districts: number;
  events: number;
  listings: number;
  votes: number;
  incidents: number;
  tags: number;
  interactions: number;
}

/**
 * Reconciliation job: wipe the Neo4j projection and rebuild it from Mongo (the source
 * of truth). Because per-request syncGraph is best-effort (it logs and continues on a
 * degraded Neo4j), Mongo and the graph drift over time; running this restores them to
 * a consistent state and makes the projection self-healing.
 *
 * Covers the nodes + the relationships the recommendation engine and traversals rely
 * on: residence, event authorship/containment/registration/attendance/interest, listing
 * authorship + tags, vote district-scope, and incident authorship/containment. Contract
 * → service edges are intentionally out of scope (contracts are managed separately).
 */
export const rebuildGraphUseCase = (deps: RebuildGraphDeps) => {
  return async (): Promise<RebuildGraphStats> => {
    const {
      userRepository,
      districtRepository,
      eventRepository,
      listingRepository,
      voteRepository,
      incidentRepository,
      tagRepository,
      graphRepository: graph,
    } = deps;

    const [users, districts, events, listings, votes, incidents, tags, interactions] = await Promise.all([
      userRepository.getUsers({ limit: ALL }).then((r) => r.data),
      districtRepository.getDistricts({ limit: ALL }).then((r) => r.data),
      eventRepository.getEvents({ limit: ALL }).then((r) => r.data),
      listingRepository.getListings({ limit: ALL }).then((r) => r.data),
      voteRepository.getVotes({ limit: ALL }).then((r) => r.data),
      incidentRepository.getIncidents({ limit: ALL }).then((r) => r.data),
      tagRepository.getTags({ limit: ALL }).then((r) => r.data),
      eventRepository.getAllInteractions(),
    ]);

    // 1. Start from a clean projection so nodes/edges deleted in Mongo don't linger.
    await graph.reset();

    // 2. Nodes.
    await Promise.all(districts.map((d) => graph.upsertDistrict({ id: d.id, name: d.name })));
    await Promise.all(tags.map((t) => graph.upsertTag({ name: t.name })));
    await Promise.all(
      users.map((u) =>
        graph.upsertUser({ id: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email, role: u.role }),
      ),
    );

    // 3. Residence.
    await Promise.all(users.map((u) => graph.linkUserLivesIn(u.id, u.districtId, u.createdAt, u.address)));

    // 4. Events: node + author + containment + registrations.
    for (const e of events) {
      await graph.upsertEvent({ id: e.id, title: e.title, date: e.eventDate });
      await graph.linkUserCreatedEvent(e.creatorId, e.id);
      await graph.linkDistrictContainsEvent(e.districtId, e.id);
      for (const registrantId of e.registrants) {
        await graph.linkUserRegisteredForEvent(registrantId, e.id, e.createdAt, "registered");
      }
    }

    // 5. Attendance + interest (Mongo event_interactions is the source of truth).
    for (const i of interactions) {
      if (i.kind === "attendance") {
        await graph.linkUserAttendedEvent(i.userId, i.eventId, i.rating);
      } else {
        await graph.setUserInterestedInEvent(i.userId, i.eventId, i.score ?? 0);
      }
    }

    // 6. Listings: node + author + tags.
    for (const l of listings) {
      await graph.upsertListing({ id: l.id, type: l.type, category: l.tags[0] });
      await graph.linkUserPublishedListing(l.authorId, l.id);
      for (const tagName of l.tags) {
        await graph.linkListingTagged(l.id, tagName);
      }
    }

    // 7. Votes: node + district scope.
    for (const v of votes) {
      await graph.upsertVote({ id: v.id, question: v.question, endDate: v.endDate });
      for (const districtId of v.districtIds) {
        await graph.linkDistrictConcernsVote(districtId, v.id);
      }
    }

    // 8. Incidents: node + author + containment.
    for (const inc of incidents) {
      await graph.upsertIncident({ id: inc.id, category: inc.category, status: inc.status });
      await graph.linkUserReportedIncident(inc.reporterId, inc.id);
      await graph.linkDistrictContainsIncident(inc.districtId, inc.id);
    }

    return {
      users: users.length,
      districts: districts.length,
      events: events.length,
      listings: listings.length,
      votes: votes.length,
      incidents: incidents.length,
      tags: tags.length,
      interactions: interactions.length,
    };
  };
};

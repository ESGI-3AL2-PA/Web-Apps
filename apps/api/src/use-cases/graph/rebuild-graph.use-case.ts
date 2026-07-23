import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { IDistrictRepository } from "../../repositories/District/district.repository.js";
import type { IEventRepository } from "../../repositories/Event/event.repository.js";
import type { IListingRepository } from "../../repositories/Listing/listing.repository.js";
import type { IVoteRepository } from "../../repositories/Vote/vote.repository.js";
import type { IIncidentRepository } from "../../repositories/Incident/incident.repository.js";
import type { ITagRepository } from "../../repositories/Tag/tag.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";

// Fichier : cas d'usage de reconstruction integrale de la projection de graphe.
// Repart des donnees Mongo (source de verite) pour reconstruire le graphe Neo4j
// depuis zero. Expose la factory `rebuildGraphUseCase`, ses dependances (une
// entree par repository de domaine) et le type de statistiques renvoyees.

// Taille de page « tout charger » pour la reconstruction. La projection est
// petite (application de quartier) ; une seule grande page evite de propager la
// pagination a travers chaque collection.
const ALL = 100_000;

/** Dependances de la reconstruction : un repository par domaine mirore vers le graphe. */
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

/** Compteurs des noeuds et interactions reprojetes, renvoyes en fin de reconstruction. */
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
 * Cas d'usage : tache de reconciliation qui vide la projection Neo4j et la
 * reconstruit depuis Mongo (source de verite). Comme le syncGraph par requete
 * est best-effort (il journalise et poursuit sur un Neo4j degrade), Mongo et le
 * graphe divergent avec le temps ; cette tache les remet dans un etat coherent
 * et rend la projection auto-reparatrice.
 *
 * Couvre les noeuds + les relations dont dependent le moteur de recommandation
 * et les traversees : residence, evenement (auteur / rattachement au quartier /
 * inscription / participation / interet), annonce (auteur + tags), portee des
 * votes par quartier, et signalement (auteur / rattachement au quartier). Les
 * aretes contrat -> service sont volontairement hors perimetre (les contrats
 * sont geres separement).
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

    // Charge en parallele l'integralite de chaque collection (source de verite Mongo).
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

    // 1. Repartir d'une projection vierge pour que les noeuds/aretes supprimes dans Mongo ne persistent pas.
    await graph.reset();

    // 2. Noeuds (quartiers, tags, utilisateurs).
    await Promise.all(districts.map((d) => graph.upsertDistrict({ id: d.id, name: d.name })));
    await Promise.all(tags.map((t) => graph.upsertTag({ name: t.name })));
    await Promise.all(
      users.map((u) =>
        graph.upsertUser({ id: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email, role: u.role }),
      ),
    );

    // 3. Residence (arete utilisateur -> quartier d'habitation).
    await Promise.all(users.map((u) => graph.linkUserLivesIn(u.id, u.districtId, u.createdAt, u.address)));

    // 4. Evenements : noeud + auteur + rattachement au quartier + inscriptions.
    for (const e of events) {
      await graph.upsertEvent({ id: e.id, title: e.title, date: e.eventDate });
      await graph.linkUserCreatedEvent(e.creatorId, e.id);
      await graph.linkDistrictContainsEvent(e.districtId, e.id);
      for (const registrantId of e.registrants) {
        await graph.linkUserRegisteredForEvent(registrantId, e.id, e.createdAt, "registered");
      }
    }

    // 5. Participation + interet (la collection Mongo event_interactions fait foi).
    for (const i of interactions) {
      if (i.kind === "attendance") {
        await graph.linkUserAttendedEvent(i.userId, i.eventId, i.rating);
      } else {
        await graph.setUserInterestedInEvent(i.userId, i.eventId, i.score ?? 0);
      }
    }

    // 6. Annonces : noeud + auteur + tags.
    for (const l of listings) {
      await graph.upsertListing({ id: l.id, category: l.tags[0] });
      await graph.linkUserPublishedListing(l.authorId, l.id);
      for (const tagName of l.tags) {
        await graph.linkListingTagged(l.id, tagName);
      }
    }

    // 7. Votes / sondages : noeud + portee par quartier.
    for (const v of votes) {
      await graph.upsertVote({ id: v.id, question: v.question, endDate: v.endDate });
      for (const districtId of v.districtIds) {
        await graph.linkDistrictConcernsVote(districtId, v.id);
      }
    }

    // 8. Signalements : noeud + auteur + rattachement au quartier.
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

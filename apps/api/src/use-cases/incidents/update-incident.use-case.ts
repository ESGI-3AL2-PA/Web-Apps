import type { UpdateIncidentDto } from "@repo/contracts";
import type { Incident, IncidentHistoryEntry } from "../../entities/incident.entity.js";
import type { IIncidentRepository } from "../../repositories/Incident/incident.repository.js";
import type { IUserRepository } from "../../repositories/User/user.repository.js";
import type { IGraphRepository } from "../../repositories/Graph/graph.repository.js";
import { syncGraph } from "../../repositories/Graph/graph.sync.js";

/**
 * Resultat discrimine de la mise a jour :
 * - `not-found` : signalement inexistant ;
 * - `invalid-assignee` : assignataire absent ou non admin ;
 * - `ok` : mise a jour reussie, porte le signalement resultant.
 */
export type UpdateIncidentResult =
  | { kind: "not-found" }
  | { kind: "invalid-assignee" }
  | { kind: "ok"; incident: Incident };

/**
 * Cas d'usage : mettre a jour un signalement.
 *
 * Valide l'assignataire, empile une entree d'historique a chaque changement de
 * statut, applique le patch cote Mongo, puis rafraichit les champs projetes
 * dans le graphe (statut / categorie) s'ils ont change.
 *
 * @param actorId identifiant de l'utilisateur a l'origine de la modification (auteur de l'entree d'historique).
 */
export const updateIncidentUseCase = (
  incidentRepository: IIncidentRepository,
  userRepository: IUserRepository,
  graphRepository: IGraphRepository,
) => {
  return async (id: string, data: UpdateIncidentDto, actorId: string): Promise<UpdateIncidentResult> => {
    const existing = await incidentRepository.getIncidentById(id);
    if (!existing) return { kind: "not-found" };

    // On separe la note d'historique du reste : elle ne fait pas partie des champs du signalement.
    const { historyNote, ...rest } = data;

    // Un signalement ne peut etre assigne qu'a un admin (les traitants du quartier), jamais a un utilisateur ordinaire.
    if (rest.assignedTo) {
      const assignee = await userRepository.getUserById(rest.assignedTo);
      if (!assignee || assignee.role !== "admin") return { kind: "invalid-assignee" };
    }

    const update: Partial<Omit<Incident, "id" | "createdAt" | "updatedAt">> = { ...rest };

    // Empile une entree d'historique a chaque changement de statut (la note, elle, est portee par l'entree).
    if (rest.status && rest.status !== existing.status) {
      const entry: IncidentHistoryEntry = {
        status: rest.status,
        note: historyNote,
        updatedBy: actorId,
        updatedAt: new Date().toISOString(),
      };
      update.history = [...existing.history, entry];
    }

    const incident = await incidentRepository.updateIncident(id, update);
    if (!incident) return { kind: "not-found" };

    // Rafraichit les champs projetes du noeud (statut / categorie) s'ils ont change.
    if (rest.status !== undefined || rest.category !== undefined) {
      await syncGraph(`upsertIncident(${incident.id})`, () =>
        graphRepository.upsertIncident({
          id: incident.id,
          category: incident.category,
          status: incident.status,
        }),
      );
    }

    return { kind: "ok", incident };
  };
};

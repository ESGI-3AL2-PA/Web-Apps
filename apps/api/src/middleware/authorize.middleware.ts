import type { RequestHandler } from "express";
import type { AppRoute } from "@ts-rest/core";
import { getAuthPolicy, type AuthScope, type ResourceKind } from "@repo/contracts";

import { resolve } from "../repositories/container.js";
import type { IUserRepository } from "../repositories/User/user.repository.js";
import type { IListingRepository } from "../repositories/Listing/listing.repository.js";
import type { IEventRepository } from "../repositories/Event/event.repository.js";
import type { IVoteRepository } from "../repositories/Vote/vote.repository.js";
import type { IIncidentRepository } from "../repositories/Incident/incident.repository.js";
import type { IContractRepository } from "../repositories/Contract/contract.repository.js";
import type { IConversationRepository } from "../repositories/Conversation/conversation.repository.js";
import type { INotificationRepository } from "../repositories/Notification/notification.repository.js";
import type { IDistrictRepository } from "../repositories/District/district.repository.js";
import type { ITagRepository } from "../repositories/Tag/tag.repository.js";

// Middleware — autorisation globale pilotée par les métadonnées du contrat. Applique la
// politique `metadata.auth` de chaque route : audience, rôles, self-param, propriété et quartier.
// Expose aussi les prédicats purs (ownsRecord / inDistrict / hasRecordCheck), testables isolément.

// Un enregistrement chargé, accédé génériquement par nom de champ.
type Record_ = globalThis.Record<string, unknown>;
type RecordLoader = (id: string) => Promise<Record_ | null>;

// Le SEUL endroit où vit la spécificité par ressource : comment charger un enregistrement par id.
// `resolve()` est affecté à une const typée par interface car en position d'expression nue le
// générique du container inférerait sinon `never` (même contournement que dans les routeurs).
const loaders: Partial<Record<ResourceKind, RecordLoader>> = {
  user: async (id) => {
    const repo: IUserRepository = resolve("user");
    return (await repo.getUserById(id)) as Record_ | null;
  },
  listing: async (id) => {
    const repo: IListingRepository = resolve("listing");
    return (await repo.getListingById(id)) as Record_ | null;
  },
  event: async (id) => {
    const repo: IEventRepository = resolve("event");
    return (await repo.getEventById(id)) as Record_ | null;
  },
  vote: async (id) => {
    const repo: IVoteRepository = resolve("vote");
    return (await repo.getVoteById(id)) as Record_ | null;
  },
  incident: async (id) => {
    const repo: IIncidentRepository = resolve("incident");
    return (await repo.getIncidentById(id)) as Record_ | null;
  },
  contract: async (id) => {
    const repo: IContractRepository = resolve("contract");
    return (await repo.getContractById(id)) as Record_ | null;
  },
  conversation: async (id) => {
    const repo: IConversationRepository = resolve("conversation");
    return (await repo.getConversationById(id)) as Record_ | null;
  },
  message: async (id) => {
    const repo: IConversationRepository = resolve("conversation");
    return (await repo.getMessageById(id)) as Record_ | null;
  },
  notification: async (id) => {
    const repo: INotificationRepository = resolve("notification");
    return (await repo.getNotificationById(id)) as Record_ | null;
  },
  district: async (id) => {
    const repo: IDistrictRepository = resolve("district");
    return (await repo.getDistrictById(id)) as Record_ | null;
  },
  tag: async (id) => {
    const repo: ITagRepository = resolve("tag");
    return (await repo.getTagById(id)) as Record_ | null;
  },
  // Composite : un message plus les participants de sa conversation parente, pour que les
  // routes au niveau message puissent autoriser en fonction de l'appartenance à la conversation.
  messageParticipants: async (id) => {
    const repo: IConversationRepository = resolve("conversation");
    const message = await repo.getMessageById(id);
    if (!message) return null;
    const conversation = await repo.getConversationById(message.conversationId);
    if (!conversation) return null;
    return { ...message, participants: conversation.participants } as Record_;
  },
};

/** Vrai si `sub` possède l'enregistrement : champ propriétaire unique, liste OR de champs, ou appartenance à un champ tableau. */
export const ownsRecord = (rec: Record_, scope: AuthScope, sub: string): boolean => {
  if (scope.ownerField && rec[scope.ownerField] === sub) return true;
  if (scope.ownerFields?.some((f) => rec[f] === sub)) return true;
  if (scope.ownerArrayField && Array.isArray(rec[scope.ownerArrayField])) {
    return (rec[scope.ownerArrayField] as unknown[]).includes(sub);
  }
  return false;
};

/** Vrai si le quartier administré par l'appelant correspond au(x) quartier(s) de l'enregistrement (accès modération). */
export const inDistrict = (rec: Record_, scope: AuthScope, adminDistrictId: string | null): boolean => {
  // Dégradation sûre : tant que le claim adminDistrictId n'est pas émis, le quartier ne matche jamais.
  if (!adminDistrictId) return false;
  if (scope.districtField) return rec[scope.districtField] === adminDistrictId;
  if (scope.districtArrayField && Array.isArray(rec[scope.districtArrayField])) {
    return (rec[scope.districtArrayField] as unknown[]).includes(adminDistrictId);
  }
  return false;
};

/** Vrai si le scope exige de charger l'enregistrement (un champ propriétaire ou quartier est déclaré). */
export const hasRecordCheck = (scope: AuthScope): boolean =>
  Boolean(
    scope.ownerField || scope.ownerFields || scope.ownerArrayField || scope.districtField || scope.districtArrayField,
  );

/**
 * Porte d'autorisation unique, pilotée par les métadonnées du contrat. Enregistrée comme
 * `globalMiddleware` sur chaque jeu d'endpoints ts-rest ; lit `req.tsRestRoute` (posé par
 * @ts-rest/express avant son exécution) et applique la politique `metadata.auth` de la route.
 * `requireAuth` s'exécute avant (global) et a déjà vérifié le token + renseigné `req.user`.
 */
export const authorize: RequestHandler = async (req, res, next) => {
  const route = (req as { tsRestRoute?: AppRoute }).tsRestRoute;
  const policy = route ? getAuthPolicy(route) : undefined;

  if (policy?.public) return next();

  const user = req.user;
  if (!user) {
    res.status(401).json({ message: "Unauthenticated" });
    return;
  }

  // 1. audience
  if (policy?.audience && user.aud !== policy.audience) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  // 2. rôle (ignoré pour un GET quand readBypassesRoles est activé)
  const isRead = req.method === "GET";
  if (policy?.roles && !(isRead && policy.readBypassesRoles)) {
    if (!policy.roles.includes(user.role as never)) {
      res.status(403).json({ message: "Insufficient permissions" });
      return;
    }
  }

  const scope = policy?.scope;
  if (!scope) return next();

  // 3. famille self-param (/users/:id ...) : le param id doit être égal au sujet du token.
  if (scope.selfParam) {
    const targetId = req.params[scope.selfParam];
    const bypass = scope.bypassRoles?.includes(user.role as never) ?? false;
    if (!bypass && targetId !== user.sub) {
      res.status(scope.notFoundOnDeny ? 404 : 403).json({ message: scope.notFoundOnDeny ? "Not found" : "Forbidden" });
      return;
    }
    return next();
  }

  // 4. propriété / quartier au niveau de l'enregistrement
  if (hasRecordCheck(scope)) {
    const id = req.params[scope.idParam ?? "id"];
    if (!id) return next(); // route de collection/création — rien à charger

    const loader = loaders[scope.resource];
    if (!loader) {
      res.status(500).json({ message: "Authorization misconfigured" });
      return;
    }

    const rec = await loader(id);
    if (!rec) {
      res.status(404).json({ message: "Not found" }); // le 404 précède toujours le 403
      return;
    }

    const bypass = scope.bypassRoles?.includes(user.role as never) ?? false;
    const isOwner = ownsRecord(rec, scope, user.sub);
    // Un accès accordé uniquement par le quartier de l'appelant (ni propriété ni bypass) :
    // c'est un administrateur de quartier agissant comme modérateur sur un enregistrement qu'il ne possède pas.
    const districtGrant = !bypass && !isOwner && inDistrict(rec, scope, user.adminDistrictId ?? null);
    const allowed = bypass || isOwner || districtGrant;
    if (!allowed) {
      res.status(scope.notFoundOnDeny ? 404 : 403).json({ message: scope.notFoundOnDeny ? "Not found" : "Forbidden" });
      return;
    }

    // Audite les lectures, par un admin non-participant, de conversations privées. Les écritures de
    // conversation ne portent pas districtField, donc un accès par quartier sur une ressource
    // conversation ne peut être qu'une lecture de modération d'un DM où l'admin n'est pas participant.
    if (districtGrant && isRead && scope.resource === "conversation") {
      req.log.info(
        {
          audit: "moderation.conversation.read",
          actorSub: user.sub,
          actorRole: user.role,
          conversationId: id,
        },
        "Non-participant admin read of a private conversation",
      );
    }

    // Transmet l'enregistrement déjà chargé au handler pour éviter un second fetch.
    req.authRecord = rec;
  }

  next();
};

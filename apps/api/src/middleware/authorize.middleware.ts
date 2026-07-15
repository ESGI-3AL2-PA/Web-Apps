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

// A loaded record, accessed generically by field name.
type Record_ = globalThis.Record<string, unknown>;
type RecordLoader = (id: string) => Promise<Record_ | null>;

// The ONLY place per-resource specifics live: how to fetch a record by id.
// `resolve()` is assigned into an interface-typed const because in bare expression
// position the container's generic otherwise infers `never` (same workaround as the routers).
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
  // Composite: a message plus its parent conversation's participants, so
  // message-level routes can authorize against conversation membership.
  messageParticipants: async (id) => {
    const repo: IConversationRepository = resolve("conversation");
    const message = await repo.getMessageById(id);
    if (!message) return null;
    const conversation = await repo.getConversationById(message.conversationId);
    if (!conversation) return null;
    return { ...message, participants: conversation.participants } as Record_;
  },
};

export const ownsRecord = (rec: Record_, scope: AuthScope, sub: string): boolean => {
  if (scope.ownerField && rec[scope.ownerField] === sub) return true;
  if (scope.ownerFields?.some((f) => rec[f] === sub)) return true;
  if (scope.ownerArrayField && Array.isArray(rec[scope.ownerArrayField])) {
    return (rec[scope.ownerArrayField] as unknown[]).includes(sub);
  }
  return false;
};

export const inDistrict = (rec: Record_, scope: AuthScope, adminDistrictId: string | null): boolean => {
  // Degrades safely: until the adminDistrictId claim is minted, district never matches.
  if (!adminDistrictId) return false;
  if (scope.districtField) return rec[scope.districtField] === adminDistrictId;
  if (scope.districtArrayField && Array.isArray(rec[scope.districtArrayField])) {
    return (rec[scope.districtArrayField] as unknown[]).includes(adminDistrictId);
  }
  return false;
};

export const hasRecordCheck = (scope: AuthScope): boolean =>
  Boolean(
    scope.ownerField || scope.ownerFields || scope.ownerArrayField || scope.districtField || scope.districtArrayField,
  );

/**
 * Single, contract-metadata-driven authorization gate. Registered as
 * `globalMiddleware` on every ts-rest endpoint set; reads `req.tsRestRoute`
 * (set by @ts-rest/express before this runs) and enforces the route's
 * `metadata.auth` policy. `requireAuth` runs earlier (global) and has already
 * verified the token + set `req.user`.
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

  // 2. role (skipped for GET when readBypassesRoles is set)
  const isRead = req.method === "GET";
  if (policy?.roles && !(isRead && policy.readBypassesRoles)) {
    if (!policy.roles.includes(user.role as never)) {
      res.status(403).json({ message: "Insufficient permissions" });
      return;
    }
  }

  const scope = policy?.scope;
  if (!scope) return next();

  // 3. self-param family (/users/:id ...): the id param must equal the subject.
  if (scope.selfParam) {
    const targetId = req.params[scope.selfParam];
    const bypass = scope.bypassRoles?.includes(user.role as never) ?? false;
    if (!bypass && targetId !== user.sub) {
      res.status(scope.notFoundOnDeny ? 404 : 403).json({ message: scope.notFoundOnDeny ? "Not found" : "Forbidden" });
      return;
    }
    return next();
  }

  // 4. record-level ownership / district
  if (hasRecordCheck(scope)) {
    const id = req.params[scope.idParam ?? "id"];
    if (!id) return next(); // collection/create route — nothing to load

    const loader = loaders[scope.resource];
    if (!loader) {
      res.status(500).json({ message: "Authorization misconfigured" });
      return;
    }

    const rec = await loader(id);
    if (!rec) {
      res.status(404).json({ message: "Not found" }); // 404 always precedes 403
      return;
    }

    const bypass = scope.bypassRoles?.includes(user.role as never) ?? false;
    const isOwner = ownsRecord(rec, scope, user.sub);
    // A grant that came solely from the caller's district (not ownership / bypass):
    // this is a district admin acting as a moderator on a record they don't own.
    const districtGrant = !bypass && !isOwner && inDistrict(rec, scope, user.adminDistrictId ?? null);
    const allowed = bypass || isOwner || districtGrant;
    if (!allowed) {
      res.status(scope.notFoundOnDeny ? 404 : 403).json({ message: scope.notFoundOnDeny ? "Not found" : "Forbidden" });
      return;
    }

    // security-M2: audit non-participant admin reads of private conversations. After the
    // read-only fix, conversation writes no longer carry districtField, so a district grant
    // on a conversation resource can only be a moderation read of a DM the admin isn't in.
    if (districtGrant && isRead && scope.resource === "conversation") {
      console.warn(
        JSON.stringify({
          event: "moderation.conversation.read",
          actorSub: user.sub,
          actorRole: user.role,
          conversationId: id,
        }),
      );
    }

    // Hand the already-loaded record to the handler to avoid a second fetch.
    req.authRecord = rec;
  }

  next();
};

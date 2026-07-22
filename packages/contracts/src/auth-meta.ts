import type { AppRoute } from "@ts-rest/core";

/**
 * Per-endpoint authorization policy, declared in the contract's `metadata.auth`
 * and enforced by a single generic middleware in the api. This is the single
 * source of truth for who may call each endpoint.
 *
 * Static parts (public / audience / roles) are checked directly. Record-level
 * parts (`scope`) make the middleware load the target record via the DI
 * container and check ownership / district before the handler runs.
 */

export type Audience = "api" | "api:internal";

export type Role = "user" | "admin" | "superAdmin" | "service";

/** Names the enforcement middleware uses to resolve a repository and read fields. */
export type ResourceKind =
  | "user"
  | "listing"
  | "event"
  | "vote"
  | "incident"
  | "contract"
  | "conversation"
  | "message"
  | "messageParticipants"
  | "notification"
  | "district"
  | "tag";

/** Record-level (data-dependent) policy. Absent => no record is loaded. */
export interface AuthScope {
  /** Which container repo to load the record from. */
  resource: ResourceKind;
  /** Path param holding the record id (default "id"). */
  idParam?: string;
  /** Record field whose value must equal `req.user.sub` for the owner (e.g. "authorId"). */
  ownerField?: string;
  /** OR-list of owner fields (e.g. ["providerId", "beneficiaryId"]). */
  ownerFields?: string[];
  /** Record field that is an array of user ids (e.g. conversation "participants"). */
  ownerArrayField?: string;
  /** Record field holding the district id (matched against the caller's adminDistrictId). */
  districtField?: string;
  /** Array form of the district field (e.g. votes "districtIds"). */
  districtArrayField?: string;
  /** Roles that skip the ownership / district check entirely. */
  bypassRoles?: Role[];
  /** Respond 404 (hide existence) instead of 403 when access is denied. */
  notFoundOnDeny?: boolean;
  /**
   * The id path param itself is a user id and must equal `req.user.sub`
   * (or a bypass role). No record is loaded. Used for the /users/:id family.
   */
  selfParam?: string;
}

/**
 * Step-up (fresh-TOTP) requirement for a sensitive operation. Enforced by the api's
 * `requireStepUp` middleware, but only in production — dev stays friction-free.
 * The caller proves possession by sending an `X-Step-Up-Token` (minted at /auth/step-up).
 */
export interface StepUpPolicy {
  /** The operation always requires step-up (e.g. delete account, token transfer). */
  always?: boolean;
  /** Require step-up only when the request body sets any of these fields (e.g. email/address on a PATCH). */
  whenBodyTouches?: string[];
}

export interface AuthPolicy {
  /** No authentication at all. */
  public?: boolean;
  /** Allowed roles. Omitted => any authenticated role (subject to `audience`). */
  roles?: Role[];
  /** Required `aud` claim on the token. */
  audience?: Audience;
  /** GET is allowed for any end-user even when `roles` is set. */
  readBypassesRoles?: boolean;
  /** Record-level ownership / district enforcement. */
  scope?: AuthScope;
  /** Fresh-TOTP step-up requirement (production only). */
  stepUp?: StepUpPolicy;
}

/**
 * Author-side helper. ts-rest types `metadata` as `unknown`, so this brands the
 * value while giving full type-checking on the policy object at the call site.
 */
export const auth = (policy: AuthPolicy): { auth: AuthPolicy } => ({ auth: policy });

/** Consumer-side runtime guard used by the enforcement middleware. */
export const getAuthPolicy = (route: AppRoute): AuthPolicy | undefined => {
  const meta = (route as { metadata?: unknown }).metadata;
  if (meta && typeof meta === "object" && "auth" in meta) {
    return (meta as { auth: AuthPolicy }).auth;
  }
  return undefined;
};

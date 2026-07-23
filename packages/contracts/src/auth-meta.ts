// Contracts : métadonnées d'autorisation par endpoint. Ce fichier définit la forme
// de la politique d'auth attachée à chaque route (`metadata.auth`), un helper
// `auth()` côté auteur du contrat et un lecteur `getAuthPolicy()` côté middleware.
import type { AppRoute } from "@ts-rest/core";

/**
 * Politique d'autorisation par endpoint, déclarée dans le `metadata.auth` du
 * contrat et appliquée par un unique middleware générique dans l'api. C'est la
 * source de vérité unique de qui peut appeler chaque endpoint.
 *
 * Les parties statiques (public / audience / rôles) sont vérifiées directement.
 * La partie au niveau enregistrement (`scope`) fait charger l'enregistrement cible
 * par le middleware via le conteneur d'injection, puis vérifier la propriété / le
 * quartier avant l'exécution du handler.
 */

/** Audience (claim `aud`) attendue sur le token : api publique ou usage interne. */
export type Audience = "api" | "api:internal";

/** Rôles reconnus, dont `service` (token interne éphémère émis par l'auth-service). */
export type Role = "user" | "admin" | "superAdmin" | "service";

/** Noms que le middleware d'enforcement utilise pour résoudre un repository et lire ses champs. */
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

/** Politique au niveau enregistrement (dépendante des données). Absente => aucun enregistrement n'est chargé. */
export interface AuthScope {
  /** Repository du conteneur d'où charger l'enregistrement. */
  resource: ResourceKind;
  /** Param de chemin portant l'id de l'enregistrement (défaut "id"). */
  idParam?: string;
  /** Champ de l'enregistrement dont la valeur doit égaler `req.user.sub` pour le propriétaire (ex. "authorId"). */
  ownerField?: string;
  /** Liste de champs de propriété en OU (ex. ["providerId", "beneficiaryId"]). */
  ownerFields?: string[];
  /** Champ de l'enregistrement qui est un tableau d'ids utilisateur (ex. "participants" d'une conversation). */
  ownerArrayField?: string;
  /** Champ portant l'id de quartier (comparé à l'adminDistrictId de l'appelant). */
  districtField?: string;
  /** Forme tableau du champ quartier (ex. "districtIds" d'un vote). */
  districtArrayField?: string;
  /** Rôles qui court-circuitent entièrement le contrôle de propriété / quartier. */
  bypassRoles?: Role[];
  /** Répondre 404 (masquer l'existence) au lieu de 403 quand l'accès est refusé. */
  notFoundOnDeny?: boolean;
  /**
   * Le param d'id du chemin est lui-même un id utilisateur et doit égaler
   * `req.user.sub` (ou un rôle de bypass). Aucun enregistrement n'est chargé.
   * Utilisé par la famille de routes /users/:id.
   */
  selfParam?: string;
}

/**
 * Exigence de step-up (TOTP récent) pour une opération sensible. Appliquée par le
 * middleware `requireStepUp` de l'api, mais uniquement en production — le dev reste
 * sans friction. L'appelant prouve la possession en envoyant un `X-Step-Up-Token`
 * (émis par /auth/step-up).
 */
export interface StepUpPolicy {
  /** L'opération exige toujours un step-up (ex. suppression de compte, transfert de points). */
  always?: boolean;
  /** Exiger le step-up seulement si le corps de requête touche l'un de ces champs (ex. email/adresse sur un PATCH). */
  whenBodyTouches?: string[];
}

/** Politique d'auth complète attachée à une route via `metadata.auth`. */
export interface AuthPolicy {
  /** Aucune authentification. */
  public?: boolean;
  /** Rôles autorisés. Omis => tout rôle authentifié (selon `audience`). */
  roles?: Role[];
  /** Claim `aud` requis sur le token. */
  audience?: Audience;
  /** GET autorisé pour tout utilisateur final même quand `roles` est défini. */
  readBypassesRoles?: boolean;
  /** Enforcement propriété / quartier au niveau enregistrement. */
  scope?: AuthScope;
  /** Exigence de step-up TOTP récent (production seulement). */
  stepUp?: StepUpPolicy;
}

/**
 * Helper côté auteur du contrat. ts-rest type `metadata` comme `unknown` ; ceci
 * marque la valeur tout en offrant un typage complet de l'objet de politique au
 * point d'appel.
 */
export const auth = (policy: AuthPolicy): { auth: AuthPolicy } => ({ auth: policy });

/** Garde runtime côté consommateur, utilisée par le middleware d'enforcement pour extraire la politique d'une route. */
export const getAuthPolicy = (route: AppRoute): AuthPolicy | undefined => {
  const meta = (route as { metadata?: unknown }).metadata;
  if (meta && typeof meta === "object" && "auth" in meta) {
    return (meta as { auth: AuthPolicy }).auth;
  }
  return undefined;
};

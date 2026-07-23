/**
 * Baril d'exports des DTO (schémas zod + types inférés) partagés par les contrats ts-rest.
 *
 * Réexporte chaque module DTO du dossier afin que les contrats et les fronts importent
 * l'ensemble des schémas/DTO depuis un point d'entrée unique (`@repo/contracts` → DTO).
 */
export * from "./query.dto";
export * from "./geoJson.dto";
export * from "./user.dto";
export * from "./user-export.dto";
export * from "./auth.dto";
export * from "./errors.dto";
export * from "./district.dto";
export * from "./district-admin.dto";
export * from "./contract.dto";
export * from "./listing.dto";
export * from "./event.dto";
export * from "./incident.dto";
export * from "./tag.dto";
export * from "./vote.dto";
export * from "./conversation.dto";
export * from "./notification.dto";
export * from "./transaction.dto";
export * from "./recommendation.dto";
export * from "./paginatedResponse.dto";
export * from "./desktop-sso.dto";
export * from "./sync.dto";
export * from "./conflict.dto";

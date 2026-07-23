// Point d'entrée du package @repo/contracts : source unique des contrats ts-rest et
// des DTO zod partagés entre l'api, l'auth-service et les frontends. L'ordre importe :
// l'extension zod (`.openapi()`) doit être installée avant que tout schéma l'appelle.
import "./src/zod"; // doit s'exécuter avant tout appel à .openapi()
export * from "./src/auth-meta";
export * from "./src/DTO/index";
export * from "./src/users.contract";
export * from "./src/districts.contract";
export * from "./src/district-admins.contract";
export * from "./src/listings.contract";
export * from "./src/events.contract";
export * from "./src/contracts.contract";
export * from "./src/incidents.contract";
export * from "./src/tags.contract";
export * from "./src/votes.contract";
export * from "./src/conversations.contract";
export * from "./src/notifications.contract";
export * from "./src/transactions.contract";
export * from "./src/recommendations.contract";
export * from "./src/auth.contract";
export * from "./src/sync.contract";
export * from "./src/conflicts.contract";

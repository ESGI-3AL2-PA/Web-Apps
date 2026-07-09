// Barrel export — admin-front only exposes services for collections that
// the admin app actually needs (per consigne.md). Anything user-only
// (contracts, conversations, vote_responses, …) is NOT re-exported here.
export { default as api } from "./api";

export * as usersService from "./users.service";
export * as districtsService from "./districts.service";
export * as districtAdminsService from "./district-admins.service";
export * as incidentsService from "./incidents.service";
export * as listingsService from "./listings.service";
export * as eventsService from "./events.service";
export * as votesService from "./votes.service";
export * as transactionsService from "./transactions.service";
export * as notificationsService from "./notifications.service";

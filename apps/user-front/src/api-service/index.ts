// Barrel export — convenience re-export of every domain service so consumers
// can import any function with a single path:
//   import { getUsers, getEvents } from "@/api-service";
export { default as api } from "./api";

export * as usersService from "./users.service";
export * as districtsService from "./districts.service";
export * as listingsService from "./listings.service";
export * as contractsService from "./contracts.service";
export * as eventsService from "./events.service";
export * as incidentsService from "./incidents.service";
export * as tagsService from "./tags.service";
export * as votesService from "./votes.service";
export * as conversationsService from "./conversations.service";
export * as notificationsService from "./notifications.service";
export * as transactionsService from "./transactions.service";

/**
 * Names of the Mongo collections physically shared by both backends. Redeclaring
 * the literal `"users"` / `"district_admins"` in each repo is how the two apps'
 * views of the same document drifted; these constants are the single source.
 */
export const USERS_COLLECTION = "users";
export const DISTRICT_ADMINS_COLLECTION = "district_admins";

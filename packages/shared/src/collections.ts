/**
 * Noms des collections Mongo physiquement partagées par les deux backends (api et
 * auth-service). Redéclarer les littéraux `"users"` / `"district_admins"` dans chaque
 * app est précisément ce qui avait fait diverger leurs vues d'un même document ; ces
 * constantes en sont désormais la source unique.
 */
export const USERS_COLLECTION = "users";
export const DISTRICT_ADMINS_COLLECTION = "district_admins";

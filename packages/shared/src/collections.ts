/**
 * Noms des collections Mongo physiquement partagées par les deux backends (api et
 * auth-service). Ces constantes sont la source unique des littéraux `"users"` /
 * `"district_admins"`, pour que les deux apps référencent les mêmes noms de collection.
 */
export const USERS_COLLECTION = "users";
export const DISTRICT_ADMINS_COLLECTION = "district_admins";

// Entity — schéma du document utilisateur.
//
// Le schéma vit une seule fois dans @repo/shared : la collection `users` est lue à la fois
// par l'api et par l'auth-service, donc sa forme y est centralisée pour que les deux services
// partagent une définition unique. Réexporté ici sous les noms locaux de l'api pour que les
// imports existants (`User`, `UserSchema`, `UserRole`) restent stables.
export {
  userDocumentSchema as UserSchema,
  UserRoleSchema,
  type UserDocument as User,
  type UserRole,
} from "@repo/shared";

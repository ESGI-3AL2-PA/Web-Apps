// The user document schema is the single source of truth in @repo/shared — the
// shared `users` collection is read by both api and auth-service, so its shape lives
// once (previously each app hand-declared it and they drifted). Re-exported under the
// api's local names so existing imports (`User`, `UserSchema`, `UserRole`) stay stable.
export {
  userDocumentSchema as UserSchema,
  UserRoleSchema,
  type UserDocument as User,
  type UserRole,
} from "@repo/shared";

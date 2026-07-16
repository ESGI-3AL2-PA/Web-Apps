// Join entity between User and District — records that a user has admin privileges on
// a specific district. Stored in the shared `district_admins` collection (unique
// compound index on `(districtId, userId)`), read by both backends, so its schema is
// the single source of truth in @repo/server-kit. Re-exported under the api's local
// names so existing imports (`DistrictAdmin`, `DistrictAdminSchema`) stay stable.
export {
  districtAdminDocumentSchema as DistrictAdminSchema,
  type DistrictAdminDocument as DistrictAdmin,
} from "@repo/server-kit";

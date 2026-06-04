// Read-only view of the `district_admins` relationship. The api owns writes
// (admin promotion); the auth-service only reads it to mint the adminDistrictId
// claim at login/refresh. One district per admin (unique on userId).
export interface IDistrictAdminReaderRepository {
  /** The district this user administers, or null if they are not an admin of any. */
  findDistrictIdByUserId(userId: string): Promise<string | null>;
}

// Vue en lecture seule de la relation `district_admins`. L'api possède les écritures
// (promotion d'administrateur de quartier) ; l'auth-service ne fait que la lire pour forger
// le claim adminDistrictId au login / refresh. Un seul quartier par administrateur (unicité
// sur userId).
export interface IDistrictAdminReaderRepository {
  /** Le quartier administré par cet utilisateur, ou null s'il n'administre aucun quartier. */
  findDistrictIdByUserId(userId: string): Promise<string | null>;
}

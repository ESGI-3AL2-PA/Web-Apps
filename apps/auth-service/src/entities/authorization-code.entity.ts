/**
 * Entité : code d'autorisation à usage unique du login PKCE de l'app desktop.
 *
 * Stocké en hash sha256, comme les refresh tokens, pour qu'une lecture de la base
 * (backup, log, réplica compromis) ne puisse pas être rejouée contre l'endpoint token.
 * Lié au client, au redirect_uri exact et au challenge PKCE pour lequel il a été émis ;
 * ces trois éléments sont revérifiés au moment de l'échange.
 */
export interface AuthorizationCode {
  id: string;
  codeHash: string;
  clientId: string;
  userId: string;
  /** Comparé octet à octet à la requête d'échange — stocké brut, jamais re-parsé. */
  redirectUri: string;
  /**
   * Challenge PKCE S256. Non-nullable à dessein : une colonne nullable permettrait à un
   * appelant d'omettre le challenge et de rétrograder silencieusement vers un flux sans
   * aucune authentification client — or pour un client public c'est la seule chose qui
   * lie le code à l'app qui l'a demandé.
   */
  codeChallenge: string;
  expiresAt: string;
  /** Date BSON qui pilote l'index TTL ; le `expiresAt` ISO est ignoré par le moniteur TTL. */
  expiresAtDate: Date;
  usedAt: string | null;
  createdAt: string;
}

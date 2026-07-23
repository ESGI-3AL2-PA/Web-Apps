/**
 * Service API « compte » côté front utilisateur.
 *
 * Regroupe les appels liés au compte de l'utilisateur connecté : réinitialisation
 * de mot de passe, export RGPD de ses données et suppression de son compte.
 */
import { config } from "@repo/config";
import type { UserDataExportResponseDto } from "@repo/contracts";
import api from "./api";

/**
 * Déclenche l'envoi d'un e-mail de réinitialisation de mot de passe.
 *
 * Réutilise le flux « mot de passe oublié » existant (non authentifié) pour
 * permettre à un utilisateur connecté de réinitialiser son mot de passe par
 * e-mail — il n'existe pas d'endpoint dédié de changement de mot de passe.
 * Appel direct via `fetch` (hors client `api`) car l'endpoint vit sur
 * l'auth-service et ne nécessite pas de token.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await fetch(`${config.authServiceUrl}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export type AccountExport = UserDataExportResponseDto;

/**
 * Récupère l'export RGPD complet des données personnelles de l'utilisateur.
 *
 * Droit d'accès/portabilité RGPD (art. 15/20) : l'export canonique est produit
 * par l'api. Un unique appel authentifié, cadré sur soi-même, renvoie TOUTES les
 * catégories de données personnelles — données perso de l'utilisateur, annonces,
 * contrats, transactions, événements, votes, signalements, conversations +
 * messages, notifications, historique des sessions (refresh tokens) et les
 * arêtes du graphe Neo4j — y compris des données que le client ne peut pas lire
 * autrement (messages de chaque fil, historique IP/UA des sessions, relations du
 * graphe).
 */
export async function exportMyData(userId: string): Promise<AccountExport> {
  const { data } = await api.get<AccountExport>(`/users/${userId}/export`);
  return data;
}

/**
 * Supprime le compte de l'appelant (droit à l'effacement RGPD, self-service,
 * cadré côté backend sur l'utilisateur authentifié).
 */
export async function deleteAccount(userId: string): Promise<void> {
  await api.delete(`/users/${userId}`);
}

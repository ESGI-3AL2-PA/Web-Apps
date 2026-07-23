// Service TOTP (couche services) : fine surcouche autour d'otplib qui vérifie un
// code et renvoie son pas de temps absolu, brique de l'anti-rejeu du MFA.
import { authenticator } from "otplib";

// Pas de temps par défaut de l'authenticator otplib (en secondes).
// `authenticator.options.step` n'est renseigné que s'il a été personnalisé
// explicitement ; on retombe donc sur la valeur par défaut de la lib (30).
const TOTP_STEP_SECONDS = authenticator.options.step ?? 30;

/**
 * Vérifie un code TOTP et renvoie le pas de temps absolu auquel il correspond
 * (le compteur TOTP), ou null si le code est invalide. Ce pas permet aux appelants
 * de rejeter le rejeu d'un code déjà consommé dans sa fenêtre de validité :
 * `checkDelta` renvoie de combien de pas le code correspondant est décalé par
 * rapport à « maintenant » (0 pour la fenêtre courante, ±1 si une fenêtre de
 * tolérance est configurée).
 */
export const verifyTotpStep = (code: string, secret: string): number | null => {
  const delta = authenticator.checkDelta(code, secret);
  if (delta === null) return null;
  return Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS) + delta;
};

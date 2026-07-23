// Config partagée (couche « logging »). Expose un logger structuré unique,
// réutilisé par les deux backends.
import pino, { type Logger } from "pino";

/**
 * Logger structuré applicatif. Émet du JSON sur stdout pour que les logs puissent
 * être expédiés vers un agrégateur ; le niveau vient de LOG_LEVEL (défaut "info").
 * pino-http (branché dans l'index.ts de chaque app) attache un logger enfant
 * par requête sous `req.log`, porteur d'un identifiant de corrélation : le code
 * du chemin requête devrait donc préférer `req.log` quand une requête est
 * disponible.
 */
export const createLogger = (): Logger => pino({ level: process.env.LOG_LEVEL ?? "info" });

export const logger = createLogger();

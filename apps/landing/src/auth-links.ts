// URLs de connexion / inscription pointant vers les pages HTML de l'auth-service.
import { config } from "@repo/config";

// L'auth-service sert les pages HTML /login et /register et honore un
// ?redirect_uri qu'il valide contre sa liste blanche. On renvoie les visiteurs
// fraîchement authentifiés directement dans le produit (user-front), déjà une
// origine autorisée — aucune modif de config de l'auth-service nécessaire.
const redirect = encodeURIComponent(config.appUrl);

export const loginUrl = `${config.authServiceUrl}/login?redirect_uri=${redirect}`;
export const registerUrl = `${config.authServiceUrl}/register?redirect_uri=${redirect}`;

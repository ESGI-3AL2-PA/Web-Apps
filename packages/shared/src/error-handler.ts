// Middleware de gestion d'erreurs partagé (api + auth-service) + hiérarchie
// d'erreurs applicatives portant un code HTTP. Les erreurs connues sont
// renvoyées telles quelles au client ; toute autre est loguée et masquée en 500.
import { type Request, type Response, type NextFunction } from "express";
import "pino-http"; // augmente la Request Express avec `req.log`

/** Erreur applicative connue : porte un code HTTP à renvoyer directement au client. */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** Raccourci pour un 404 sur une ressource absente. */
export class NotFoundError extends AppError {
  constructor() {
    super(404, "Ressource not found");
  }
}

/**
 * Middleware d'erreurs Express terminal (signature à 4 args). Une AppError est
 * traduite en sa réponse HTTP dédiée ; toute erreur inattendue est loguée et
 * réduite à un 500 générique (pas de fuite de détails internes au client).
 */
export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  // Body-parser / http-errors signalent une entrée client malformée par un 4xx
  // portant `expose: true` (ex. un corps de requête non-JSON → 400
  // "entity.parse.failed", ou un corps trop volumineux → 413). `expose` est le
  // contrat de http-errors pour « ce statut + ce message sont sûrs à renvoyer au
  // client » ; on l'honore donc au lieu de masquer une erreur client en 500. Les
  // 5xx ne positionnent jamais expose : elles continuent de retomber sur le chemin
  // opaque Internal-server-error ci-dessous.
  const httpErr = err as { statusCode?: number; status?: number; expose?: boolean };
  const status = httpErr.statusCode ?? httpErr.status;
  if (httpErr.expose === true && typeof status === "number" && status >= 400 && status < 500) {
    return res.status(status).json({ message: err.message });
  }

  // req.log est le logger enfant par-requête de pino-http (porte l'id de corrélation).
  req.log.error({ err }, "Unhandled error");
  return res.status(500).json({ message: "Internal server error" });
};

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

  // req.log est le logger enfant par-requête de pino-http (porte l'id de corrélation).
  req.log.error({ err }, "Unhandled error");
  return res.status(500).json({ message: "Internal server error" });
};

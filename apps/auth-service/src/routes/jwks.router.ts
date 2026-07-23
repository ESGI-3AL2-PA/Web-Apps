// Router JWKS (couche route). Publie l'endpoint public
// GET /.well-known/jwks.json : le jeu de clés publiques RS256 que l'api utilise
// (via createRemoteJWKSet) pour vérifier les access tokens signés par l'auth-service.
import type { Request, Response } from "express";
import { getJWKS } from "../keys.js";

/** Renvoie le JWKS courant (clés publiques exposées sous forme JSON). */
export const jwksHandler = (_req: Request, res: Response) => {
  res.json(getJWKS());
};

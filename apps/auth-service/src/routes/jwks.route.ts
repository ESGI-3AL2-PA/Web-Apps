import type { Request, Response } from "express";
import { getJWKS } from "../keys.js";

export const jwksHandler = (_req: Request, res: Response) => {
  res.json(getJWKS());
};

import { type Request, type Response, type NextFunction } from "express";
import "pino-http"; // augments Express Request with `req.log`

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor() {
    super(404, "Ressource not found");
  }
}

export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  // Body-parser / http-errors report malformed client input as a 4xx carrying
  // `expose: true` (e.g. a non-JSON request body → 400 "entity.parse.failed",
  // or an oversized body → 413). `expose` is http-errors' contract for "this
  // status + message are safe to return to the client", so honor it instead of
  // masking a client mistake as a 500. 5xx errors never set expose, so they still
  // fall through to the opaque Internal-server-error path below.
  const httpErr = err as { statusCode?: number; status?: number; expose?: boolean };
  const status = httpErr.statusCode ?? httpErr.status;
  if (httpErr.expose === true && typeof status === "number" && status >= 400 && status < 500) {
    return res.status(status).json({ message: err.message });
  }

  // req.log is the pino-http per-request child logger (carries the correlation id).
  req.log.error({ err }, "Unhandled error");
  return res.status(500).json({ message: "Internal server error" });
};

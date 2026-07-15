import { type Request, type Response, type NextFunction } from "express";

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

  // req.log is the pino-http per-request child logger (carries the correlation id).
  req.log.error({ err }, "Unhandled error");
  return res.status(500).json({ message: "Internal server error" });
};

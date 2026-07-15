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

// Raised when a message's media bytes were stored but the mediaUrl could not be
// attached to the row. The use-case compensates (deletes bytes + row) before
// throwing this so no orphan is left behind.
export class ImageAttachError extends AppError {
  constructor() {
    super(500, "Failed to attach image to message");
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

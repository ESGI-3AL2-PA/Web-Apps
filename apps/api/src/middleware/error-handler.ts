import { type Request, type Response } from "express";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const errorHandler = (err: Error, _req: Request, res: Response) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  console.error("Unhandled error:", err);
  return res.status(500).json({ message: "Internal server error" });
};

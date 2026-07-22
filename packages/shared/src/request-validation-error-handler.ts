import { type Request, type Response, type NextFunction } from "express";
import { type ZodError } from "zod";

// ts-rest raises a RequestValidationError carrying up to four per-segment ZodErrors when an
// incoming request fails its contract schema. Typed structurally so this package needn't
// depend on @ts-rest/express — the real class is assignable to this shape.
interface RequestValidationErrorLike {
  pathParams: ZodError | null;
  headers: ZodError | null;
  query: ZodError | null;
  body: ZodError | null;
}

// Turn a ts-rest validation failure into one human-readable sentence. Custom refinements
// ("Password must contain a symbol") already read as full sentences; generic zod messages
// ("Required", "Invalid email") are prefixed with the offending field for context.
export function validationMessage(err: RequestValidationErrorLike): string {
  const zerr = err.body ?? err.query ?? err.pathParams ?? err.headers;
  const issue = zerr?.issues[0];
  if (!issue) return "Invalid request";
  const field = issue.path.join(".");
  return field && issue.code !== "custom" ? `${field}: ${issue.message}` : issue.message;
}

// ts-rest's default request-validation response echoes the raw ZodError
// (`{ name: "ZodError", issues: [{ code, path, message }] }`), which leaks the internal
// error shape to clients and has no top-level `message` for a plain fetch to surface — so a
// hand-rolled form falls back to a generic "failed" string. Replace it with a clean 400.
export const requestValidationErrorHandler = (
  err: RequestValidationErrorLike,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  res.status(400).json({ message: validationMessage(err) });
};

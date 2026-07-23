// Handler d'erreur de validation de requête ts-rest partagé : transforme un échec de
// validation de contrat (une ZodError par segment) en une réponse 400 propre { message },
// sans divulguer au client la forme interne de l'erreur Zod.
import { type Request, type Response, type NextFunction } from "express";
import { type ZodError } from "zod";

// ts-rest lève une RequestValidationError portant jusqu'à quatre ZodError (une par segment)
// lorsqu'une requête entrante échoue à son schéma de contrat. Typée structurellement pour que
// ce package n'ait pas à dépendre de @ts-rest/express — la vraie classe est assignable à cette forme.
interface RequestValidationErrorLike {
  pathParams: ZodError | null;
  headers: ZodError | null;
  query: ZodError | null;
  body: ZodError | null;
}

// Transforme un échec de validation ts-rest en une phrase lisible. Les refinements personnalisés
// (« Password must contain a symbol ») se lisent déjà comme des phrases complètes ; les messages
// zod génériques (« Required », « Invalid email ») sont préfixés du champ fautif pour le contexte.
export function validationMessage(err: RequestValidationErrorLike): string {
  const zerr = err.body ?? err.query ?? err.pathParams ?? err.headers;
  const issue = zerr?.issues[0];
  if (!issue) return "Invalid request";
  const field = issue.path.join(".");
  return field && issue.code !== "custom" ? `${field}: ${issue.message}` : issue.message;
}

// La réponse de validation par défaut de ts-rest renvoie la ZodError brute
// (`{ name: "ZodError", issues: [{ code, path, message }] }`), ce qui divulgue la forme interne
// de l'erreur au client et n'expose aucun `message` de premier niveau qu'un simple fetch pourrait
// afficher — un formulaire fait main retombe alors sur une chaîne « failed » générique. On la
// remplace par un 400 propre.
export const requestValidationErrorHandler = (
  err: RequestValidationErrorLike,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  res.status(400).json({ message: validationMessage(err) });
};

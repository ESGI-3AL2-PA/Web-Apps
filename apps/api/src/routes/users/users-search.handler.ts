import type { Request, Response, NextFunction } from "express";
import { resolve } from "../../repositories/container.js";
import { getUserByIdUseCase } from "../../use-cases/users/get-user-by-id.use-case.js";
import { getUsersUseCase } from "../../use-cases/users/get-users.use-case.js";

/**
 * Handler Express brut (hors ts-rest) : `GET /users/public/search?q=`.
 *
 * Recherche par nom, réservée aux users du même quartier. Renvoie uniquement
 * `{ id, firstName, lastName }` pour alimenter l'autocomplete côté user-front
 * (nouvelle conversation) sans exposer d'annuaire global ni de données sensibles.
 * Court-circuite avec un tableau vide si la requête fait moins de 2 caractères.
 */
export const userSearchHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length < 2) {
      res.json([]);
      return;
    }

    const userRepo = resolve("user");
    // Le token ne porte pas le districtId d'un user normal → on résout l'appelant pour scoper.
    const caller = await getUserByIdUseCase(userRepo)({ id: req.user.sub });
    if (!caller?.districtId) {
      res.json([]);
      return;
    }

    const { data } = await getUsersUseCase(userRepo)({
      search: q,
      districtId: caller.districtId,
      page: 1,
      limit: 10,
    });

    // On exclut l'appelant de ses propres résultats et on ne renvoie que les champs publics.
    res.json(
      data.filter((u) => u.id !== caller.id).map((u) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName })),
    );
  } catch (err) {
    next(err);
  }
};

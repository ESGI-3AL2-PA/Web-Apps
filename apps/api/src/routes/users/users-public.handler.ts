import type { Request, Response, NextFunction } from "express";
import { resolve } from "../../repositories/container.js";
import { getUserByIdUseCase } from "../../use-cases/users/get-user-by-id.use-case.js";

// GET /users/:id/public — renvoie uniquement les infos publiques (id, firstName, lastName)
// pour permettre à n'importe quel user authentifié d'afficher les noms des autres
// (sidebar messagerie, bulles d'expéditeur, etc.) sans exposer email/téléphone/solde.
export const userPublicHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ message: "Missing user id" });
      return;
    }
    const user = await getUserByIdUseCase(resolve("user"))({ id });
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  } catch (err) {
    next(err);
  }
};

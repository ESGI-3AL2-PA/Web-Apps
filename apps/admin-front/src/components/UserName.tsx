import { useEffect, useState } from "react";
import { getUserPublic } from "../api-service/users";

// Résout un id user en "Prénom Nom" via /users/:id/public (caché côté service).
// Remplace ShortId pour les champs qui référencent un utilisateur — on n'affiche
// jamais l'id brut : "…" pendant le chargement, "Utilisateur" si la résolution échoue.
export function UserName({ id }: { id?: string | null }) {
  const [name, setName] = useState<string>("…");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getUserPublic(id)
      .then((u) => !cancelled && setName(`${u.firstName} ${u.lastName}`))
      .catch(() => !cancelled && setName("Utilisateur"));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id) return <>—</>;
  return <>{name}</>;
}

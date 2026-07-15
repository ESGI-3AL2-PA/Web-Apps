import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getUserPublic } from "../api-service/users";

// Résout un id user en "Prénom Nom" via /users/:id/public (caché côté service).
// Remplace ShortId pour les champs qui référencent un utilisateur — on n'affiche
// jamais l'id brut : "…" pendant le chargement, "Utilisateur" si la résolution échoue.
export function UserName({ id }: { id?: string | null }) {
  const { t } = useTranslation();
  const [name, setName] = useState<string>("…");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getUserPublic(id)
      .then((u) => !cancelled && setName(`${u.firstName} ${u.lastName}`))
      .catch(() => !cancelled && setName(t("userName.fallbackName")));
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  if (!id) return <>—</>;
  return <>{name}</>;
}

// Composant : résout et affiche le nom d'un utilisateur à partir de son id.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getUserPublic } from "../api-service/users";

/**
 * Résout un id utilisateur en "Prénom Nom" via /users/:id/public (mis en cache côté service).
 * Remplace ShortId pour les champs qui référencent un utilisateur — l'id brut n'est jamais
 * montré : "…" pendant le chargement, libellé de repli traduit si la résolution échoue,
 * tiret cadratin si aucun id n'est fourni. Le drapeau `cancelled` évite un setState tardif.
 */
export function UserName({ id }: { id?: string | null }) {
  const { t } = useTranslation();
  const [name, setName] = useState<string>("…");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getUserPublic(id)
      .then((u) => !cancelled && setName(`${u.firstName} ${u.lastName}`))
      .catch(() => !cancelled && setName(t("common.userFallback")));
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  if (!id) return <>—</>;
  return <>{name}</>;
}

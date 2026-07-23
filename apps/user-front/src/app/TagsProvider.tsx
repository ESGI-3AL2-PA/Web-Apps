import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TagResponseDto } from "@repo/contracts";
import { getTags } from "../api-service/tags.service";
import { tagLabel } from "../lib/tag-label";
import { TagsContext, type TagsContextValue } from "./tags-context";

/**
 * Provider chargeant une seule fois les tags du quartier pour toute l'app authentifiée.
 * Les sites de rendu qui ne connaissent qu'un nom de tag (cartes/détail d'annonce)
 * peuvent ainsi résoudre un libellé d'affichage sans refetch.
 */
export function TagsProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [tags, setTags] = useState<TagResponseDto[]>([]);

  // Chargement unique au montage. Le drapeau `alive` évite un setState après démontage
  // (l'effet peut se dénouer avant la résolution de la promesse) ; en cas d'échec on
  // retombe sur une liste vide.
  useEffect(() => {
    let alive = true;
    getTags()
      .then((t) => alive && setTags(t))
      .catch(() => alive && setTags([]));
    return () => {
      alive = false;
    };
  }, []);

  // Valeur du contexte mémoïsée. `byName` indexe les tags par nom pour un lookup O(1)
  // dans `labelFor` ; on recalcule seulement quand les tags ou la langue changent.
  const value = useMemo<TagsContextValue>(() => {
    const byName = new Map(tags.map((t) => [t.name, t]));
    return {
      tags,
      label: (tag) => tagLabel(tag, i18n.language),
      labelFor: (name) => {
        const tag = byName.get(name);
        return tag ? tagLabel(tag, i18n.language) : name;
      },
    };
  }, [tags, i18n.language]);

  return <TagsContext.Provider value={value}>{children}</TagsContext.Provider>;
}

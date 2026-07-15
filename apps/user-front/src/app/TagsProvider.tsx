import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TagResponseDto } from "@repo/contracts";
import { getTags } from "../api-service/tags.service";
import { tagLabel } from "../lib/tag-label";
import { TagsContext, type TagsContextValue } from "./tags-context";

// Loads the district's tags once for the whole authed app so name-string render
// sites (listing cards/detail) can resolve a display label without refetching.
export function TagsProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [tags, setTags] = useState<TagResponseDto[]>([]);

  useEffect(() => {
    let alive = true;
    getTags()
      .then((t) => alive && setTags(t))
      .catch(() => alive && setTags([]));
    return () => {
      alive = false;
    };
  }, []);

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

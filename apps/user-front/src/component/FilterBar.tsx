import { useEffect, useState } from "react";
import type { TagResponseDto } from "@repo/contracts";
import { getTags } from "../api-service/tags.service";

type FilterBarProps = {
  selectedTag: string;
  onChange: (tag: string) => void;
};

// Affiche les tags récupérés depuis l'API.
// `selectedTag` est le `name` du tag actif ("" = aucun filtre).
// Le toggle reclique sur la même case → désélectionne.
const FilterBar = ({ selectedTag, onChange }: FilterBarProps) => {
  const [tags, setTags] = useState<TagResponseDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTags({ limit: 100 } as never)
      .then((res) => {
        if (!cancelled) setTags(res.data);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les tags");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (tagName: string) => {
    onChange(selectedTag === tagName ? "" : tagName);
  };

  return (
    <div className="flex flex-col gap-2 shadow-md rounded-lg p-4 bg-[#f8f7f2]">
      <h3 className="font-bold text-base-content text-sm uppercase tracking-wide">Catégorie</h3>

      {loading && <span className="text-xs text-base-content/70">Chargement…</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}

      {!loading && !error && (
        <div className="flex flex-col gap-2">
          {tags.map((tag) => (
            <label key={tag.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="checkbox checkbox-primary checkbox-sm"
                checked={selectedTag === tag.name}
                onChange={() => toggle(tag.name)}
              />
              <span className="text-base-content capitalize">{tag.name}</span>
            </label>
          ))}
          {tags.length === 0 && <span className="text-xs text-base-content/70">Aucun tag disponible</span>}
        </div>
      )}
    </div>
  );
};

export default FilterBar;

// Composant : barre d'outils au-dessus des tableaux (recherche + filtres + actions).
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

/** Descripteur d'un filtre déroulant (select) : clé, libellé, valeur courante, options et handler. */
export interface FilterSelect {
  key: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

interface ToolbarProps {
  search?: string;
  onSearchChange?: (value: string) => void; // absent ⇒ champ de recherche masqué
  searchPlaceholder?: string;
  filters?: FilterSelect[];
  /** Contrôles de filtre inline supplémentaires, rendus à côté des selects (ex. filtre texte debouncé). */
  extraFilters?: ReactNode;
  /** Emplacement de fin de barre, poussé à droite — ex. un bouton "Créer". */
  actions?: ReactNode;
}

/**
 * Barre d'outils de liste : champ de recherche optionnel, une série de filtres select,
 * des filtres additionnels libres, et un emplacement d'actions aligné à droite.
 * Chaque select ajoute une option "tous" en tête pour réinitialiser le filtre.
 */
export function Toolbar({ search, onSearchChange, searchPlaceholder, filters, extraFilters, actions }: ToolbarProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-end gap-3 mb-4">
      {onSearchChange && (
        <label className="input input-sm max-w-xs grow">
          <span className="icon-[tabler--search] size-4 text-base-content/60" />
          <input
            type="search"
            value={search ?? ""}
            placeholder={searchPlaceholder ?? t("common.actions.search")}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </label>
      )}
      {filters?.map((filter) => (
        <select
          key={filter.key}
          className="select select-sm max-w-[12rem]"
          value={filter.value}
          onChange={(e) => filter.onChange(e.target.value)}
        >
          <option value="">{t("common.table.filterAll", { label: filter.label })}</option>
          {filter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}
      {extraFilters}
      {actions && <div className="ms-auto">{actions}</div>}
    </div>
  );
}

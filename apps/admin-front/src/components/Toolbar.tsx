import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export interface FilterSelect {
  key: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

interface ToolbarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterSelect[];
  /** Extra inline filter controls rendered alongside the selects (e.g. a debounced text filter). */
  extraFilters?: ReactNode;
  /** Trailing slot, e.g. a "Create" button. */
  actions?: ReactNode;
}

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
            placeholder={searchPlaceholder ?? t("toolbar.searchPlaceholder")}
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
          <option value="">{t("toolbar.filterAll", { label: filter.label })}</option>
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

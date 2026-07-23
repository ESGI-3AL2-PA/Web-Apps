// Composant de tableau générique et typé, réutilisé par toutes les pages de liste de la console.
// Gère l'affichage des états chargement / erreur / vide via une ligne unique à colspan étendu.
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

/** Description d'une colonne : en-tête, rendu de cellule à partir de la ligne, classes optionnelles. */
export interface Column<T> {
  header: string;
  /** Rendu de cellule ; reçoit la ligne. */
  cell: (row: T) => ReactNode;
  className?: string;
}

/** Props de DataTable. */
interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string; // clé React stable par ligne
  loading?: boolean;
  error?: string | null;
  emptyLabel?: string; // texte quand la liste est vide (défaut : « aucun résultat »)
  /** Actions par ligne, rendues dans une colonne finale optionnelle. */
  actions?: (row: T) => ReactNode;
}

export function DataTable<T>({ columns, rows, rowKey, loading, error, emptyLabel, actions }: DataTableProps<T>) {
  const { t } = useTranslation();
  // colspan couvrant toutes les colonnes (+ la colonne d'actions) pour les lignes d'état.
  const colSpan = columns.length + (actions ? 1 : 0);

  return (
    <div className="overflow-x-auto rounded-box border border-base-content/10">
      <table className="table table-sm">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.header} scope="col" className={col.className}>
                {col.header}
              </th>
            ))}
            {actions && (
              <th scope="col" className="text-end">
                {t("common.actions.actions")}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={colSpan} className="text-center text-base-content/60 py-8">
                <span className="loading loading-spinner loading-sm" /> {t("common.states.loading")}
              </td>
            </tr>
          )}
          {!loading && error && (
            <tr>
              <td colSpan={colSpan} className="text-center text-error py-8">
                {error}
              </td>
            </tr>
          )}
          {!loading && !error && rows.length === 0 && (
            <tr>
              <td colSpan={colSpan} className="text-center text-base-content/60 py-8">
                {emptyLabel ?? t("common.states.noResults")}
              </td>
            </tr>
          )}
          {!loading &&
            !error &&
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((col) => (
                  <td key={col.header} className={col.className}>
                    {col.cell(row)}
                  </td>
                ))}
                {actions && <td className="text-end whitespace-nowrap">{actions(row)}</td>}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

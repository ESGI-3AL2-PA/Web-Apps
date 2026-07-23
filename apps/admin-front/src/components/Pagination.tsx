// Composant : barre de pagination pour les tableaux (précédent / page X / suivant).
import { useTranslation } from "react-i18next";

interface PaginationProps {
  page: number; // page courante, 1-indexée
  limit: number; // taille de page (nombre d'éléments par page)
  total: number; // total d'éléments toutes pages confondues
  onPageChange: (page: number) => void;
}

/**
 * Contrôles de pagination avec libellé de plage ("X–Y sur N").
 * Calcule le nombre de pages et les bornes affichées ; les boutons se désactivent
 * aux extrémités. Composant purement contrôlé — l'état de page vit chez le parent.
 */
export function Pagination({ page, limit, total, onPageChange }: PaginationProps) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(total / limit)); // au moins 1 page, même vide
  const from = total === 0 ? 0 : (page - 1) * limit + 1; // premier index affiché
  const to = Math.min(page * limit, total); // dernier index affiché (borné au total)

  return (
    <nav aria-label={t("common.table.pagination")} className="flex items-center justify-between gap-4 mt-4">
      <span className="text-sm text-base-content/60">{t("common.table.range", { from, to, total })}</span>
      <div className="join">
        <button
          className="btn btn-sm join-item"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={t("common.table.previous")}
        >
          «
        </button>
        <span className="btn btn-sm join-item pointer-events-none" aria-current="page" aria-live="polite">
          {t("common.table.page", { page, total: totalPages })}
        </span>
        <button
          className="btn btn-sm join-item"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label={t("common.table.next")}
        >
          »
        </button>
      </div>
    </nav>
  );
}

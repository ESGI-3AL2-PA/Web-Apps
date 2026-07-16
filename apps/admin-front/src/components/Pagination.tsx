import { useTranslation } from "react-i18next";

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, limit, total, onPageChange }: PaginationProps) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

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

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, limit, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between gap-4 mt-4">
      <span className="text-sm text-base-content/60">
        {from}–{to} of {total}
      </span>
      <div className="join">
        <button
          className="btn btn-sm join-item"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          «
        </button>
        <span className="btn btn-sm join-item pointer-events-none">
          Page {page} / {totalPages}
        </span>
        <button
          className="btn btn-sm join-item"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          »
        </button>
      </div>
    </div>
  );
}

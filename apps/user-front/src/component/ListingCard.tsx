import type { ListingResponseDto } from "@repo/contracts";
import { useTranslation } from "react-i18next";
import { listingStatusBadgeClass } from "../lib/listingLabels";

type ListingCardProps = {
  listing: ListingResponseDto;
  onDelete?: (id: string) => void;
};

const ListingCard = ({ listing, onDelete }: ListingCardProps) => {
  const { t } = useTranslation();

  return (
    <article className="card border border-base-content/10 bg-base-100 shadow-sm transition-shadow hover:shadow-md">
      <div className="card-body gap-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="card-title text-lg">{listing.title}</h3>
          <div className="flex shrink-0 items-center gap-1">
            <span className="badge badge-primary">{t("listing.points", { count: listing.price })}</span>
            {onDelete && (
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => onDelete(listing.id)}
                aria-label={t("myListings.delete")}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <p className="line-clamp-3 text-sm text-base-content/70">{listing.description}</p>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="badge badge-outline">{t(`listing.type.${listing.type}`)}</span>
          <span className={`badge ${listingStatusBadgeClass[listing.status]}`}>
            {t(`listing.status.${listing.status}`)}
          </span>
          {listing.tags.map((tag) => (
            <span key={tag} className="badge badge-ghost">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
};

export default ListingCard;

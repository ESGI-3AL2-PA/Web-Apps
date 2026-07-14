import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ListingResponseDto } from "@repo/contracts";
import { formatPrice, formatRelative, placeholderColor } from "../lib/format";
import AuthedImage from "./AuthedImage";

export default function ListingCard({ listing }: { listing: ListingResponseDto }) {
  const { t } = useTranslation();
  const cover = listing.images?.[0];

  return (
    <Link
      to={`/annonce/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 transition hover:shadow-md"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
        {cover ? (
          <AuthedImage
            src={cover}
            alt={listing.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-4xl font-black text-white/90"
            style={{ background: placeholderColor(listing.id) }}
          >
            {listing.title.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="text-base font-bold text-neutral-900 dark:text-neutral-50">{formatPrice(listing.price)}</span>
        <span className="line-clamp-2 text-sm text-neutral-700 dark:text-neutral-200">{listing.title}</span>
        <div className="mt-auto flex items-center justify-between pt-1 text-[11px] text-neutral-500">
          <span className="truncate">{listing.tags?.[0] ?? t("common.misc")}</span>
          <span className="shrink-0">{formatRelative(listing.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}

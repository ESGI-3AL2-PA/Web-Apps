import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { ListingResponseDto } from "@repo/contracts";
import { getListingById } from "../api-service/listings.service";
import { getUserPublic, type UserPublic } from "../api-service/users.service";
import { createConversation, getConversations } from "../api-service/conversations.service";
import { formatDate, formatPrice, placeholderColor, typeLabel } from "../lib/format";

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [listing, setListing] = useState<ListingResponseDto | null>(null);
  const [seller, setSeller] = useState<UserPublic | null>(null);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [contacting, setContacting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getListingById(id)
      .then((l) => {
        setListing(l);
        return getUserPublic(l.authorId).catch(() => null);
      })
      .then((s) => setSeller(s))
      .catch(() => setListing(null))
      .finally(() => setLoading(false));
  }, [id]);

  const contactSeller = async () => {
    if (!listing || !user) return;
    setContacting(true);
    try {
      // Reuse an existing direct conversation with this seller if there is one.
      const mine = await getConversations({ participantId: user.id } as never);
      const existing = mine.find(
        (c) => c.type === "direct" && c.participants.includes(listing.authorId) && c.participants.includes(user.id),
      );
      const conv =
        existing ?? (await createConversation({ participants: [user.id, listing.authorId], type: "direct" }));
      navigate(`/messages/${conv.id}`);
    } catch {
      alert(t("detail.contactError"));
    } finally {
      setContacting(false);
    }
  };

  if (loading) return <p className="text-neutral-500">{t("common.loading")}</p>;
  if (!listing) return <p className="text-neutral-500">{t("detail.notFound")}</p>;

  const images = listing.images ?? [];
  const isOwner = user?.id === listing.authorId;

  return (
    <div className="space-y-4">
      <Link to="/recherche" className="text-sm text-neutral-500 hover:text-[color:var(--color-brand)]">
        {t("detail.back")}
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* Gallery */}
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <div className="aspect-video w-full bg-neutral-100">
            {images.length > 0 ? (
              <img src={images[active]} alt={listing.title} className="h-full w-full object-contain" />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-6xl font-black text-white/70"
                style={{ background: placeholderColor(listing.id) }}
              >
                {listing.title.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto p-3">
              {images.map((src, i) => (
                <button
                  key={src}
                  onClick={() => setActive(i)}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded border-2 ${
                    i === active ? "border-[color:var(--color-brand)]" : "border-transparent"
                  }`}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <span className="mb-1 inline-block rounded bg-[color:var(--color-brand-soft)] px-2 py-0.5 text-xs font-semibold text-[color:var(--color-brand-dark)]">
              {typeLabel(listing.type)}
            </span>
            <h1 className="text-xl font-bold text-neutral-900">{listing.title}</h1>
            <p className="mt-1 text-2xl font-extrabold text-[color:var(--color-brand)]">{formatPrice(listing.price)}</p>
            <p className="mt-1 text-xs text-neutral-400">
              {t("detail.publishedOn", { date: formatDate(listing.createdAt) })}
            </p>

            {!isOwner && (
              <button
                onClick={contactSeller}
                disabled={contacting}
                className="mt-4 w-full rounded-lg bg-[color:var(--color-brand)] py-2.5 font-semibold text-white hover:bg-[color:var(--color-brand-dark)] disabled:opacity-60"
              >
                {contacting ? t("detail.contacting") : t("detail.contactSeller")}
              </button>
            )}
            {isOwner && (
              <Link
                to="/mes-annonces"
                className="mt-4 block w-full rounded-lg border border-neutral-300 py-2.5 text-center font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                {t("detail.manageListing")}
              </Link>
            )}
          </div>

          {seller && (
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-500">{t("detail.seller")}</h3>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--color-brand-soft)] font-bold text-[color:var(--color-brand-dark)]">
                  {seller.firstName.charAt(0)}
                </div>
                <span className="font-medium text-neutral-800">
                  {seller.firstName} {seller.lastName}
                </span>
              </div>
            </div>
          )}
        </aside>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-2 text-lg font-bold text-neutral-900">{t("detail.description")}</h2>
        <p className="whitespace-pre-wrap text-neutral-700">{listing.description}</p>
        {listing.tags && listing.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {listing.tags.map((t) => (
              <span key={t} className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

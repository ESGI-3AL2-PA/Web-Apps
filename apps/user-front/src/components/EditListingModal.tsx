import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { ListingResponseDto, TagResponseDto, UpdateListingDto } from "@repo/contracts";
import { updateListing } from "../api-service/listings.service";
import { getTags } from "../api-service/tags.service";
import { useFocusTrap } from "../lib/useFocusTrap";

// Self-contained edit form for a single listing. Kept inside MyListings' scope on
// purpose (see PR notes): PostListing owns its own form, so we duplicate the field
// layout here rather than share a component and risk a cross-PR collision.
export default function EditListingModal({
  listing,
  onClose,
  onUpdated,
}: {
  listing: ListingResponseDto;
  onClose: () => void;
  onUpdated: (listing: ListingResponseDto) => void;
}) {
  const { t } = useTranslation();
  const panelRef = useFocusTrap<HTMLDivElement>(true, onClose);
  const [tags, setTags] = useState<TagResponseDto[]>([]);
  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description);
  const [price, setPrice] = useState(String(listing.price));
  const [tag, setTag] = useState(listing.tags?.[0] ?? "");
  const [type, setType] = useState(listing.type);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTags()
      .then(setTags)
      .catch(() => setTags([]));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: UpdateListingDto = {
        title: title.trim(),
        description: description.trim(),
        type,
        price: Number(price) || 0,
        tags: tag ? [tag] : [],
      };
      const updated = await updateListing(listing.id, body);
      onUpdated(updated);
      onClose();
    } catch {
      setError(t("myListings.editError"));
    } finally {
      setBusy(false);
    }
  };

  const field =
    "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm outline-none focus:border-[color:var(--color-brand)] focus-visible:ring-2 ring-[color:var(--color-brand)]";
  const labelCls = "mb-1 block text-sm font-semibold text-neutral-700 dark:text-neutral-200";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-listing-title"
    >
      <button aria-label={t("common.cancel")} onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white dark:bg-neutral-900 p-5 shadow-2xl outline-none sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="edit-listing-title" className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
            {t("myListings.editTitle")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("common.cancel")}
            className="text-2xl leading-none text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            ×
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="edit-title" className={labelCls}>
              {t("post.fieldTitle")}
            </label>
            <input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={300}
              className={field}
              placeholder={t("post.titlePlaceholder")}
            />
          </div>

          <div>
            <label htmlFor="edit-type" className={labelCls}>
              {t("myListings.fieldType")}
            </label>
            <select
              id="edit-type"
              value={type}
              onChange={(e) => setType(e.target.value as ListingResponseDto["type"])}
              className={field}
            >
              <option value="offer">{t("myListings.typeOffer")}</option>
              <option value="request">{t("myListings.typeRequest")}</option>
            </select>
          </div>

          <div>
            <label htmlFor="edit-price" className={labelCls}>
              {t("post.pricePoints")}
            </label>
            <input
              id="edit-price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type="number"
              min={0}
              required
              className={field}
              placeholder="0"
            />
          </div>

          <div>
            <label htmlFor="edit-category" className={labelCls}>
              {t("post.category")}
            </label>
            <select id="edit-category" value={tag} onChange={(e) => setTag(e.target.value)} className={field}>
              <option value="">{t("post.chooseCategory")}</option>
              {tags.map((tg) => (
                <option key={tg.id} value={tg.name}>
                  {tg.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="edit-description" className={labelCls}>
              {t("post.description")}
            </label>
            <textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={5}
              className={field}
              placeholder={t("post.descriptionPlaceholder")}
            />
          </div>

          {error && (
            <p role="alert" aria-live="assertive" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-[color:var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--color-brand-dark)] disabled:opacity-60"
            >
              {busy ? t("myListings.saving") : t("myListings.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { ListingResponseDto, TagResponseDto, UpdateListingDto } from "@repo/contracts";
import { updateListing } from "../api-service/listings.service";
import { getTags } from "../api-service/tags.service";
import { tagLabel } from "../lib/tag-label";
import { useFocusTrap } from "../lib/useFocusTrap";

/**
 * Modale d'édition autonome d'une annonce. Volontairement cantonnée au périmètre de
 * MyListings (cf. notes de PR) : PostListing possède déjà son propre formulaire, on
 * duplique donc ici la disposition des champs plutôt que de partager un composant et
 * risquer une collision entre PR.
 *
 * @param listing - l'annonce à éditer (valeurs initiales du formulaire).
 * @param onClose - ferme la modale sans enregistrer.
 * @param onUpdated - reçoit l'annonce mise à jour après un PATCH réussi.
 */
export default function EditListingModal({
  listing,
  onClose,
  onUpdated,
}: {
  listing: ListingResponseDto;
  onClose: () => void;
  onUpdated: (listing: ListingResponseDto) => void;
}) {
  const { t, i18n } = useTranslation();
  const panelRef = useFocusTrap<HTMLDivElement>(true, onClose);
  const [tags, setTags] = useState<TagResponseDto[]>([]);
  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description);
  const [price, setPrice] = useState(String(listing.price));
  const [tag, setTag] = useState(listing.tags?.[0] ?? ""); // on ne gère qu'une seule catégorie
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charge la liste des catégories (tags) pour le menu déroulant ; en cas d'échec, liste vide.
  useEffect(() => {
    let ignore = false;
    getTags()
      .then((tgs) => {
        if (!ignore) setTags(tgs);
      })
      .catch(() => {
        if (!ignore) setTags([]);
      });
    return () => {
      ignore = true;
    };
  }, []);

  // Construit le DTO de mise à jour et envoie le PATCH ; remonte l'annonce à jour au parent.
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: UpdateListingDto = {
        title: title.trim(),
        description: description.trim(),
        price: Number(price) || 0, // prix en points ; NaN retombe sur 0
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
    "w-full rounded-lg border border-base-content/20 bg-base-100 px-3 py-2 text-sm text-base-content outline-none focus:border-primary focus-visible:ring-2 ring-primary";
  const labelCls = "mb-1 block text-sm font-semibold text-base-content/80";

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
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-base-100 p-5 shadow-2xl outline-none sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="edit-listing-title" className="text-lg font-bold text-base-content">
            {t("myListings.editTitle")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("common.cancel")}
            className="text-2xl leading-none text-base-content/50 hover:text-base-content"
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
                  {tagLabel(tg, i18n.language)}
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
            <p role="alert" aria-live="assertive" className="text-sm text-error">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-base-content/20 px-4 py-2 text-sm font-semibold text-base-content/80 hover:bg-base-200"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-content hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? t("myListings.saving") : t("myListings.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

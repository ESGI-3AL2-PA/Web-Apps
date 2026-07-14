import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { CreateListingDto, TagResponseDto } from "@repo/contracts";
import { createListing } from "../api-service/listings.service";
import { getTags } from "../api-service/tags.service";
import { uploadImages } from "../api-service/uploads.service";

export default function PostListing() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tags, setTags] = useState<TagResponseDto[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [tag, setTag] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTags()
      .then(setTags)
      .catch(() => setTags([]));
  }, []);

  // Revoke the current preview URLs when they're replaced (re-pick) or on unmount.
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const onFiles = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list).slice(0, 8);
    setFiles(picked);
    setPreviews(picked.map((f) => URL.createObjectURL(f)));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const images = files.length > 0 ? await uploadImages(files) : [];
      const body: CreateListingDto = {
        title: title.trim(),
        description: description.trim(),
        type: "offer",
        price: Number(price) || 0,
        ...(tag ? { tags: [tag] } : {}),
        ...(images.length ? { images } : {}),
      };
      const created = await createListing(body);
      navigate(`/annonce/${created.id}`);
    } catch {
      setError(t("post.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const field =
    "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm outline-none focus:border-[color:var(--color-brand)] focus-visible:ring-2 ring-[color:var(--color-brand)]";

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-extrabold text-neutral-900 dark:text-neutral-50">{t("post.title")}</h1>
      <form
        onSubmit={onSubmit}
        className="space-y-5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-6"
      >
        <div>
          <label
            htmlFor="post-title"
            className="mb-1 block text-sm font-semibold text-neutral-700 dark:text-neutral-200"
          >
            {t("post.fieldTitle")}
          </label>
          <input
            id="post-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={300}
            className={field}
            placeholder={t("post.titlePlaceholder")}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "post-error" : undefined}
          />
        </div>

        <div>
          <label
            htmlFor="post-price"
            className="mb-1 block text-sm font-semibold text-neutral-700 dark:text-neutral-200"
          >
            {t("post.pricePoints")}
          </label>
          <input
            id="post-price"
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
          <label
            htmlFor="post-category"
            className="mb-1 block text-sm font-semibold text-neutral-700 dark:text-neutral-200"
          >
            {t("post.category")}
          </label>
          <select id="post-category" value={tag} onChange={(e) => setTag(e.target.value)} className={field}>
            <option value="">{t("post.chooseCategory")}</option>
            {tags.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="post-description"
            className="mb-1 block text-sm font-semibold text-neutral-700 dark:text-neutral-200"
          >
            {t("post.description")}
          </label>
          <textarea
            id="post-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={5}
            className={field}
            placeholder={t("post.descriptionPlaceholder")}
          />
        </div>

        <div>
          <label
            htmlFor="post-photos"
            className="mb-1 block text-sm font-semibold text-neutral-700 dark:text-neutral-200"
          >
            {t("post.photos")}
          </label>
          <input
            id="post-photos"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => onFiles(e.target.files)}
            className="text-sm"
          />
          {previews.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {previews.map((src) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="h-20 w-20 rounded-lg border border-neutral-200 dark:border-neutral-700 object-cover"
                />
              ))}
            </div>
          )}
        </div>

        {error && (
          <p id="post-error" role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-[color:var(--color-brand)] py-3 font-semibold text-white hover:bg-[color:var(--color-brand-dark)] disabled:opacity-60"
        >
          {submitting ? t("post.submitting") : t("post.submit")}
        </button>
      </form>
    </div>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { CreateListingDto, TagResponseDto } from "@repo/contracts";
import { createListing } from "../api-service/listings.service";
import { getTags } from "../api-service/tags.service";
import { uploadImages } from "../api-service/uploads.service";

export default function PostListing() {
  const navigate = useNavigate();
  const [tags, setTags] = useState<TagResponseDto[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"offer" | "request">("offer");
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
        type,
        price: Number(price) || 0,
        ...(tag ? { tags: [tag] } : {}),
        ...(images.length ? { images } : {}),
      };
      const created = await createListing(body);
      navigate(`/annonce/${created.id}`);
    } catch {
      setError("La publication a échoué. Vérifiez les champs et réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  const field =
    "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[color:var(--color-brand)]";

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-extrabold text-neutral-900">Déposer une annonce</h1>
      <form onSubmit={onSubmit} className="space-y-5 rounded-xl border border-neutral-200 bg-white p-6">
        <div>
          <label className="mb-1 block text-sm font-semibold text-neutral-700">Titre</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={300}
            className={field}
            placeholder="Ex. Vélo de ville en bon état"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-neutral-700">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as "offer" | "request")} className={field}>
              <option value="offer">Offre</option>
              <option value="request">Demande</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-neutral-700">Prix (points)</label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type="number"
              min={0}
              required
              className={field}
              placeholder="0"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-neutral-700">Catégorie</label>
          <select value={tag} onChange={(e) => setTag(e.target.value)} className={field}>
            <option value="">— Choisir une catégorie —</option>
            {tags.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-neutral-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={5}
            className={field}
            placeholder="Décrivez votre annonce…"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-neutral-700">Photos (max 8)</label>
          <input type="file" accept="image/*" multiple onChange={(e) => onFiles(e.target.files)} className="text-sm" />
          {previews.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {previews.map((src) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="h-20 w-20 rounded-lg border border-neutral-200 object-cover"
                />
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-[color:var(--color-brand)] py-3 font-semibold text-white hover:bg-[color:var(--color-brand-dark)] disabled:opacity-60"
        >
          {submitting ? "Publication…" : "Publier l'annonce"}
        </button>
      </form>
    </div>
  );
}

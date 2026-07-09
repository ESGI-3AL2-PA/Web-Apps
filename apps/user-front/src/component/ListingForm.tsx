import { useEffect, useState } from "react";
import type { CreateListingDto, ListingResponseDto, TagResponseDto } from "@repo/contracts";
import { getTags } from "../api-service/tags.service";

// Formulaire réutilisable — utilisé à la fois pour CREATER (CreateService) et
// pour ÉDITER (modale de CarteService). On passe optionnellement les valeurs
// initiales : si absentes, le formulaire démarre vide.
//
// `type` = offre/demande. La catégorie est un tag, choisi séparément et
// envoyé dans `tags` (source des filtres et du moteur de reco Neo4j).
type ListingFormProps = {
  initialValues?: Partial<ListingResponseDto>;
  onSubmit: (data: CreateListingDto) => Promise<void>;
  submitLabel: string;
};

const ListingForm = ({ initialValues, onSubmit, submitLabel }: ListingFormProps) => {
  const [tags, setTags] = useState<TagResponseDto[]>([]);
  const [tagsError, setTagsError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Omit<CreateListingDto, "tags">>({
    title: initialValues?.title ?? "",
    description: initialValues?.description ?? "",
    type: initialValues?.type ?? "offer",
    price: initialValues?.price ?? 0,
  });
  // Catégorie = nom d'un tag, indépendante de `type`.
  const [category, setCategory] = useState<string>(initialValues?.tags?.[0] ?? "");

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [success, setSuccess] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Charge les tags au mount pour peupler le select.
  useEffect(() => {
    let cancelled = false;
    getTags({ limit: 100 } as never)
      .then((res) => {
        if (cancelled) return;
        setTags(res.data);
        // Si aucune catégorie pré-sélectionnée, on prend le 1er tag dispo par défaut.
        setCategory((prev) => prev || res.data[0]?.name || "");
      })
      .catch(() => {
        if (!cancelled) setTagsError("Impossible de charger les catégories");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "price" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess("");
    setSubmitting(true);
    try {
      // La catégorie choisie part dans `tags` (filtres + reco Neo4j).
      const payload: CreateListingDto = {
        ...formData,
        tags: category ? [category] : [],
      };
      await onSubmit(payload);
      setSuccess("Opération réussie");
    } catch {
      setError("Échec de l'opération");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col gap-1">
        <label>Titre de l&apos;annonce</label>
        <input
          className="border border-black rounded px-2 py-1"
          type="text"
          name="title"
          value={formData.title}
          onChange={handleChange}
          required
        />
      </div>

      <div className="flex flex-col gap-1">
        <label>Description</label>
        <input
          className="border border-black rounded px-2 py-1"
          type="text"
          name="description"
          value={formData.description}
          onChange={handleChange}
          required
        />
      </div>

      <div className="flex flex-col gap-1">
        <label>Type</label>
        <select
          className="border border-black rounded px-2 py-1"
          name="type"
          value={formData.type}
          onChange={handleChange}
          required
        >
          <option value="offer">Offre</option>
          <option value="request">Demande</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label>Catégorie</label>
        {tagsError ? (
          <span className="text-xs text-red-600">{tagsError}</span>
        ) : (
          <select
            className="border border-black rounded px-2 py-1"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          >
            {tags.length === 0 && <option value="">Chargement…</option>}
            {tags.map((tag) => (
              <option key={tag.id} value={tag.name}>
                {tag.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label>Point demandé</label>
        <input
          className="border border-black rounded px-2 py-1"
          type="number"
          name="price"
          value={formData.price}
          onChange={handleChange}
          min={0}
          required
        />
      </div>

      <button className="border border-black rounded px-4 py-2 disabled:opacity-50" type="submit" disabled={submitting}>
        {submitting ? "Envoi…" : submitLabel}
      </button>

      {success && <p className="text-green-600">{success}</p>}
      {error && <p className="text-red-500">{error}</p>}
    </form>
  );
};

export default ListingForm;

import { useEffect, useState } from "react";
import type {
  CreateListingDto,
  ListingResponseDto,
  ListingType,
  TagResponseDto,
} from "@repo/contracts";
import { getTags } from "../api-service/tags.service";

// Formulaire réutilisable — utilisé à la fois pour CREATER (CreateService) et
// pour ÉDITER (modale de CarteService). On passe optionnellement les valeurs
// initiales : si absentes, le formulaire démarre vide.
//
// La liste des `type` est tirée dynamiquement des tags via `getTags()`,
// conformément à la consigne ("LISTING_TYPES = valeurs des tags").
type ListingFormProps = {
  initialValues?: Partial<ListingResponseDto>;
  onSubmit: (data: CreateListingDto) => Promise<void>;
  submitLabel: string;
};

const ListingForm = ({ initialValues, onSubmit, submitLabel }: ListingFormProps) => {
  const [tags, setTags] = useState<TagResponseDto[]>([]);
  const [tagsError, setTagsError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateListingDto>({
    title: initialValues?.title ?? "",
    description: initialValues?.description ?? "",
    // Cast nécessaire car le backend `ListingTypeSchema` est un enum strict :
    // si un tag a un nom hors enum, le backend renverra une 400 à la soumission.
    type: (initialValues?.type ?? "") as ListingType,
    price: initialValues?.price ?? 0,
  });

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
        // Si aucun type pré-sélectionné, on prend le 1er tag dispo comme défaut.
        if (!initialValues?.type && res.data.length > 0) {
          setFormData((prev) => ({ ...prev, type: res.data[0].name as ListingType }));
        }
      })
      .catch(() => {
        if (!cancelled) setTagsError("Impossible de charger les catégories");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
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
      // On envoie aussi le tag choisi dans le tableau `tags` pour qu'il soit
      // exploité par le moteur de reco Neo4j et par les filtres tag-based.
      const payload: CreateListingDto = {
        ...formData,
        tags: [formData.type],
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
        <label>Titre de l'annonce</label>
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
        {tagsError ? (
          <span className="text-xs text-red-600">{tagsError}</span>
        ) : (
          <select
            className="border border-black rounded px-2 py-1"
            name="type"
            value={formData.type}
            onChange={handleChange}
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

      <button
        className="border border-black rounded px-4 py-2 disabled:opacity-50"
        type="submit"
        disabled={submitting}
      >
        {submitting ? "Envoi…" : submitLabel}
      </button>

      {success && <p className="text-green-600">{success}</p>}
      {error && <p className="text-red-500">{error}</p>}
    </form>
  );
};

export default ListingForm;

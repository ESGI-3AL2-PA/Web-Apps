import { useState } from "react";
import type { CreateListingDto, ListingType } from "@repo/contracts";
import { createListing } from "../../api-service/listings.service";

// Liste hardcodée pour ne pas dépendre d'un import runtime de `ListingTypeSchema`
// (qui exigerait que `packages/contracts/dist/` soit rebuild en permanence).
// Le `satisfies readonly ListingType[]` garantit la synchro avec le contract :
// si tu ajoutes / renommes un type dans `listing.dto.ts`, TS criera ici.
const LISTING_TYPES = [
  "Jardinage",
  "Bricolage",
  "Garde d'enfants",
  "Cuisine",
  "Transport",
  "Animaux",
  "Informatique",
] as const satisfies readonly ListingType[];

const EMPTY_FORM: CreateListingDto = {
  title: "",
  description: "",
  type: LISTING_TYPES[0],
  price: 0,
};

function CreateService() {
  const [formData, setFormData] = useState<CreateListingDto>(EMPTY_FORM);
  const [created, setCreated] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

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
    setCreated("");
    try {
      await createListing(formData);
      setCreated("Service créé");
      setFormData(EMPTY_FORM);
    } catch {
      setError("Échec de la création du service");
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-1">
          <label>Titre de l'annonce</label>
          <input
            className="border border-black rounded px-2 py-1"
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
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
          />
        </div>

        <div className="flex flex-col gap-1">
          <label>Type</label>
          <select
            className="border border-black rounded px-2 py-1"
            name="type"
            value={formData.type}
            onChange={handleChange}
          >
            {LISTING_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label>Point demandé</label>
          <input
            className="border border-black rounded px-2 py-1"
            type="number"
            name="price"
            value={formData.price}
            onChange={handleChange}
          />
        </div>

        <button className="border border-black rounded px-4 py-2" type="submit">
          Créer le service
        </button>
      </form>

      {created && <p className="text-green-600">{created}</p>}
      {error && <p className="text-red-500">{error}</p>}
    </>
  );
}

export default CreateService;

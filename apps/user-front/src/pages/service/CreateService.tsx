import { createListings } from "../../api-service/api";
import { useEffect, useState } from "react";
import { CreateListingDto, listingTypes } from "../../type/annonce";
import { create } from "axios";

function CreateService() {
  const [formData, setFormData] = useState<CreateListingDto>({
    title: "",
    description: "",
    type: "offer",
    price: 0,
  });
  const [created, setCreated] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: name === "price" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await createListings(formData);

      setFormData(res);
      setCreated("Service créer");
    } catch (error) {
      setError("Echec de la création du service");
    }
  };

  {
    error && <p>{error}</p>;
  }

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
            <option value="">Choisir un type</option>

            {listingTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label>Point demandé</label>
          <input
            className="border border-black rounded px-2 py-1"
            type="text"
            name="price"
            value={formData.price}
            onChange={handleChange}
          />
        </div>

        <button className="border border-black rounded px-4 py-2" type="submit">
          Créer le service
        </button>
      </form>
      {created != "" && <p className="text-red-500">{created}</p>}
    </>
  );
}

export default CreateService;

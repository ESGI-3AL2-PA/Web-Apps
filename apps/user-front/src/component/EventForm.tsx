import { useState } from "react";
import { useAuth } from "@repo/hooks";
import type { CreateEventDto, EventResponseDto } from "@repo/contracts";

// Formulaire réutilisable de création / édition d'événement.
// Calqué sur `ListingForm.tsx` mais avec les champs spécifiques aux events :
//   title, description, location, totalSeats, eventDate, districtId.
// districtId est récupéré depuis le user connecté (son quartier).
type EventFormProps = {
  initialValues?: Partial<EventResponseDto>;
  onSubmit: (data: CreateEventDto) => Promise<void>;
  submitLabel: string;
};

// Convertit une ISO datetime en valeur pour <input type="datetime-local">,
// qui veut le format "YYYY-MM-DDTHH:mm" (sans secondes ni timezone).
const toLocalInputValue = (iso?: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const EventForm = ({ initialValues, onSubmit, submitLabel }: EventFormProps) => {
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    title: initialValues?.title ?? "",
    description: initialValues?.description ?? "",
    location: initialValues?.location ?? "",
    totalSeats: initialValues?.totalSeats ?? 10,
    // Représentation locale pour l'input ; on convertit en ISO à la soumission.
    eventDateLocal: toLocalInputValue(initialValues?.eventDate),
  });

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [success, setSuccess] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "totalSeats" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess("");
    setSubmitting(true);
    try {
      // districtId : on prend celui du user. Si l'auth ne l'expose pas, le
      // backend devra l'auto-résoudre (cf. createListing pattern).
      const districtId =
        (initialValues?.districtId as string | undefined) ??
        // @ts-expect-error — districtId peut être ou non sur le user JWT selon la configuration
        (user?.districtId as string | undefined) ??
        "";

      // Conversion datetime-local → ISO 8601 (avec Z UTC).
      const eventDate = formData.eventDateLocal
        ? new Date(formData.eventDateLocal).toISOString()
        : new Date().toISOString();

      const payload: CreateEventDto = {
        districtId,
        title: formData.title,
        description: formData.description,
        location: formData.location,
        totalSeats: formData.totalSeats,
        eventDate,
      };
      await onSubmit(payload);
      setSuccess("Événement enregistré");
    } catch {
      setError("Échec de l'enregistrement de l'événement");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col gap-1">
        <label>Titre de l'événement</label>
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
        <textarea
          className="border border-black rounded px-2 py-1"
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          required
        />
      </div>

      <div className="flex flex-col gap-1">
        <label>Lieu</label>
        <input
          className="border border-black rounded px-2 py-1"
          type="text"
          name="location"
          value={formData.location}
          onChange={handleChange}
          required
        />
      </div>

      <div className="flex flex-col gap-1">
        <label>Date et heure</label>
        <input
          className="border border-black rounded px-2 py-1"
          type="datetime-local"
          name="eventDateLocal"
          value={formData.eventDateLocal}
          onChange={handleChange}
          required
        />
      </div>

      <div className="flex flex-col gap-1">
        <label>Nombre de places</label>
        <input
          className="border border-black rounded px-2 py-1"
          type="number"
          name="totalSeats"
          value={formData.totalSeats}
          onChange={handleChange}
          min={1}
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

export default EventForm;

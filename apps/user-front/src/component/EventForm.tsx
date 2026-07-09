import { useState } from "react";
import { useAuth } from "@repo/hooks";
import type { CreateEventDto, EventResponseDto } from "@repo/contracts";

type EventFormProps = {
  initialValues?: Partial<EventResponseDto>;
  onSubmit: (data: CreateEventDto) => Promise<void>;
  submitLabel: string;
};

// ISO → "YYYY-MM-DDTHH:mm" for <input type="datetime-local">.
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
    eventDateLocal: toLocalInputValue(initialValues?.eventDate),
  });

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [success, setSuccess] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
      // districtId from the user's own district; the backend resolves it if absent.
      const districtId =
        (initialValues?.districtId as string | undefined) ?? (user?.districtId as string | undefined) ?? "";

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
        <label htmlFor="evt-title">{"Titre de l'événement"}</label>
        <input
          id="evt-title"
          className="border border-black rounded px-2 py-1"
          type="text"
          name="title"
          value={formData.title}
          onChange={handleChange}
          required
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="evt-description">Description</label>
        <textarea
          id="evt-description"
          className="border border-black rounded px-2 py-1"
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          required
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="evt-location">Lieu</label>
        <input
          id="evt-location"
          className="border border-black rounded px-2 py-1"
          type="text"
          name="location"
          value={formData.location}
          onChange={handleChange}
          required
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="evt-date">Date et heure</label>
        <input
          id="evt-date"
          className="border border-black rounded px-2 py-1"
          type="datetime-local"
          name="eventDateLocal"
          value={formData.eventDateLocal}
          onChange={handleChange}
          required
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="evt-seats">Nombre de places</label>
        <input
          id="evt-seats"
          className="border border-black rounded px-2 py-1"
          type="number"
          name="totalSeats"
          value={formData.totalSeats}
          onChange={handleChange}
          min={1}
          required
        />
      </div>

      <button className="border border-black rounded px-4 py-2 disabled:opacity-50" type="submit" disabled={submitting}>
        {submitting ? "Envoi…" : submitLabel}
      </button>

      {success && (
        <p role="status" className="text-green-700">
          {success}
        </p>
      )}
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
    </form>
  );
};

export default EventForm;

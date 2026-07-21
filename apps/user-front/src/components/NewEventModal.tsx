import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { CreateEventDto, EventResponseDto } from "@repo/contracts";
import { createEvent } from "../api-service/events.service";
import { useFocusTrap } from "../lib/useFocusTrap";

// datetime-local speaks local "YYYY-MM-DDTHH:mm"; the API speaks ISO.
const nowLocal = (plusDays = 0): string => {
  const d = new Date(Date.now() + plusDays * 86_400_000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export default function NewEventModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (event: EventResponseDto) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const panelRef = useFocusTrap<HTMLDivElement>(true, onClose);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [totalSeats, setTotalSeats] = useState("20");
  const [eventDate, setEventDate] = useState(nowLocal(7));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.districtId) return;
    setBusy(true);
    setError(null);
    try {
      const body: CreateEventDto = {
        districtId: user.districtId,
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        totalSeats: Number(totalSeats) || 1,
        eventDate: new Date(eventDate).toISOString(),
      };
      const created = await createEvent(body);
      onCreated(created);
      onClose();
    } catch {
      setError(t("events.createError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-event-title"
    >
      <button aria-label={t("common.cancel")} onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-base-100 p-5 shadow-2xl outline-none sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="new-event-title" className="text-lg font-bold text-base-content">
            {t("events.create")}
          </h2>
          <button onClick={onClose} aria-label={t("common.cancel")} className="btn btn-text btn-circle btn-sm">
            <span className="icon-[tabler--x] size-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="new-event-title-input" className="mb-1.5 block text-sm text-base-content/70">
              {t("events.fields.title")}
            </label>
            <input
              id="new-event-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={300}
              className="input w-full"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="new-event-location" className="mb-1.5 block text-sm text-base-content/70">
              {t("events.fields.location")}
            </label>
            <input
              id="new-event-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
              maxLength={500}
              className="input w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-event-date" className="mb-1.5 block text-sm text-base-content/70">
                {t("events.fields.date")}
              </label>
              <input
                id="new-event-date"
                type="datetime-local"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
                className="input w-full"
              />
            </div>
            <div>
              <label htmlFor="new-event-seats" className="mb-1.5 block text-sm text-base-content/70">
                {t("events.fields.seats")}
              </label>
              <input
                id="new-event-seats"
                type="number"
                min={1}
                value={totalSeats}
                onChange={(e) => setTotalSeats(e.target.value)}
                required
                className="input w-full"
              />
            </div>
          </div>
          <div>
            <label htmlFor="new-event-description" className="mb-1.5 block text-sm text-base-content/70">
              {t("events.fields.description")}
            </label>
            <textarea
              id="new-event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              className="textarea w-full"
            />
          </div>
          {error && (
            <p role="alert" aria-live="assertive" className="text-sm text-error">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn btn-soft">
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={busy} className="btn btn-primary">
              {busy && <span className="loading loading-spinner loading-sm" />}
              {busy ? t("events.creating") : t("events.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

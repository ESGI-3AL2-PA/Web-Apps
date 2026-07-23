import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import { createConversation } from "../api-service/conversations.service";
import type { UserPublic } from "../api-service/users.service";
import { useFocusTrap } from "../lib/useFocusTrap";
import UserAutocomplete from "./UserAutocomplete";

/**
 * Modale de création d'une conversation. On ajoute un ou plusieurs destinataires via
 * l'autocomplétion d'utilisateurs ; au-delà d'un destinataire la conversation devient un
 * groupe (type "group") avec un nom optionnel, sinon c'est un échange direct.
 *
 * @param onClose - ferme la modale.
 * @param onCreated - reçoit l'id de la conversation créée.
 */
export default function NewConversationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const panelRef = useFocusTrap<HTMLDivElement>(true, onClose);
  const [targets, setTargets] = useState<UserPublic[]>([]);
  const [name, setName] = useState("");
  const [pickerKey, setPickerKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGroup = targets.length > 1; // groupe dès qu'il y a plus d'un destinataire

  // Ajoute un destinataire : refuse soi-même et ignore les doublons.
  const addTarget = (u: UserPublic | null) => {
    if (!u) return;
    if (u.id === user?.id) {
      setError(t("messages.notYourself"));
      return;
    }
    if (targets.some((x) => x.id === u.id)) return;
    setTargets((prev) => [...prev, u]);
    setError(null);
    // Remonte l'autocomplétion (change sa key) pour vider sa saisie/liste déroulante internes.
    setPickerKey((k) => k + 1);
  };

  const removeTarget = (id: string) => setTargets((prev) => prev.filter((x) => x.id !== id));

  // Crée la conversation : participants = utilisateur courant + destinataires choisis.
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (targets.length === 0) {
      setError(t("messages.pickNeighbour"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createConversation({
        participants: [user.id, ...targets.map((x) => x.id)],
        type: isGroup ? "group" : "direct",
        name: isGroup ? name.trim() || undefined : undefined,
      });
      onCreated(created.id);
      onClose();
    } catch {
      setError(t("messages.createError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-conv-title"
    >
      <button aria-label={t("common.cancel")} onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative w-full max-w-sm rounded-t-2xl bg-base-100 p-5 shadow-2xl outline-none sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="new-conv-title" className="text-lg font-bold text-base-content">
            {t("messages.newConversation")}
          </h2>
          <button onClick={onClose} aria-label={t("common.cancel")} className="btn btn-text btn-circle btn-sm">
            <span className="icon-[tabler--x] size-5" />
          </button>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="new-conv-participant" className="mb-1.5 block text-sm text-base-content/70">
            {t("messages.neighbourLabel")}
          </label>
          <UserAutocomplete key={pickerKey} id="new-conv-participant" selected={null} onSelect={addTarget} autoFocus />
          {targets.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {targets.map((u) => (
                <li
                  key={u.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 py-1 pl-3 pr-1.5 text-sm text-base-content"
                >
                  {u.firstName} {u.lastName}
                  <button
                    type="button"
                    onClick={() => removeTarget(u.id)}
                    aria-label={t("messages.removeParticipant")}
                    className="text-lg leading-none text-base-content/50 hover:text-base-content"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          {isGroup && (
            <div className="mt-3">
              <label htmlFor="new-conv-name" className="mb-1.5 block text-sm text-base-content/70">
                {t("messages.groupName")}
              </label>
              <input
                id="new-conv-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("messages.groupNamePlaceholder")}
                className="input w-full"
              />
            </div>
          )}
          {error && (
            <p role="alert" aria-live="assertive" className="mt-2 text-sm text-error">
              {error}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-soft">
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={busy || targets.length === 0} className="btn btn-primary">
              {busy && <span className="loading loading-spinner loading-sm" />}
              {busy ? t("messages.creating") : t("messages.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

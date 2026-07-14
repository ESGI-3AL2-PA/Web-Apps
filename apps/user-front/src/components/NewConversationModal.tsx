import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import { createConversation } from "../api-service/conversations.service";
import type { UserPublic } from "../api-service/users.service";
import UserAutocomplete from "./UserAutocomplete";

export default function NewConversationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [targets, setTargets] = useState<UserPublic[]>([]);
  const [name, setName] = useState("");
  const [pickerKey, setPickerKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGroup = targets.length > 1;

  const addTarget = (u: UserPublic | null) => {
    if (!u) return;
    if (u.id === user?.id) {
      setError(t("messages.notYourself"));
      return;
    }
    if (targets.some((x) => x.id === u.id)) return;
    setTargets((prev) => [...prev, u]);
    setError(null);
    // Remount the autocomplete to clear its internal query/dropdown state.
    setPickerKey((k) => k + 1);
  };

  const removeTarget = (id: string) => setTargets((prev) => prev.filter((x) => x.id !== id));

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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button aria-label={t("common.cancel")} onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-sm rounded-t-2xl bg-white dark:bg-neutral-900 p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">{t("messages.newConversation")}</h2>
          <button
            onClick={onClose}
            aria-label={t("common.cancel")}
            className="text-2xl leading-none text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            ×
          </button>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="new-conv-participant" className="mb-1.5 block text-sm text-neutral-600 dark:text-neutral-300">
            {t("messages.neighbourLabel")}
          </label>
          <UserAutocomplete key={pickerKey} id="new-conv-participant" selected={null} onSelect={addTarget} autoFocus />
          {targets.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {targets.map((u) => (
                <li
                  key={u.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-brand-soft)] py-1 pl-3 pr-1.5 text-sm text-neutral-800 dark:text-neutral-100"
                >
                  {u.firstName} {u.lastName}
                  <button
                    type="button"
                    onClick={() => removeTarget(u.id)}
                    aria-label={t("messages.removeParticipant")}
                    className="text-lg leading-none text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          {isGroup && (
            <div className="mt-3">
              <label htmlFor="new-conv-name" className="mb-1.5 block text-sm text-neutral-600 dark:text-neutral-300">
                {t("messages.groupName")}
              </label>
              <input
                id="new-conv-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("messages.groupNamePlaceholder")}
                className="h-10 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 text-sm outline-none focus:border-[color:var(--color-brand)]"
              />
            </div>
          )}
          {error && (
            <p role="alert" aria-live="assertive" className="mt-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={busy || targets.length === 0}
              className="rounded-lg bg-[color:var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--color-brand-dark)] disabled:opacity-60"
            >
              {busy ? t("messages.creating") : t("messages.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { CreateVoteDto, VoteResponseDto, VoteType } from "@repo/contracts";
import { createVote } from "../api-service/votes.service";
import { useFocusTrap } from "../lib/useFocusTrap";

// datetime-local speaks local "YYYY-MM-DDTHH:mm"; the API speaks ISO.
const nowLocal = (plusDays = 0): string => {
  const d = new Date(Date.now() + plusDays * 86_400_000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const VOTE_TYPES: VoteType[] = ["single_choice", "multiple_choice"];

export default function NewVoteModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (vote: VoteResponseDto) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const panelRef = useFocusTrap<HTMLDivElement>(true, onClose);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [voteType, setVoteType] = useState<VoteType>("single_choice");
  const [startDate, setStartDate] = useState(nowLocal());
  const [endDate, setEndDate] = useState(nowLocal(7));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setOption = (i: number, value: string) => setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  const addOption = () => setOptions((prev) => [...prev, ""]);
  const removeOption = (i: number) => setOptions((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.districtId) return;
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      setError(t("votes.needTwoOptions"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: CreateVoteDto = {
        districtIds: [user.districtId],
        question: question.trim(),
        options: cleanOptions,
        voteType,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      };
      const created = await createVote(body);
      onCreated(created);
      onClose();
    } catch {
      setError(t("votes.createError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-vote-title"
    >
      <button aria-label={t("common.cancel")} onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-base-100 p-5 shadow-2xl outline-none sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="new-vote-title" className="text-lg font-bold text-base-content">
            {t("votes.create")}
          </h2>
          <button onClick={onClose} aria-label={t("common.cancel")} className="btn btn-text btn-circle btn-sm">
            <span className="icon-[tabler--x] size-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="new-vote-question" className="mb-1.5 block text-sm text-base-content/70">
              {t("votes.fields.question")}
            </label>
            <textarea
              id="new-vote-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              required
              maxLength={500}
              rows={2}
              className="textarea w-full"
              autoFocus
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm text-base-content/70">{t("votes.fields.options")}</p>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={opt}
                    onChange={(e) => setOption(i, e.target.value)}
                    placeholder={t("votes.optionPlaceholder", { n: i + 1 })}
                    aria-label={t("votes.optionPlaceholder", { n: i + 1 })}
                    className="input w-full flex-1"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      aria-label={t("votes.removeOption")}
                      className="btn btn-square btn-text btn-error"
                    >
                      <span className="icon-[tabler--x] size-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addOption} className="btn btn-sm btn-text mt-2">
              <span className="icon-[tabler--plus] size-4" />
              {t("votes.addOption")}
            </button>
          </div>

          <div>
            <label htmlFor="new-vote-type" className="mb-1.5 block text-sm text-base-content/70">
              {t("votes.fields.type")}
            </label>
            <select
              id="new-vote-type"
              value={voteType}
              onChange={(e) => setVoteType(e.target.value as VoteType)}
              className="select w-full"
            >
              {VOTE_TYPES.map((vt) => (
                <option key={vt} value={vt}>
                  {t(`votes.type.${vt}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-vote-start" className="mb-1.5 block text-sm text-base-content/70">
                {t("votes.fields.start")}
              </label>
              <input
                id="new-vote-start"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="input w-full"
              />
            </div>
            <div>
              <label htmlFor="new-vote-end" className="mb-1.5 block text-sm text-base-content/70">
                {t("votes.fields.end")}
              </label>
              <input
                id="new-vote-end"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="input w-full"
              />
            </div>
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
              {busy ? t("votes.creating") : t("votes.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

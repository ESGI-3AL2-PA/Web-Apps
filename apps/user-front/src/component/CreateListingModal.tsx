import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { CreateListingDto, ListingType } from "@repo/contracts";
import { createListing } from "../api-service/api";

type CreateListingModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

const emptyForm = {
  title: "",
  description: "",
  type: "offer" as ListingType,
  price: 0,
  tags: "",
};

const CreateListingModal = ({ open, onClose, onCreated }: CreateListingModalProps) => {
  const { t } = useTranslation();
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: CreateListingDto = {
        title: form.title.trim(),
        description: form.description.trim(),
        type: form.type,
        price: Number(form.price),
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };
      await createListing(body);
      setForm(emptyForm);
      onCreated();
      onClose();
    } catch {
      setError(t("createListing.error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-listing-title"
      onClick={onClose}
    >
      <div className="w-full max-w-lg rounded-box bg-base-100 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 id="create-listing-title" className="mb-4 text-2xl font-bold text-base-content">
          {t("createListing.title")}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("createListing.fieldTitle")}</span>
            <input
              type="text"
              required
              maxLength={300}
              className="input input-bordered"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("createListing.description")}</span>
            <textarea
              required
              rows={4}
              className="textarea textarea-bordered"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>

          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm font-medium">{t("createListing.type")}</span>
              <select
                className="select select-bordered"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as ListingType })}
              >
                <option value="offer">{t("createListing.typeOffer")}</option>
                <option value="request">{t("createListing.typeRequest")}</option>
              </select>
            </label>

            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm font-medium">{t("createListing.price")}</span>
              <input
                type="number"
                min={0}
                required
                className="input input-bordered"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("createListing.tags")}</span>
            <input
              type="text"
              className="input input-bordered"
              placeholder={t("createListing.tagsPlaceholder")}
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
          </label>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
              {t("createListing.cancel")}
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t("createListing.submitting") : t("createListing.submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateListingModal;

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { EventQueryDto, ListingQueryDto, UserResponseDto, VoteQueryDto } from "@repo/contracts";
import { getUserById, updateUser } from "../api-service/users.service";
import { getDistrictById } from "../api-service/districts.service";
import { getUserBalance } from "../api-service/transactions.service";
import { getListings } from "../api-service/listings.service";
import { getContracts } from "../api-service/contracts.service";
import { getEvents } from "../api-service/events.service";
import { getVotes } from "../api-service/votes.service";
import { formatPrice } from "../lib/format";
import { useDialog } from "../components/DialogProvider";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="text-sm text-neutral-800 dark:text-neutral-100">{value}</div>
    </div>
  );
}

const inputClass =
  "mt-1 h-10 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 text-sm outline-none focus:border-[color:var(--color-brand)]";

export default function Profile() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { alert } = useDialog();

  const [fullUser, setFullUser] = useState<UserResponseDto | null>(null);
  const [districtName, setDistrictName] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [stats, setStats] = useState({ listings: 0, contracts: 0, events: 0, votes: 0 });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const uid = user?.id;

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    getUserById(uid)
      .then((u) => {
        if (cancelled) return;
        setFullUser(u);
        setForm({ firstName: u.firstName, lastName: u.lastName, phone: u.phone ?? "", address: u.address ?? "" });
        if (u.districtId) {
          getDistrictById(u.districtId)
            .then((d) => !cancelled && setDistrictName(d.name))
            .catch(() => undefined);
        }
      })
      .catch(() => undefined);
    getUserBalance(uid)
      .then((r) => !cancelled && setBalance(r.balance))
      .catch(() => !cancelled && setBalance(null));
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const [listings, cProvider, cBenef, events, votes] = await Promise.all([
          getListings({ authorId: uid, limit: 1 } as ListingQueryDto),
          getContracts({ providerId: uid, limit: 1 }),
          getContracts({ beneficiaryId: uid, limit: 1 }),
          getEvents({ creatorId: uid, limit: 100 } as EventQueryDto),
          getVotes({ creatorId: uid, limit: 100 } as VoteQueryDto),
        ]);
        if (cancelled) return;
        setStats({
          listings: listings.total,
          contracts: cProvider.total + cBenef.total,
          events: events.length,
          votes: votes.length,
        });
      } catch {
        // stats are best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const copyId = useCallback(async () => {
    if (!uid) return;
    try {
      await navigator.clipboard.writeText(uid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be unavailable; ignore
    }
  }, [uid]);

  const save = async () => {
    if (!uid) return;
    setSaving(true);
    try {
      const updated = await updateUser(uid, {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        address: form.address || undefined,
      });
      setFullUser(updated);
      setEditing(false);
    } catch {
      await alert({ message: t("profile.saveError") });
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    if (fullUser) {
      setForm({
        firstName: fullUser.firstName,
        lastName: fullUser.lastName,
        phone: fullUser.phone ?? "",
        address: fullUser.address ?? "",
      });
    }
    setEditing(false);
  };

  if (!user) return <p className="text-neutral-500 dark:text-neutral-400">{t("common.loading")}</p>;

  const none = "—";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-extrabold text-neutral-900 dark:text-neutral-50">{t("profile.title")}</h1>

      {/* Identity */}
      <Card title={t("profile.identity.title")}>
        <p className="mb-2 text-sm text-neutral-500 dark:text-neutral-400">{t("profile.identity.desc")}</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 break-all rounded-lg bg-neutral-100 dark:bg-neutral-800 px-3 py-2 text-sm">
            {user.id}
          </code>
          <button
            onClick={copyId}
            className="shrink-0 rounded-lg bg-[color:var(--color-brand)] px-3 py-2 text-sm font-semibold text-white hover:bg-[color:var(--color-brand-dark)]"
          >
            {copied ? t("profile.identity.copied") : t("profile.identity.copy")}
          </button>
        </div>
      </Card>

      {/* Info */}
      <section className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">{t("profile.info.title")}</h2>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              {t("profile.info.edit")}
            </button>
          )}
        </div>
        {!editing ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Info label={t("profile.info.firstName")} value={fullUser?.firstName ?? user.firstName} />
            <Info label={t("profile.info.lastName")} value={fullUser?.lastName ?? user.lastName} />
            <Info label={t("profile.info.email")} value={fullUser?.email ?? user.email} />
            <Info label={t("profile.info.phone")} value={fullUser?.phone ?? none} />
            <Info label={t("profile.info.address")} value={fullUser?.address ?? none} />
            <Info
              label={t("profile.info.district")}
              value={districtName || (fullUser?.districtId ? t("common.loading") : none)}
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {t("profile.info.firstName")}
              </span>
              <input
                className={inputClass}
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {t("profile.info.lastName")}
              </span>
              <input
                className={inputClass}
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {t("profile.info.phone")}
              </span>
              <input
                className={inputClass}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {t("profile.info.address")}
              </span>
              <input
                className={inputClass}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-60"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-[color:var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--color-brand-dark)] disabled:opacity-60"
              >
                {saving ? t("profile.info.saving") : t("profile.info.save")}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Stats */}
      <Card title={t("profile.stats.title")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["listings", stats.listings],
              ["contracts", stats.contracts],
              ["events", stats.events],
              ["votes", stats.votes],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="rounded-lg bg-neutral-50 dark:bg-neutral-800 p-3 text-center">
              <div className="text-2xl font-extrabold text-neutral-900 dark:text-neutral-50">{value}</div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">{t(`profile.stats.${key}`)}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Points */}
      <Card title={t("profile.points.title")}>
        <p className="text-3xl font-extrabold text-[color:var(--color-brand)]">
          {formatPrice(balance ?? user.balance)}
        </p>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{t("profile.points.desc")}</p>
      </Card>
    </div>
  );
}

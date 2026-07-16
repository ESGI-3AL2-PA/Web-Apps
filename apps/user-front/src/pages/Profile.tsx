import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type {
  EventQueryDto,
  ListingQueryDto,
  TransactionResponseDto,
  UserResponseDto,
  VoteQueryDto,
} from "@repo/contracts";
import { getUserById, updateUser } from "../api-service/users.service";
import { getDistrictById } from "../api-service/districts.service";
import { getUserBalance, getUserTransactions } from "../api-service/transactions.service";
import { getListings } from "../api-service/listings.service";
import { getContracts } from "../api-service/contracts.service";
import { getEvents } from "../api-service/events.service";
import { getVotes } from "../api-service/votes.service";
import { formatDateTime, formatPrice } from "../lib/format";
import { useDialog } from "../components/dialog-context";

const HISTORY_PAGE_SIZE = 10;

function PointsHistory({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<TransactionResponseDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getUserTransactions(userId, { page, limit: HISTORY_PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        setItems((prev) => (page === 1 ? res.data : [...prev, ...res.data]));
        setTotal(res.total);
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [userId, page]);

  const hasMore = items.length < total;

  if (loading && items.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">{t("common.loading")}</p>;
  }
  if (error && items.length === 0) {
    return <p className="text-sm text-red-600">{t("profile.history.error")}</p>;
  }
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">{t("profile.history.empty")}</p>;
  }

  return (
    <div>
      <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {items.map((tx) => {
          const positive = tx.amount > 0;
          const sign = positive ? "+" : "";
          return (
            <li key={tx.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-50">
                  {t(`profile.history.type.${tx.type}`)}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {formatDateTime(tx.createdAt)}
                  {tx.refType && (
                    <>
                      {" · "}
                      {t(`profile.history.ref.${tx.refType}`)}
                      {tx.refId && ` · ${tx.refId.slice(0, 8)}`}
                    </>
                  )}
                </p>
              </div>
              <span
                className={`shrink-0 text-sm font-semibold ${
                  positive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {sign}
                {formatPrice(tx.amount)}
              </span>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-3 text-sm text-red-600">{t("profile.history.error")}</p>}
      {hasMore && (
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={loading}
          className="mt-4 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-60"
        >
          {loading ? t("common.loading") : t("profile.history.loadMore")}
        </button>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card border border-base-content/10 bg-base-100 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-base-content">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-base-content/60">{label}</div>
      <div className="text-sm text-base-content/80">{value}</div>
    </div>
  );
}

const inputClass = "input mt-1 w-full";

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
  const copyTimerRef = useRef<number | null>(null);

  const uid = user?.id;

  useEffect(
    () => () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    },
    [],
  );

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
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
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

  if (!user) return <p className="text-base-content/60">{t("common.loading")}</p>;

  const none = "—";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-extrabold text-base-content">{t("profile.title")}</h1>

      {/* Identity */}
      <Card title={t("profile.identity.title")}>
        <p className="mb-2 text-sm text-base-content/60">{t("profile.identity.desc")}</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 break-all rounded-lg bg-base-200 px-3 py-2 text-sm">{user.id}</code>
          <button onClick={copyId} className="btn btn-primary shrink-0">
            {copied ? t("profile.identity.copied") : t("profile.identity.copy")}
          </button>
        </div>
      </Card>

      {/* Info */}
      <section className="card border border-base-content/10 bg-base-100 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-base-content">{t("profile.info.title")}</h2>
          {!editing && (
            <button onClick={() => setEditing(true)} className="btn btn-soft btn-sm">
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
              <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                {t("profile.info.firstName")}
              </span>
              <input
                className={inputClass}
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                {t("profile.info.lastName")}
              </span>
              <input
                className={inputClass}
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                {t("profile.info.phone")}
              </span>
              <input
                className={inputClass}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                {t("profile.info.address")}
              </span>
              <input
                className={inputClass}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={cancelEdit} disabled={saving} className="btn btn-soft">
                {t("common.cancel")}
              </button>
              <button onClick={save} disabled={saving} className="btn btn-primary">
                {saving && <span className="loading loading-spinner loading-sm" />}
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
            <div key={key} className="rounded-lg bg-base-200 p-3 text-center">
              <div className="text-2xl font-extrabold text-base-content">{value}</div>
              <div className="text-xs text-base-content/60">{t(`profile.stats.${key}`)}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Points */}
      <Card title={t("profile.points.title")}>
        <p className="text-3xl font-extrabold text-primary">{formatPrice(balance ?? user.balance)}</p>
        <p className="mt-1 text-sm text-base-content/60">{t("profile.points.desc")}</p>
      </Card>

      {/* Points history */}
      <Card title={t("profile.history.title")}>
        {uid ? (
          <PointsHistory userId={uid} />
        ) : (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{t("common.loading")}</p>
        )}
      </Card>
    </div>
  );
}

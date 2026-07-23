// Page de gestion des utilisateurs du quartier actif : consultation (solde + transactions
// récentes), envoi d'un lien de réinitialisation de mot de passe, exclusion du quartier,
// bannissement/débannissement, et promotion/rétrogradation en administrateur de quartier
// (superAdmin uniquement, sur le quartier en scope).
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@repo/hooks";
import type { TransactionResponseDto, UserBalanceResponseDto, UserResponseDto } from "@repo/contracts";
import { useScopedList } from "../../hooks/useScopedList";
import { banUser, kickFromDistrict, listUsers, requestPasswordReset } from "../../api-service/users";
import { createDistrictAdmin, deleteDistrictAdmin, listDistrictAdmins } from "../../api-service/district-admins";
import { getUserBalance, getUserTransactions } from "../../api-service/transactions";
import { DataTable, type Column } from "../../components/DataTable";
import { RowActionButton } from "../../components/RowActionButton";
import { Pagination } from "../../components/Pagination";
import { Toolbar } from "../../components/Toolbar";
import { StatusBadge } from "../../components/StatusBadge";
import { FormModal } from "../../components/FormModal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { useDistrictScope } from "../../app/DistrictScopeProvider";
import { formatDate, formatTokens } from "../../lib/format";

export default function UsersList() {
  const { t } = useTranslation();
  const list = useScopedList<UserResponseDto>(listUsers);
  const toast = useToast();
  const { user: me } = useAuth();
  const scope = useDistrictScope();
  const ban = useAsyncAction();
  const reset = useAsyncAction();
  const kick = useAsyncAction();
  const promote = useAsyncAction();
  const demote = useAsyncAction();
  const [viewing, setViewing] = useState<UserResponseDto | null>(null);
  const [banning, setBanning] = useState<UserResponseDto | null>(null);
  const [resetting, setResetting] = useState<UserResponseDto | null>(null);
  const [kicking, setKicking] = useState<UserResponseDto | null>(null);
  const [promoting, setPromoting] = useState<UserResponseDto | null>(null);
  const [demoting, setDemoting] = useState<UserResponseDto | null>(null);
  // userId -> id d'attribution, pour le quartier actif uniquement (voir loadAssignments).
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  // La promotion confère les droits d'administrateur de quartier : réservée au superAdmin (même
  // règle que la page /district-admins) et nécessite un quartier actif auquel rattacher l'attribution.
  const canPromote = me?.role === "superAdmin" && !!scope.districtId;

  // Recense les admins de ce quartier promus via une ligne d'attribution — les seuls que cette page
  // peut rétrograder. Chargé par quartier plutôt que par ligne pour tenir en une seule requête.
  const loadAssignments = useCallback(async () => {
    if (!canPromote) return setAssignments({});
    const res = await listDistrictAdmins({ page: 1, limit: 100, districtId: scope.districtId! });
    setAssignments(Object.fromEntries(res.data.map((a) => [a.userId, a.id])));
  }, [canPromote, scope.districtId]);

  useEffect(() => {
    void loadAssignments().catch(() => setAssignments({}));
  }, [loadAssignments]);

  const columns: Column<UserResponseDto>[] = [
    { header: t("common.fields.name"), cell: (u) => `${u.firstName} ${u.lastName}` },
    { header: t("common.fields.email"), cell: (u) => u.email },
    { header: t("common.fields.role"), cell: (u) => <StatusBadge value={u.role} /> },
    { header: t("common.fields.status"), cell: (u) => <StatusBadge value={u.banned ? "banned" : "active"} /> },
    { header: t("common.fields.balance"), cell: (u) => formatTokens(u.balance) },
    { header: t("common.fields.verified"), cell: (u) => (u.emailVerified ? "✓" : "—") },
    { header: t("common.fields.created"), cell: (u) => formatDate(u.createdAt) },
  ];

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{t("users.title")}</h1>

      <Toolbar search={list.search} onSearchChange={list.setSearch} searchPlaceholder={t("users.searchPlaceholder")} />

      <DataTable
        columns={columns}
        rows={list.items}
        rowKey={(u) => u.id}
        loading={list.loading}
        error={list.error}
        actions={(u) => (
          <div className="flex justify-end gap-1">
            <RowActionButton icon="icon-[tabler--eye]" label={t("common.actions.view")} onClick={() => setViewing(u)} />
            {u.role === "user" && (
              <>
                <RowActionButton
                  icon="icon-[tabler--key]"
                  label={t("users.resetPassword")}
                  onClick={() => setResetting(u)}
                />
                {u.districtId && (
                  <RowActionButton
                    icon="icon-[tabler--user-off]"
                    label={t("users.kick")}
                    variant="btn-warning"
                    onClick={() => setKicking(u)}
                  />
                )}
                <RowActionButton
                  icon={u.banned ? "icon-[tabler--lock-open]" : "icon-[tabler--ban]"}
                  label={u.banned ? t("users.unban") : t("users.ban")}
                  variant={u.banned ? undefined : "btn-error"}
                  onClick={() => setBanning(u)}
                />
                {canPromote && !u.banned && (
                  <RowActionButton
                    icon="icon-[tabler--arrow-up]"
                    label={t("users.promote")}
                    variant="btn-primary"
                    onClick={() => setPromoting(u)}
                  />
                )}
              </>
            )}
            {u.role === "admin" && u.id !== me?.id && assignments[u.id] && (
              <RowActionButton
                icon="icon-[tabler--arrow-down]"
                label={t("users.demote")}
                variant="btn-warning"
                onClick={() => setDemoting(u)}
              />
            )}
          </div>
        )}
      />
      <Pagination page={list.page} limit={list.limit} total={list.total} onPageChange={list.setPage} />

      {viewing && <UserView user={viewing} onClose={() => setViewing(null)} />}

      <ConfirmDialog
        open={!!resetting}
        title={t("users.sendReset")}
        message={t("users.resetMessage", { email: resetting?.email })}
        confirmLabel={t("users.sendLink")}
        busy={reset.busy}
        error={reset.error}
        onCancel={() => {
          setResetting(null);
          reset.reset();
        }}
        onConfirm={() =>
          reset.run(async () => {
            await requestPasswordReset(resetting!.email);
            toast.show(t("users.resetSent"));
            setResetting(null);
          })
        }
      />

      <ConfirmDialog
        open={!!kicking}
        title={t("users.kickTitle")}
        message={t("users.kickMessage", { email: kicking?.email })}
        confirmLabel={t("users.kick")}
        busy={kick.busy}
        error={kick.error}
        onCancel={() => {
          setKicking(null);
          kick.reset();
        }}
        onConfirm={() =>
          kick.run(async () => {
            await kickFromDistrict(kicking!.id);
            toast.show(t("users.kicked"));
            setKicking(null);
            list.refetch();
          })
        }
      />

      <ConfirmDialog
        open={!!promoting}
        title={t("users.promoteTitle")}
        message={t("users.promoteMessage", { email: promoting?.email, district: scope.districtName ?? "—" })}
        confirmLabel={t("users.promote")}
        busy={promote.busy}
        error={promote.error}
        onCancel={() => {
          setPromoting(null);
          promote.reset();
        }}
        onConfirm={() =>
          promote.run(async () => {
            await createDistrictAdmin({ districtId: scope.districtId!, userId: promoting!.id });
            toast.show(t("users.promoted"));
            setPromoting(null);
            await loadAssignments();
            list.refetch();
          })
        }
      />

      <ConfirmDialog
        open={!!demoting}
        title={t("users.demoteTitle")}
        message={t("users.demoteMessage", { email: demoting?.email, district: scope.districtName ?? "—" })}
        confirmLabel={t("users.demote")}
        busy={demote.busy}
        error={demote.error}
        onCancel={() => {
          setDemoting(null);
          demote.reset();
        }}
        onConfirm={() =>
          demote.run(async () => {
            await deleteDistrictAdmin(assignments[demoting!.id]);
            toast.show(t("users.demoted"));
            setDemoting(null);
            await loadAssignments();
            list.refetch();
          })
        }
      />

      <ConfirmDialog
        open={!!banning}
        title={banning?.banned ? t("users.unbanTitle") : t("users.banTitle")}
        message={
          banning?.banned
            ? t("users.unbanMessage", { email: banning?.email })
            : t("users.banMessage", { email: banning?.email })
        }
        confirmLabel={banning?.banned ? t("users.unban") : t("users.ban")}
        busy={ban.busy}
        error={ban.error}
        onCancel={() => {
          setBanning(null);
          ban.reset();
        }}
        onConfirm={() =>
          ban.run(async () => {
            const wasBanned = banning!.banned;
            await banUser(banning!.id, !wasBanned);
            toast.show(wasBanned ? t("users.unbanned") : t("users.banned"));
            setBanning(null);
            list.refetch();
          })
        }
      />
    </div>
  );
}

/**
 * Fiche de consultation d'un utilisateur : affiche ses informations, son solde à jour et ses
 * dix dernières transactions (chargés en parallèle au montage).
 */
function UserView({ user, onClose }: { user: UserResponseDto; onClose: () => void }) {
  const { t } = useTranslation();
  const scope = useDistrictScope();
  const [balance, setBalance] = useState<UserBalanceResponseDto | null>(null);
  const [txns, setTxns] = useState<TransactionResponseDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Charge solde et transactions en parallèle ; `cancelled` ignore la réponse si la modale ferme avant.
  useEffect(() => {
    let cancelled = false;
    Promise.all([getUserBalance(user.id), getUserTransactions(user.id, { page: 1, limit: 10 })])
      .then(([b, t]) => {
        if (cancelled) return;
        setBalance(b);
        setTxns(t.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message ?? err?.message ?? t("common.states.failedToLoad"));
      });
    return () => {
      cancelled = true;
    };
  }, [user.id, t]);

  return (
    <FormModal open title={`${user.firstName} ${user.lastName}`} onClose={onClose} readOnly size="lg">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Info label={t("common.fields.email")} value={user.email} />
        <Info label={t("common.fields.phone")} value={user.phone ?? "—"} />
        <Info label={t("common.fields.role")} value={t(`role.${user.role}`)} />
        <Info label={t("common.fields.status")} value={user.banned ? t("status.banned") : t("status.active")} />
        <Info label={t("common.fields.district")} value={scope.districtName ?? user.districtId ?? "—"} />
        <Info label={t("common.fields.address")} value={user.address ?? "—"} />
        <Info label={t("common.fields.balance")} value={formatTokens(balance?.balance ?? user.balance)} />
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
      <div>
        <h4 className="font-medium mt-2 mb-2">{t("users.recentTransactions")}</h4>
        {txns.length === 0 ? (
          <p className="text-sm text-base-content/60">{t("users.noTransactions")}</p>
        ) : (
          <ul className="divide-y divide-base-content/10">
            {txns.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-1.5 text-sm">
                <span>
                  <StatusBadge value={t.type} /> <span className="text-base-content/60">{t.refType ?? ""}</span>
                </span>
                <span className="font-medium">{formatTokens(t.amount)}</span>
                <span className="text-base-content/60">{formatDate(t.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FormModal>
  );
}

/** Paire libellé/valeur en lecture seule dans la fiche utilisateur. */
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-base-content/50">{label}</p>
      <p className="break-words">{value}</p>
    </div>
  );
}

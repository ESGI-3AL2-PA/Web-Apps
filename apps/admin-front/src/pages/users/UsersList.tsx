import { useEffect, useState } from "react";
import type { TransactionResponseDto, UserBalanceResponseDto, UserResponseDto } from "@repo/contracts";
import { useScopedList } from "../../hooks/useScopedList";
import { banUser, listUsers, requestPasswordReset } from "../../api-service/users";
import { getUserBalance, getUserTransactions } from "../../api-service/transactions";
import { DataTable, type Column } from "../../components/DataTable";
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
  const list = useScopedList<UserResponseDto>(listUsers);
  const toast = useToast();
  const ban = useAsyncAction();
  const reset = useAsyncAction();
  const [viewing, setViewing] = useState<UserResponseDto | null>(null);
  const [banning, setBanning] = useState<UserResponseDto | null>(null);
  const [resetting, setResetting] = useState<UserResponseDto | null>(null);

  const columns: Column<UserResponseDto>[] = [
    { header: "Name", cell: (u) => `${u.firstName} ${u.lastName}` },
    { header: "Email", cell: (u) => u.email },
    { header: "Role", cell: (u) => <StatusBadge value={u.role} /> },
    { header: "Status", cell: (u) => <StatusBadge value={u.banned ? "banned" : "active"} /> },
    { header: "Balance", cell: (u) => formatTokens(u.balance) },
    { header: "Verified", cell: (u) => (u.emailVerified ? "✓" : "—") },
    { header: "Created", cell: (u) => formatDate(u.createdAt) },
  ];

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Users</h1>

      <Toolbar search={list.search} onSearchChange={list.setSearch} searchPlaceholder="Search name or email…" />

      <DataTable
        columns={columns}
        rows={list.items}
        rowKey={(u) => u.id}
        loading={list.loading}
        error={list.error}
        actions={(u) => (
          <div className="flex justify-end gap-1">
            <button className="btn btn-xs btn-text" onClick={() => setViewing(u)}>
              View
            </button>
            {u.role === "user" && (
              <>
                <button className="btn btn-xs btn-text" onClick={() => setResetting(u)}>
                  Reset password
                </button>
                <button className={`btn btn-xs btn-text ${u.banned ? "" : "btn-error"}`} onClick={() => setBanning(u)}>
                  {u.banned ? "Unban" : "Ban"}
                </button>
              </>
            )}
          </div>
        )}
      />
      <Pagination page={list.page} limit={list.limit} total={list.total} onPageChange={list.setPage} />

      {viewing && <UserView user={viewing} onClose={() => setViewing(null)} />}

      <ConfirmDialog
        open={!!resetting}
        title="Send password reset"
        message={`Email a password reset link to ${resetting?.email}? They'll set a new password themselves.`}
        confirmLabel="Send link"
        busy={reset.busy}
        error={reset.error}
        onCancel={() => {
          setResetting(null);
          reset.reset();
        }}
        onConfirm={() =>
          reset.run(async () => {
            await requestPasswordReset(resetting!.email);
            toast.show("Password reset link sent");
            setResetting(null);
          })
        }
      />

      <ConfirmDialog
        open={!!banning}
        title={banning?.banned ? "Unban user" : "Ban user"}
        message={
          banning?.banned
            ? `Restore access for ${banning?.email}? They'll be able to log in again.`
            : `Ban ${banning?.email}? They'll be logged out and blocked from signing in.`
        }
        confirmLabel={banning?.banned ? "Unban" : "Ban"}
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
            toast.show(wasBanned ? "User unbanned" : "User banned");
            setBanning(null);
            list.refetch();
          })
        }
      />
    </div>
  );
}

function UserView({ user, onClose }: { user: UserResponseDto; onClose: () => void }) {
  const scope = useDistrictScope();
  const [balance, setBalance] = useState<UserBalanceResponseDto | null>(null);
  const [txns, setTxns] = useState<TransactionResponseDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getUserBalance(user.id), getUserTransactions(user.id, { page: 1, limit: 10 })])
      .then(([b, t]) => {
        if (cancelled) return;
        setBalance(b);
        setTxns(t.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message ?? err?.message ?? "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  return (
    <FormModal open title={`${user.firstName} ${user.lastName}`} onClose={onClose} readOnly size="lg">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Info label="Email" value={user.email} />
        <Info label="Phone" value={user.phone ?? "—"} />
        <Info label="Role" value={user.role} />
        <Info label="Status" value={user.banned ? "Banned" : "Active"} />
        <Info label="District" value={scope.districtName ?? user.districtId ?? "—"} />
        <Info label="Address" value={user.address ?? "—"} />
        <Info label="Balance" value={formatTokens(balance?.balance ?? user.balance)} />
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
      <div>
        <h4 className="font-medium mt-2 mb-2">Recent transactions</h4>
        {txns.length === 0 ? (
          <p className="text-sm text-base-content/60">No transactions</p>
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-base-content/50">{label}</p>
      <p className="break-words">{value}</p>
    </div>
  );
}

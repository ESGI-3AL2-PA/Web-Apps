import { useEffect, useState, type FormEvent } from "react";
import type { TransactionResponseDto, UpdateUserDto, UserBalanceResponseDto, UserResponseDto } from "@repo/contracts";
import { useScopedList } from "../../hooks/useScopedList";
import { deleteUser, listUsers, updateUser } from "../../api-service/users";
import { getUserBalance, getUserTransactions } from "../../api-service/transactions";
import { DataTable, type Column } from "../../components/DataTable";
import { Pagination } from "../../components/Pagination";
import { Toolbar } from "../../components/Toolbar";
import { StatusBadge } from "../../components/StatusBadge";
import { FormModal } from "../../components/FormModal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Field } from "../../components/Field";
import { useToast } from "../../components/Toast";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { useDistrictScope } from "../../app/DistrictScopeProvider";
import { formatDate, formatTokens } from "../../lib/format";

export default function UsersList() {
  const list = useScopedList<UserResponseDto>(listUsers);
  const toast = useToast();
  const del = useAsyncAction();
  const [viewing, setViewing] = useState<UserResponseDto | null>(null);
  const [editing, setEditing] = useState<UserResponseDto | null>(null);
  const [deleting, setDeleting] = useState<UserResponseDto | null>(null);

  const columns: Column<UserResponseDto>[] = [
    {
      header: "Name",
      cell: (u) => `${u.firstName} ${u.lastName}`,
    },
    { header: "Email", cell: (u) => u.email },
    { header: "Role", cell: (u) => <StatusBadge value={u.role} /> },
    { header: "Balance", cell: (u) => formatTokens(u.balance) },
    { header: "Verified", cell: (u) => (u.emailVerified ? "✓" : "—") },
    { header: "Created", cell: (u) => formatDate(u.createdAt) },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
      </div>
      <p className="text-sm text-base-content/60">
        Creating users is service-token only (handled by auth-service registration) — not available here.
      </p>

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
            <button className="btn btn-xs btn-text" onClick={() => setEditing(u)}>
              Edit
            </button>
            <button className="btn btn-xs btn-text btn-error" onClick={() => setDeleting(u)}>
              Delete
            </button>
          </div>
        )}
      />
      <Pagination page={list.page} limit={list.limit} total={list.total} onPageChange={list.setPage} />

      {viewing && <UserView user={viewing} onClose={() => setViewing(null)} />}
      {editing && (
        <UserEdit
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast.show("User updated");
            list.refetch();
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Delete user"
        message={`Permanently delete ${deleting?.email}? This cannot be undone.`}
        busy={del.busy}
        error={del.error}
        onCancel={() => {
          setDeleting(null);
          del.reset();
        }}
        onConfirm={() =>
          del.run(async () => {
            await deleteUser(deleting!.id);
            toast.show("User deleted");
            setDeleting(null);
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

function UserEdit({ user, onClose, onSaved }: { user: UserResponseDto; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone ?? "",
    address: user.address ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const body: UpdateUserDto = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone || undefined,
      address: form.address || undefined,
    };
    try {
      await updateUser(user.id, body);
      onSaved();
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e2?.response?.data?.message ?? e2?.message ?? "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal
      open
      title={`Edit ${user.email}`}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" required>
          <input
            className="input"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
        </Field>
        <Field label="Last name" required>
          <input
            className="input"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Email" required>
        <input
          type="email"
          className="input"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </Field>
      <Field label="Phone">
        <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </Field>
      <Field label="Address">
        <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </Field>
    </FormModal>
  );
}

import { useState, type FormEvent } from "react";
import type { CreateTransactionDto, TransactionResponseDto, TransactionType } from "@repo/contracts";
import { useList } from "../../hooks/useList";
import { createTransaction, listTransactions } from "../../api-service/transactions";
import { DataTable, type Column } from "../../components/DataTable";
import { Pagination } from "../../components/Pagination";
import { Toolbar } from "../../components/Toolbar";
import { StatusBadge } from "../../components/StatusBadge";
import { FormModal } from "../../components/FormModal";
import { Field } from "../../components/Field";
import { formatDate, shortId } from "../../lib/format";

const TYPES: TransactionType[] = ["credit", "debit", "transfer_in", "transfer_out"];

export default function TransactionsList() {
  const list = useList<TransactionResponseDto>(listTransactions);
  const [creating, setCreating] = useState(false);

  const columns: Column<TransactionResponseDto>[] = [
    { header: "User", cell: (t) => shortId(t.userId) },
    { header: "Type", cell: (t) => <StatusBadge value={t.type} /> },
    { header: "Amount", cell: (t) => <span className="font-medium">{t.amount}</span> },
    { header: "Ref", cell: (t) => (t.refType ? `${t.refType}${t.refId ? `:${shortId(t.refId)}` : ""}` : "—") },
    { header: "Date", cell: (t) => formatDate(t.createdAt) },
  ];

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Transactions</h1>
      <Toolbar
        filters={[
          {
            key: "type",
            label: "Type",
            value: list.filters.type ?? "",
            options: TYPES.map((t) => ({ value: t, label: t })),
            onChange: (v) => list.setFilter("type", v),
          },
        ]}
        actions={
          <div className="flex gap-2">
            <input
              className="input input-sm max-w-[12rem]"
              placeholder="Filter by user ID"
              defaultValue={list.filters.userId ?? ""}
              onBlur={(e) => list.setFilter("userId", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && list.setFilter("userId", e.currentTarget.value)}
            />
            <button className="btn btn-sm btn-primary" onClick={() => setCreating(true)}>
              <span className="icon-[tabler--plus] size-4" /> Manual entry
            </button>
          </div>
        }
      />
      <DataTable columns={columns} rows={list.items} rowKey={(t) => t.id} loading={list.loading} error={list.error} />
      <Pagination page={list.page} limit={list.limit} total={list.total} onPageChange={list.setPage} />

      {creating && (
        <TransactionCreate
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            list.refetch();
          }}
        />
      )}
    </div>
  );
}

type Mode = "credit" | "debit" | "transfer";

function TransactionCreate({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<Mode>("credit");
  const [fromUserId, setFromUserId] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isInteger(amt) || amt <= 0) {
      setError("Amount must be a positive integer");
      return;
    }
    const body: CreateTransactionDto = { amount: amt, refType: "manual" };
    if (mode === "credit") body.toUserId = toUserId;
    else if (mode === "debit") body.fromUserId = fromUserId;
    else {
      body.fromUserId = fromUserId;
      body.toUserId = toUserId;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createTransaction(body);
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
      title="Manual transaction"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
      submitLabel="Create"
    >
      <Field label="Type">
        <select className="select" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
          <option value="credit">Credit (system → user)</option>
          <option value="debit">Debit (user → system)</option>
          <option value="transfer">Transfer (user → user)</option>
        </select>
      </Field>
      {(mode === "debit" || mode === "transfer") && (
        <Field label="From user ID" required>
          <input className="input" value={fromUserId} onChange={(e) => setFromUserId(e.target.value)} required />
        </Field>
      )}
      {(mode === "credit" || mode === "transfer") && (
        <Field label="To user ID" required>
          <input className="input" value={toUserId} onChange={(e) => setToUserId(e.target.value)} required />
        </Field>
      )}
      <Field label="Amount" required>
        <input
          type="number"
          min={1}
          className="input"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </Field>
    </FormModal>
  );
}

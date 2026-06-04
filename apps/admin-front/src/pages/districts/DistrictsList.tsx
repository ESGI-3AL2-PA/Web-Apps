import { useState, type FormEvent } from "react";
import type { CreateDistrictDto, DistrictResponseDto, GeoJson, UpdateDistrictDto } from "@repo/contracts";
import { useList } from "../../hooks/useList";
import { createDistrict, deleteDistrict, listDistricts, updateDistrict } from "../../api-service/districts";
import { DataTable, type Column } from "../../components/DataTable";
import { Pagination } from "../../components/Pagination";
import { Toolbar } from "../../components/Toolbar";
import { FormModal } from "../../components/FormModal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Field } from "../../components/Field";

export default function DistrictsList() {
  const list = useList<DistrictResponseDto>(listDistricts);
  const [editing, setEditing] = useState<DistrictResponseDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<DistrictResponseDto | null>(null);

  const columns: Column<DistrictResponseDto>[] = [
    { header: "Name", cell: (d) => d.name },
    { header: "GeoJSON", cell: (d) => (d.geoJson ? d.geoJson.type : "—") },
    { header: "ID", cell: (d) => <span className="text-xs text-base-content/50">{d.id}</span> },
  ];

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Districts</h1>
      <Toolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search districts…"
        actions={
          <button className="btn btn-sm btn-primary" onClick={() => setEditing("new")}>
            <span className="icon-[tabler--plus] size-4" /> New district
          </button>
        }
      />
      <DataTable
        columns={columns}
        rows={list.items}
        rowKey={(d) => d.id}
        loading={list.loading}
        error={list.error}
        actions={(d) => (
          <div className="flex justify-end gap-1">
            <button className="btn btn-xs btn-text" onClick={() => setEditing(d)}>
              Edit
            </button>
            <button className="btn btn-xs btn-text btn-error" onClick={() => setDeleting(d)}>
              Delete
            </button>
          </div>
        )}
      />
      <Pagination page={list.page} limit={list.limit} total={list.total} onPageChange={list.setPage} />

      {editing && (
        <DistrictEdit
          district={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.refetch();
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Delete district"
        message={`Delete district "${deleting?.name}"?`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteDistrict(deleting.id);
          setDeleting(null);
          list.refetch();
        }}
      />
    </div>
  );
}

function DistrictEdit({
  district,
  onClose,
  onSaved,
}: {
  district: DistrictResponseDto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(district?.name ?? "");
  const [geoJsonText, setGeoJsonText] = useState(district?.geoJson ? JSON.stringify(district.geoJson, null, 2) : "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    let geoJson: GeoJson | undefined;
    if (geoJsonText.trim()) {
      try {
        geoJson = JSON.parse(geoJsonText) as GeoJson;
      } catch {
        setError("GeoJSON is not valid JSON");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (district) {
        const body: UpdateDistrictDto = { name, geoJson };
        await updateDistrict(district.id, body);
      } else {
        const body: CreateDistrictDto = { name, geoJson };
        await createDistrict(body);
      }
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
      title={district ? `Edit ${district.name}` : "New district"}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
    >
      <Field label="Name" required>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="GeoJSON" hint="Optional. Raw GeoJSON geometry object.">
        <textarea
          className="textarea font-mono text-xs"
          rows={8}
          value={geoJsonText}
          placeholder='{ "type": "Polygon", "coordinates": [...] }'
          onChange={(e) => setGeoJsonText(e.target.value)}
        />
      </Field>
    </FormModal>
  );
}

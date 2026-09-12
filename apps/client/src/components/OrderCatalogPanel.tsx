import { Archive, Pencil, Plus, RotateCcw, Save, X } from "lucide-react";
import type { ReactNode } from "react";
import { useAdminOrders } from "../hooks";
import type { CatalogOrder } from "../types";

const categories: CatalogOrder["category"][] = [
  "Medication",
  "Laboratory",
  "Imaging",
  "Other Tests",
  "Procedure",
  "Monitoring",
  "Consultation",
  "Counseling"
];

export function OrderCatalogPanel() {
  const {
    ordersQuery,
    draft,
    editingId,
    saveOrder,
    toggleOrder,
    updateDraft,
    editOrder,
    resetEditor
  } = useAdminOrders();

  return (
    <section className="w-full max-w-[1250px] px-[34px] py-7">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold">Order catalog</h1>
          <p className="text-[13px] text-[#60717d]">
            Define each searchable clinical order once. Cases will configure its patient-specific behavior.
          </p>
        </div>
        <button
          className="flex items-center gap-2 border border-[#193c50] bg-[#1e465e] px-3 py-2 text-sm text-white"
          onClick={resetEditor}
        >
          <Plus size={16} /> New order
        </button>
      </div>

      <form
        className="mb-5 border border-[#aab5bc] bg-white p-5"
        onSubmit={(event) => {
          event.preventDefault();
          saveOrder.mutate();
        }}
      >
        <div className="mb-4 flex items-center justify-between border-b border-[#d0d7db] pb-3">
          <h2 className="text-sm font-bold text-[#1e465e]">
            {editingId ? `Edit ${editingId}` : "Create catalog order"}
          </h2>
          {editingId && (
            <button type="button" title="Cancel editing" onClick={resetEditor}>
              <X size={17} />
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <CatalogField label="Order ID">
            <input
              required
              disabled={Boolean(editingId)}
              value={draft.id}
              onChange={(event) => updateDraft("id", event.target.value)}
              className="h-9 border border-[#9eabb3] px-2 disabled:bg-[#edf0f2]"
              placeholder="normal-saline"
            />
          </CatalogField>
          <CatalogField label="Display name">
            <input required value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} className="h-9 border border-[#9eabb3] px-2" />
          </CatalogField>
          <CatalogField label="Category">
            <select value={draft.category} onChange={(event) => updateDraft("category", event.target.value as CatalogOrder["category"])} className="h-9 border border-[#9eabb3] px-2">
              {categories.map((category) => <option key={category}>{category}</option>)}
            </select>
          </CatalogField>
          <CatalogField label="Aliases (comma separated)">
            <input value={draft.aliases} onChange={(event) => updateDraft("aliases", event.target.value)} className="h-9 border border-[#9eabb3] px-2" />
          </CatalogField>
          <CatalogField label="Routes (comma separated)">
            <input value={draft.route} onChange={(event) => updateDraft("route", event.target.value)} className="h-9 border border-[#9eabb3] px-2" />
          </CatalogField>
          <CatalogField label="Doses (comma separated)">
            <input value={draft.dose} onChange={(event) => updateDraft("dose", event.target.value)} className="h-9 border border-[#9eabb3] px-2" />
          </CatalogField>
          <CatalogField label="Frequencies (comma separated)">
            <input value={draft.frequency} onChange={(event) => updateDraft("frequency", event.target.value)} className="h-9 border border-[#9eabb3] px-2" />
          </CatalogField>
          <CatalogField label="Durations (comma separated)">
            <input value={draft.duration} onChange={(event) => updateDraft("duration", event.target.value)} className="h-9 border border-[#9eabb3] px-2" />
          </CatalogField>
          <CatalogField label="Priorities (comma separated)">
            <input value={draft.priority} onChange={(event) => updateDraft("priority", event.target.value)} className="h-9 border border-[#9eabb3] px-2" />
          </CatalogField>
          <CatalogField label="Default processing minutes">
            <input type="number" min={0} value={draft.resultDelayMinutes} onChange={(event) => updateDraft("resultDelayMinutes", event.target.value)} className="h-9 border border-[#9eabb3] px-2" />
          </CatalogField>
        </div>
        {(saveOrder.error || toggleOrder.error) && (
          <p className="mt-3 text-xs text-red-700">{(saveOrder.error ?? toggleOrder.error)?.message}</p>
        )}
        <div className="mt-4 flex justify-end">
          <button disabled={saveOrder.isPending} className="flex items-center gap-2 border border-[#193c50] bg-[#1e465e] px-5 py-2 text-sm font-bold text-white">
            <Save size={15} /> {saveOrder.isPending ? "Saving..." : "Save order"}
          </button>
        </div>
      </form>

      <div className="border border-[#aab5bc] bg-white">
        <div className="grid h-[34px] grid-cols-[1.5fr_1fr_1.3fr_.7fr_150px] items-center border-b border-[#aab5bc] bg-[#d7e0e5] px-3.5 text-[11px] font-bold">
          <span>Order</span><span>Category</span><span>Aliases</span><span>Status</span><span>Actions</span>
        </div>
        {ordersQuery.isLoading && <p className="p-6 text-center text-sm text-[#60717d]">Loading catalog...</p>}
        {ordersQuery.data?.orders.map((order) => (
          <div key={order.id} className="grid min-h-[58px] grid-cols-[1.5fr_1fr_1.3fr_.7fr_150px] items-center border-b border-[#e0e5e8] px-3.5 text-xs">
            <span className="grid"><strong>{order.name}</strong><small className="text-[#6b7a83]">{order.id}</small></span>
            <span>{order.category}</span>
            <span className="truncate pr-3" title={order.aliases.join(", ")}>{order.aliases.join(", ") || "-"}</span>
            <span className={order.active ? "font-bold text-[#397a5c]" : "text-[#7b5555]"}>{order.active ? "Active" : "Archived"}</span>
            <span className="flex gap-2">
              <button title="Edit order" className="border border-[#8998a1] bg-[#f6f7f8] p-1.5" onClick={() => editOrder(order)}><Pencil size={14} /></button>
              <button
                title={order.active ? "Archive order" : "Restore order"}
                className="border border-[#8998a1] bg-[#f6f7f8] p-1.5"
                onClick={() => toggleOrder.mutate({ id: order.id, active: !order.active })}
              >
                {order.active ? <Archive size={14} /> : <RotateCcw size={14} />}
              </button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function CatalogField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1 text-xs font-bold">{label}{children}</label>;
}

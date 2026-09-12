import { Archive, Check, Edit3, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAdminCases, useSession } from "../../hooks";
import type { AdminCase } from "../../types";

import { defineAbility, caseSubject } from "@ccs/domain";

const actionClass = "inline-flex min-h-8 items-center gap-1 border border-[#8998a1] bg-[#f6f7f8] px-2 text-xs disabled:opacity-45";
const label = (status: string) => status === "published" ? "Published" : status === "retired" ? "Retired" : "Draft";

export function CaseWorkflowTable({ cases, onEdit }: { cases: AdminCase[]; currentUserId?: string; onEdit: (entry: AdminCase) => void }) {
  const workflow = useAdminCases();
  const session = useSession();
  const ability = defineAbility(session.data?.user?.role);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [deleting, setDeleting] = useState<AdminCase | null>(null);
  const visible = cases.filter(entry => (status === "all" || label(entry.status) === status) &&
    (entry.title + " " + entry.specialty + " " + entry.slug).toLowerCase().includes(search.toLowerCase()));
  const error = workflow.publishCase.error ?? workflow.retireCase.error ?? workflow.deleteCase.error;
  const busy = workflow.publishCase.isPending || workflow.retireCase.isPending || workflow.deleteCase.isPending;
  return <>
    <div className="mb-4 flex flex-wrap gap-2">
      <input aria-label="Search cases" className="h-10 w-full border border-[#9eabb3] bg-white px-3 text-sm sm:w-80" placeholder="Search cases" value={search} onChange={event => setSearch(event.target.value)} />
      <select aria-label="Case status" className="h-10 border border-[#9eabb3] bg-white px-3 text-sm" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option>{["Draft", "Published", "Retired"].map(value => <option key={value}>{value}</option>)}</select>
    </div>
    {error && <p role="alert" className="mb-3 border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error.message}</p>}
    <div className="overflow-x-auto border border-[#aab5bc] bg-white"><table className="w-full text-left text-sm">
      <thead className="bg-[#d7e0e5]"><tr>{["Case", "Status", "Updated", "Actions"].map(value => <th className="p-3" key={value}>{value}</th>)}</tr></thead>
      <tbody>{visible.map(entry => <tr key={entry.id} className="border-t border-[#e0e5e8]">
        <td className="p-3"><strong>{entry.title}</strong><small className="block text-[#6b7a83]">{entry.specialty} | {entry.slug}</small></td>
        <td className={"p-3 font-bold " + (entry.status === "published" ? "text-green-700" : "text-[#46555f]")}>{label(entry.status)}</td>
        <td className="p-3">{entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString() : ""}</td>
        <td className="p-3"><div className="flex flex-wrap gap-2">
          {ability.can("update", caseSubject(entry.status)) && <button className={actionClass} disabled={busy} onClick={() => onEdit(entry)}><Edit3 size={14} />Edit</button>}
          {ability.can("publish", "Case") && entry.status !== "published" && <button className={actionClass} disabled={busy} onClick={() => { workflow.retireCase.reset(); workflow.deleteCase.reset(); workflow.publishCase.mutate(entry.id); }}><Check size={14} />Publish</button>}
          {ability.can("retire", "Case") && entry.status === "published" && <button className={actionClass} disabled={busy} onClick={() => { workflow.publishCase.reset(); workflow.deleteCase.reset(); workflow.retireCase.mutate(entry.id); }}><Archive size={14} />Retire</button>}
          {ability.can("delete", "Case") && <button className={actionClass + " text-red-700"} disabled={busy} onClick={() => { workflow.deleteCase.reset(); setDeleting(entry); }}><Trash2 size={14} />Delete</button>}
        </div></td>
      </tr>)}{!visible.length && <tr><td colSpan={4} className="p-8 text-center text-[#60717d]">No matching cases.</td></tr>}</tbody>
    </table></div>
    {deleting && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><section role="dialog" aria-modal="true" aria-labelledby="delete-case-title" className="w-full max-w-md border border-[#aab5bc] bg-white p-5">
      <h2 id="delete-case-title" className="text-lg font-bold">Delete {deleting.title}?</h2>
      <p className="my-4 text-sm">The case will be removed from both libraries. Existing student attempts and results will be retained.</p>
      {workflow.deleteCase.error && <p role="alert" className="mb-3 text-sm text-red-700">{workflow.deleteCase.error.message}</p>}
      <div className="flex justify-end gap-2"><button className={actionClass} disabled={busy} onClick={() => setDeleting(null)}>Cancel</button><button className={actionClass + " text-red-700"} disabled={busy} onClick={() => workflow.deleteCase.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}><Trash2 size={14} />{busy ? "Deleting..." : "Delete case"}</button></div>
    </section></div>}
  </>;
}

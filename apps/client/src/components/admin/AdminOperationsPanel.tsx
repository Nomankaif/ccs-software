import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, RefreshCw, UserPlus, X, Pause, Play, Trash2 } from "lucide-react";
import { api } from "../../api";
import { AnalyticsChart } from "./AnalyticsChart";
import { useSession } from "../../hooks";

type User = { _id: string; email: string; role: string; createdAt: string; paused?: boolean };
type Event = { _id: string; action: string; resource: string; actorEmail: string; createdAt: string; status?: number; source: string };
type Page = { total: number; page: number; pageSize: number };
type Analytics = { days: number; users: number; publishedCases: number; statuses: { _id: string; count: number }[];
  cases: { _id: string; title: string; version?: number; attempts: number; completed: number; averageScore: number | null }[] };
const inputClass = "border border-[#a8b3ba] bg-white p-2 text-sm min-w-0";
const buttonClass = "inline-flex items-center justify-center gap-2 border border-[#8998a1] bg-white px-3 py-2 text-sm disabled:opacity-50";
const date = (value: string) => new Date(value).toLocaleString();

function Pager({ total, page, pageSize, change }: Page & { change: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <div className="mt-4 flex items-center justify-between gap-3 text-sm">
    <span>{total} records · Page {page} of {pages}</span>
    <div className="flex gap-2"><button className={buttonClass} title="Previous page" aria-label="Previous page" disabled={page <= 1} onClick={() => change(page - 1)}><ChevronLeft size={16} /></button>
      <button className={buttonClass} title="Next page" aria-label="Next page" disabled={page >= pages} onClick={() => change(page + 1)}><ChevronRight size={16} /></button></div>
  </div>;
}

export function AdminOperationsPanel({ section }: { section: "Users" | "Employees" | "Analytics" | "Audit log" }) {
  const session = useSession();
  const [employeeAction, setEmployeeAction] = useState<{ user: User; action: "pause" | "resume" | "delete" } | null>(null);
  const accounts = section === "Users" || section === "Employees";
  const endpoint = section === "Employees" ? "employees" : "users";
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [days, setDays] = useState(30);
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newRole, setNewRole] = useState(section === "Employees" ? "writer" : "student");
  const [notice, setNotice] = useState("");
  const client = useQueryClient();
  const params = new URLSearchParams({ q: query, role, page: String(page) });
  const users = useQuery({ queryKey: ["admin-users", endpoint, query, role, page], queryFn: () => api<Page & { users: User[] }>(`/admin/${endpoint}?${params}`), enabled: accounts });
  const audit = useQuery({ queryKey: ["admin-audit", query, page], queryFn: () => api<Page & { events: Event[] }>(`/admin/audit?q=${encodeURIComponent(query)}&page=${page}`), enabled: section === "Audit log" });
  const analytics = useQuery({ queryKey: ["admin-analytics", days], queryFn: () => api<Analytics>(`/admin/analytics?days=${days}`), enabled: section === "Analytics" });
  const active = accounts ? users : section === "Analytics" ? analytics : audit;
  const create = useMutation({ mutationFn: () => api<{ user: User }>(`/admin/${endpoint}`, { method: "POST", body: JSON.stringify({ email, password, role: newRole }) }),
    onSuccess: (result) => { setCreating(false); setEmail(""); setPassword(""); setNotice(`Created ${result.user.email}`); void client.invalidateQueries({ queryKey: ["admin-users"] }); } });
  const changeEmployee = useMutation({
    mutationFn: ({ user, action }: { user: User; action: "pause" | "resume" | "delete" }) =>
      api(`/admin/employees/${user._id}${action === "delete" ? "" : "/status"}`, {
        method: action === "delete" ? "DELETE" : "PATCH",
        ...(action === "delete" ? {} : { body: JSON.stringify({ paused: action === "pause" }) })
      }),
    onSuccess: (_, { user, action }) => {
      setEmployeeAction(null);
      setNotice(`${user.email}: ${action === "delete" ? "deleted" : action === "pause" ? "paused" : "resumed"}.`);
      void client.invalidateQueries({ queryKey: ["admin-users"] });
    }
  });
  return <section className="w-full min-w-0 max-w-[1400px] p-4 md:p-7">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">{section}</h1>
      <div className="flex gap-2"><button className={buttonClass} title="Refresh" aria-label="Refresh" disabled={active.isFetching} onClick={() => void active.refetch()}><RefreshCw size={16} /></button>
        {accounts && <button className={buttonClass} onClick={() => { setCreating(true); create.reset(); }}><UserPlus size={16} />{section === "Employees" ? "New employee" : "New student"}</button>}</div></div>
    {notice && <p role="status" className="mb-4 border border-green-300 bg-green-50 p-3 text-sm">{notice}</p>}
    {section !== "Analytics" ? <form className="mb-4 flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); setQuery(search); setPage(1); }}>
      <input className={`${inputClass} w-full sm:w-80`} aria-label={accounts ? "Search email" : "Search audit events"} placeholder={accounts ? "Search email" : "Search actor, action or resource"} value={search} onChange={event => setSearch(event.target.value)} maxLength={200} />
      {section === "Employees" && <select className={inputClass} aria-label="Filter role" value={role} onChange={event => { setRole(event.target.value); setPage(1); }}><option value="">All roles</option><option value="admin">Admin</option><option value="subadmin">Sub-admin</option><option value="writer">Case writer</option></select>}
      <button className={buttonClass}>Search</button></form> : <label className="mb-4 flex items-center gap-3 text-sm">Attempts started in<select className={inputClass} value={days} onChange={event => setDays(Number(event.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last year</option></select></label>}
    {active.isPending && <p role="status">Loading...</p>}
    {active.error && <p role="alert" className="mb-4 border border-red-300 bg-red-50 p-3">{active.error.message}</p>}
    {accounts && users.data && <><div className="overflow-x-auto border border-[#a8b3ba]"><table className="w-full text-left text-sm"><thead className="bg-[#d8e1e6]"><tr><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Created</th>{section === "Employees" && <><th className="p-3">Status</th><th className="p-3">Actions</th></>}</tr></thead><tbody className="bg-white">{users.data.users.map(user => <tr key={user._id} className="border-t border-[#d8e1e6]"><td className="break-all p-3">{user.email}</td><td className="p-3">{({ admin: "Admin", subadmin: "Sub-admin", writer: "Case writer", student: "Student" } as Record<string, string>)[user.role] ?? user.role}</td><td className="p-3">{date(user.createdAt)}</td>{section === "Employees" && <>
      <td className={`p-3 font-medium ${user.paused ? "text-amber-800" : "text-green-700"}`}>{user.paused ? "Paused" : "Active"}</td>
      <td className="p-3">{user.role === "admin" ? <span className="text-xs text-[#60717d]">Protected admin</span> : user._id === session.data?.user?.id ? <span className="text-xs text-[#60717d]">Your account</span> : <div className="flex flex-wrap gap-2">
        <button className={buttonClass} disabled={changeEmployee.isPending} onClick={() => { changeEmployee.reset(); setEmployeeAction({ user, action: user.paused ? "resume" : "pause" }); }}>{user.paused ? <Play size={15} /> : <Pause size={15} />}{user.paused ? "Resume" : "Pause"}</button>
        <button className={buttonClass + " text-red-700"} disabled={changeEmployee.isPending} onClick={() => { changeEmployee.reset(); setEmployeeAction({ user, action: "delete" }); }}><Trash2 size={15} />Delete</button>
      </div>}</td></>}</tr>)}{!users.data.users.length && <tr><td colSpan={section === "Employees" ? 5 : 3} className="p-6 text-center">No matching users.</td></tr>}</tbody></table></div><Pager {...users.data} change={setPage} /></>}
    {section === "Audit log" && audit.data && <><p className="mb-3 text-sm text-[#60717d]">Case review history and administrative requests recorded since audit tracking was enabled.</p><div className="overflow-x-auto border border-[#a8b3ba]"><table className="w-full text-left text-sm"><thead className="bg-[#d8e1e6]"><tr>{["Time", "Actor", "Action", "Resource", "Status"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody className="bg-white">{audit.data.events.map(event => <tr key={`${event.source}-${event._id}`} className="border-t border-[#d8e1e6]"><td className="p-3">{date(event.createdAt)}</td><td className="break-all p-3">{event.actorEmail}</td><td className="p-3">{event.action}</td><td className="break-all p-3">{event.resource}</td><td className="p-3">{event.status ?? "Recorded"}</td></tr>)}{!audit.data.events.length && <tr><td colSpan={5} className="p-6 text-center">No matching audit events.</td></tr>}</tbody></table></div><Pager {...audit.data} change={setPage} /></>}
    {section === "Analytics" && analytics.data && <>
      <div className="mb-6 grid grid-cols-2 gap-4 border-y border-[#a8b3ba] py-4 lg:grid-cols-4">{[
        ["Registered users (all time)", analytics.data.users], ["Published case versions", analytics.data.publishedCases],
        ["Attempts in period", analytics.data.statuses.reduce((sum, item) => sum + item.count, 0)],
        ["Active / final orders", analytics.data.statuses.filter(item => ["active", "final_orders"].includes(item._id)).reduce((sum, item) => sum + item.count, 0)]
      ].map(([label, value]) => <div key={label}><p className="text-sm text-[#60717d]">{label}</p><p className="text-2xl font-bold">{value}</p></div>)}</div>
      <AnalyticsChart cases={analytics.data.cases} />
      <div className="overflow-x-auto border border-[#a8b3ba]"><table className="w-full text-left text-sm"><thead className="bg-[#d8e1e6]"><tr>{["Case version", "Attempts", "Finished / expired", "Average final score"].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody className="bg-white">{analytics.data.cases.map(item => <tr key={item._id} className="border-t border-[#d8e1e6]"><td className="p-3">{item.title || "Untitled case"}{item.version ? ` v${item.version}` : ""}<span className="block text-xs text-[#60717d]">{item._id}</span></td><td className="p-3">{item.attempts}</td><td className="p-3">{item.completed}</td><td className="p-3">{item.averageScore == null ? "No scored attempts" : `${item.averageScore.toFixed(1)} / 100`}</td></tr>)}{!analytics.data.cases.length && <tr><td colSpan={4} className="p-6 text-center">No attempts in this period.</td></tr>}</tbody></table></div>
    </>}
    {employeeAction && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><section role="dialog" aria-modal="true" aria-labelledby="employee-action-title" className="w-full max-w-md border border-[#a8b3ba] bg-white p-5">
      <h2 id="employee-action-title" className="text-lg font-bold">{employeeAction.action === "delete" ? "Delete employee?" : employeeAction.action === "pause" ? "Pause employee?" : "Resume employee?"}</h2>
      <p className="my-3 break-all text-sm">{employeeAction.user.email}</p>
      <p className="mb-4 text-sm">{employeeAction.action === "delete" ? "Access will be removed permanently. Authored cases and audit history will be retained." : employeeAction.action === "pause" ? "Access and existing sessions will be blocked until this employee is resumed." : "This employee can sign in again with their existing email and password."}</p>
      {changeEmployee.error && <p role="alert" className="mb-3 text-sm text-red-700">{changeEmployee.error.message}</p>}
      <div className="flex justify-end gap-2"><button className={buttonClass} disabled={changeEmployee.isPending} onClick={() => setEmployeeAction(null)}>Cancel</button><button className={buttonClass} disabled={changeEmployee.isPending} onClick={() => changeEmployee.mutate(employeeAction)}>{changeEmployee.isPending ? "Updating..." : employeeAction.action === "delete" ? "Delete employee" : employeeAction.action === "pause" ? "Pause employee" : "Resume employee"}</button></div>
    </section></div>}
    {creating && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><form role="dialog" aria-modal="true" aria-labelledby="new-user-title" className="w-full max-w-md border border-[#a8b3ba] bg-white p-5" onSubmit={event => { event.preventDefault(); create.mutate(); }}>
      <div className="mb-4 flex items-center justify-between"><h2 id="new-user-title" className="text-lg font-bold">{section === "Employees" ? "New employee" : "New student"}</h2><button type="button" title="Close" aria-label="Close" disabled={create.isPending} onClick={() => { setCreating(false); setPassword(""); }}><X size={20} /></button></div>
      <label className="mb-3 block text-sm">Email<input autoFocus required type="email" autoComplete="off" maxLength={254} className={`${inputClass} mt-1 w-full`} value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label className="mb-3 block text-sm">Password ({section === "Employees" ? 8 : 12} characters minimum)<input required type="password" autoComplete="new-password" minLength={section === "Employees" ? 8 : 12} maxLength={128} className={`${inputClass} mt-1 w-full`} value={password} onChange={event => setPassword(event.target.value)} /></label>
      {section === "Employees" && <label className="mb-4 block text-sm">Role<select className={`${inputClass} mt-1 w-full`} value={newRole} onChange={event => setNewRole(event.target.value)}><option value="subadmin">Sub-admin</option><option value="writer">Case writer</option></select></label>}
      {create.error && <p role="alert" className="mb-3 text-sm text-red-700">{create.error.message}</p>}
      <button className={buttonClass} disabled={create.isPending}><UserPlus size={16} />{create.isPending ? "Creating..." : "Create user"}</button>
    </form></div>}
  </section>;
}

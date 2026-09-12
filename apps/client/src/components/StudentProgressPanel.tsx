import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { api } from "../api";
import { useSession } from "../hooks";
import { isFinished, summarizePerformance, type AttemptSummary } from "../hooks/student-progress";

const control = "border border-[#9eabb3] bg-white px-3 py-2 text-sm disabled:opacity-50";
export function StudentProgressPanel({ section }: { section: "Attempt history" | "Performance" }) {
  const session = useSession();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [days, setDays] = useState(0);
  const query = useQuery({ queryKey: ["student-attempts", session.data?.user?.id], queryFn: () => api<{ attempts: AttemptSummary[] }>("/attempts"), refetchOnMount: "always" });
  const attempts = query.data?.attempts ?? [];
  const filtered = attempts.filter(item => (!status || item.status === status) && item.caseSnapshot.title.toLowerCase().includes(search.toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / 15));
  const currentPage = Math.min(page, pages);
  const summary = summarizePerformance(attempts.filter(item => !days || new Date(item.createdAt).getTime() >= Date.now() - days * 86400_000));
  return <section className="w-full min-w-0 max-w-[1250px] p-4 md:p-7">
    <div className="mb-6 flex items-center justify-between"><h1 className="text-2xl font-bold">{section}</h1><button className={control} aria-label="Refresh attempts" title="Refresh attempts" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw size={16} /></button></div>
    {query.isPending && <p role="status">Loading attempts...</p>}
    {query.error && <p role="alert" className="mb-4 border border-red-300 bg-red-50 p-3 text-red-800">{query.error.message}</p>}
    {query.data && (section === "Attempt history" ? <>
      <div className="mb-4 flex flex-wrap gap-2"><input className={`${control} w-full sm:w-80`} aria-label="Search attempts" placeholder="Search case title" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />
        <select aria-label="Attempt status" className={control} value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option><option value="active">Active</option><option value="final_orders">Final orders</option><option value="completed">Completed</option><option value="expired">Expired</option></select></div>
      <div className="overflow-x-auto border border-[#aab5bc]"><table className="w-full text-left text-sm"><thead className="bg-[#d7e0e5]"><tr>{["Case", "Started", "Status", "Simulated time", "Score", "Action"].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead>
        <tbody className="bg-white">{filtered.slice((currentPage - 1) * 15, currentPage * 15).map(item => <tr key={item._id} className="border-t border-[#d7e0e5]">
          <td className="p-3"><strong>{item.caseSnapshot.title}</strong><span className="block text-xs text-[#60717d]">{item.caseSnapshot.specialty}{item.caseSnapshot.version ? ` · v${item.caseSnapshot.version}` : ""}</span></td>
          <td className="p-3">{new Date(item.createdAt).toLocaleString()}</td><td className="p-3">{item.status.replace("_", " ")}</td><td className="p-3">{item.simulatedMinute} min</td><td className="p-3">{isFinished(item) && item.scoreReport ? `${item.scoreReport.total}/100` : "Not scored"}</td>
          <td className="p-3"><Link className="whitespace-nowrap text-[#1e465e] underline" to={`/attempts/${item._id}`}>{isFinished(item) ? "View report" : "Resume"}</Link></td>
        </tr>)}{!filtered.length && <tr><td className="p-8 text-center" colSpan={6}>No matching attempts.</td></tr>}</tbody></table></div>
      <div className="mt-4 flex items-center justify-between text-sm"><span>{filtered.length} attempts · Page {currentPage} of {pages}</span><div className="flex gap-2"><button className={control} title="Previous page" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} /></button><button className={control} title="Next page" aria-label="Next page" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16} /></button></div></div>
    </> : <>
      <label className="mb-5 flex items-center gap-3 text-sm">Attempts started<select className={control} value={days} onChange={event => setDays(Number(event.target.value))}><option value={0}>All time</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label>
      <div className="mb-6 grid grid-cols-2 gap-4 border-y border-[#aab5bc] py-4 lg:grid-cols-4">{[["Finished attempts", summary.finished], ["Scored attempts", summary.scored.length], ["Average score", summary.average == null ? "Not available" : `${summary.average.toFixed(1)}/100`], ["Best score", summary.best == null ? "Not available" : `${summary.best}/100`]].map(([label, value]) => <div key={label}><p className="text-sm text-[#60717d]">{label}</p><p className="text-xl font-bold">{value}</p></div>)}</div>
      <h2 className="mb-3 text-lg font-bold">Domain performance</h2>
      <div className="overflow-x-auto border border-[#aab5bc]"><table className="w-full text-left text-sm"><thead className="bg-[#d7e0e5]"><tr><th className="p-3">Domain</th><th className="p-3">Earned / possible points</th><th className="p-3">Scored attempts</th></tr></thead><tbody className="bg-white">{summary.domains.map(item => <tr className="border-t border-[#d7e0e5]" key={item.label}><td className="p-3">{item.label}</td><td className="p-3">{item.score} / {item.max}</td><td className="p-3">{item.attempts}</td></tr>)}{!summary.domains.length && <tr><td colSpan={3} className="p-6 text-center">No scored domain results yet.</td></tr>}</tbody></table></div>
      <h2 className="mb-3 mt-6 text-lg font-bold">Recent scores</h2><div className="divide-y divide-[#d7e0e5] border border-[#aab5bc] bg-white">{summary.scored.slice(0, 10).map(item => <Link className="flex items-center justify-between gap-4 p-3 text-sm hover:bg-[#e8eef1]" to={`/attempts/${item._id}`} key={item._id}><span>{item.caseSnapshot.title}<small className="block text-[#60717d]">{new Date(item.createdAt).toLocaleDateString()}</small></span><strong>{item.scoreReport!.total}/100</strong></Link>)}{!summary.scored.length && <p className="p-6 text-center text-sm">Complete a case to see your scores.</p>}</div>
    </>)}
  </section>;
}

import {
  BarChart3,
  ChevronRight,
  Clock3,
  LogOut,
  Stethoscope,
} from "lucide-react";
import { useCaseLibrary, useLogout } from "../hooks";

export function CaseLibrary() {
  const logout = useLogout();
  const { casesQuery: cases, startAttempt: start } = useCaseLibrary();
  return (
    
    <main className="min-h-screen bg-[#f1f3f4] text-[#18242b]">
      <header className="flex h-[58px] items-center justify-between border-b border-[#a8b3ba] bg-white px-6">
        <div className="flex items-center gap-2.5 text-base font-bold text-[#1e465e]">
          <Stethoscope size={22} />
          ClinSim CCS
        </div>
        <nav className="flex gap-2">
          <button
            className="flex items-center gap-1.5 p-2 text-sm text-[#46555f]"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <LogOut size={15} />
            {logout.isPending ? "Signing out..." : "Sign out"}
          </button>
        </nav>
      </header>
      <div className="grid min-h-[calc(100vh-58px)] grid-cols-[210px_1fr]">
        <aside className="bg-[#263f4e] p-3 pt-[18px]">
          <button className="mb-[3px] h-10 w-full bg-[#e8eef1] px-3.5 text-left text-sm font-bold text-[#193b50]">
            Case library
          </button>
          <button className="mb-[3px] h-10 w-full px-3.5 text-left text-sm text-[#dbe3e8]">
            Attempt history
          </button>
          <button className="h-10 w-full px-3.5 text-left text-sm text-[#dbe3e8]">
            Performance
          </button>
        </aside>
        <section className="w-full max-w-[1250px] px-[34px] py-7">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="mb-1 text-2xl font-bold">Case library</h1>
              <p className="text-[13px] text-[#60717d]">
                Practice clinical management under timed exam conditions.
              </p>
            </div>
            <div className="flex items-center gap-2.5 border-l-[3px] border-[#2c627f] bg-white px-[18px] py-3 shadow-sm">
              <BarChart3 size={20} />
              <span className="grid text-xs">
                <strong className="text-lg">
                  {cases.data?.cases.length ?? 0}
                </strong>
                cases available
              </span>
            </div>
          </div>
          <div className="mb-4 flex gap-2.5">
            <input
              className="h-[38px] w-[300px] border border-[#9eabb3] bg-white px-2.5"
              placeholder="Search cases"
            />
            <select className="h-[38px] w-[180px] border border-[#9eabb3] bg-white px-2.5">
              <option>All specialties</option>
            </select>
            <select className="h-[38px] w-[180px] border border-[#9eabb3] bg-white px-2.5">
              <option>All difficulties</option>
            </select>
          </div>
          <div className="border border-[#aab5bc] bg-white">
            <div className="grid h-[34px] grid-cols-[2fr_1fr_.8fr_.7fr_40px] items-center border-b border-[#aab5bc] bg-[#d7e0e5] px-3.5 text-[11px] font-bold text-[#3d4c55]">
              <span>Case</span>
              <span>Specialty</span>
              <span>Difficulty</span>
              <span>Time</span>
              <span />
            </div>
            {cases.isLoading && (
              <p className="p-8 text-center text-sm text-slate-500">
                Loading cases...
              </p>
            )}
            {cases.data?.cases.map((entry) => (
              <button
                key={entry.id}
                className="grid min-h-[66px] w-full grid-cols-[2fr_1fr_.8fr_.7fr_40px] items-center border-0 bg-white px-3.5 text-left text-xs text-[#26353d] hover:bg-[#f3f6f7]"
                onClick={() => start.mutate(entry.id)}
              >
                <span className="grid gap-1">
                  <strong>{entry.title}</strong>
                  <small className="text-[#6b7a83]">
                    {entry.opening.slice(0, 70)}...
                  </small>
                </span>
                <span>{entry.specialty}</span>
                <span>{entry.difficulty}</span>
                <span className="flex items-center gap-1">
                  <Clock3 size={14} />
                  {entry.durationMinutes} min
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
          {start.error && (
            <p className="mt-3 text-sm text-red-700">{start.error.message}</p>
          )}
        </section>
      </div>
    </main>
  );
}

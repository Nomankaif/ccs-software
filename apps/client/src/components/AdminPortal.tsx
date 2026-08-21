import {
  CheckCircle2,
  FileJson,
  FilePlus2,
  LogOut,
  Search,
  ShieldCheck,
  Upload,
} from "lucide-react";
import type { CaseDefinitionInput } from "@ccs/validation";
import { useAdminCaseEditor, useAdminCases, useLogout } from "../hooks";

export function AdminPortal() {
  const logout = useLogout();
  const {
    casesQuery: cases,
    createCase: create,
    publishCase: publish,
    retireCase: retire
  } = useAdminCases();
  const {
    isEditorOpen: editor,
    definition,
    validationError: jsonError,
    toggleEditor,
    closeEditor,
    updateField,
    updateJsonField,
    parseImportFile,
    validateDefinition
  } = useAdminCaseEditor();
  return (
    <main className="min-h-screen bg-[#f1f3f4] text-[#18242b]">
      <header className="flex h-[58px] items-center justify-between border-b border-[#a8b3ba] bg-white px-6">
        <div className="flex items-center gap-2.5 font-bold text-[#1e465e]">
          <ShieldCheck size={22} />
          ClinSim Administration
        </div>
        <button
          className="flex items-center gap-1.5 p-2 text-sm text-[#46555f]"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          <LogOut size={15} />
          {logout.isPending ? "Signing out..." : "Sign out"}
        </button>
      </header>
      <div className="grid min-h-[calc(100vh-58px)] grid-cols-[210px_1fr]">
        <aside className="bg-[#263f4e] p-3 pt-[18px]">
          {["Cases", "Order catalog", "Users", "Analytics", "Audit log"].map(
            (item, index) => (
              <button
                key={item}
                className={`mb-[3px] h-10 w-full px-3.5 text-left text-sm ${index === 0 ? "bg-[#e8eef1] font-bold text-[#193b50]" : "text-[#dbe3e8]"}`}
              >
                {item}
              </button>
            ),
          )}
        </aside>
        <section className="w-full max-w-[1250px] px-[34px] py-7">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="mb-1 text-2xl font-bold">Case management</h1>
              <p className="text-[13px] text-[#60717d]">
                Create, validate, preview, and publish clinical cases.
              </p>
            </div>
            <div className="flex gap-2">
              <label className="flex cursor-pointer items-center gap-2 border border-[#8998a1] bg-white px-3 py-2 text-sm">
                <Upload size={16} />
                Import JSON
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const parsed = await parseImportFile(file);
                    if (parsed) create.mutate(parsed, { onSuccess: closeEditor });
                  }}
                />
              </label>
              <button
                className="flex items-center gap-2 border border-[#193c50] bg-[#1e465e] px-3 py-2 text-sm text-white"
                onClick={toggleEditor}
              >
                <FilePlus2 size={16} />
                {editor ? "Close editor" : "New case"}
              </button>
            </div>
          </div>
          {jsonError && (
            <p className="mb-4 border border-red-300 bg-red-50 p-3 text-xs text-red-800">
              {jsonError}
            </p>
          )}
          {editor && (
            <form
              className="mb-6 border border-[#aab5bc] bg-white p-5"
              onSubmit={(event) => {
                event.preventDefault();
                const parsed = validateDefinition();
                if (parsed) create.mutate(parsed, { onSuccess: closeEditor });
              }}
            >
              <div className="mb-4 flex items-center gap-2 border-b border-[#d0d7db] pb-3 text-[#1e465e]">
                <FileJson size={18} />
                <h2 className="text-base font-bold">Guided case definition</h2>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  ["title", "Title"],
                  ["slug", "Slug"],
                  ["specialty", "Specialty"],
                ].map(([key, label]) => (
                  <label key={key} className="grid gap-1 text-xs font-bold">
                    {label}
                    <input
                      className="h-9 border border-[#9eabb3] px-2"
                      value={String(
                        definition[key as keyof CaseDefinitionInput],
                      )}
                      onChange={(e) =>
                        updateField(key as "title", e.target.value)
                      }
                    />
                  </label>
                ))}
                <label className="grid gap-1 text-xs font-bold">
                  Difficulty
                  <select
                    className="h-9 border border-[#9eabb3] px-2"
                    value={definition.difficulty}
                    onChange={(e) =>
                      updateField("difficulty", e.target.value as any)
                    }
                  >
                    <option>Beginner</option>
                    <option>Intermediate</option>
                    <option>Advanced</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-bold">
                  Case minutes
                  <input
                    className="h-9 border border-[#9eabb3] px-2"
                    type="number"
                    value={definition.durationMinutes}
                    onChange={(e) =>
                      updateField("durationMinutes", Number(e.target.value))
                    }
                  />
                </label>
                <label className="grid gap-1 text-xs font-bold">
                  Starting location
                  <select
                    className="h-9 border border-[#9eabb3] px-2"
                    value={definition.startingLocation}
                    onChange={(e) =>
                      updateField("startingLocation", e.target.value as any)
                    }
                  >
                    {definition.allowedLocations.map((location) => (
                      <option key={location}>{location}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="mt-4 grid gap-1 text-xs font-bold">
                Opening presentation
                <textarea
                  className="min-h-20 border border-[#9eabb3] p-2 font-normal"
                  value={definition.opening}
                  onChange={(e) => updateField("opening", e.target.value)}
                />
              </label>
              <label className="mt-4 grid gap-1 text-xs font-bold">
                Appearance
                <textarea
                  className="min-h-14 border border-[#9eabb3] p-2 font-normal"
                  value={definition.appearance}
                  onChange={(e) => updateField("appearance", e.target.value)}
                />
              </label>
              <div className="mt-4 grid grid-cols-2 gap-4">
                {(
                  [
                    "history",
                    "exam",
                    "orders",
                    "results",
                    "scoreRules",
                  ] as const
                ).map((key) => (
                  <label key={key} className="grid gap-1 text-xs font-bold">
                    {key}
                    <textarea
                      className="min-h-40 border border-[#9eabb3] p-2 font-mono text-[11px] font-normal"
                      value={JSON.stringify(definition[key], null, 2)}
                      onChange={(e) => updateJsonField(key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
              <label className="mt-4 grid gap-1 text-xs font-bold">
                Final feedback
                <textarea
                  className="min-h-20 border border-[#9eabb3] p-2 font-normal"
                  value={definition.feedback}
                  onChange={(e) => updateField("feedback", e.target.value)}
                />
              </label>
              <div className="mt-4 flex justify-end">
                <button
                  className="border border-[#193c50] bg-[#1e465e] px-5 py-2 text-sm font-bold text-white"
                  disabled={create.isPending}
                >
                  Save draft
                </button>
              </div>
            </form>
          )}
          <div className="mb-4 flex gap-2.5">
            <div className="relative">
              <Search
                className="absolute left-2.5 top-3 text-[#61717b]"
                size={15}
              />
              <input
                className="h-[38px] w-[300px] border border-[#9eabb3] bg-white pl-8"
                placeholder="Search cases"
              />
            </div>
            <select className="h-[38px] w-[180px] border border-[#9eabb3] bg-white px-2.5">
              <option>All statuses</option>
            </select>
          </div>
          <div className="border border-[#aab5bc] bg-white">
            <div className="grid h-[34px] grid-cols-[2fr_.8fr_.5fr_.8fr_190px] items-center border-b border-[#aab5bc] bg-[#d7e0e5] px-3.5 text-[11px] font-bold">
              <span>Case</span>
              <span>Status</span>
              <span>Version</span>
              <span>Updated</span>
              <span>Actions</span>
            </div>
            {cases.data?.cases.map((entry) => (
              <div
                key={entry.id}
                className="grid min-h-[66px] grid-cols-[2fr_.8fr_.5fr_.8fr_190px] items-center border-b border-[#e0e5e8] px-3.5 text-xs"
              >
                <span className="grid">
                  <strong>{entry.title}</strong>
                  <small className="text-[#6b7a83]">{entry.specialty}</small>
                </span>
                <span
                  className={
                    entry.status === "published"
                      ? "flex items-center gap-1 font-bold text-[#397a5c]"
                      : "capitalize"
                  }
                >
                  {entry.status === "published" && <CheckCircle2 size={14} />}{" "}
                  {entry.status}
                </span>
                <span>v{entry.version}</span>
                <span>
                  {entry.updatedAt
                    ? new Date(entry.updatedAt).toLocaleDateString()
                    : "Today"}
                </span>
                <span className="flex gap-2">
                  {entry.status === "draft" && (
                    <button
                      className="border border-[#8998a1] bg-[#f6f7f8] px-2 py-1"
                      onClick={() => publish.mutate(entry.id)}
                    >
                      Publish
                    </button>
                  )}
                  {entry.status === "published" && (
                    <button
                      className="border border-[#8998a1] bg-[#f6f7f8] px-2 py-1"
                      onClick={() => retire.mutate(entry.id)}
                    >
                      Retire
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

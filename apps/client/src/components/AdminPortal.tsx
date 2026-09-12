import { FilePlus2, LogOut, ShieldCheck, Upload } from "lucide-react";
import { useState } from "react";
import { defineAbility, type PermissionSubject } from "@ccs/domain";
import { useAdminCaseEditor, useAdminCases, useAdminOrderCatalog, useLogout, useSession } from "../hooks";
import { CaseWorkflowTable } from "./admin/CaseWorkflowTable";
import { GuidedCaseEditor } from "./admin/GuidedCaseEditor";
import { OrderCatalogPanel } from "./OrderCatalogPanel";
import { AdminOperationsPanel } from "./admin/AdminOperationsPanel";

export function AdminPortal() {
  const [section, setSection] = useState("Cases");
  const logout = useLogout();
  const session = useSession();
  const ability = defineAbility(session.data?.user?.role);
  const sections: Record<string, PermissionSubject> = { Analytics: "Analytics", Cases: "Case", "Order catalog": "Order", Users: "Student", Employees: "Employee", "Audit log": "Audit" };
  const catalog = useAdminOrderCatalog();
  const {
    casesQuery: cases,
    createCase: create,
    updateCase
  } = useAdminCases();
  const {
    isEditorOpen: editor,
    definition,
    validationError: jsonError,
    validationIssues,
    isDefinitionValid,
    editingCaseId,
    toggleEditor,
    editCase,
    closeEditor,
    updateField,
    updateJsonField,
    addCatalogOrder,
    parseImportFile,
    validateDefinition
  } = useAdminCaseEditor();
  return (
    <main className="grid h-dvh grid-rows-[58px_minmax(0,1fr)] overflow-hidden bg-[#f1f3f4] text-[#18242b]">
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
      <div className="grid min-h-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[210px_minmax(0,1fr)] md:grid-rows-1">
        <aside className="grid grid-cols-2 content-start bg-[#263f4e] p-3 md:block md:min-h-0 md:overflow-y-auto md:pt-[18px]">
          {Object.keys(sections).filter(item => ability.can("read", sections[item])).map(
            (item) => (
              <button
                key={item}
                aria-current={section === item ? "page" : undefined}
                onClick={() => setSection(item)}
                className={`mb-[3px] h-10 w-full px-3.5 text-left text-sm ${section === item ? "bg-[#e8eef1] font-bold text-[#193b50]" : "text-[#dbe3e8]"} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {item}
              </button>
            ),
          )}
        </aside>
        <div key={section} className="min-h-0 min-w-0 overflow-y-auto overscroll-contain" role="region" aria-label={`${section} content`} tabIndex={0}>
        {section === "Order catalog" ? <OrderCatalogPanel /> : section === "Users" || section === "Employees" || section === "Analytics" || section === "Audit log" ? <AdminOperationsPanel key={section} section={section} /> : <section className="w-full max-w-[1250px] px-[34px] py-7">
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
          {(create.error || updateCase.error) && (
            <p className="mb-4 border border-red-300 bg-red-50 p-3 text-xs text-red-800">
              {(create.error ?? updateCase.error)?.message}
            </p>
          )}
          {editor && (
            <GuidedCaseEditor
              definition={definition}
              updateField={updateField}
              updateJsonField={updateJsonField}
              catalogOrders={catalog.data?.orders ?? []}
              addCatalogOrder={addCatalogOrder}
              validationIssues={validationIssues}
              isValid={isDefinitionValid}
              saving={create.isPending || updateCase.isPending}
              saveLabel="Save draft"
              onSave={() => {
                const parsed = validateDefinition();
                if (!parsed) return;
                if (editingCaseId) {
                  updateCase.mutate({ id: editingCaseId, definition: parsed }, { onSuccess: closeEditor });
                } else {
                  create.mutate(parsed, { onSuccess: closeEditor });
                }
              }}
            />
          )}
          <CaseWorkflowTable cases={cases.data?.cases ?? []} currentUserId={session.data?.user?.id} onEdit={editCase} />
        </section>}
        </div>
      </div>
    </main>
  );
}

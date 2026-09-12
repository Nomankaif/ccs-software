import type { CaseDefinitionInput } from "@ccs/validation";
import { Activity, Clock3, MapPin, Play, RotateCcw, Stethoscope } from "lucide-react";
import { useMemo, useState } from "react";
import { useAdminCasePreview } from "../../hooks";

const fieldClass = "h-9 border border-[#9eabb3] bg-white px-2 text-xs";

export function CasePreviewConsole({ definition }: { definition: CaseDefinitionInput }) {
  const preview = useAdminCasePreview(definition);
  const [orderId, setOrderId] = useState(definition.orders[0]?.id ?? "");
  const [minutes, setMinutes] = useState(5);
  const [examSection, setExamSection] = useState(Object.keys(definition.exam)[0] ?? "");
  const order = useMemo(() => definition.orders.find((item) => item.id === orderId), [definition.orders, orderId]);
  const [qualifiers, setQualifiers] = useState<Record<string, string>>({});
  const state = preview.state;

  const placeOrder = () => {
    if (!order) return;
    preview.run({
      type: "PLACE_ORDER",
      orderId: order.id,
      route: qualifiers.route ?? order.route?.[0],
      dose: qualifiers.dose ?? order.dose?.[0],
      frequency: qualifiers.frequency ?? order.frequency?.[0],
      duration: qualifiers.duration ?? order.duration?.[0],
      priority: qualifiers.priority ?? order.priority?.[0]
    });
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between border-b border-[#c5cfd5] pb-3">
        <div>
          <h3 className="font-bold text-[#1e465e]">Engine preview console</h3>
          <p className="mt-1 text-xs text-[#61717b]">Runs the production simulation engine in memory. No student attempt is saved.</p>
        </div>
        <button type="button" className="flex items-center gap-1.5 border border-[#8998a1] bg-white px-3 py-2 text-xs" onClick={preview.reset}>
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      <div className="grid grid-cols-[1.4fr_.7fr_.7fr] gap-3 border border-[#aab5bc] bg-[#eef2f4] p-3">
        <div className="grid gap-2">
          <label className="text-xs font-bold">Place an order</label>
          <div className="flex gap-2">
            <select className={`${fieldClass} min-w-0 flex-1`} value={orderId} onChange={(event) => { setOrderId(event.target.value); setQualifiers({}); }}>
              {definition.orders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <button type="button" className="flex items-center gap-1.5 border border-[#1e465e] bg-[#1e465e] px-3 text-xs font-bold text-white" onClick={placeOrder} disabled={!order || preview.isPending}>
              <Play size={13} /> Place
            </button>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {(["route", "dose", "frequency", "duration", "priority"] as const).map((key) => order?.[key]?.length ? (
              <select key={key} title={key} aria-label={key} className={fieldClass} value={qualifiers[key] ?? order[key]?.[0]} onChange={(event) => setQualifiers((current) => ({ ...current, [key]: event.target.value }))}>
                {order[key]?.map((value) => <option key={value}>{value}</option>)}
              </select>
            ) : <span key={key} />)}
          </div>
        </div>
        <div className="grid content-start gap-2">
          <label className="text-xs font-bold">Advance simulated time</label>
          <div className="flex gap-2">
            <input className={`${fieldClass} w-20`} type="number" min={1} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
            <button type="button" title="Advance time" className="border border-[#8998a1] bg-white px-3" onClick={() => preview.run({ type: "ADVANCE_TIME", minutes })}><Clock3 size={15} /></button>
            <button type="button" className="border border-[#8998a1] bg-white px-2 text-xs" onClick={() => preview.run({ type: "ADVANCE_TO_NEXT_EVENT" })}>Next event</button>
          </div>
        </div>
        <div className="grid content-start gap-2">
          <label className="text-xs font-bold">Change location</label>
          <select className={fieldClass} value={state?.location ?? definition.startingLocation} onChange={(event) => preview.run({ type: "CHANGE_LOCATION", location: event.target.value })}>
            {definition.allowedLocations.map((location) => <option key={location}>{location}</option>)}
          </select>
          <div className="flex gap-2">
            <select aria-label="Examination section" className={`${fieldClass} min-w-0 flex-1`} value={examSection} onChange={(event) => setExamSection(event.target.value)}>{Object.keys(definition.exam).map((section) => <option key={section}>{section}</option>)}</select>
            <button type="button" title="Perform examination" className="border border-[#8998a1] bg-white px-3" disabled={!examSection} onClick={() => preview.run({ type: "PERFORM_EXAM", sections: [examSection] })}><Stethoscope size={15} /></button>
          </div>
        </div>
      </div>

      {!state && !preview.error && <div className="border border-dashed border-[#9eabb3] p-8 text-center text-sm text-[#61717b]">Place an order, advance time, change location, or perform an examination to begin the preview.</div>}
      {preview.error && <p className="border border-red-300 bg-red-50 p-3 text-xs text-red-800">{preview.error.message}</p>}
      {state && (
        <>
          <div className="grid grid-cols-5 border border-[#aab5bc] bg-white text-xs">
            <div className="border-r border-[#d0d7db] p-3"><Clock3 className="mb-1 text-[#2d6988]" size={16} /><strong>{state.simulatedMinute} min</strong><span className="block text-[#61717b]">Simulated time</span></div>
            <div className="border-r border-[#d0d7db] p-3"><MapPin className="mb-1 text-[#2d6988]" size={16} /><strong>{state.location}</strong><span className="block text-[#61717b]">Location</span></div>
            <div className="border-r border-[#d0d7db] p-3"><Activity className="mb-1 text-[#2d6988]" size={16} /><strong>{state.currentClinicalStateId ?? "No state"}</strong><span className="block text-[#61717b]">Clinical state</span></div>
            <div className="border-r border-[#d0d7db] p-3"><Stethoscope className="mb-1 text-[#2d6988]" size={16} /><strong>{state.status}</strong><span className="block text-[#61717b]">Case status</span></div>
            <div className="p-3"><strong className="text-lg text-[#2d6988]">{state.scoreReport.total}</strong><span className="block text-[#61717b]">Provisional score</span></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-[#aab5bc] bg-white">
              <h4 className="border-b border-[#aab5bc] bg-[#d7e0e5] px-3 py-2 text-xs font-bold">Action and result timeline</h4>
              <div className="max-h-64 overflow-auto">
                {state.actions.length ? state.actions.map((action, index) => <div key={`${action.id ?? index}`} className="grid grid-cols-[60px_1fr] border-b border-[#e0e5e8] px-3 py-2 text-xs"><span className="text-[#60717d]">+{action.simulatedMinute}m</span><span>{action.summary}</span></div>) : <p className="p-4 text-xs text-[#60717d]">No actions yet.</p>}
              </div>
            </div>
            <div className="border border-[#aab5bc] bg-white">
              <h4 className="border-b border-[#aab5bc] bg-[#d7e0e5] px-3 py-2 text-xs font-bold">Engine event inspection</h4>
              <div className="max-h-64 overflow-auto">
                {state.pendingEvents.length ? state.pendingEvents.map((event) => <div key={event.id} className="grid grid-cols-[1fr_70px_70px] border-b border-[#e0e5e8] px-3 py-2 text-xs"><span>{event.eventTag ?? event.ruleId ?? event.type}</span><span>{event.dueMinute === undefined ? "blocked" : `+${event.dueMinute}m`}</span><strong className={event.status === "completed" ? "text-green-700" : event.status === "blocked" ? "text-amber-700" : "text-[#2d6988]"}>{event.status}</strong></div>) : <p className="p-4 text-xs text-[#60717d]">No scheduled events.</p>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

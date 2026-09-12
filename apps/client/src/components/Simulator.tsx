import {
  CalendarClock,
  ClipboardList,
  Clock3,
  LogOut,
  MapPin,
  Stethoscope,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type {
  AttemptAction,
  CaseResult,
  ChartTab,
  OrderDefinition,
  PlacedOrder,
  ScoreReport,
} from "@ccs/domain";
import { useAttemptOrderSearch, useAttemptSimulator } from "../hooks";
import type { StudentCaseDefinition } from "../types";
import { Modal } from "./Modal";

const tabs: ChartTab[] = [
  "Order Sheet",
  "Progress Notes",
  "Vital Signs",
  "Lab Reports",
  "Imaging",
  "Other Tests",
  "Treatment Record",
];
type Stage = "intro" | "opening" | "vitals" | "history" | "running" | "score";
type Dialog =
  | null
  | "exam"
  | "history"
  | "orders"
  | "time"
  | "location"
  | "message"
  | "exit";
const timeLabel = (minute: number) =>
  `Day ${Math.floor(minute / 1440) + 1} @ ${String(11 + Math.floor((minute % 1440) / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")} (Mon)`;

export function Simulator() {
  const {
    attempt,
    attemptQuery: stateQuery,
    secondsLeft,
    realtimeConnected,
    submitAction: actionMutation,
    leaveSimulator
  } = useAttemptSimulator();
  const [stage, setStage] = useState<Stage>("intro");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [tab, setTab] = useState<ChartTab>("Order Sheet");
  const [message, setMessage] = useState("");
  const seenNotifications = useRef(new Set<string>());
  const finalOrdersShown = useRef(false);
  useEffect(() => {
    if (
      attempt?.status === "final_orders" &&
      stage === "running" &&
      !finalOrdersShown.current
    ) {
      const finalOrderNotification = attempt.notifications.find(
        (notification) => notification.type === "FINAL_ORDERS",
      );
      finalOrdersShown.current = true;
      setMessage(finalOrderNotification?.message ?? "This case is ending. Enter final orders now.");
      setDialog("message");
    }
    if (
      (attempt?.status === "completed" || attempt?.status === "expired") &&
      attempt.scoreReport
    )
      setStage("score");
    const update = attempt?.notifications.find(
      (notification) =>
        notification.type === "PATIENT_UPDATE" &&
        notification.id &&
        !seenNotifications.current.has(notification.id),
    );
    if (update?.id && stage === "running") {
      seenNotifications.current.add(update.id);
      setMessage(update.message);
      setDialog("message");
    }
  }, [attempt?.status, attempt?.scoreReport, attempt?.notifications, stage]);
  useEffect(() => {
    if (!actionMutation.error) return;
    setMessage(actionMutation.error.message);
    setDialog("message");
  }, [actionMutation.error]);
  if (stateQuery.isLoading || !attempt)
    return (
      <div className="grid min-h-screen place-items-center bg-[#eef1f2] text-sm text-slate-600">
        Loading case...
      </div>
    );
  const definition = attempt.case;
  if (stage === "score" && attempt.scoreReport)
    return (
      <ScoreScreen
        score={attempt.scoreReport}
        actions={attempt.actions}
        title={definition.title}
        onExit={leaveSimulator}
      />
    );
  return (
    <main className="simulator-frame">
      <header className="sim-header">
        <div>
          <strong>ClinSim Computer-based Case Simulation</strong>
          <small>Independent educational training environment</small>
        </div>
        <div className="accessibility">
          {stage === "running" &&
            attempt.status !== "completed" &&
            attempt.status !== "expired" && (
              <button
                className="exit-case-button"
                onClick={() => setDialog("exit")}
                title="Finish and score this case"
              >
                <LogOut />
                Exit Case
              </button>
            )}
          <button>About</button>
          <button>Reverse Color</button>
          <button>A</button>
          <button>A</button>
        </div>
      </header>
      <div className="time-banner">
        <span>
          Maximum allotted real time: {definition.durationMinutes} minutes +{" "}
          {definition.finalOrderMinutes} minutes for case-end orders
        </span>
        <strong>
          {Math.floor(secondsLeft / 60)}:
          {String(secondsLeft % 60).padStart(2, "0")}
        </strong>
      </div>
      {stage === "intro" ? (
        <Intro definition={definition} onStart={() => setStage("opening")} />
      ) : stage !== "running" ? (
        <LaunchStage
          stage={stage}
          definition={definition}
          setStage={setStage}
        />
      ) : (
        <>
          <nav className="command-bar">
            <button disabled={attempt.status === "final_orders"} onClick={() => setDialog("exam")}>
              <Stethoscope />
              <span>
                Interval Hx
                <br />
                or PE
              </span>
            </button>
            <button onClick={() => setDialog("orders")}>
              <ClipboardList />
              <span>
                Write Orders
                <br />
                or Review Chart
              </span>
            </button>
            <button disabled={attempt.status === "final_orders"} onClick={() => setDialog("time")}>
              <Clock3 />
              <span>
                Obtain Results
                <br />
                or See Patient Later
                <small>{timeLabel(attempt.simulatedMinute)}</small>
              </span>
            </button>
            <button disabled={attempt.status === "final_orders"} onClick={() => setDialog("location")}>
              <MapPin />
              <span>
                Change Location<strong>{attempt.location}</strong>
              </span>
            </button>
          </nav>
          <Chart
            definition={definition}
            tab={tab}
            setTab={setTab}
            orders={attempt.orders}
            results={attempt.results}
            actions={attempt.actions}
            progressNotes={attempt.progressNotes ?? []}
            vitalSignsLog={attempt.vitalSignsLog ?? []}
            currentVitals={attempt.currentVitals ?? definition.vitals}
            simMinute={attempt.simulatedMinute}
          />
          <footer className="sim-footer">
            <span>
              Elapsed SIMULATED Case Time ={" "}
              {Math.floor(attempt.simulatedMinute / 1440)} Days{" "}
              {Math.floor((attempt.simulatedMinute % 1440) / 60)} Hrs{" "}
              {attempt.simulatedMinute % 60} Mins
            </span>
            <span>
              {realtimeConnected
                ? "Realtime synchronization: connected"
                : "Realtime unavailable: REST synchronization every 5 seconds"}
            </span>
          </footer>
          {attempt.status === "final_orders" && (
            <div className="final-actions">
              <button onClick={() => setDialog("orders")}>
                Write New Orders
              </button>
              <button onClick={() => setDialog("exit")}>Exit Case</button>
            </div>
          )}
        </>
      )}
      {dialog === "exam" && (
        <ExamDialog
          definition={definition}
          onClose={() => setDialog(null)}
          onHistory={() => setDialog("history")}
          onDone={(sections) => {
            actionMutation.mutate({ type: "PERFORM_EXAM", sections });
            setDialog(null);
          }}
        />
      )}{" "}
      {dialog === "history" && (
        <HistoryDialog
          definition={definition}
          onClose={() => setDialog(null)}
        />
      )}{" "}
      {dialog === "orders" && (
        <OrdersDialog
          attemptId={attempt.attemptId}
          placedOrders={attempt.orders}
          onClose={() => setDialog(null)}
          onOrder={(orderId, qualifiers) => {
            actionMutation.mutate({
              type: "PLACE_ORDER",
              orderId,
              ...qualifiers,
            });
            setTab("Order Sheet");
          }}
          onDiscontinue={(placedOrderId) => {
            actionMutation.mutate({ type: "DISCONTINUE_ORDER", placedOrderId });
          }}
        />
      )}{" "}
      {dialog === "time" && (
        <TimeDialog
          currentMinute={attempt.simulatedMinute}
          onClose={() => setDialog(null)}
          onAdvance={(action) => {
            actionMutation.mutate(action);
            setDialog(null);
          }}
        />
      )}{" "}
      {dialog === "location" && (
        <LocationDialog
          definition={definition}
          current={attempt.location}
          onClose={() => setDialog(null)}
          onSelect={(location) => {
            actionMutation.mutate({ type: "CHANGE_LOCATION", location });
            setDialog(null);
          }}
        />
      )}{" "}
      {dialog === "message" && (
        <Modal
          title="Patient Update"
          onClose={() => setDialog(null)}
          width={460}
        >
          <div className="system-message">{message}</div>
          <div className="modal-actions">
            <button onClick={() => setDialog(null)}>OK</button>
          </div>
        </Modal>
      )}{" "}
      {dialog === "exit" && (
        <Modal title="End of Case" onClose={() => setDialog(null)} width={430}>
          <div className="end-message">
            <strong>END OF CASE</strong>
            <p>Thank you for taking care of the patient.</p>
          </div>
          <div className="modal-actions">
            <button
              onClick={() => actionMutation.mutate({ type: "FINISH_CASE" })}
            >
              Exit Case
            </button>
            <button onClick={() => setDialog(null)}>Continue Orders</button>
          </div>
        </Modal>
      )}
    </main>
  );
}

function Intro({
  definition,
  onStart,
}: {
  definition: StudentCaseDefinition;
  onStart: () => void;
}) {
  return (
    <section className="intro-screen">
      <div className="intro-copy">
        <h1>Case Instructions</h1>
        <p>
          You will manage one patient. Simulated time advances only when you
          request an examination, change location, or choose to see the patient
          later.
        </p>
        <dl>
          <div>
            <dt>Maximum real time</dt>
            <dd>{definition.durationMinutes} minutes</dd>
          </div>
          <div>
            <dt>Case-end orders</dt>
            <dd>{definition.finalOrderMinutes} minutes</dd>
          </div>
          <div>
            <dt>Starting location</dt>
            <dd>{definition.startingLocation}</dd>
          </div>
        </dl>
      </div>
      <button className="start-case" onClick={onStart}>
        Start Case
      </button>
    </section>
  );
}
function LaunchStage({
  stage,
  definition,
  setStage,
}: {
  stage: Stage;
  definition: StudentCaseDefinition;
  setStage: (stage: Stage) => void;
}) {
  const content =
    stage === "opening" ? (
      <>
        <h2>Case Introduction</h2>
        <p>{definition.opening}</p>
        <p>{definition.appearance}</p>
        <p>
          <strong>Location:</strong> {definition.startingLocation} &nbsp;{" "}
          <strong>Time:</strong> {timeLabel(0)}
        </p>
      </>
    ) : stage === "vitals" ? (
      <>
        <h2>Vital Signs</h2>
        <div className="vitals-grid">
          {Object.entries(definition.vitals).map(([key, value]) => (
            <div key={key}>
              <span>{key.replace(/([A-Z])/g, " $1")}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </>
    ) : (
      <>
        <h2>Initial History</h2>
        <div className="history-text">
          {Object.entries(definition.history).map(([key, value]) => (
            <section key={key}>
              <strong>{key}:</strong> {value}
            </section>
          ))}
        </div>
      </>
    );
  const next =
    stage === "opening" ? "vitals" : stage === "vitals" ? "history" : "running";
  return (
    <section className="launch-stage">
      <div className="launch-panel">
        {content}
        <div className="center-action">
          <button onClick={() => setStage(next)}>OK</button>
        </div>
      </div>
    </section>
  );
}
function Chart({
  definition,
  tab,
  setTab,
  orders,
  results,
  actions,
  progressNotes,
  vitalSignsLog,
  currentVitals,
  simMinute,
}: {
  definition: StudentCaseDefinition;
  tab: ChartTab;
  setTab: (tab: ChartTab) => void;
  orders: PlacedOrder[];
  results: CaseResult[];
  actions: AttemptAction[];
  progressNotes?: Array<{ id: string; simulatedMinute: number; text: string }>;
  vitalSignsLog?: Array<{ simulatedMinute: number; vitals: StudentCaseDefinition["vitals"] }>;
  currentVitals: StudentCaseDefinition["vitals"];
  simMinute: number;
}) {
  const visibleResults = results.filter((result) => result.category === tab);
  const fallbackVitalSigns = JSON.stringify(currentVitals) === JSON.stringify(definition.vitals)
    ? [{ simulatedMinute: 0, vitals: definition.vitals }]
    : [
        { simulatedMinute: 0, vitals: definition.vitals },
        { simulatedMinute: simMinute, vitals: currentVitals }
      ];
  return (
    <section className="chart-shell">
      <div className="chart-tabs">
        {tabs.map((item) => (
          <button
            className={item === tab ? "active" : ""}
            onClick={() => setTab(item)}
            key={item}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="chart-content">
        <h3>{tab}</h3>
        {tab === "Order Sheet" && (
          <Table
            headers={[
              "Order",
              "Route / Dose",
              "Frequency / Duration",
              "Priority",
              "Order Time",
              "Report Time",
            ]}
            rows={orders.map((o) => {
              const releasedResult = [...results].reverse().find((result) => result.orderId === o.id);
              const reportMinute = releasedResult?.availableAt ?? o.reportAt;
              return [
                o.name,
                [o.route, o.dose].filter(Boolean).join(" / "),
                [o.frequency, o.duration].filter(Boolean).join(" / "),
                o.priority ?? "",
                timeLabel(o.orderedAt),
                reportMinute == null ? "" : timeLabel(reportMinute),
              ];
            })}
            empty="No orders have been written."
          />
        )}
        {tab === "Progress Notes" && (
          <Table
            headers={["Simulated Time", "Progress Note"]}
            rows={[
              ...(progressNotes ?? []).map((note) => [timeLabel(note.simulatedMinute), note.text]),
              ...actions
                .filter((action) => action.type !== "system")
                .map((action) => [timeLabel(action.simulatedMinute), action.summary]),
            ]}
            empty="No progress notes are available."
          />
        )}
        {tab === "Vital Signs" && (
          <Table
            headers={[
              "Time",
              "Temp",
              "Pulse",
              "Resp",
              "Blood Pressure",
              "O2 Sat",
            ]}
            rows={((vitalSignsLog?.length ?? 0) > 0
              ? vitalSignsLog
              : fallbackVitalSigns
            )!.map((entry) => [
              timeLabel(entry.simulatedMinute),
              ...Object.values(entry.vitals),
            ])}
            empty=""
          />
        )}
        {(["Lab Reports", "Imaging", "Other Tests"] as ChartTab[]).includes(
          tab,
        ) && (
          <Table
            headers={["Test", "Result", "Report Time"]}
            rows={visibleResults.map((r) => [
              r.name,
              r.value,
              timeLabel(r.availableAt),
            ])}
            empty="No results are available."
          />
        )}
        {tab === "Treatment Record" && (
          <Table
            headers={["Treatment", "Status", "Time"]}
            rows={orders
              .filter((o) => o.category === "Medication")
              .map((o) => [o.name, o.status, timeLabel(o.orderedAt)])}
            empty="No treatments have been recorded."
          />
        )}
      </div>
      <div className="chart-status">
        Current simulated time: {timeLabel(simMinute)}
      </div>
    </section>
  );
}
function Table({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: string[][];
  empty: string;
}) {
  return (
    <div className="clinical-table">
      <div className="clinical-tr header">
        {headers.map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>
      {rows.length ? (
        rows.map((row, i) => (
          <div className="clinical-tr" key={i}>
            {row.map((cell, j) => (
              <span key={j}>{cell}</span>
            ))}
          </div>
        ))
      ) : (
        <div className="empty-table">{empty}</div>
      )}
    </div>
  );
}
function ExamDialog({
  definition,
  onClose,
  onHistory,
  onDone,
}: {
  definition: StudentCaseDefinition;
  onClose: () => void;
  onHistory: () => void;
  onDone: (selected: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <Modal
      title="Interval History or Physical Examination"
      onClose={onClose}
      width={590}
    >
      <section className="exam-section">
        <h3>History</h3>
        <button onClick={onHistory}>Review initial history</button>
      </section>
      <section className="exam-section">
        <h3>
          Physical Examination <small>(2 minutes per system)</small>
        </h3>
        <div className="exam-options">
          {Object.keys(definition.exam).map((item) => (
            <label key={item}>
              <input
                type="checkbox"
                checked={selected.includes(item)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, item]
                      : selected.filter((x) => x !== item),
                  )
                }
              />{" "}
              {item}
            </label>
          ))}
        </div>
      </section>
      <div className="modal-actions spread">
        <button onClick={() => onDone(selected)} disabled={!selected.length}>
          OK
        </button>
        <button onClick={() => setSelected([])}>Clear</button>
      </div>
    </Modal>
  );
}
function HistoryDialog({
  definition,
  onClose,
}: {
  definition: StudentCaseDefinition;
  onClose: () => void;
}) {
  return (
    <Modal title="Initial History" onClose={onClose} width={650}>
      <div className="scroll-paper">
        {Object.entries(definition.history).map(([key, value]) => (
          <p key={key}>
            <strong>{key}:</strong>
            <br />
            {value}
          </p>
        ))}
      </div>
      <div className="modal-actions">
        <button onClick={onClose}>OK</button>
      </div>
    </Modal>
  );
}
function OrdersDialog({
  attemptId,
  placedOrders,
  onClose,
  onOrder,
  onDiscontinue,
}: {
  attemptId: string;
  placedOrders: PlacedOrder[];
  onClose: () => void;
  onOrder: (id: string, qualifiers: { route?: string; dose?: string; frequency?: string; duration?: string; priority?: string }) => void;
  onDiscontinue: (placedOrderId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<OrderDefinition | null>(null);
  const [route, setRoute] = useState("");
  const [dose, setDose] = useState("");
  const [frequency, setFrequency] = useState("");
  const [duration, setDuration] = useState("");
  const [priority, setPriority] = useState("");
  const orderSearch = useAttemptOrderSearch(attemptId, query);
  const matches = orderSearch.isDebouncing ? [] : orderSearch.data?.orders ?? [];
  return (
    <Modal
      title={picked ? `Order Qualifiers - ${picked.name}` : "Write Orders"}
      onClose={onClose}
      width={picked ? 430 : 620}
    >
      {picked ? (
        <>
          {picked.route?.length ? <div className="qualifier">
            <h3>Route of Administration</h3>
            {picked.route.map((item) => (
              <label key={item}>
                <input
                  type="radio"
                  name="route"
                  checked={
                    (route || picked.route?.[0]) === item
                  }
                  onChange={() => setRoute(item)}
                />{" "}
                {item}
              </label>
            ))}
          </div> : null}
          {picked.dose?.length ? <div className="qualifier">
            <h3>Dose</h3>
            {picked.dose.map((item) => (
              <label key={item}>
                <input type="radio" name="dose" checked={(dose || picked.dose?.[0]) === item} onChange={() => setDose(item)} />{" "}{item}
              </label>
            ))}
          </div> : null}
          {picked.frequency?.length ? <div className="qualifier">
            <h3>Frequency</h3>
            {picked.frequency.map((item) => (
              <label key={item}>
                <input
                  type="radio"
                  name="frequency"
                  checked={
                    (frequency || picked.frequency?.[0]) === item
                  }
                  onChange={() => setFrequency(item)}
                />{" "}
                {item}
              </label>
            ))}
          </div> : null}
          {picked.duration?.length ? <div className="qualifier">
            <h3>Duration</h3>
            {picked.duration.map((item) => (
              <label key={item}>
                <input type="radio" name="duration" checked={(duration || picked.duration?.[0]) === item} onChange={() => setDuration(item)} />{" "}{item}
              </label>
            ))}
          </div> : null}
          {picked.priority?.length ? <div className="qualifier">
            <h3>Priority</h3>
            {picked.priority.map((item) => (
              <label key={item}>
                <input type="radio" name="priority" checked={(priority || picked.priority?.[0]) === item} onChange={() => setPriority(item)} />{" "}{item}
              </label>
            ))}
          </div> : null}
          <div className="modal-actions">
            <button
              onClick={() => {
                onOrder(
                  picked.id,
                  {
                    route: route || picked.route?.[0],
                    dose: dose || picked.dose?.[0],
                    frequency: frequency || picked.frequency?.[0],
                    duration: duration || picked.duration?.[0],
                    priority: priority || picked.priority?.[0]
                  },
                );
                setPicked(null);
                setQuery("");
              }}
            >
              OK
            </button>
            <button onClick={() => setPicked(null)}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <label className="order-search">
            Enter order
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Begin typing an order..."
            />
          </label>
          <div className="order-results">
            {matches.map((item) => (
              <button key={item.id} onClick={() => setPicked(item)}>
                <span>{item.name}</span>
                <small>{item.category}</small>
              </button>
            ))}
            {query.trim().length >= 2 && (orderSearch.isDebouncing || orderSearch.isFetching) && (
              <p>Searching orders...</p>
            )}
            {query.trim().length >= 2 && !orderSearch.isDebouncing && !orderSearch.isFetching && !matches.length && !orderSearch.isError && (
              <p>No matching orders.</p>
            )}
            {orderSearch.isError && <p>Order search is temporarily unavailable.</p>}
          </div>
          {placedOrders.some((order) => ["active", "held"].includes(order.status)) && (
            <div className="qualifier">
              <h3>Active orders</h3>
              {placedOrders.filter((order) => ["active", "held"].includes(order.status)).map((order) => (
                <div className="flex items-center justify-between border-b border-[#c5cdd1] py-2 text-sm" key={order.id}>
                  <span>{order.name}{order.status === "held" ? " (Held)" : ""}</span>
                  <button onClick={() => onDiscontinue(order.id)}>Discontinue</button>
                </div>
              ))}
            </div>
          )}
          <div className="modal-actions">
            <button onClick={onClose}>Done</button>
          </div>
        </>
      )}
    </Modal>
  );
}
function TimeDialog({
  currentMinute,
  onClose,
  onAdvance,
}: {
  currentMinute: number;
  onClose: () => void;
  onAdvance: (action: Record<string, unknown>) => void;
}) {
  const [minutes, setMinutes] = useState(30);
  const [mode, setMode] = useState<"interval" | "result" | "appointment" | "needed">("interval");
  const [appointmentMinutes, setAppointmentMinutes] = useState(60);
  return (
    <Modal title="Reevaluate" onClose={onClose} width={500}>
      <div className="reevaluate">
        <div className="mini-calendar">
          <strong>Calendar</strong>
          {Array.from({ length: 35 }, (_, i) => (
            <span className={i === 1 ? "today" : ""} key={i}>
              {i < 4 ? "" : i - 3}
            </span>
          ))}
        </div>
        <fieldset>
          <legend>Reevaluate Case</legend>
          <label>
            <input type="radio" name="advance-mode" checked={mode === "interval"} onChange={() => setMode("interval")} /> In{" "}
            <input
              type="number"
              min={1}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />{" "}
            minute(s)
          </label>
          <label>
            <input type="radio" name="advance-mode" checked={mode === "result"} onChange={() => setMode("result")} /> With next available result
          </label>
          <label>
            <input type="radio" name="advance-mode" checked={mode === "appointment"} onChange={() => setMode("appointment")} /> At an appointment in{" "}
            <input type="number" min={1} value={appointmentMinutes} onChange={(event) => setAppointmentMinutes(Number(event.target.value))} /> minute(s)
          </label>
          <label>
            <input type="radio" name="advance-mode" checked={mode === "needed"} onChange={() => setMode("needed")} /> Call/see me as needed
          </label>
        </fieldset>
      </div>
      <div className="modal-actions">
        <button onClick={() => onAdvance(
          mode === "interval"
            ? { type: "ADVANCE_TIME", minutes }
            : mode === "result"
              ? { type: "ADVANCE_TO_NEXT_RESULT" }
              : mode === "appointment"
                ? { type: "ADVANCE_TO_SIMULATED_MINUTE", targetMinute: currentMinute + appointmentMinutes }
                : { type: "ADVANCE_TO_NEXT_EVENT" }
        )}>OK</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}
function LocationDialog({
  definition,
  current,
  onClose,
  onSelect,
}: {
  definition: StudentCaseDefinition;
  current: string;
  onClose: () => void;
  onSelect: (location: string) => void;
}) {
  const [selected, setSelected] = useState(current);
  return (
    <Modal title="Change Location" onClose={onClose} width={440}>
      <div className="location-list">
        {definition.allowedLocations.map((item) => (
          <label key={item}>
            <input
              type="radio"
              name="location"
              checked={selected === item}
              onChange={() => setSelected(item)}
            />{" "}
            {item}
          </label>
        ))}
      </div>
      <div className="modal-actions">
        <button onClick={() => onSelect(selected)}>OK</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}
function ScoreScreen({
  score,
  actions,
  title,
  onExit,
}: {
  score: ScoreReport;
  actions: AttemptAction[];
  title: string;
  onExit: () => void;
}) {
  return (
    <main className="score-page">
      <header>
        <div>
          <small>CASE COMPLETE</small>
          <h1>{title}</h1>
        </div>
        <button onClick={onExit}>Return to case library</button>
      </header>
      <section className="score-summary">
        <div className="score-circle">
          <strong>{score.total}</strong>
          <span>/100</span>
        </div>
        <div>
          <h2>Performance summary</h2>
          <p>{score.rationale}</p>
        </div>
      </section>
      <div className="score-columns">
        <section>
          <h2>Domain scores</h2>
          {score.domains.map((d) => (
            <div className="domain-row" key={d.label}>
              <span>{d.label}</span>
              <div>
                <i style={{ width: `${Math.min(100, d.score)}%` }} />
              </div>
              <strong>{d.score}</strong>
            </div>
          ))}
        </section>
        <section>
          <h2>Case feedback</h2>
          <h3>Completed actions</h3>
          <ul className="good-list">
            {score.ideal.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          {(score.partial?.length ?? 0) > 0 && (
            <>
              <h3>Partial credit</h3>
              <ul className="missed-list">
                {score.partial!.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </>
          )}
          <h3>Missed opportunities</h3>
          <ul className="missed-list">
            {score.missed.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          {score.harmful.length > 0 && (
            <>
              <h3>Potentially harmful</h3>
              <ul className="harm-list">
                {score.harmful.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
      <section className="timeline">
        <h2>Attempt timeline</h2>
        {[...actions].sort((left, right) => left.simulatedMinute - right.simulatedMinute).map((a) => (
          <div key={a.id}>
            <time>{timeLabel(a.simulatedMinute)}</time>
            <span>{a.summary}</span>
          </div>
        ))}
      </section>
    </main>
  );
}

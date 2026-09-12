import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type CaseMetric = { _id: string; title: string; version?: number; attempts: number; completed: number; averageScore: number | null };

export function AnalyticsChart({ cases }: { cases: CaseMetric[] }) {
  if (!cases.length) return <p className="mb-6 border-y border-[#a8b3ba] py-10 text-center text-sm text-[#60717d]">No attempts in this period.</p>;
  const data = cases.map(item => ({ ...item, label: `${item.title || "Untitled case"}${item.version ? ` v${item.version}` : ""}` }));
  return <section aria-label="Case attempts and average scores" className="mb-6 min-w-0 border-y border-[#a8b3ba] bg-white py-4">
    <h2 className="mb-4 px-4 text-base font-semibold">Attempts and scores by case</h2>
    <div className="overflow-x-auto" tabIndex={0} aria-label="Case performance chart">
      <div style={{ height: 390, minWidth: Math.max(620, cases.length * 130) }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 25, right: 20, bottom: 12, left: 16 }} accessibilityLayer>
            <CartesianGrid stroke="#e0e5e8" vertical={false} />
            <XAxis dataKey="_id" interval={0} height={65} tick={{ fontSize: 11, fill: "#46555f" }} tickMargin={12}
              tickFormatter={id => { const label = data.find(item => item._id === id)?.label ?? ""; return label.length > 18 ? `${label.slice(0, 17)}...` : label; }} />
            <YAxis yAxisId="attempts" allowDecimals={false} width={48} tick={{ fontSize: 12 }}
              label={{ value: "Attempts", position: "insideTopLeft", offset: -20, fontSize: 12 }} />
            <YAxis yAxisId="score" orientation="right" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} width={50} tick={{ fontSize: 12 }}
              label={{ value: "Score / 100", position: "insideTopRight", offset: -20, fontSize: 12 }} />
            <Tooltip filterNull={false} labelFormatter={id => data.find(item => item._id === id)?.label ?? String(id)}
              formatter={(value, name) => [value == null ? "No scored attempts" : name === "Average final score" ? `${Number(value).toFixed(1)} / 100` : value, name]}
              contentStyle={{ border: "1px solid #a8b3ba", borderRadius: 4, fontSize: 13, maxWidth: 300, whiteSpace: "normal" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="attempts" dataKey="attempts" name="Attempts" fill="#2d6985" maxBarSize={30} isAnimationActive={false} />
            <Bar yAxisId="attempts" dataKey="completed" name="Finished / expired" fill="#39947d" maxBarSize={30} isAnimationActive={false} />
            <Line yAxisId="score" dataKey="averageScore" name="Average final score" stroke="#bd681b" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  </section>;
}

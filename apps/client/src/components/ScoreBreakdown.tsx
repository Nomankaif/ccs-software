import type { ScoreReport } from "@ccs/domain";

const outcomes = { met: "Full credit", partial: "Partial credit", missed: "Missed credit", penalty: "Penalty", avoided: "Penalty avoided" };
export function ScoreBreakdown({ score, formatTime }: { score: ScoreReport; formatTime: (minute: number) => string }) {
  if (!score.details) return null;
  const earned = score.details.reduce((sum, item) => sum + Math.max(0, item.awardedPoints), 0);
  const deductions = score.details.reduce((sum, item) => sum + Math.min(0, item.awardedPoints), 0);
  return <section className="score-breakdown">
    <h2>Action-by-action feedback</h2>
    <div className="score-totals"><span>Earned <strong>+{earned}</strong></span><span>Penalties <strong>{deductions}</strong></span><span>Final score <strong>{score.total}/100</strong></span></div>
    {score.rawTotal !== undefined && score.rawTotal !== score.total && <p>Raw score: {score.rawTotal}. The final score is limited to 0-100.</p>}
    {score.details.map((item, index) => <article key={`${item.ruleId}-${index}`} className={`score-rule score-rule-${item.status}`}>
      <div className="score-rule-heading"><div><h3>{item.label}</h3><small>{item.domain}{item.simulatedMinute !== undefined ? ` | ${formatTime(item.simulatedMinute)}` : " | No qualifying action"}</small></div><strong>{item.awardedPoints > 0 ? "+" : ""}{item.awardedPoints} points <span>{outcomes[item.status]}</span></strong></div>
      {item.label !== item.action && <p>{item.action}</p>}
      <p>{item.explanation}</p>
      <dl><dt>Case requirement</dt><dd>{item.expected}</dd>
        <dt>Why it matters</dt><dd>{item.rationale ?? "No clinical explanation was provided by the case author."}</dd>
        {item.possiblePoints > 0 && <><dt>Available credit</dt><dd>{item.awardedPoints} / {item.possiblePoints} points</dd></>}
      </dl>
    </article>)}
  </section>;
}

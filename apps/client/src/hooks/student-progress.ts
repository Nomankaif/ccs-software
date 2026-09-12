import type { StudentCaseSummary } from "../types";

export interface AttemptSummary {
  _id: string;
  caseVersionId: string;
  status: "active" | "final_orders" | "completed" | "expired";
  caseSnapshot: { title: string; specialty?: string; version?: number };
  createdAt: string;
  completedAt?: string;
  simulatedMinute: number;
  scoreReport: { total: number; domains: { label: string; score: number; max: number }[] } | null;
}
export const isFinished = (attempt: AttemptSummary) => ["completed", "expired"].includes(attempt.status);
export function filterLibrary(cases: StudentCaseSummary[], search: string, specialty: string, difficulty: string) {
  const query = search.trim().toLowerCase();
  return cases.filter(item => (!specialty || item.specialty === specialty) && (!difficulty || item.difficulty === difficulty)
    && (!query || `${item.title} ${item.opening} ${item.specialty}`.toLowerCase().includes(query)));
}
export function summarizePerformance(attempts: AttemptSummary[]) {
  const scored = attempts.filter(item => isFinished(item) && item.scoreReport != null);
  const domains = new Map<string, { label: string; score: number; max: number; attempts: number }>();
  for (const attempt of scored) for (const domain of attempt.scoreReport!.domains ?? []) {
    const item = domains.get(domain.label) ?? { label: domain.label, score: 0, max: 0, attempts: 0 };
    item.score += domain.score; item.max += domain.max; item.attempts++;
    domains.set(domain.label, item);
  }
  return { scored, finished: attempts.filter(isFinished).length,
    average: scored.length ? scored.reduce((sum, item) => sum + item.scoreReport!.total, 0) / scored.length : null,
    best: scored.length ? Math.max(...scored.map(item => item.scoreReport!.total)) : null,
    domains: [...domains.values()].sort((a, b) => a.label.localeCompare(b.label)) };
}

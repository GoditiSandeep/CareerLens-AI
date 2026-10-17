// Career What-If Simulator — compare two or three career paths side by side,
// grounded in the real /careers catalogue and the signed-in user's /skills/mine.
//
// Honesty notes:
//  - Skills, prerequisites and learning effort come from the configured
//    database (seeded sample data) plus a transparent, explainable heuristic.
//  - Salary ranges are shown only where the seeded record provides them and are
//    NEVER treated as guarantees.
//  - "Learning effort" is an estimate in study-months derived from the number of
//    missing skills and roadmap steps; assumptions are stated on screen.
//  - No employment, salary or promotion outcome is promised anywhere.
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Career, type Skill } from "../lib/api";
import { AnimatedRing, EmptyState, ErrorBanner, GlassCard, Loader, ProgressBar, Reveal, TiltCard, parseList } from "../components/ui";

// required_skills can be a list or a {skill: weight} map; normalise to names.
function skillsOf(c: Career): string[] {
  const rs = c.required_skills;
  if (Array.isArray(rs)) return rs.map(String);
  if (rs && typeof rs === "object") return Object.keys(rs);
  return parseList(typeof rs === "string" ? rs : "");
}

interface RoadmapStep {
  month: number;
  title: string;
  items: string[];
}

function roadmapOf(c: Career): RoadmapStep[] {
  const raw = c.roadmap;
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((s: Record<string, unknown>) => ({
      month: Number(s.month) || 0,
      title: String(s.title ?? ""),
      items: Array.isArray(s.items) ? s.items.map(String) : [],
    }))
    .filter((s) => s.title);
}

// Transparent, explainable comparison metrics for one path vs a user's skills.
interface PathMetrics {
  required: string[];
  owned: string[];
  missing: string[];
  transferPct: number;
  effortMonths: number; // transparent estimate
  steps: number;
  firstSteps: string[];
}

function metricsFor(career: Career, owned: Set<string>): PathMetrics {
  const required = skillsOf(career);
  const lowerOwned = new Set([...owned].map((s) => s.toLowerCase()));
  const own = required.filter((s) => lowerOwned.has(s.toLowerCase()));
  const missing = required.filter((s) => !lowerOwned.has(s.toLowerCase()));
  const transferPct = required.length
    ? Math.round((own.length / required.length) * 100)
    : 0;
  const stepsArr = roadmapOf(career);
  const steps = stepsArr.length || 1;
  // Effort estimate: each missing skill is roughly 0.5 month, plus roadmap pacing.
  // Stated openly as a rough estimate, not a prediction.
  const effortMonths = Math.max(steps, Math.round(missing.length * 0.5 + steps * 0.5));
  const firstSteps = stepsArr.flatMap((s) => s.items).filter(Boolean).slice(0, 3);
  return { required, owned: own, missing, transferPct, effortMonths, steps, firstSteps };
}

export default function WhatIf() {
  const [careers, setCareers] = useState<Career[] | null>(null);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, mine] = await Promise.all([
        api.get<Career[]>("/careers"),
        api.get<Skill[]>("/skills/mine"),
      ]);
      setCareers(c);
      setOwned(new Set(mine.map((s) => s.name)));
      // Preselect the first two paths so the comparison is never empty.
      setSelected((prev) => (prev.length ? prev : c.slice(0, 2).map((x) => x.id)));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load careers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggle = (id: number) =>
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return [...prev.slice(1), id]; // keep at most 3
      return [...prev, id];
    });

  const selectedCareers = useMemo(
    () => (careers ?? []).filter((c) => selected.includes(c.id)),
    [careers, selected],
  );
  const metricsMap = useMemo(() => {
    const m = new Map<number, PathMetrics>();
    selectedCareers.forEach((c) => m.set(c.id, metricsFor(c, owned)));
    return m;
  }, [selectedCareers, owned]);

  // Best-effort "closest fit" ranking is purely ordinal, never a guarantee.
  const ranked = useMemo(
    () =>
      [...selectedCareers]
        .map((c) => ({ c, m: metricsMap.get(c.id)! }))
        .sort((a, b) => b.m.transferPct - a.m.transferPct),
    [selectedCareers, metricsMap],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Career What-If Simulator</h1>
        <p className="page-sub">
          Compare up to three paths side by side against the skills you have logged.
          Every number below is a transparent estimate, not a prediction.
        </p>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}
      {loading && <Loader label="Loading career paths…" />}

      {!loading && !error && (
        <>
          {/* Path picker */}
          <div className="card">
            <p className="section-title mb-3">Choose paths to compare</p>
            <div className="flex flex-wrap gap-2">
              {(careers ?? []).map((c) => {
                const active = selected.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggle(c.id)}
                    className={`chip ${active ? "chip-active" : ""}`}
                    aria-pressed={active}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
            <p className="muted mt-2 text-xs">
              Select 2 or 3 paths. Skill-transfer, effort and reference ranges are
              illustrative aids only.
            </p>
          </div>

          {selectedCareers.length === 0 && (
            <EmptyState
              title="Pick at least one path"
              hint="Search or tap a path above to start comparing. Choose two or more for a side-by-side view."
            />
          )}
          {selectedCareers.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="Path comparison">
              {ranked.map(({ c, m }) => (
                <Reveal key={c.id}>
                  <TiltCard>
                    <GlassCard className="space-y-4" sheen>
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <p className="section-title">{c.name}</p>
                          {ranked[0]?.c.id === c.id && selectedCareers.length > 1 && (
                            <span className="badge-green" title="Highest skill transfer with your current skills">
                              Closest fit
                            </span>
                          )}
                        </div>
                        <p className="muted text-xs">{c.category}</p>
                      </div>

                      {/* Skill transfer */}
                      <div className="flex items-center gap-4">
                        <AnimatedRing
                          value={m.transferPct}
                          size={84}
                          thickness={8}
                          label="Fit"
                          color="#22d3ee"
                          trackClassName="stroke-brand-100 dark:stroke-slate-700"
                        />
                        <div className="flex-1">
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-700 dark:text-slate-300">Skill transfer</span>
                            <span className="font-semibold text-brand-600">{m.transferPct}%</span>
                          </div>
                          <ProgressBar value={m.transferPct} />
                        </div>
                      </div>

                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
                      <dt className="muted text-xs">Est. effort</dt>
                      <dd className="font-semibold text-slate-800 dark:text-slate-200">~{m.effortMonths} mo</dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
                      <dt className="muted text-xs">Roadmap steps</dt>
                      <dd className="font-semibold text-slate-800 dark:text-slate-200">{m.steps}</dd>
                    </div>
                  </dl>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Skills you have</p>
                    {m.owned.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {m.owned.map((s) => <span key={s} className="badge-green">{s}</span>)}
                      </div>
                    ) : (
                      <p className="muted mt-1 text-xs">None yet — a great fresh start.</p>
                    )}

                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Skills to build</p>
                    {m.missing.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {m.missing.map((s) => <span key={s} className="badge-amber">{s}</span>)}
                      </div>
                    ) : (
                      <p className="muted mt-1 text-xs">You already cover the core requirements.</p>
                    )}
                  </div>

                  {m.firstSteps.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested first steps</p>
                      <ul className="muted mt-1 list-disc space-y-1 pl-4 text-xs">
                        {m.firstSteps.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}

                  {c.salary_range ? (
                    <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reference range (sample data)</p>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{c.salary_range}</p>
                      <p className="muted mt-1 text-[11px]">
                        Indicative only. Actual pay varies widely by location, company and
                        experience and is never guaranteed.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <p className="muted text-[11px]">
                        No reference salary stored for this path — we show ranges only when a
                        credible value is available.
                      </p>
                    </div>
                  )}
                    </GlassCard>
                  </TiltCard>
                </Reveal>
              ))}
            </div>
          )}

          <p className="muted text-xs">
            Comparisons use transparent heuristics over the configured career catalogue and
            your logged skills. Skill-transfer %, effort estimates and reference ranges are
            illustrative aids, not guarantees of employment, salary or promotion. Verify
            salary figures against dated, credible sources before deciding.
          </p>
        </>
      )}
    </div>
  );
}

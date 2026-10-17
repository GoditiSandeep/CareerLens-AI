import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, type Career, type SkillGapOut } from "../lib/api";
import { EmptyState, ErrorBanner, Loader, ProgressBar, useToast } from "../components/ui";

function skillNames(c: Career): string[] {
  if (Array.isArray(c.required_skills)) return c.required_skills;
  return Object.keys(c.required_skills ?? {});
}

export default function Careers() {
  const notify = useToast();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<"all" | "recs">("all");
  const [careers, setCareers] = useState<Career[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [openId, setOpenId] = useState<number | null>(null);
  const [gaps, setGaps] = useState<SkillGapOut | null>(null);
  const [gapsLoading, setGapsLoading] = useState(false);

  const load = useCallback(async (which: "all" | "recs") => {
    setError("");
    setCareers(null);
    try {
      const path = which === "recs" ? "/careers/recommendations" : "/careers";
      setCareers(await api.get<Career[]>(path));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load careers");
    }
  }, []);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  useEffect(() => {
    const q = params.get("q");
    if (q) setQuery(q);
  }, [params]);

  const filtered = useMemo(() => {
    if (!careers) return [];
    const q = query.trim().toLowerCase();
    if (!q) return careers;
    return careers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q),
    );
  }, [careers, query]);

  const showGaps = async (career: Career) => {
    setGapsLoading(true);
    setOpenId(career.id);
    setGaps(null);
    try {
      setGaps(await api.get<SkillGapOut>(`/skills/gaps?target=${encodeURIComponent(career.name)}`));
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gap analysis failed", "error");
    } finally {
      setGapsLoading(false);
    }
  };

  const search = (value: string) => {
    setQuery(value);
    if (value) setParams({ q: value });
    else setParams({});
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Career exploration</h1>
          <p className="page-sub">
            Seeded career paths with skills, salary bands and demand signals — plus explainable
            fit scoring against your profile.
          </p>
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
          {(["all", "recs"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === t ? "bg-brand-600 text-white" : "text-slate-600 dark:text-slate-300"}`}>
              {t === "all" ? "All careers" : "Recommended for me"}
            </button>
          ))}
        </div>
      </div>

      <input className="input max-w-md" placeholder="Search careers, e.g. 'data' or 'cloud'"
        value={query} onChange={(e) => search(e.target.value)} aria-label="Search careers" />

      {error && <ErrorBanner message={error} onRetry={() => void load(tab)} />}
      {!careers && !error && <Loader label="Loading careers…" />}

      {careers && filtered.length === 0 && (
        <EmptyState title="No careers match your search"
          hint="Try a different keyword or clear the search."
          action={<button className="btn-ghost" onClick={() => search("")}>Clear search</button>} />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((c, idx) => (
          <div key={c.id} className={`card card-interactive anim-fade-up stagger-${Math.min(8, (idx % 8) + 1)}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{c.name}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <span className="badge-slate">{c.category}</span>
                  {c.demand_level && <span className="badge-green">Demand: {c.demand_level}</span>}
                  {c.salary_range && <span className="badge-brand">{c.salary_range}</span>}
                </div>
              </div>
              {typeof c.suitability === "number" && (
                <div className="text-right">
                  <ScoreRing value={c.suitability} />
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">fit</p>
                </div>
              )}
            </div>
            <p className="muted mt-2">{c.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {skillNames(c).slice(0, 6).map((s) => (
                <span key={s} className="badge-slate">{s}</span>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-ghost !py-1.5 !text-xs"
                onClick={() => setOpenId(openId === c.id ? null : c.id)}>
                {openId === c.id ? "Hide details" : "View details"}
              </button>
              <button className="btn-primary !py-1.5 !text-xs" onClick={() => void showGaps(c)}>
                Skill-gap analysis
              </button>
              <Link to={`/roadmap?role=${encodeURIComponent(c.name)}`} className="btn-ghost !py-1.5 !text-xs">
                Generate roadmap
              </Link>
            </div>
            {openId === c.id && (
              <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                <DetailList title="Responsibilities" items={c.responsibilities} />
                <DetailList title="Learning roadmap" items={c.roadmap} />
                <DetailList title="Portfolio projects" items={c.projects} />
                <DetailList title="Interview topics" items={c.interview_topics} />
                <DetailList title="Certifications" items={c.certifications} />
                {gapsLoading && <p className="muted">Analyzing your skill gaps…</p>}
                {gaps && gaps.target === c.name && (
                  <div className="anim-fade-up rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
                    <p className="section-title mb-2">Gap analysis vs {gaps.target}</p>
                    {gaps.gaps.slice(0, 8).map((g) => (
                      <div key={g.name} className="mb-2">
                        <ProgressBar value={g.current}
                          label={`${g.name} — need ${g.required.toFixed(0)}% (gap ${g.gap.toFixed(0)})`} />
                      </div>
                    ))}
                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600 dark:text-slate-300">
                      {gaps.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {tab === "recs" && careers && careers.length > 0 && (
        <div className="rounded-lg border border-brand-200 bg-brand-50/60 p-4 text-sm text-brand-800 dark:border-brand-900 dark:bg-brand-950/50 dark:text-brand-200">
          <strong>How scoring works:</strong> fit = overlap between your saved skills and this
          career's required skills (deterministic, no hidden AI). Recommendations re-rank every
          time you update your skills.
        </div>
      )}
    </div>
  );
}

function ScoreRing({ value }: { value: number }) {
  const cls = value >= 70 ? "text-emerald-600" : value >= 40 ? "text-amber-600" : "text-slate-500";
  return <span className={`text-lg font-bold ${cls}`}>{value.toFixed(0)}%</span>;
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <div>
      <p className="label !mb-1">{title}</p>
      <ul className="list-inside list-disc space-y-0.5 text-sm text-slate-600 dark:text-slate-300">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  );
}

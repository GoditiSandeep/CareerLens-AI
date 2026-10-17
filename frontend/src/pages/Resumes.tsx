import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, type JobMatch, type Resume, type ResumeAnalysis } from "../lib/api";
import {
  AnimatedBar,
  AnimatedRing,
  EmptyState,
  ErrorBanner,
  Loader,
  SkillChips,
  Skeleton,
  formatDate,
  useToast,
} from "../components/ui";

// ---- Small presentational helpers (never invent data — they only render what
// the API actually returned, and render nothing when a field is absent). ----

/** Turn a raw technical field name ("why_not_match") into readable text. */
function humanize(raw: string): string {
  return raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Visual tone for a 0–100 score. Shared by rings, bars and badges. */
function scoreAccent(score: number): "green" | "amber" | "rose" {
  return score >= 70 ? "green" : score >= 45 ? "amber" : "rose";
}
function scoreColor(score: number): string {
  return score >= 70 ? "#10b981" : score >= 45 ? "#f59e0b" : "#f43f5e";
}

/** Safe numeric coercion so a missing/unexpected field never crashes the UI. */
function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Render a short human explanation from a possibly-missing string. */
function Line({ text }: { text?: string | null }) {
  if (!text) return null;
  return <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{text}</p>;
}

// ---- Safe advisory-list rendering ------------------------------------------
// Advice from the API is not guaranteed to be clean prose: an entry can arrive
// as a plain sentence, a raw JSON blob (the backend may persist the model's
// response verbatim), a Python-style dict string, a nested object, null, or
// something unexpected. These helpers reduce any value to readable text and
// silently drop anything that would render as raw JSON or a dictionary.

/** Object fields whose values are genuine advice worth showing as-is. */
const ADVICE_KEYS = new Set([
  "summary", "recommendation", "recommendations", "advice", "tip", "tips",
  "message", "text", "detail", "details", "description", "action", "note",
  "reason", "suggestion", "insight", "guidance", "rationale", "explanation",
]);
/** Object fields holding relevant skills / short labels rather than prose. */
const SKILL_KEYS = new Set([
  "skill", "skills", "keyword", "keywords", "name", "title", "label",
  "technology", "technologies", "stack", "role", "position",
]);

function isPreferredKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[\s-]+/g, "_");
  return ADVICE_KEYS.has(k) || SKILL_KEYS.has(k);
}

/** Collapse whitespace so a long blob renders as one tidy line. */
function tidy(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Strip markdown code fences that models sometimes wrap payloads in. */
function stripFences(s: string): string {
  return s
    .replace(/^\s*```(?:json|javascript|js|python|py)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

/** Heuristic: does this string contain a JSON / Python-dict payload? */
function looksStructured(s: string): boolean {
  const t = stripFences(s);
  if (t.startsWith("{") && t.endsWith("}")) return true;
  if (t.startsWith("[") && t.endsWith("]")) return true;
  // e.g. prose followed by an embedded {"key": ...} fragment.
  return /[{\[][\s\S]*[}\]]/.test(t) && /["']\s*:/.test(t);
}

/** True for sentence-like prose we are happy to display verbatim. */
function isReadableProse(s: string): boolean {
  const t = s.trim();
  return t.length >= 12 && t.includes(" ") && /[a-z]/i.test(t);
}

/**
 * Best-effort recovery from unparsable JSON / Python dict reprs (truncated or
 * single-quoted): keep only quoted values that read like real sentences so no
 * structural text ever reaches the screen.
 */
function salvageQuoted(raw: string): string[] {
  const out: string[] = [];
  const re = /"([^"\\]{12,})"|'([^'\\]{12,})'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const cand = tidy(m[1] ?? m[2] ?? "");
    if (isReadableProse(cand)) out.push(cand);
  }
  return out;
}

/**
 * Recursively reduce any API value to display-ready strings: structured
 * strings are parsed (or salvaged), arrays are flattened, objects contribute
 * their readable fields, and everything else is dropped.
 */
function collect(value: unknown, keyHint = "", depth = 0): string[] {
  if (depth > 5 || value === null || value === undefined) return [];
  if (typeof value === "string") {
    const t = tidy(value);
    if (!t) return [];
    if (looksStructured(t)) {
      const bare = stripFences(t);
      try {
        return collect(JSON.parse(bare), "", depth + 1);
      } catch {
        return salvageQuoted(bare); // never fall back to raw structural text
      }
    }
    // Top-level items, preferred fields, and real prose are all displayable.
    if (!keyHint || isPreferredKey(keyHint) || isReadableProse(t)) return [t];
    return [];
  }
  if (typeof value === "number") {
    return Number.isFinite(value) && isPreferredKey(keyHint)
      ? [`${cap(humanize(keyHint))}: ${value}`]
      : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collect(item, keyHint, depth + 1));
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      collect(v, k, depth + 1),
    );
  }
  return [];
}

/**
 * Public helper: safely turn a possibly-missing or unexpected API value into a
 * flat, de-duplicated list of readable strings — never raw JSON or dicts.
 */
function toReadableList(value: unknown): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of collect(value)) {
    const text = item.length > 400 ? `${item.slice(0, 400).trimEnd()}…` : item;
    if (seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= 30) break;
  }
  return out;
}

export default function Resumes() {
  const notify = useToast();
  const [resumes, setResumes] = useState<Resume[] | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Resume | null>(null);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [jd, setJd] = useState("");
  const [match, setMatch] = useState<JobMatch | null>(null);
  const [matching, setMatching] = useState(false);
  // Bumped each time a fresh result arrives so entrance animations replay.
  const [analysisKey, setAnalysisKey] = useState(0);
  const [matchKey, setMatchKey] = useState(0);

  const load = useCallback(async () => {
    setError("");
    try {
      const list = await api.get<Resume[]>("/resumes");
      setResumes(list);
      if (list.length > 0 && !selected) setSelected(list[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load resumes");
    }
  }, [selected]);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("file") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      notify("Max file size is 5 MB", "error");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const created = await api.upload<Resume>("/resumes/upload", form);
      notify(`Uploaded ${created.original_filename}`, "success");
      input.value = "";
      setSelected(created);
      setAnalysis(null);
      setMatch(null);
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const analyze = async () => {
    if (!selected) return;
    setAnalyzing(true);
    setMatch(null);
    try {
      await api.post(`/resumes/${selected.id}/analyze`);
      setAnalysis(await api.get<ResumeAnalysis>(`/resumes/${selected.id}/analysis`));
      setAnalysisKey((k) => k + 1);
      notify("Analysis complete", "success");
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Analysis failed", "error");
    } finally {
      setAnalyzing(false);
    }
  };

  const runMatch = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected || jd.trim().length < 20) {
      notify("Paste at least 20 characters of job description", "error");
      return;
    }
    setMatching(true);
    try {
      setMatch(await api.post<JobMatch>(`/resumes/${selected.id}/job-match`, {
        job_description: jd.trim(),
      }));
      setMatchKey((k) => k + 1);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Match failed", "error");
    } finally {
      setMatching(false);
    }
  };

  const remove = async (r: Resume) => {
    if (!window.confirm(`Delete "${r.original_filename}"? This cannot be undone.`)) return;
    try {
      await api.del(`/resumes/${r.id}`);
      notify("Resume deleted", "info");
      if (selected?.id === r.id) {
        setSelected(null);
        setAnalysis(null);
        setMatch(null);
      }
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Delete failed", "error");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Resume lab</h1>
        <p className="page-sub">
          Upload a PDF/DOCX/TXT, get an ATS-style score, section checks and job-description match.
          Analysis runs locally — resume data never leaves your server.
        </p>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4">
          <form onSubmit={upload} className="card">
            <p className="section-title mb-3">Upload resume</p>
            <input type="file" name="file" accept=".pdf,.docx,.doc,.txt" className="input !py-2"
              aria-label="Resume file" required />
            <button className="btn-primary mt-3 w-full" disabled={uploading}>
              {uploading ? "Uploading…" : "Upload"}
            </button>
            <p className="muted mt-2 text-xs">PDF, DOCX or TXT · up to 5 MB · stored privately.</p>
          </form>

          <div className="card">
            <p className="section-title mb-3">Your resumes</p>
            {!resumes && <Loader />}
            {resumes && resumes.length === 0 && (
              <EmptyState title="No resumes yet" hint="Upload one to unlock ATS analysis." />
            )}
            <div className="space-y-2">
              {resumes?.map((r) => (
                <div key={r.id}
                  className={`flex items-center justify-between rounded-lg border p-3 text-sm ${selected?.id === r.id
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-950"
                    : "border-slate-200 dark:border-slate-800"}`}>
                  <button className="flex-1 truncate text-left" onClick={() => {
                    setSelected(r);
                    setAnalysis(null);
                    setMatch(null);
                  }}>
                    <span className="font-medium">{r.original_filename ?? r.filename}</span>
                    <span className="block text-xs text-slate-500">{formatDate(r.created_at)}</span>
                  </button>
                  <button className="btn-ghost !px-2 !text-xs" onClick={() => void remove(r)}
                    aria-label="Delete resume">✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-4 lg:col-span-2">
          {!selected && (
            <EmptyState title="Select a resume" hint="Upload or pick one on the left to run analysis." />
          )}

          {selected && (
            <div className="card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {selected.original_filename ?? selected.filename}
                  </p>
                  <p className="muted text-xs">Uploaded {formatDate(selected.created_at)}</p>
                </div>
                <button className="btn-primary" onClick={() => void analyze()} disabled={analyzing}>
                  {analyzing ? "Analyzing…" : analysis ? "↻ Re-run analysis" : "Run ATS analysis"}
                </button>
              </div>

              {/* Skeleton while analyzing — including re-runs (previously gated
                  on `!analysis`, so a second run showed no skeleton and the old
                  results never unmounted → animations never replayed). */}
              {analyzing && (
                <div className="mt-5 space-y-4" aria-hidden>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-[120px] w-[120px] rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-2/5" />
                    </div>
                  </div>
                  <Skeleton className="h-24 w-full" />
                </div>
              )}

              {!analyzing && analysis && (
                <div key={analysisKey} className="mt-5 space-y-6">
                  <div className="anim-fade-up flex flex-col items-center gap-5 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:flex-row dark:border-slate-800 dark:bg-slate-800/50">
                    <AnimatedRing
                      value={num(analysis.ats_score) ?? 0}
                      size={132}
                      thickness={12}
                      label="ATS score"
                      color={scoreColor(num(analysis.ats_score) ?? 0)}
                    />
                    <div className="flex-1 text-center sm:text-left">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Applicant Tracking System score
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                        <ScoreWord score={num(analysis.ats_score)} />
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <MiniStat label="Content match" value={num(analysis.match_score)} accent="green" />
                        <MiniStat label="Missing sections" value={analysis.missing_sections?.length ?? 0} accent="amber" plain />
                      </div>
                    </div>
                  </div>

                  {Object.keys(analysis.categories ?? {}).length > 0 && (
                    <div className="anim-fade-up stagger-1">
                      <p className="section-title mb-3">Category breakdown</p>
                      <div className="space-y-3">
                        {Object.entries(analysis.categories ?? {}).map(([k, v]) => (
                          <AnimatedBar key={k} value={num(v) ?? 0} accent={scoreAccent(num(v) ?? 0)} label={cap(humanize(k))} />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid gap-5 sm:grid-cols-2">
                    <InfoCard title="Strengths" tone="green" icon="✓" items={analysis.strengths} empty="No strengths detected yet." />
                    <InfoCard title="Improvements" tone="rose" icon="!" items={analysis.improvements} empty="Nothing flagged — looks tidy." />
                    <InfoCard title="Missing sections" tone="amber" icon="◇" items={analysis.missing_sections} empty="All key sections present." />
                    <InfoCard title="Recommendations" tone="brand" icon="→" items={analysis.recommendations} empty="Re-run analysis for tailored tips." />
                  </div>

                  {!!analysis.keywords_found?.length && (
                    <div className="anim-fade-up stagger-3">
                      <p className="label">Keywords found in your resume</p>
                      <SkillChips items={toReadableList(analysis.keywords_found)} tone="green" icon="✓" />
                    </div>
                  )}
                </div>
              )}

              {!analysis && !analyzing && (
                <p className="muted mt-4">
                  No analysis yet — click “Run ATS analysis” for scores, gaps and fixes.
                </p>
              )}
            </div>
          )}

          {selected && (
            <form onSubmit={runMatch} className="card">
              <p className="section-title mb-2">Job-description match</p>
              <p className="muted mb-2 text-xs">
                Paste a JD (min. 20 chars) to see matched skills, gaps and improvement hints.
              </p>
              <textarea className="input" rows={4} value={jd} onChange={(e) => setJd(e.target.value)}
                placeholder="We are hiring a backend engineer with Python, SQL, Docker…" />
              <button className="btn-primary mt-3" disabled={matching}>
                {matching ? "Matching…" : "Match resume to JD"}
              </button>

              {/* Same re-run fix as the analysis skeleton above. */}
              {matching && (
                <div className="mt-5 space-y-4" aria-hidden>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-[120px] w-[120px] rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                  <Skeleton className="h-20 w-full" />
                </div>
              )}

              {!matching && match && <JobMatchReport key={matchKey} match={match} />}

              {!match && !matching && (
                <p className="muted mt-3 text-xs">
                  Your match report appears here — nothing is stored until you run it.
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Result presentational components ----

/** Short human verdict for a 0–100 score; renders "—" when the score is absent. */
function ScoreWord({ score }: { score: number | null }) {
  if (score === null) return <>—</>;
  const word = score >= 80 ? "Excellent" : score >= 65 ? "Strong" : score >= 45 ? "Fair" : "Needs work";
  return <>{word} <span className="text-sm font-medium text-slate-400">· {score.toFixed(0)}/100</span></>;
}

function MiniStat({ label, value, accent, plain }: {
  label: string;
  value: number | null;
  accent: "green" | "amber" | "rose";
  plain?: boolean;
}) {
  const text = accent === "green" ? "text-emerald-600 dark:text-emerald-400"
    : accent === "amber" ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";
  return (
    <div className="rounded-lg bg-white p-3 text-center shadow-sm dark:bg-slate-900">
      <p className={`text-2xl font-bold ${text}`}>
        {value === null ? "—" : plain ? value : `${Math.round(value)}`}
        {!plain && value !== null && <span className="text-sm font-semibold opacity-70">%</span>}
      </p>
      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

/** A titled card of human-readable bullet points with staggered entrance. */
function InfoCard({ title, items, tone, icon, empty }: {
  title: string;
  /** Raw API value — normalized to readable strings before rendering. */
  items: unknown;
  tone: "green" | "rose" | "amber" | "brand";
  icon: string;
  empty: string;
}) {
  const dot = tone === "green" ? "bg-emerald-500" : tone === "rose" ? "bg-rose-500"
    : tone === "amber" ? "bg-amber-500" : "bg-brand-500";
  const list = toReadableList(items);
  return (
    <div className="anim-fade-up stagger-1 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="mb-2 flex items-center gap-2">
        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${dot}`} aria-hidden>
          {icon}
        </span>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
        <span className="badge-slate ml-auto">{list.length}</span>
      </div>
      {list.length === 0 ? (
        <p className="muted text-xs italic">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {list.map((s, i) => (
            <li
              key={i}
              className={`anim-fade-up stagger-${Math.min(8, i + 1)} flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300`}
            >
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Full job-match report: prominent ring, fit label, skill chips + insights. */
function JobMatchReport({ match }: { match: JobMatch }) {
  const score = num(match.match_score) ?? 0;
  const exp = num(match.experience_match);
  const edu = num(match.education_match);
  // Normalized to readable text — backend advice can embed raw model output.
  const matched = toReadableList(match.matched_skills);
  const missing = toReadableList(match.missing_skills);
  const keywords = toReadableList(match.recommended_keywords);
  const improve = toReadableList(match.what_to_improve);
  const whyMatch = toReadableList(match.why_match);
  const whyNot = toReadableList(match.why_not_match);

  return (
    <div className="mt-5 space-y-6">
      {/* Hero: ring + fit label + recommendation */}
      <div className="anim-fade-up flex flex-col items-center gap-5 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:flex-row dark:border-slate-800 dark:bg-slate-800/50">
        <AnimatedRing value={score} size={132} thickness={12} label="JD match" color={scoreColor(score)} />
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <span className={score >= 60 ? "badge-green" : score >= 45 ? "badge-amber" : "badge-rose"}>
              {score.toFixed(0)}% match
            </span>
            {match.role_suitability && (
              <span className="text-base font-semibold text-slate-900 dark:text-white">
                {match.role_suitability}
              </span>
            )}
          </div>
          <Line text={match.recommendation} />
          {(exp !== null || edu !== null) && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {exp !== null && <MiniStat label="Experience fit" value={exp} accent={scoreAccent(exp)} />}
              {edu !== null && <MiniStat label="Education fit" value={edu} accent={scoreAccent(edu)} />}
            </div>
          )}
        </div>
      </div>

      {/* Matched vs missing skills */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="anim-fade-up stagger-1 rounded-xl border border-emerald-200 p-4 dark:border-emerald-900">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            <span aria-hidden>✓</span> Matched skills
            <span className="badge-green ml-auto">{matched.length}</span>
          </p>
          <SkillChips items={matched} tone="green"
            emptyHint="No exact keyword overlaps found — your transferable skills may still apply." />
        </div>
        <div className="anim-fade-up stagger-2 rounded-xl border border-rose-200 p-4 dark:border-rose-900">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-300">
            <span aria-hidden>!</span> Missing skills
            <span className="badge-rose ml-auto">{missing.length}</span>
          </p>
          <SkillChips items={missing} tone="rose"
            emptyHint="Nothing missing — you cover the JD's keywords." />
        </div>
      </div>

      {!!keywords.length && (
        <div className="anim-fade-up stagger-2">
          <p className="label">Add these keywords to strengthen your resume</p>
          <SkillChips items={keywords} tone="amber" icon="+" />
        </div>
      )}

      {/* Insights */}
      <div className="grid gap-5 sm:grid-cols-2">
        {whyMatch.length > 0 && <InfoCard title="Why you match" tone="green" icon="✓" items={whyMatch} empty="—" />}
        {whyNot.length > 0 && <InfoCard title="Where you fall short" tone="rose" icon="!" items={whyNot} empty="—" />}
        {improve.length > 0 && (
          <div className={whyMatch.length > 0 && whyNot.length > 0 ? "sm:col-span-2" : ""}>
            <InfoCard title="What to improve" tone="amber" icon="→" items={improve} empty="—" />
          </div>
        )}
      </div>
    </div>
  );
}

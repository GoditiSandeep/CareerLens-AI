import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, type JobMatch, type Resume, type ResumeAnalysis } from "../lib/api";
import { EmptyState, ErrorBanner, Loader, formatDate, useToast } from "../components/ui";

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

              {analysis && (
                <div className="mt-5 space-y-5">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 p-4 text-center dark:bg-slate-800">
                      <p className="text-3xl font-bold text-brand-600">{analysis.ats_score.toFixed(0)}</p>
                      <p className="text-xs text-slate-500">ATS score</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-4 text-center dark:bg-slate-800">
                      <p className="text-3xl font-bold text-emerald-600">{analysis.match_score.toFixed(0)}</p>
                      <p className="text-xs text-slate-500">Content match</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-4 text-center dark:bg-slate-800">
                      <p className="text-3xl font-bold text-amber-600">{analysis.missing_sections.length}</p>
                      <p className="text-xs text-slate-500">Missing sections</p>
                    </div>
                  </div>

                  <div>
                    <p className="section-title mb-2">Category breakdown</p>
                    {Object.entries(analysis.categories ?? {}).map(([k, v]) => (
                      <div key={k} className="mb-2 flex items-center gap-3">
                        <span className="w-40 shrink-0 text-xs capitalize text-slate-500">
                          {k.replace(/_/g, " ")}
                        </span>
                        <div className="progress-track flex-1">
                          <div className="progress-fill" style={{ width: `${v}%` }} />
                        </div>
                        <span className="w-10 text-right text-xs font-semibold">{Math.round(v)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <ListBlock title="Strengths" items={analysis.strengths} tone="green" />
                    <ListBlock title="Improvements" items={analysis.improvements} tone="rose" />
                    <ListBlock title="Missing sections" items={analysis.missing_sections} tone="amber" />
                    <ListBlock title="Recommendations" items={analysis.recommendations} tone="brand" />
                    {!!analysis.keywords_found?.length && (
                      <div className="sm:col-span-2">
                        <p className="label">Keywords found</p>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.keywords_found.map((k) => <span key={k} className="badge-green">{k}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!analysis && (
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

              {match && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className={match.match_score >= 60 ? "badge-green" : "badge-amber"}>
                      {match.match_score.toFixed(0)}% match
                    </span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {match.role_suitability || "Match report"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{match.recommendation}</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ListBlock title="Matched skills" items={match.matched_skills} tone="green" />
                    <ListBlock title="Missing skills" items={match.missing_skills} tone="rose" />
                    <ListBlock title="Why it matches" items={match.why_match} tone="brand" />
                    <ListBlock title="What to improve" items={match.what_to_improve} tone="amber" />
                  </div>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function ListBlock({ title, items, tone }: {
  title: string;
  items: string[];
  tone: "green" | "rose" | "amber" | "brand";
}) {
  const dot = tone === "green" ? "bg-emerald-500" : tone === "rose" ? "bg-rose-500"
    : tone === "amber" ? "bg-amber-500" : "bg-brand-500";
  return (
    <div>
      <p className="label">{title}</p>
      {(!items || items.length === 0) && <p className="muted text-xs">None</p>}
      <ul className="space-y-1">
        {items?.map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

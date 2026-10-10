import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Job } from "../lib/api";
import { EmptyState, ErrorBanner, Loader, ScoreBadge, useToast } from "../components/ui";

export default function Jobs() {
  const notify = useToast();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [jobType, setJobType] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (workMode) params.set("work_mode", workMode);
      if (jobType) params.set("job_type", jobType);
      const qs = params.toString();
      setJobs(await api.get<Job[]>(`/jobs${qs ? `?${qs}` : ""}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    }
  }, [q, workMode, jobType]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(t);
  }, [load]);

  const toggleSave = async (job: Job) => {
    setBusyId(job.id);
    try {
      if (job.saved) {
        await api.del(`/jobs/${job.id}/save`);
        notify("Removed from saved jobs", "info");
      } else {
        await api.post(`/jobs/${job.id}/save`);
        notify("Saved to your list", "success");
      }
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Action failed", "error");
    } finally {
      setBusyId(null);
    }
  };

  const apply = async (job: Job) => {
    setBusyId(job.id);
    try {
      await api.post(`/jobs/${job.id}/apply`);
      notify(`Applied to ${job.title} — tracked in Applications`, "success");
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Apply failed", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Job & internship discovery</h1>
          <p className="page-sub">
            Seeded sample listings (not live postings) ranked by skill overlap with your profile.
          </p>
        </div>
        <Link to="/applications" className="btn-ghost">Open application board →</Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search title or company…" value={q}
          onChange={(e) => setQ(e.target.value)} aria-label="Search jobs" />
        <select className="input !w-40" value={workMode} onChange={(e) => setWorkMode(e.target.value)}
          aria-label="Work mode filter">
          <option value="">Any work mode</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
          <option value="onsite">On-site</option>
        </select>
        <select className="input !w-44" value={jobType} onChange={(e) => setJobType(e.target.value)}
          aria-label="Job type filter">
          <option value="">Any type</option>
          <option value="full_time">Full-time</option>
          <option value="internship">Internship</option>
          <option value="part_time">Part-time</option>
        </select>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}
      {!jobs && !error && <Loader />}

      {jobs && jobs.length === 0 && (
        <EmptyState title="No jobs match these filters"
          action={<button className="btn-ghost"
            onClick={() => { setQ(""); setWorkMode(""); setJobType(""); }}>
            Clear filters
          </button>} />
      )}

      <div className="space-y-4">
        {jobs?.map((job) => (
          <div key={job.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{job.title}</p>
                <p className="text-sm text-slate-500">
                  {job.company} · {job.location} · {job.work_mode} · {job.job_type.replace("_", "-")}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <ScoreBadge score={job.match_score} />
                  {job.salary && <span className="badge-green">{job.salary}</span>}
                  {job.industry && <span className="badge-slate">{job.industry}</span>}
                  {job.experience_label && <span className="badge-slate">{job.experience_label}</span>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-ghost !py-1.5 !text-xs" disabled={busyId === job.id}
                  onClick={() => void toggleSave(job)}>
                  {job.saved ? "★ Saved" : "☆ Save"}
                </button>
                <button className="btn-primary !py-1.5 !text-xs" disabled={busyId === job.id}
                  onClick={() => void apply(job)}>
                  Apply
                </button>
                <button className="btn-ghost !py-1.5 !text-xs"
                  onClick={() => setExpanded(expanded === job.id ? null : job.id)}>
                  {expanded === job.id ? "Hide" : "Details"}
                </button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {job.skills.slice(0, 8).map((s) => <span key={s} className="badge-slate">{s}</span>)}
            </div>
            {expanded === job.id && (
              <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
                <p className="muted whitespace-pre-line">{job.description}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {job.posted_on ? `Sample listing dated ${job.posted_on}` : "Seeded sample listing"}
                  {" · "}Match % = skill overlap with your saved skills.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

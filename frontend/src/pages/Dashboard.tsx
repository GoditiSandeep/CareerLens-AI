import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api, type DashboardData } from "../lib/api";
import { ErrorBanner, Loader, StatCard, useToast } from "../components/ui";

const PIE_COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#f43f5e", "#06b6d4", "#8b5cf6", "#84cc16", "#64748b"];

export default function Dashboard() {
  const notify = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await api.get<DashboardData>("/dashboard"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!data) return <Loader label="Computing your readiness…" />;

  const breakdownData = Object.entries(data.breakdown ?? {}).map(([name, value]) => ({
    name: name.replace(/_/g, " "),
    value: Math.round(value),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Your dashboard</h1>
          <p className="page-sub">
            Live readiness snapshot — every number comes from your actual profile and activity.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/roadmap" className="btn-ghost">My roadmap</Link>
          <Link to="/chat" className="btn-primary">Ask AI mentor</Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Career readiness" value={`${data.career_readiness.toFixed(0)}%`} hint="Overall index" />
        <StatCard label="Skill score" value={`${data.skill_score.toFixed(0)}%`} hint="Vs target roles" accent="green" />
        <StatCard label="Resume ATS" value={`${data.ats_score.toFixed(0)}%`} hint={data.ats_score ? "Latest analysis" : "Upload a resume"} accent="amber" />
        <StatCard label="Interview readiness" value={`${data.interview_score.toFixed(0)}%`} hint="Practice sessions" accent="rose" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <p className="section-title mb-3">Readiness breakdown</p>
          {breakdownData.length === 0 ? (
            <p className="muted">No breakdown data yet — complete onboarding first.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={breakdownData} margin={{ left: -20, right: 8, top: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={56} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}`, "score"]} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {breakdownData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="card">
          <p className="section-title mb-3">Next best actions</p>
          {data.next_actions?.length ? (
            <ul className="space-y-3">
              {data.next_actions.map((a, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="badge-brand !px-2">{i + 1}</span>
                  <span className="text-slate-700 dark:text-slate-300">{a}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">All caught up — add skills or resume analysis to get new actions.</p>
          )}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card">
          <p className="section-title mb-3">Activity</p>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <p className="text-2xl font-bold text-brand-600">{data.total_applications}</p>
              <p className="text-xs text-slate-500">Applications</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <p className="text-2xl font-bold text-emerald-600">{data.saved_jobs}</p>
              <p className="text-xs text-slate-500">Saved jobs</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <p className="text-2xl font-bold text-amber-600">{data.profile_completeness.toFixed(0)}%</p>
              <p className="text-xs text-slate-500">Profile complete</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <p className="text-2xl font-bold text-violet-600">{data.learning_progress.toFixed(0)}%</p>
              <p className="text-xs text-slate-500">Roadmap progress</p>
            </div>
          </div>
        </div>

        <div className="card">
          <p className="section-title mb-3">Recommended roles</p>
          <div className="flex flex-wrap gap-2">
            {data.recommended_roles?.length ? (
              data.recommended_roles.map((r) => (
                <Link key={r} to={`/careers?q=${encodeURIComponent(r)}`} className="badge-brand hover:underline">
                  {r}
                </Link>
              ))
            ) : (
              <p className="muted">Add skills to unlock role recommendations.</p>
            )}
          </div>
          <div className="mt-4 h-40">
            {breakdownData.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={breakdownData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={64}
                    paddingAngle={2} strokeWidth={0}>
                    {breakdownData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${v}`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card flex flex-col justify-between">
          <div>
            <p className="section-title">Quick start</p>
            <p className="muted mt-1">Pick up where you left off.</p>
          </div>
          <div className="mt-4 space-y-2">
            <Link to="/resumes" className="btn-ghost w-full justify-start">✎ Analyze my resume</Link>
            <Link to="/practice" className="btn-ghost w-full justify-start">◉ Start interview practice</Link>
            <Link to="/jobs" className="btn-ghost w-full justify-start">⌂ Browse matched jobs</Link>
          </div>
        </div>
      </div>
      <button
        onClick={() => { void load(); notify("Dashboard refreshed", "info"); }}
        className="btn-ghost !text-xs"
      >
        ↻ Refresh data
      </button>
    </div>
  );
}

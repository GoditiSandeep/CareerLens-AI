// Growth Planner page.
//
// Persistent, adaptive weekly planning for the signed-in user. All data comes
// from the backend /planner endpoints:
//
//   GET   /planner/settings   -> goal, deadline, weekly capacity, study days
//   PUT   /planner/settings   -> update capacity/goal/study days
//   GET   /planner/tasks      -> tasks (optionally ?status=)
//   POST  /planner/tasks      -> create a task (auto-prioritised)
//   PATCH /planner/tasks/{id} -> update / mark complete / skip
//   DELETE /planner/tasks/{id}-> remove
//   POST  /planner/schedule   -> auto-place unscheduled tasks onto study days
//   POST  /planner/reschedule -> move overdue tasks forward
//   GET   /planner/review     -> weekly review + honest suggestions
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  plannerApi,
  type PlannerSettings,
  type PlannerTask,
  type PlannerWeekReview,
} from "../lib/api";
import { AnimatedRing, ErrorBanner, GlassCard, Loader, ProgressBar, Reveal, TiltCard, useToast } from "../components/ui";

const CATEGORY_LABELS: Record<string, string> = {
  learning: "Learning",
  revision: "Revision",
  project: "Project",
  application: "Application",
  interview: "Interview",
};

// Weekday ints (0=Mon .. 6=Sun) match the backend's study_days encoding.
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function studyDaysOf(s: PlannerSettings): number[] {
  try {
    const parsed = JSON.parse(s.study_days || "[]");
    return Array.isArray(parsed) ? parsed.map(Number) : [];
  } catch {
    return [];
  }
}

export default function GrowthPlanner() {
  const { user, loading } = useAuth();
  const notify = useToast();

  const [settings, setSettings] = useState<PlannerSettings | null>(null);
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [review, setReview] = useState<PlannerWeekReview | null>(null);
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("learning");
  const [targetDate, setTargetDate] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [s, t, r] = await Promise.all([
        plannerApi.getSettings(),
        plannerApi.listTasks(),
        plannerApi.review().catch(() => null),
      ]);
      setSettings(s);
      setTasks(t);
      setReview(r);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    load();
  }, [loading, user, load]);

  const createTask = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim()) return;
      setBusy(true);
      setError("");
      try {
        await plannerApi.createTask({
          title: title.trim(),
          category,
          target_date: targetDate || null,
          estimated_minutes: estimatedMinutes ? Number(estimatedMinutes) : undefined,
        });
        setTitle("");
        setTargetDate("");
        setEstimatedMinutes("");
        notify("Task added", "success");
        await load();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [title, category, targetDate, estimatedMinutes, load, notify],
  );

  const setStatus = useCallback(
    async (id: number, status: string) => {
      try {
        await plannerApi.updateTask(id, { status });
        await load();
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [load],
  );

  const removeTask = useCallback(
    async (id: number) => {
      try {
        await plannerApi.deleteTask(id);
        await load();
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [load],
  );

  const runSchedule = useCallback(async () => {
    setBusy(true);
    try {
      await plannerApi.schedule();
      notify("Unscheduled tasks placed on your study days", "success");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [load, notify]);

  const runReschedule = useCallback(async () => {
    setBusy(true);
    try {
      const r = await plannerApi.reschedule();
      notify(
        r.count ? `Moved ${r.count} overdue task(s) forward` : "Nothing overdue to move",
        "success",
      );
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [load, notify]);

  const toggleStudyDay = useCallback(
    async (day: number) => {
      if (!settings) return;
      const current = studyDaysOf(settings);
      const next = current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day].sort();
      try {
        const updated = await plannerApi.updateSettings({ study_days: next });
        setSettings(updated);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [settings],
  );

  const setCapacity = useCallback(
    async (hours: number) => {
      if (!settings) return;
      try {
        const updated = await plannerApi.updateSettings({ hours_per_week: hours });
        setSettings(updated);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [settings],
  );

  if (loading || !user) return <Loader label="Loading your growth plan…" />;

  const studyDays = settings ? studyDaysOf(settings) : [];
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const activeTasks = tasks.filter((t) => t.status !== "completed");

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="page-title">Growth Planner</h1>
            <p className="page-sub">
              Persistent, adaptive weekly planning grounded in your own tasks — no
              fabricated data.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={load} disabled={busy}>Reload</button>
            <button className="btn-ghost" onClick={runSchedule} disabled={busy}>Auto-schedule</button>
            <button className="btn-ghost" onClick={runReschedule} disabled={busy}>Move overdue</button>
          </div>
        </div>
      </Reveal>

      {error && <ErrorBanner message={error} />}

      {settings && (
        <Reveal>
          <TiltCard>
            <GlassCard className="p-4 sm:p-5 space-y-4" sheen>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <AnimatedRing
                    value={tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0}
                    size={96}
                    thickness={9}
                    label="Done"
                    color="#22d3ee"
                    trackClassName="stroke-brand-100 dark:stroke-slate-700"
                  />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Target role</p>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{settings.target_role ?? "Not set"}</h2>
                    {settings.goal_deadline && (
                      <p className="muted mt-1 text-xs">
                        Goal deadline: {new Date(settings.goal_deadline).toLocaleDateString()}
                      </p>
                    )}
                    <p className="muted mt-1 text-xs">
                      {completedTasks.length} of {tasks.length} tasks completed
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Weekly capacity</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{settings.hours_per_week} hrs/week</p>
                </div>
              </div>

            <div>
              <p className="section-title mb-2">Study days</p>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((label, idx) => {
                  const on = studyDays.includes(idx);
                  return (
                    <button
                      key={label}
                      className={on ? "badge-green" : "badge-slate"}
                      onClick={() => toggleStudyDay(idx)}
                      aria-pressed={on}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="section-title mb-2">Weekly capacity (hours)</p>
              <div className="flex flex-wrap gap-2">
                {[2, 4, 6, 8, 12, 16].map((h) => (
                  <button
                    key={h}
                    className={settings.hours_per_week === h ? "badge-brand" : "badge-slate"}
                    onClick={() => setCapacity(h)}
                    aria-pressed={settings.hours_per_week === h}
                  >
                    {h}h
                  </button>
                ))}
              </div>
              </div>
            </GlassCard>
          </TiltCard>
        </Reveal>
      )}

      <Reveal>
        <form className="card p-4 sm:p-5" onSubmit={createTask}>
          <p className="section-title">Add a task</p>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="label">Title</label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Finish REST API project"
                required
              />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Target date</label>
              <input
                className="input"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="label mb-0">Est. minutes</label>
            <input
              className="input w-28"
              type="number"
              min={5}
              max={600}
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
              placeholder="auto"
            />
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Adding…" : "Add task"}
            </button>
          </div>
        </form>
      </Reveal>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Reveal>
            <div className="card p-4 sm:p-5">
              <p className="section-title">Active tasks ({activeTasks.length})</p>
              {activeTasks.length === 0 ? (
                <p className="muted text-sm">No active tasks. Add one above, then auto-schedule.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  {activeTasks.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{t.title}</p>
                        <p className="muted text-xs">
                          {CATEGORY_LABELS[t.category] ?? t.category} · {t.estimated_minutes} min · priority {t.priority}
                          {t.target_date
                            ? ` · due ${new Date(t.target_date).toLocaleDateString()}`
                            : " · unscheduled"}
                          {t.is_milestone ? " · milestone" : ""}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        <button className="btn-ghost btn-sm text-emerald-600" onClick={() => setStatus(t.id, "completed")}>Done</button>
                        <button className="btn-ghost btn-sm" onClick={() => setStatus(t.id, "skipped")}>Skip</button>
                        <button className="btn-ghost btn-sm text-rose-600" onClick={() => removeTask(t.id)}>Delete</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Reveal>
        </div>

        <div className="lg:col-span-2 space-y-5">
          <Reveal>
            <div className="card p-4 sm:p-5">
              <p className="section-title">Completed ({completedTasks.length})</p>
              {completedTasks.length === 0 ? (
                <p className="muted text-sm">Nothing completed yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  {completedTasks.slice(0, 8).map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                      <span className="text-slate-700 dark:text-slate-300 truncate">{t.title}</span>
                      <button className="btn-ghost btn-sm" onClick={() => setStatus(t.id, "todo")}>Reopen</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Reveal>

          {review && (
            <Reveal>
              <div className="card p-4 sm:p-5">
                <p className="section-title">Weekly review</p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-2xl font-bold text-emerald-600">{review.completed}</p>
                    <p className="muted text-xs">done</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-600">{review.skipped}</p>
                    <p className="muted text-xs">skipped</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-brand-600">{review.pending}</p>
                    <p className="muted text-xs">pending</p>
                  </div>
                </div>
                <div className="mt-3">
                  <ProgressBar
                    value={review.minutes_planned
                      ? Math.round((review.minutes_completed / review.minutes_planned) * 100)
                      : 0}
                    label={`${review.minutes_completed} / ${review.minutes_planned} min completed`}
                  />
                </div>
                {review.suggestions.length > 0 && (
                  <ul className="muted mt-3 list-disc space-y-1 pl-4 text-xs">
                    {review.suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </div>
  );
}

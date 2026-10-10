import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type Career, type Roadmap, type RoadmapItem } from "../lib/api";
import { EmptyState, ErrorBanner, Loader, ProgressBar, formatDate, useToast } from "../components/ui";

const STATUS_STYLE: Record<string, string> = {
  pending: "badge-slate",
  in_progress: "badge-amber",
  completed: "badge-green",
};

export default function Roadmap() {
  const notify = useToast();
  const [params, setParams] = useSearchParams();
  const [roadmaps, setRoadmaps] = useState<Roadmap[] | null>(null);
  const [careers, setCareers] = useState<Career[]>([]);
  const [error, setError] = useState("");
  const [role, setRole] = useState("");
  const [months, setMonths] = useState(6);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const [rms, cs] = await Promise.all([
        api.get<Roadmap[]>("/roadmap"),
        api.get<Career[]>("/careers"),
      ]);
      setRoadmaps(rms);
      setCareers(cs);
      setSelectedId((cur) => (cur ?? rms[0]?.id ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load roadmaps");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const r = params.get("role");
    if (r) setRole(r);
  }, [params]);

  const generate = async () => {
    if (!role.trim()) {
      notify("Pick a target role first", "error");
      return;
    }
    setBusy(true);
    try {
      const created = await api.post<Roadmap>("/roadmap/generate", { target_role: role.trim(), months });
      notify(`Generated "${created.title}"`, "success");
      setParams({});
      setSelectedId(created.id);
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Generation failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const updateItem = async (item: RoadmapItem, patch: Record<string, unknown>) => {
    try {
      await api.put<RoadmapItem>(`/roadmap/items/${item.id}`, patch);
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Update failed", "error");
    }
  };

  const current = roadmaps?.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Learning roadmap & planner</h1>
        <p className="page-sub">
          Generate a month-by-month plan for any role, then track tasks, deadlines and progress.
        </p>
      </div>

      <div className="card grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="targetRole">Target role</label>
          <select id="targetRole" className="input" value={role}
            onChange={(e) => setRole(e.target.value)}>
            <option value="">Choose a career path…</option>
            {careers.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="months">Duration</label>
          <select id="months" className="input" value={months}
            onChange={(e) => setMonths(Number(e.target.value))}>
            {[3, 4, 6, 9, 12].map((m) => <option key={m} value={m}>{m} months</option>)}
          </select>
        </div>
        <button className="btn-primary" onClick={() => void generate()} disabled={busy}>
          {busy ? "Generating…" : "Generate plan"}
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}
      {!roadmaps && !error && <Loader label="Loading roadmaps…" />}

      {roadmaps && roadmaps.length === 0 && (
        <EmptyState title="No roadmaps yet"
          hint="Pick a target role above and generate your first plan. Each month gets goals, resources and a deadline." />
      )}

      {roadmaps && roadmaps.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {roadmaps.map((r) => (
            <button key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={`rounded-lg border px-3 py-2 text-sm ${selectedId === r.id
                ? "border-brand-600 bg-brand-50 font-semibold text-brand-700 dark:bg-brand-950"
                : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}>
              {r.title}
            </button>
          ))}
        </div>
      )}

      {current && (
        <div className="card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="section-title">{current.title}</p>
              <p className="muted text-xs">
                Target: {current.career_path_name} · {current.total_months} months ·
                generated {formatDate(current.generated_at)}
              </p>
            </div>
            <div className="w-48">
              <ProgressBar value={current.progress} label="Overall progress" />
            </div>
          </div>
          <div className="space-y-3">
            {current.items.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge-brand">Month {item.month}</span>
                      <span className={STATUS_STYLE[item.status] ?? "badge-slate"}>
                        {item.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="mt-1.5 font-medium text-slate-800 dark:text-slate-200">{item.title}</p>
                    <p className="muted mt-0.5 text-xs">{item.description}</p>
                    {item.deadline && (
                      <p className="mt-1 text-xs text-slate-500">Deadline: {formatDate(item.deadline)}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <select className="input !w-36 !py-1.5 !text-xs" value={item.status}
                      aria-label={`Status for ${item.title}`}
                      onChange={(e) => void updateItem(item, { status: e.target.value })}>
                      <option value="pending">pending</option>
                      <option value="in_progress">in progress</option>
                      <option value="completed">completed</option>
                    </select>
                    <input type="date" className="input !w-36 !py-1.5 !text-xs"
                      aria-label={`Deadline for ${item.title}`}
                      value={item.deadline ?? ""}
                      onChange={(e) => void updateItem(item, { deadline: e.target.value || null })} />
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-brand-600">
                    Resources & notes
                  </summary>
                  <p className="muted mt-1 text-xs">{item.resources}</p>
                  <textarea className="input mt-2" rows={2} placeholder="Personal notes…"
                    defaultValue={item.notes ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (item.notes ?? "")) {
                        void updateItem(item, { notes: e.target.value });
                      }
                    }} />
                </details>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

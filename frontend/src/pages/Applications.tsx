import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, type Application } from "../lib/api";
import { EmptyState, ErrorBanner, Loader, formatDate, useToast } from "../components/ui";

const STATUSES = [
  { key: "wishlist", label: "Wishlist", cls: "border-slate-300 dark:border-slate-600" },
  { key: "applied", label: "Applied", cls: "border-brand-400" },
  { key: "assessment", label: "Assessment", cls: "border-amber-400" },
  { key: "interview", label: "Interview", cls: "border-violet-400" },
  { key: "offer", label: "Offer", cls: "border-emerald-400" },
  { key: "rejected", label: "Rejected", cls: "border-rose-400" },
] as const;

export default function Applications() {
  const notify = useToast();
  const [apps, setApps] = useState<Application[] | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ company: "", role: "", status: "wishlist", job_url: "", notes: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setApps(await api.get<Application[]>("/applications"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load applications");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const move = async (app: Application, status: string) => {
    try {
      await api.put(`/applications/${app.id}`, { status });
      notify(`Moved to ${status}`, "success");
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Move failed", "error");
    }
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/applications", {
        company: form.company.trim(),
        role: form.role.trim(),
        status: form.status,
        job_url: form.job_url.trim() || null,
        notes: form.notes.trim() || null,
      });
      notify("Application added", "success");
      setForm({ company: "", role: "", status: "wishlist", job_url: "", notes: "" });
      setShowForm(false);
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not add application", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Application tracker</h1>
          <p className="page-sub">Kanban board across every stage — fully keyboard accessible.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/jobs" className="btn-ghost">Find jobs</Link>
          <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Close" : "+ Add application"}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={create} className="card grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="appCompany">Company *</label>
            <input id="appCompany" required className="input" value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="appRole">Role *</label>
            <input id="appRole" required className="input" value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="appStatus">Stage</label>
            <select id="appStatus" className="input" value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="appUrl">Job URL</label>
            <input id="appUrl" type="url" className="input" placeholder="https://…"
              value={form.job_url}
              onChange={(e) => setForm((f) => ({ ...f, job_url: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="appNotes">Notes</label>
            <textarea id="appNotes" className="input" rows={2} value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <button className="btn-primary sm:col-span-2" disabled={busy}>
            {busy ? "Saving…" : "Add to board"}
          </button>
        </form>
      )}

      {error && <ErrorBanner message={error} onRetry={load} />}
      {!apps && !error && <Loader label="Loading board…" />}

      {apps && apps.length === 0 && (
        <EmptyState title="No applications yet"
          hint="Apply from the Jobs page or add opportunities manually to start tracking."
          action={<Link to="/jobs" className="btn-primary">Browse jobs</Link>} />
      )}

      {apps && apps.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {STATUSES.map((col, colIdx) => {
            const items = apps.filter((a) => a.status === col.key);
            return (
              <div key={col.key}
                className={`anim-fade-up stagger-${Math.min(8, colIdx + 1)} rounded-xl border-t-4 bg-slate-100 p-3 dark:bg-slate-900 ${col.cls}`}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    {col.label}
                  </p>
                  <span className="badge-slate">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((a) => (
                    <div key={a.id} className="card anim-pop-in !p-3">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{a.role}</p>
                      <p className="text-xs text-slate-500">{a.company}</p>
                      {a.deadline && (
                        <p className="mt-1 text-xs text-amber-600">Deadline {formatDate(a.deadline)}</p>
                      )}
                      {a.notes && <p className="mt-1 text-xs text-slate-500">{a.notes}</p>}
                      <select className="input mt-2 !py-1 !text-xs" value={a.status}
                        aria-label={`Move ${a.role} at ${a.company}`}
                        onChange={(e) => void move(a, e.target.value)}>
                        {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </div>
                  ))}
                  {items.length === 0 && <p className="px-1 text-xs text-slate-400">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

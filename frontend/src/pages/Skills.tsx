import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, type Skill } from "../lib/api";
import { EmptyState, ErrorBanner, Loader, ProgressBar, useToast } from "../components/ui";

interface CatalogSkill {
  id: number;
  name: string;
  category: string;
}

export default function Skills() {
  const notify = useToast();
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [catalog, setCatalog] = useState<CatalogSkill[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", level: 50, target_level: 80, category: "technical" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [mine, all] = await Promise.all([
        api.get<Skill[]>("/skills/mine"),
        api.get<CatalogSkill[]>("/skills"),
      ]);
      setSkills(mine);
      setCatalog(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load skills");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const res = await api.post<{ created?: string; updated?: string }>("/skills", {
        ...form,
        name: form.name.trim(),
      });
      notify(res.created ? `Added ${res.created}` : `Updated ${res.updated}`, "success");
      setForm((f) => ({ ...f, name: "" }));
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not save skill", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Skills & readiness</h1>
          <p className="page-sub">Track what you know, set targets, and compare against any career path.</p>
        </div>
        <Link to="/careers" className="btn-primary">Analyze gaps vs a career →</Link>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <p className="section-title mb-4">Your skills</p>
          {!skills && !error && <Loader label="Loading skills…" />}
          {skills && skills.length === 0 && (
            <EmptyState title="No skills yet"
              hint="Add your first skill using the form — fit scores and gap analysis use these." />
          )}
          {skills && skills.length > 0 && (
            <div className="space-y-4">
              {skills.map((s, idx) => (
                <div key={s.id} className={`anim-fade-up stagger-${Math.min(8, (idx % 8) + 1)} rounded-lg border border-slate-200 p-3 transition-colors hover:border-brand-300 dark:border-slate-800 dark:hover:border-brand-700`}>
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{s.name}</span>
                      <span className="badge-slate ml-2">{s.category}</span>
                    </div>
                    <span className="text-xs text-slate-500">target {s.target_level ?? 80}%</span>
                  </div>
                  <ProgressBar value={s.level} label="Current level" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <form onSubmit={submit} className="card">
            <p className="section-title mb-3">Add / update skill</p>
            <label className="label" htmlFor="skillName">Skill name *</label>
            <input id="skillName" className="input" required value={form.name}
              placeholder="e.g. React"
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <label className="label mt-3" htmlFor="skillCat">Category</label>
            <select id="skillCat" className="input" value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              <option value="technical">Technical</option>
              <option value="tool">Tool</option>
              <option value="soft">Soft skill</option>
              <option value="domain">Domain</option>
            </select>
            <label className="label mt-3" htmlFor="skillLevel">
              Level: <span className="text-brand-600">{form.level}</span>
            </label>
            <input id="skillLevel" type="range" min={0} max={100} className="w-full accent-brand-600"
              value={form.level}
              onChange={(e) => setForm((f) => ({ ...f, level: Number(e.target.value) }))} />
            <label className="label mt-3" htmlFor="skillTarget">
              Target: <span className="text-brand-600">{form.target_level}</span>
            </label>
            <input id="skillTarget" type="range" min={0} max={100} className="w-full accent-brand-600"
              value={form.target_level}
              onChange={(e) => setForm((f) => ({ ...f, target_level: Number(e.target.value) }))} />
            <button className="btn-primary mt-4 w-full" disabled={busy}>
              {busy ? "Saving…" : "Save skill"}
            </button>
            <p className="muted mt-2 text-xs">Saving an existing name updates it in place — no duplicates.</p>
          </form>

          <div className="card">
            <p className="section-title mb-2">Quick add from catalog</p>
            <div className="flex flex-wrap gap-1.5">
              {catalog.slice(0, 24).map((s) => (
                <button key={s.id} className="badge-slate hover:bg-brand-100"
                  onClick={() => setForm((f) => ({ ...f, name: s.name }))}
                  title={`Add ${s.name}`}>
                  + {s.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

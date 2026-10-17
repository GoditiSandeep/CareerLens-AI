import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, type ProjectIdea, type UserProject } from "../lib/api";
import { EmptyState, ErrorBanner, Loader, useToast } from "../components/ui";

export default function Projects() {
  const notify = useToast();
  const [mine, setMine] = useState<UserProject[] | null>(null);
  const [ideas, setIdeas] = useState<ProjectIdea[] | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", technologies: "", category: "web",
    difficulty: "Beginner", github_url: "", status: "planned",
  });

  const load = useCallback(async () => {
    setError("");
    try {
      const [m, i] = await Promise.all([
        api.get<UserProject[]>("/projects/mine"),
        api.get<ProjectIdea[]>("/projects/recommendations"),
      ]);
      setMine(m);
      setIdeas(i);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/projects/mine", {
        title: form.title.trim(),
        description: form.description.trim(),
        technologies: form.technologies.split(",").map((s) => s.trim()).filter(Boolean),
        category: form.category,
        difficulty: form.difficulty,
        github_url: form.github_url.trim() || null,
        status: form.status,
      });
      notify("Project added to your portfolio", "success");
      setForm({ title: "", description: "", technologies: "", category: "web",
        difficulty: "Beginner", github_url: "", status: "planned" });
      setShowForm(false);
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not add project", "error");
    } finally {
      setBusy(false);
    }
  };

  const startFromIdea = (idea: ProjectIdea) => {
    setForm({
      title: idea.title,
      description: idea.problem_statement,
      technologies: idea.technologies.join(", "),
      category: idea.category,
      difficulty: idea.difficulty,
      github_url: "",
      status: "planned",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Projects & portfolio</h1>
          <p className="page-sub">
            Project ideas ranked by fit with your skills, plus your own portfolio entries.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Close" : "+ Add project"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="card grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="pTitle">Title *</label>
            <input id="pTitle" required className="input" value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="pDesc">Description</label>
            <textarea id="pDesc" className="input" rows={2} value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="pTech">Technologies (comma-separated)</label>
            <input id="pTech" className="input" value={form.technologies}
              onChange={(e) => setForm((f) => ({ ...f, technologies: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="pGithub">GitHub URL</label>
            <input id="pGithub" type="url" className="input" placeholder="https://github.com/…"
              value={form.github_url}
              onChange={(e) => setForm((f) => ({ ...f, github_url: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="pStatus">Status</label>
            <select id="pStatus" className="input" value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="planned">Planned</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pDiff">Difficulty</label>
            <select id="pDiff" className="input" value={form.difficulty}
              onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}>
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </select>
          </div>
          <button className="btn-primary sm:col-span-2" disabled={busy}>
            {busy ? "Saving…" : "Save project"}
          </button>
        </form>
      )}

      {error && <ErrorBanner message={error} onRetry={load} />}
      <div>
        <p className="section-title mb-3">Your portfolio</p>
        {!mine && !error && <Loader />}
        {mine && mine.length === 0 && (
          <EmptyState title="No projects yet"
            hint="Add your class projects, internships or side builds — recruiters look for evidence." />
        )}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mine?.map((p, idx) => (
            <div key={p.id} className={`card card-interactive anim-fade-up stagger-${Math.min(8, (idx % 8) + 1)}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-slate-900 dark:text-white">{p.title}</p>
                <span className={p.status === "completed" ? "badge-green"
                  : p.status === "in_progress" ? "badge-amber" : "badge-slate"}>
                  {p.status.replace("_", " ")}
                </span>
              </div>
              <p className="muted mt-1 text-xs">{p.description}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.technologies.map((t) => <span key={t} className="badge-slate">{t}</span>)}
              </div>
              {p.github_url && (
                <a href={p.github_url} target="_blank" rel="noreferrer"
                  className="mt-2 inline-block text-xs font-medium text-brand-600 hover:underline">
                  View on GitHub ↗
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="section-title mb-1">Recommended ideas</p>
        <p className="muted mb-3 text-xs">
          Ranked by overlap with your saved skills (deterministic — not generated live).
        </p>
        {!ideas && !error && <Loader />}
        <div className="grid gap-4 md:grid-cols-2">
          {ideas?.map((idea, idx) => (
            <div key={idea.title} className={`card card-interactive anim-fade-up stagger-${Math.min(8, (idx % 8) + 1)}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-slate-900 dark:text-white">{idea.title}</p>
                <div className="flex gap-1.5">
                  <span className="badge-slate">{idea.difficulty}</span>
                  <span className="badge-brand">{idea.resume_value} resume value</span>
                </div>
              </div>
              <p className="muted mt-1 text-xs">{idea.problem_statement}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {idea.technologies.slice(0, 6).map((t) => (
                  <span key={t} className="badge-slate">{t}</span>
                ))}
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-brand-600">
                  Features & checklist
                </summary>
                <ul className="mt-1 list-inside list-disc text-xs text-slate-600 dark:text-slate-300">
                  {idea.features.slice(0, 5).map((f, i) => <li key={i}>{f}</li>)}
                  {idea.github_checklist.slice(0, 4).map((f, i) => <li key={`g${i}`}>✓ {f}</li>)}
                </ul>
              </details>
              <button className="btn-ghost mt-2 !py-1.5 !text-xs"
                onClick={() => startFromIdea(idea)}>
                Add to my portfolio
              </button>
            </div>
          ))}
        </div>
        {ideas && ideas.length === 0 && (
          <EmptyState title="No ideas available" hint="Seed data may not be loaded yet." />
        )}
      </div>
    </div>
  );
}

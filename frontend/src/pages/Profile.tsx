import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { api, type Achievement, type Certification, type StudentProfile } from "../lib/api";
import { ErrorBanner, Loader, formatDate, parseList, useToast } from "../components/ui";

export default function Profile() {
  const notify = useToast();
  const { user } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    about: "", location: "", phone: "", college: "", degree: "", branch: "",
    graduation_year: "", current_year: "", cgpa: "", career_goals: "",
    interests: "", desired_roles: "", work_preference: "hybrid",
  });

  const load = useCallback(async () => {
    setError("");
    try {
      const [p, a, c] = await Promise.all([
        api.get<StudentProfile>("/profile"),
        api.get<Achievement[]>("/achievements"),
        api.get<Certification[]>("/certifications"),
      ]);
      setProfile(p);
      setAchievements(a);
      setCerts(c);
      setForm({
        about: p.about ?? "", location: p.location ?? "", phone: p.phone ?? "",
        college: p.college ?? "", degree: p.degree ?? "", branch: p.branch ?? "",
        graduation_year: p.graduation_year?.toString() ?? "",
        current_year: p.current_year?.toString() ?? "",
        cgpa: p.cgpa?.toString() ?? "",
        career_goals: p.career_goals ?? "",
        interests: parseList(p.interests).join(", "),
        desired_roles: parseList(p.desired_roles).join(", "),
        work_preference: p.work_preference ?? "hybrid",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const split = (raw: string) => raw.split(",").map((s) => s.trim()).filter(Boolean);
      await api.put<StudentProfile>("/profile", {
        about: form.about || null,
        location: form.location || null,
        phone: form.phone || null,
        college: form.college || null,
        degree: form.degree || null,
        branch: form.branch || null,
        graduation_year: form.graduation_year ? Number(form.graduation_year) : null,
        current_year: form.current_year ? Number(form.current_year) : null,
        cgpa: form.cgpa ? Number(form.cgpa) : null,
        career_goals: form.career_goals || null,
        interests: split(form.interests),
        desired_roles: split(form.desired_roles),
        work_preference: form.work_preference,
      });
      notify("Profile saved", "success");
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const exportData = async () => {
    try {
      const data = await api.get<unknown>("/profile/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "careerlens-profile-export.json";
      a.click();
      URL.revokeObjectURL(url);
      notify("Profile data exported as JSON", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Export failed", "error");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Profile & settings</h1>
          <p className="page-sub">Your data stays on this server. Export or clear it any time.</p>
        </div>
        <button className="btn-ghost" onClick={() => void exportData()}>
          ⬇ Export my data (JSON)
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}
      {!profile && !error && <Loader label="Loading profile…" />}

      {profile && (
        <form onSubmit={save} className="card anim-fade-up space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
            <div>
              <p className="section-title">{user?.full_name}</p>
              <p className="muted text-xs">{user?.email}</p>
            </div>
            <div className="flex gap-2">
              <span className={profile.onboarding_completed ? "badge-green" : "badge-amber"}>
                {profile.onboarding_completed ? "Onboarding complete" : "Onboarding incomplete"}
              </span>
              {user?.is_demo && <span className="badge-brand">Demo account</span>}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="prAbout">About</label>
            <textarea id="prAbout" className="input" rows={2} value={form.about}
              onChange={(e) => setForm((f) => ({ ...f, about: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="prLoc">Location</label>
              <input id="prLoc" className="input" value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="prPhone">Phone</label>
              <input id="prPhone" className="input" value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="prCgpa">CGPA</label>
              <input id="prCgpa" type="number" step="0.01" min={0} max={10} className="input"
                value={form.cgpa}
                onChange={(e) => setForm((f) => ({ ...f, cgpa: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="prCollege">College</label>
              <input id="prCollege" className="input" value={form.college}
                onChange={(e) => setForm((f) => ({ ...f, college: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="prDegree">Degree</label>
              <input id="prDegree" className="input" value={form.degree}
                onChange={(e) => setForm((f) => ({ ...f, degree: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="prBranch">Branch</label>
              <input id="prBranch" className="input" value={form.branch}
                onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="prGrad">Graduation year</label>
              <input id="prGrad" type="number" className="input" value={form.graduation_year}
                onChange={(e) => setForm((f) => ({ ...f, graduation_year: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="prYear">Current year</label>
              <input id="prYear" type="number" className="input" value={form.current_year}
                onChange={(e) => setForm((f) => ({ ...f, current_year: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="prWork">Work preference</label>
              <select id="prWork" className="input" value={form.work_preference}
                onChange={(e) => setForm((f) => ({ ...f, work_preference: e.target.value }))}>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="prGoals">Career goals</label>
            <textarea id="prGoals" className="input" rows={2} value={form.career_goals}
              onChange={(e) => setForm((f) => ({ ...f, career_goals: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="prInterests">Interests (comma-separated)</label>
              <input id="prInterests" className="input" value={form.interests}
                onChange={(e) => setForm((f) => ({ ...f, interests: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="prRoles">Desired roles (comma-separated)</label>
              <input id="prRoles" className="input" value={form.desired_roles}
                onChange={(e) => setForm((f) => ({ ...f, desired_roles: e.target.value }))} />
            </div>
          </div>
          <button className="btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
            <p className="mb-1 font-semibold">Privacy</p>
            <p>
              Your profile, resume files and chat history are stored only on this server and are
              visible only to your account (JWT-protected). Use “Export my data” for a full JSON
              copy. Deleting your account or individual data removes it from the database — no
              third-party AI is called unless you configure provider credentials.
            </p>
          </div>
        </form>
      )}
      <AchievementsSection
        achievements={achievements}
        certs={certs}
        onChanged={load}
        notify={notify}
      />
    </div>
  );
}

type NotifyFn = (message: string, kind?: "success" | "error" | "info") => void;

function AchievementsSection({ achievements, certs, onChanged, notify }: {
  achievements: Achievement[];
  certs: Certification[];
  onChanged: () => Promise<void>;
  notify: NotifyFn;
}) {
  const [achForm, setAchForm] = useState({ title: "", organization: "", date: "" });
  const [certForm, setCertForm] = useState({ name: "", issuer: "", issue_date: "", skills: "" });
  const [busy, setBusy] = useState(false);

  const addAchievement = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/achievements", {
        title: achForm.title.trim(),
        achievement_type: "award",
        organization: achForm.organization.trim() || null,
        date: achForm.date || null,
      });
      notify("Achievement added", "success");
      setAchForm({ title: "", organization: "", date: "" });
      await onChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not add achievement", "error");
    } finally {
      setBusy(false);
    }
  };

  const deleteAchievement = async (id: number) => {
    try {
      await api.del(`/achievements/${id}`);
      notify("Achievement removed", "info");
      await onChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Delete failed", "error");
    }
  };

  const addCert = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/certifications", {
        name: certForm.name.trim(),
        issuer: certForm.issuer.trim() || null,
        issue_date: certForm.issue_date || null,
        skills: certForm.skills.split(",").map((s) => s.trim()).filter(Boolean),
      });
      notify("Certification added", "success");
      setCertForm({ name: "", issuer: "", issue_date: "", skills: "" });
      await onChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not add certification", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="card">
        <p className="section-title mb-3">Achievements</p>
        {achievements.length === 0 && (
          <p className="muted mb-3">Nothing yet — add awards, hackathons or leadership roles.</p>
        )}
        <div className="space-y-2">
          {achievements.map((a) => (
            <div key={a.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-200">{a.title}</p>
                <p className="text-xs text-slate-500">
                  {a.organization ?? a.achievement_type}
                  {a.date ? ` · ${formatDate(a.date)}` : ""}
                </p>
              </div>
              <button className="btn-ghost !px-2 !text-xs" aria-label="Delete achievement"
                onClick={() => void deleteAchievement(a.id)}>✕</button>
            </div>
          ))}
        </div>
        <form onSubmit={addAchievement} className="mt-4 grid gap-2 sm:grid-cols-3">
          <input className="input" required placeholder="Title *" value={achForm.title}
            onChange={(e) => setAchForm((f) => ({ ...f, title: e.target.value }))} />
          <input className="input" placeholder="Organization" value={achForm.organization}
            onChange={(e) => setAchForm((f) => ({ ...f, organization: e.target.value }))} />
          <div className="flex gap-2">
            <input type="date" className="input" value={achForm.date}
              onChange={(e) => setAchForm((f) => ({ ...f, date: e.target.value }))} />
            <button className="btn-primary !px-3" disabled={busy}>+</button>
          </div>
        </form>
      </div>
      <div className="card">
        <p className="section-title mb-3">Certifications</p>
        {certs.length === 0 && (
          <p className="muted mb-3">Track course certificates — they feed your profile strength.</p>
        )}
        <div className="space-y-2">
          {certs.map((c) => (
            <div key={c.id}
              className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
              <p className="font-medium text-slate-800 dark:text-slate-200">{c.name}</p>
              <p className="text-xs text-slate-500">
                {c.issuer ?? "—"}
                {c.issue_date ? ` · ${formatDate(c.issue_date)}` : ""}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {c.skills.map((s) => <span key={s} className="badge-slate">{s}</span>)}
              </div>
              {c.credential_url && (
                <a href={c.credential_url} target="_blank" rel="noreferrer"
                  className="mt-1 inline-block text-xs text-brand-600 hover:underline">
                  Credential ↗
                </a>
              )}
            </div>
          ))}
        </div>
        <form onSubmit={addCert} className="mt-4 grid gap-2 sm:grid-cols-2">
          <input className="input" required placeholder="Name *" value={certForm.name}
            onChange={(e) => setCertForm((f) => ({ ...f, name: e.target.value }))} />
          <input className="input" placeholder="Issuer" value={certForm.issuer}
            onChange={(e) => setCertForm((f) => ({ ...f, issuer: e.target.value }))} />
          <input type="date" className="input" value={certForm.issue_date}
            onChange={(e) => setCertForm((f) => ({ ...f, issue_date: e.target.value }))} />
          <input className="input" placeholder="Skills (comma-separated)" value={certForm.skills}
            onChange={(e) => setCertForm((f) => ({ ...f, skills: e.target.value }))} />
          <button className="btn-primary sm:col-span-2" disabled={busy}>+ Add certification</button>
        </form>
      </div>
    </div>
  );
}

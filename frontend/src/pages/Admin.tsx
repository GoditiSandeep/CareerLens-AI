import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  adminApi,
  type AdminSettings,
  type AdminStats,
  type AdminUser,
  type AdminUserList,
  type Career,
  type Job,
} from "../lib/api";
import {
  EmptyState, ErrorBanner, Loader, StatCard, formatDate, parseList, useToast,
} from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { SITE } from "../lib/site";

// Normalizes the many shapes skill/required-skills fields can take across the
// API (list, JSON string, or a {skill: weight} record) into a flat string list.
function toArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
      if (parsed && typeof parsed === "object") return Object.keys(parsed);
      return [];
    } catch {
      return raw.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  if (raw && typeof raw === "object") return Object.keys(raw as object);
  return [];
}

// ---- Owner / brand (public information only, single source: lib/site.ts) ----
const OWNER_NAME = SITE.ownerName;
const OWNER_EMAIL = SITE.email;
const OWNER_PHONE = SITE.phone;

type Tab = "overview" | "users" | "careers" | "jobs" | "settings";
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "â—«" },
  { key: "users", label: "Users", icon: "â˜°" },
  { key: "careers", label: "Careers", icon: "â—Ž" },
  { key: "jobs", label: "Opportunities", icon: "âŒ‚" },
  { key: "settings", label: "Settings", icon: "âš™" },
];

const ACTIVITY_LABELS: Record<string, string> = {
  career_assessments: "Career assessments",
  resumes_analyzed: "Resumes analyzed",
  resumes_uploaded: "Resumes uploaded",
  roadmaps_created: "Learning roadmaps",
  applications_tracked: "Applications tracked",
  aptitude_attempts: "Aptitude attempts",
  coding_attempts: "Coding attempts",
  chat_messages: "AI mentor messages",
};

interface ConfirmState {
  title: string;
  message: string;
  destructive: boolean;
  run: () => void;
}

function ConfirmDialog({
  state, onCancel,
}: {
  state: ConfirmState | null;
  onCancel: () => void;
}) {
  if (!state) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={state.title}>
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="card relative z-10 w-full max-w-md">
        <p className="section-title">{state.title}</p>
        <p className="muted mt-2 text-sm">{state.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className={state.destructive ? "btn-primary !bg-rose-600 hover:!bg-rose-700" : "btn-primary"}
            onClick={state.run}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const notify = useToast();
  const [tab, setTab] = useState<Tab>("overview");

  // ---- Overview ----
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [error, setError] = useState("");

  // ---- Users ----
  const [users, setUsers] = useState<AdminUserList | null>(null);
  const [userQ, setUserQ] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userStatus, setUserStatus] = useState("");
  const [page, setPage] = useState(1);

  // ---- Careers ----
  const [careers, setCareers] = useState<Career[] | null>(null);
  const [careerForm, setCareerForm] = useState<Record<string, string>>({});
  const [editingCareer, setEditingCareer] = useState<number | null>(null);

  // ---- Jobs ----
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [jobForm, setJobForm] = useState<Record<string, string>>({});
  const [editingJob, setEditingJob] = useState<number | null>(null);

  // ---- Confirm dialog ----
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      const [s, cfg] = await Promise.all([adminApi.stats(), adminApi.settings()]);
      setStats(s);
      setSettings(cfg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load overview");
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await adminApi.users({
        q: userQ, role: userRole, status: userStatus, page, page_size: 10,
      }));
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to load users", "error");
    }
  }, [userQ, userRole, userStatus, page, notify]);

  const loadCareers = useCallback(async () => {
    try {
      setCareers(await adminApi.careers());
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to load careers", "error");
    }
  }, [notify]);

  const loadJobs = useCallback(async () => {
    try {
      setJobs(await adminApi.jobs());
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to load opportunities", "error");
    }
  }, [notify]);

  useEffect(() => { void loadOverview(); }, [loadOverview]);
  useEffect(() => { if (tab === "users") void loadUsers(); }, [tab, loadUsers]);
  useEffect(() => { if (tab === "careers") void loadCareers(); }, [tab, loadCareers]);
  useEffect(() => { if (tab === "jobs") void loadJobs(); }, [tab, loadJobs]);

  // ---- User actions ----
  const changeUser = async (u: AdminUser, patch: { role?: string; is_active?: boolean }) => {
    try {
      await adminApi.updateUser(u.id, patch);
      notify(`Updated ${u.full_name}`, "success");
      await loadUsers();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Update failed", "error");
    }
  };

  const askToggleActive = (u: AdminUser) => {
    const next = !u.is_active;
    setConfirm({
      title: next ? "Enable account?" : "Disable account?",
      message: `${u.full_name} (${u.email}) will ${next ? "be able to sign in again" : "immediately lose access"}.`,
      destructive: !next,
      run: () => { setConfirm(null); void changeUser(u, { is_active: next }); },
    });
  };

  const askChangeRole = (u: AdminUser, role: string) => {
    if (role === u.role) return;
    setConfirm({
      title: role === "admin" ? "Grant administrator?" : "Remove administrator?",
      message: role === "admin"
        ? `${u.full_name} will get full access to this dashboard and every admin API.`
        : `${u.full_name} will lose administrator access and become a student.`,
      destructive: role !== "admin",
      run: () => { setConfirm(null); void changeUser(u, { role }); },
    });
  };

  // ---- Career actions ----
  const saveCareer = async (e: FormEvent) => {
    e.preventDefault();
    const body = {
      name: careerForm.name?.trim(),
      category: careerForm.category?.trim() || "Technology",
      description: careerForm.description?.trim() || "",
      required_skills: parseList(careerForm.required_skills),
      salary_range: careerForm.salary_range?.trim() || "",
      demand_level: careerForm.demand_level?.trim() || "High",
      growth_potential: careerForm.growth_potential?.trim() || "High",
    };
    try {
      if (editingCareer) {
        await adminApi.updateCareer(editingCareer, body);
        notify("Career updated", "success");
      } else {
        await adminApi.createCareer(body);
        notify("Career created", "success");
      }
      setCareerForm({});
      setEditingCareer(null);
      await loadCareers();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Save failed", "error");
    }
  };

  const askDeleteCareer = (c: Career) => {
    setConfirm({
      title: "Delete career path?",
      message: `"${c.name}" will be permanently removed. This cannot be undone.`,
      destructive: true,
      run: () => {
        setConfirm(null);
        adminApi.deleteCareer(c.id)
          .then(async () => { notify("Career deleted", "success"); await loadCareers(); })
          .catch((err) => notify(err instanceof Error ? err.message : "Delete failed", "error"));
      },
    });
  };

  // ---- Job actions ----
  const saveJob = async (e: FormEvent) => {
    e.preventDefault();
    const body = {
      title: jobForm.title?.trim(),
      company: jobForm.company?.trim(),
      location: jobForm.location?.trim() || "Remote",
      work_mode: jobForm.work_mode?.trim() || "remote",
      salary: jobForm.salary?.trim() || "",
      job_type: jobForm.job_type?.trim() || "job",
      experience_label: jobForm.experience_label?.trim() || "Fresher",
      industry: jobForm.industry?.trim() || "Technology",
      description: jobForm.description?.trim() || "",
      skills: parseList(jobForm.skills),
    };
    try {
      if (editingJob) {
        await adminApi.updateJob(editingJob, body);
        notify("Opportunity updated", "success");
      } else {
        await adminApi.createJob(body);
        notify("Opportunity created (saved as real, not sample)", "success");
      }
      setJobForm({});
      setEditingJob(null);
      await loadJobs();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Save failed", "error");
    }
  };

  const askDeleteJob = (j: Job) => {
    setConfirm({
      title: "Delete listing?",
      message: `"${j.title}" at ${j.company} will be permanently removed.`,
      destructive: true,
      run: () => {
        setConfirm(null);
        adminApi.deleteJob(j.id)
          .then(async () => { notify("Listing deleted", "success"); await loadJobs(); })
          .catch((err) => notify(err instanceof Error ? err.message : "Delete failed", "error"));
      },
    });
  };

  const totalPages = users ? Math.max(1, Math.ceil(users.total / users.page_size)) : 1;

  const refreshAll = () => {
    void loadOverview();
    if (tab === "users") void loadUsers();
    if (tab === "careers") void loadCareers();
    if (tab === "jobs") void loadJobs();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Admin dashboard</h1>
          <p className="page-sub">
            Signed in as administrator <span className="font-semibold text-slate-700 dark:text-slate-300">{user?.full_name}</span>.
            Platform owner: {OWNER_NAME}.
          </p>
        </div>
        <button className="btn-ghost !text-xs" onClick={refreshAll}>â†» Refresh</button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-brand-600 text-brand-700 dark:text-brand-300"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <span aria-hidden>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* ---------- Overview ---------- */}
      {tab === "overview" && (
        <div className="space-y-6">
          {error && <ErrorBanner message={error} onRetry={loadOverview} />}
          {!stats && !error && <Loader label="Loading platform analyticsâ€¦" />}
          {stats && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Total users" value={stats.users.total} hint={`+${stats.users.new_last_7_days} this week`} />
                <StatCard label="Active accounts" value={stats.users.active} hint={`${stats.users.admins} admin${stats.users.admins === 1 ? "" : "s"}`} accent="green" />
                <StatCard label="Career paths" value={stats.content.career_paths} hint="Managed content" accent="amber" />
                <StatCard label="Listings" value={stats.content.jobs_listed} hint={`${stats.content.jobs_sample} sample Â· ${stats.content.jobs_active} active`} accent="rose" />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="card">
                  <p className="section-title mb-3">Recorded activity</p>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
                      <div key={key} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                        <p className="text-2xl font-bold text-brand-600">{stats.activity[key] ?? 0}</p>
                        <p className="text-xs text-slate-500">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <p className="section-title mb-3">Recent registrations</p>
                  {stats.recent_users.length === 0 ? (
                    <p className="muted">No users yet.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                      {stats.recent_users.map((u) => (
                        <li key={u.id} className="flex items-center justify-between py-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800 dark:text-slate-200">{u.full_name}</p>
                            <p className="truncate text-xs text-slate-500">{u.email}</p>
                          </div>
                          <div className="ml-3 flex flex-shrink-0 items-center gap-2">
                            <span className={u.role === "admin" ? "badge-brand" : "badge-slate"}>{u.role}</span>
                            <span className="text-xs text-slate-400">{formatDate(u.created_at)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ---------- Users ---------- */}
      {tab === "users" && (
        <div className="space-y-4">
          <div className="card grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="userQ">Search</label>
              <input id="userQ" className="input" placeholder="Name or emailâ€¦" value={userQ}
                onChange={(e) => { setUserQ(e.target.value); setPage(1); }} />
            </div>
            <div>
              <label className="label" htmlFor="userRole">Role</label>
              <select id="userRole" className="input" value={userRole}
                onChange={(e) => { setUserRole(e.target.value); setPage(1); }}>
                <option value="">All roles</option>
                <option value="student">Student</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="userStatus">Status</label>
              <select id="userStatus" className="input" value={userStatus}
                onChange={(e) => { setUserStatus(e.target.value); setPage(1); }}>
                <option value="">Any status</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          </div>

          {!users && <Loader label="Loading usersâ€¦" />}
          {users && users.items.length === 0 && (
            <EmptyState title="No users match" hint="Try clearing the search or filters." />
          )}
          {users && users.items.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
                    <th className="py-2 pr-3">User</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Joined</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.items.map((u) => {
                    const isSelf = u.id === user?.id;
                    return (
                      <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-3">
                          <p className="font-medium text-slate-800 dark:text-slate-200">
                            {u.full_name}{isSelf && <span className="ml-1 badge-brand">you</span>}
                          </p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </td>
                        <td className="py-2 pr-3">
                          <select
                            className="input !py-1 !text-xs"
                            value={u.role}
                            disabled={isSelf}
                            aria-label={`Role for ${u.full_name}`}
                            onChange={(e) => askChangeRole(u, e.target.value)}
                          >
                            <option value="student">student</option>
                            <option value="admin">admin</option>
                          </select>
                        </td>
                        <td className="py-2 pr-3">
                          <span className={u.is_active ? "badge-green" : "badge-rose"}>
                            {u.is_active ? "active" : "disabled"}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-xs text-slate-500">{formatDate(u.created_at)}</td>
                        <td className="py-2">
                          <button
                            className="btn-ghost !py-1 !text-xs"
                            disabled={isSelf}
                            title={isSelf ? "You cannot disable your own account" : undefined}
                            onClick={() => askToggleActive(u)}
                          >
                            {u.is_active ? "Disable" : "Enable"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="muted">{users.total} user{users.total === 1 ? "" : "s"}</span>
                <div className="flex items-center gap-2">
                  <button className="btn-ghost !py-1 !text-xs" disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}>â† Prev</button>
                  <span className="text-xs text-slate-500">Page {page} / {totalPages}</span>
                  <button className="btn-ghost !py-1 !text-xs" disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next â†’</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------- Careers ---------- */}
      {tab === "careers" && (
        <div className="space-y-4">
          <form onSubmit={saveCareer} className="card grid gap-3 sm:grid-cols-2">
            <p className="section-title sm:col-span-2">{editingCareer ? "Edit career path" : "Create career path"}</p>
            <div>
              <label className="label" htmlFor="cName">Name *</label>
              <input id="cName" required className="input" value={careerForm.name ?? ""}
                onChange={(e) => setCareerForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="cCat">Category</label>
              <input id="cCat" className="input" placeholder="Technology" value={careerForm.category ?? ""}
                onChange={(e) => setCareerForm((f) => ({ ...f, category: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="cDesc">Description</label>
              <textarea id="cDesc" className="input" rows={2} value={careerForm.description ?? ""}
                onChange={(e) => setCareerForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="cSkills">Required skills (comma-separated)</label>
              <input id="cSkills" className="input" placeholder="Python, SQL, Communication" value={careerForm.required_skills ?? ""}
                onChange={(e) => setCareerForm((f) => ({ ...f, required_skills: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="cSalary">Salary range</label>
              <input id="cSalary" className="input" placeholder="â‚¹4â€“8 LPA" value={careerForm.salary_range ?? ""}
                onChange={(e) => setCareerForm((f) => ({ ...f, salary_range: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="cDemand">Demand level</label>
              <select id="cDemand" className="input" value={careerForm.demand_level ?? "High"}
                onChange={(e) => setCareerForm((f) => ({ ...f, demand_level: e.target.value }))}>
                {["High", "Very High", "Medium", "Growing"].map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button className="btn-primary">{editingCareer ? "Save changes" : "Create path"}</button>
              {editingCareer && (
                <button type="button" className="btn-ghost"
                  onClick={() => { setEditingCareer(null); setCareerForm({}); }}>Cancel</button>
              )}
            </div>
          </form>

          {!careers && <Loader label="Loading career pathsâ€¦" />}
          {careers && careers.length === 0 && <EmptyState title="No career paths" hint="Create the first one above." />}
          {careers && careers.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {careers.map((c) => {
                const skills = toArray(c.required_skills);
                return (
                  <div key={c.id} className="card !p-4">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.category} Â· {c.demand_level} demand</p>
                    {skills.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {skills.slice(0, 5).map((s) => <span key={s} className="badge-slate">{s}</span>)}
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button className="btn-ghost !py-1 !text-xs"
                        onClick={() => {
                          setEditingCareer(c.id);
                          setCareerForm({
                            name: c.name, category: c.category, description: c.description,
                            salary_range: c.salary_range ?? "", demand_level: c.demand_level ?? "High",
                            growth_potential: c.growth_potential ?? "High",
                            required_skills: skills.join(", "),
                          });
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}>Edit</button>
                      <button className="btn-ghost !py-1 !text-xs !text-rose-600"
                        onClick={() => askDeleteCareer(c)}>Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ---------- Jobs / Opportunities ---------- */}
      {tab === "jobs" && (
        <div className="space-y-4">
          <form onSubmit={saveJob} className="card grid gap-3 sm:grid-cols-2">
            <p className="section-title sm:col-span-2">{editingJob ? "Edit listing" : "Create listing"}</p>
            <div>
              <label className="label" htmlFor="jTitle">Title *</label>
              <input id="jTitle" required className="input" value={jobForm.title ?? ""}
                onChange={(e) => setJobForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="jCompany">Company *</label>
              <input id="jCompany" required className="input" value={jobForm.company ?? ""}
                onChange={(e) => setJobForm((f) => ({ ...f, company: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="jLocation">Location</label>
              <input id="jLocation" className="input" placeholder="Remote" value={jobForm.location ?? ""}
                onChange={(e) => setJobForm((f) => ({ ...f, location: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="jMode">Work mode</label>
              <select id="jMode" className="input" value={jobForm.work_mode ?? "remote"}
                onChange={(e) => setJobForm((f) => ({ ...f, work_mode: e.target.value }))}>
                {["remote", "onsite", "hybrid"].map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="jType">Type</label>
              <select id="jType" className="input" value={jobForm.job_type ?? "job"}
                onChange={(e) => setJobForm((f) => ({ ...f, job_type: e.target.value }))}>
                {["job", "internship", "scholarship", "course", "apprenticeship"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="jExp">Experience</label>
              <input id="jExp" className="input" placeholder="Fresher" value={jobForm.experience_label ?? ""}
                onChange={(e) => setJobForm((f) => ({ ...f, experience_label: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="jSalary">Salary / stipend</label>
              <input id="jSalary" className="input" placeholder="â‚¹6 LPA" value={jobForm.salary ?? ""}
                onChange={(e) => setJobForm((f) => ({ ...f, salary: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="jIndustry">Industry</label>
              <input id="jIndustry" className="input" placeholder="Technology" value={jobForm.industry ?? ""}
                onChange={(e) => setJobForm((f) => ({ ...f, industry: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="jSkills">Skills (comma-separated)</label>
              <input id="jSkills" className="input" placeholder="Python, React" value={jobForm.skills ?? ""}
                onChange={(e) => setJobForm((f) => ({ ...f, skills: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="jDesc">Description</label>
              <textarea id="jDesc" className="input" rows={2} value={jobForm.description ?? ""}
                onChange={(e) => setJobForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex items-end gap-2">
              <button className="btn-primary">{editingJob ? "Save changes" : "Create listing"}</button>
              {editingJob && (
                <button type="button" className="btn-ghost"
                  onClick={() => { setEditingJob(null); setJobForm({}); }}>Cancel</button>
              )}
            </div>
          </form>

          <p className="muted text-xs">
            Listings you create are saved as <span className="font-semibold">real (not sample)</span> records.
            Seeded listings are labelled <span className="badge-amber">sample</span> so demo data is never confused with verified opportunities.
          </p>

          {!jobs && <Loader label="Loading opportunitiesâ€¦" />}
          {jobs && jobs.length === 0 && <EmptyState title="No listings" hint="Create the first one above." />}
          {jobs && jobs.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
                    <th className="py-2 pr-3">Title</th>
                    <th className="py-2 pr-3">Company</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Label</th>
                    <th className="py-2 pr-3">Active</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 pr-3 font-medium text-slate-800 dark:text-slate-200">{j.title}</td>
                      <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{j.company}</td>
                      <td className="py-2 pr-3 text-slate-500">{j.job_type}</td>
                      <td className="py-2 pr-3">
                        {j.is_sample ? <span className="badge-amber">sample</span> : <span className="badge-slate">real</span>}
                      </td>
                      <td className="py-2 pr-3">
                        <button
                          className="btn-ghost !py-1 !text-xs"
                          onClick={() => adminApi.updateJob(j.id, { is_active: !(j.is_active ?? true) })
                            .then(async () => { notify("Updated", "success"); await loadJobs(); })
                            .catch((err) => notify(err instanceof Error ? err.message : "Failed", "error"))}
                        >
                          {j.is_active ?? true ? "active" : "hidden"}
                        </button>
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button className="btn-ghost !py-1 !text-xs"
                            onClick={() => {
                              setEditingJob(j.id);
                              setJobForm({
                                title: j.title, company: j.company, location: j.location,
                                work_mode: j.work_mode, job_type: j.job_type,
                                salary: j.salary ?? "", experience_label: j.experience_label ?? "",
                                industry: j.industry ?? "", description: j.description,
                                skills: toArray(j.skills).join(", "),
                              });
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}>Edit</button>
                          <button className="btn-ghost !py-1 !text-xs !text-rose-600"
                            onClick={() => askDeleteJob(j)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {/* ---------- Settings ---------- */}
      {tab === "settings" && (
        <div className="space-y-4">
          {!settings && <Loader label="Loading configurationâ€¦" />}
          {settings && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="card">
                <p className="section-title mb-3">Platform</p>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="muted">App name</dt><dd>{settings.app_name}</dd></div>
                  <div className="flex justify-between"><dt className="muted">Debug mode</dt><dd>{settings.debug ? "on" : "off"}</dd></div>
                  <div className="flex justify-between"><dt className="muted">Database</dt><dd className="badge-brand">{settings.database_backend}</dd></div>
                  <div className="flex justify-between"><dt className="muted">Demo seeding</dt><dd>{settings.seed_demo_data ? "enabled" : "disabled"}</dd></div>
                  <div className="flex justify-between"><dt className="muted">Health</dt><dd className="badge-green">{settings.health.status}</dd></div>
                </dl>
              </div>

              <div className="card">
                <p className="section-title mb-3">AI provider</p>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="muted">Provider</dt><dd>{settings.ai.provider}</dd></div>
                  <div className="flex justify-between"><dt className="muted">Mode</dt><dd>{settings.ai.mode}</dd></div>
                  <div className="flex justify-between"><dt className="muted">Live configured</dt>
                    <dd>{settings.ai.live_configured ? <span className="badge-green">yes</span> : <span className="badge-amber">no</span>}</dd></div>
                  <div className="flex justify-between"><dt className="muted">OpenAI key</dt>
                    <dd>{settings.ai.openai_key_present ? <span className="badge-green">present</span> : <span className="badge-slate">absent</span>}</dd></div>
                  <div className="flex justify-between"><dt className="muted">Gemini key</dt>
                    <dd>{settings.ai.gemini_key_present ? <span className="badge-green">present</span> : <span className="badge-slate">absent</span>}</dd></div>
                </dl>
                <p className="muted mt-3 text-xs">{settings.ai.note}</p>
              </div>

              <div className="card">
                <p className="section-title mb-3">Uploads & CORS</p>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="muted">Max upload</dt><dd>{settings.uploads.max_size_mb} MB</dd></div>
                  <div className="flex justify-between"><dt className="muted">Allowed types</dt><dd>{settings.uploads.allowed_extensions.join(", ")}</dd></div>
                  <div><dt className="muted mb-1">CORS origins</dt>
                    <dd className="flex flex-wrap gap-1">{settings.cors_origins.map((o) => <span key={o} className="badge-slate">{o}</span>)}</dd></div>
                </dl>
              </div>

              <div className="card">
                <p className="section-title mb-3">Owner & support</p>
                <dl className="space-y-2 text-sm">
                  <div><dt className="muted">Owner</dt><dd>{OWNER_NAME}</dd></div>
                  <div><dt className="muted">Contact email</dt><dd><a className="text-brand-600 hover:underline" href={`mailto:${OWNER_EMAIL}`}>{OWNER_EMAIL}</a></dd></div>
                  <div><dt className="muted">Contact phone</dt><dd><a className="text-brand-600 hover:underline" href={`tel:${OWNER_PHONE}`}>{OWNER_PHONE}</a></dd></div>
                </dl>
                <p className="muted mt-3 text-xs">Passwords, password hashes, secret keys, and API keys are never shown anywhere in this dashboard.</p>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog state={confirm} onCancel={() => setConfirm(null)} />
    </div>
  );
}

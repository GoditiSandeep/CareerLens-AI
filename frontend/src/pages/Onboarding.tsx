import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, type StudentProfile } from "../lib/api";
import { ErrorBanner, useToast } from "../components/ui";

interface DraftSkill {
  name: string;
  level: number;
}

export default function Onboarding() {
  const navigate = useNavigate();
  const notify = useToast();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [about, setAbout] = useState("");
  const [location, setLocation] = useState("");
  const [goals, setGoals] = useState("");
  const [interests, setInterests] = useState("");
  const [roles, setRoles] = useState("");
  const [workPref, setWorkPref] = useState("hybrid");
  const [skills, setSkills] = useState<DraftSkill[]>([
    { name: "Python", level: 50 },
    { name: "SQL", level: 40 },
  ]);

  const addSkill = () => setSkills((s) => [...s, { name: "", level: 50 }]);
  const updateSkill = (i: number, patch: Partial<DraftSkill>) =>
    setSkills((s) => s.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeSkill = (i: number) => setSkills((s) => s.filter((_, idx) => idx !== i));
  const split = (raw: string) => raw.split(",").map((s) => s.trim()).filter(Boolean);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.put<StudentProfile>("/profile", {
        about: about || null,
        location: location || null,
        career_goals: goals || null,
        interests: split(interests),
        desired_roles: split(roles),
        work_preference: workPref,
      });
      await api.post<StudentProfile>("/profile/onboarding", {
        skills: skills
          .filter((s) => s.name.trim())
          .map((s) => ({ name: s.name.trim(), level: s.level, target_level: 80, category: "technical" })),
        desired_roles: split(roles),
        industries: [],
        preferred_locations: location ? [location] : [],
        work_preference: workPref,
        salary_expectation: null,
        target_companies: [],
      });
      notify("Profile set up — welcome aboard!", "success");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your profile");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3 anim-fade-up">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 font-bold text-white">C</span>
          <div>
            <p className="font-bold text-slate-900 dark:text-white">Let's set up your profile</p>
            <p className="text-sm text-slate-500">Step {step} of 2 — takes about 2 minutes.</p>
          </div>
        </div>
        <div className="progress-track mb-6">
          <div className="progress-fill" style={{ width: step === 1 ? "50%" : "100%" }} />
        </div>
        {error && <ErrorBanner message={error} />}
        <form key={step} onSubmit={submit} className="card space-y-5 anim-fade-up">
          {step === 1 && (
            <>
              <div>
                <label className="label" htmlFor="about">About you</label>
                <textarea id="about" className="input" rows={3} value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  placeholder="2nd-year CSE student who loves building web apps…" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="location">Location</label>
                  <input id="location" className="input" value={location}
                    onChange={(e) => setLocation(e.target.value)} placeholder="Bengaluru" />
                </div>
                <div>
                  <label className="label" htmlFor="workPref">Work preference</label>
                  <select id="workPref" className="input" value={workPref}
                    onChange={(e) => setWorkPref(e.target.value)}>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="onsite">On-site</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="goals">Career goals</label>
                <textarea id="goals" className="input" rows={2} value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  placeholder="Become a backend developer at a product company by graduation." />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="interests">Interests (comma-separated)</label>
                  <input id="interests" className="input" value={interests}
                    onChange={(e) => setInterests(e.target.value)} placeholder="AI, Web, Cloud" />
                </div>
                <div>
                  <label className="label" htmlFor="roles">Target roles (comma-separated)</label>
                  <input id="roles" className="input" value={roles}
                    onChange={(e) => setRoles(e.target.value)} placeholder="Backend Developer, Data Analyst" />
                </div>
              </div>
              <button type="button" className="btn-primary w-full" onClick={() => setStep(2)}>
                Continue →
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="section-title">Your current skills</p>
                  <button type="button" className="btn-ghost !py-1 !text-xs" onClick={addSkill}>
                    + Add skill
                  </button>
                </div>
                <div className="space-y-3">
                  {skills.map((s, i) => (
                    <div key={i} className={`flex items-center gap-3 anim-fade-up stagger-${Math.min(8, i + 1)}`}>
                      <input className="input !w-2/5" placeholder="Skill name" value={s.name}
                        onChange={(e) => updateSkill(i, { name: e.target.value })} />
                      <input type="range" min={0} max={100} className="flex-1 accent-brand-600"
                        aria-label={`Level for ${s.name || "skill"}`}
                        value={s.level}
                        onChange={(e) => updateSkill(i, { level: Number(e.target.value) })} />
                      <span className="w-10 text-right text-sm font-semibold text-slate-600 dark:text-slate-300">
                        {s.level}
                      </span>
                      <button type="button" className="btn-ghost !px-2" aria-label="Remove skill"
                        onClick={() => removeSkill(i)}>✕</button>
                    </div>
                  ))}
                  {skills.length === 0 && (
                    <p className="muted">No skills added yet — you can add them later on the Skills page.</p>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" className="btn-ghost flex-1" onClick={() => setStep(1)}>
                  ← Back
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={busy}>
                  {busy ? "Saving…" : "Finish setup"}
                </button>
              </div>
            </>
          )}
        </form>
        <button onClick={() => navigate("/dashboard")} className="muted mx-auto mt-4 block hover:underline">
          Skip for now
        </button>
      </div>
    </div>
  );
}

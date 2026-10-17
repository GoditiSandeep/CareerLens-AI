import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ErrorBanner } from "../components/ui";
import { ApiError } from "../lib/api";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    college: "",
    degree: "",
    branch: "",
    graduation_year: "",
    current_year: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: string) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await register({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        college: form.college.trim() || null,
        degree: form.degree.trim() || null,
        branch: form.branch.trim() || null,
        graduation_year: form.graduation_year ? Number(form.graduation_year) : null,
        current_year: form.current_year ? Number(form.current_year) : null,
      });
      navigate("/onboarding", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-lg">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 font-bold text-white">C</span>
          <span className="text-lg font-bold text-slate-900 dark:text-white">CareerLens AI</span>
        </Link>
        <div className="card anim-fade-up">
          <h1 className="page-title">Create your account</h1>
          <p className="page-sub">Set up your student profile in under 2 minutes.</p>
          {error && <div className="mt-4"><ErrorBanner message={error} /></div>}
          <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="full_name">Full name *</label>
              <input id="full_name" required className="input" value={form.full_name}
                onChange={set("full_name")} placeholder="Ada Sharma" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="email">Email *</label>
              <input id="email" type="email" required className="input" value={form.email}
                onChange={set("email")} placeholder="you@college.edu" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="password">Password * (min 8 chars)</label>
              <input id="password" type="password" required minLength={8} className="input"
                value={form.password} onChange={set("password")} placeholder="••••••••" />
            </div>
            <div>
              <label className="label" htmlFor="college">College</label>
              <input id="college" className="input" value={form.college} onChange={set("college")} placeholder="Optional" />
            </div>
            <div>
              <label className="label" htmlFor="degree">Degree</label>
              <input id="degree" className="input" value={form.degree} onChange={set("degree")} placeholder="B.Tech" />
            </div>
            <div>
              <label className="label" htmlFor="branch">Branch</label>
              <input id="branch" className="input" value={form.branch} onChange={set("branch")} placeholder="CSE" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="graduation_year">Grad. year</label>
                <input id="graduation_year" type="number" min={2000} max={2100} className="input"
                  value={form.graduation_year} onChange={set("graduation_year")} placeholder="2027" />
              </div>
              <div>
                <label className="label" htmlFor="current_year">Year</label>
                <input id="current_year" type="number" min={1} max={6} className="input"
                  value={form.current_year} onChange={set("current_year")} placeholder="3" />
              </div>
            </div>
            <button type="submit" className="btn-primary sm:col-span-2" disabled={busy}>
              {busy ? "Creating account…" : "Create account & continue"}
            </button>
          </form>
          <p className="muted mt-4 text-center">
            Already registered?{" "}
            <Link to="/login" className="font-semibold text-brand-600 hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

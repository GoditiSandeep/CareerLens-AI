// Career Twin page.
//
// A consent-gated, explainable view of a user's OWN readiness. Every number is
// derived from real, verifiable data (skills, projects, resumes, interviews,
// profile completeness) — nothing is fabricated, predicted or guaranteed.
// Consent toggles only control whether data tailors suggestions; the score is
// computed the same way either way. The twin is editable, exportable (data
// portability) and permanently deletable at any time.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { twinApi, type CareerTwin, type TwinSnapshotData } from "../lib/api";
import {
  AnimatedRing,
  ErrorBanner,
  GlassCard,
  Loader,
  ProgressBar,
  Reveal,
  TiltCard,
  parseList,
  useToast,
} from "../components/ui";

// Allowed values mirror the backend so the select never sends an invalid one.
const WORK_STYLES = ["remote", "hybrid", "onsite", "flexible"];
const EXPERIENCE_LEVELS = ["fresher", "junior", "mid", "senior", "career-switcher"];

interface FormState {
  work_style: string;
  experience_level: string;
  primary_goal: string;
  strengths: string;
  interests: string;
  focus_areas: string;
  personalization_consent: boolean;
  analytics_consent: boolean;
}

const emptyForm: FormState = {
  work_style: "",
  experience_level: "",
  primary_goal: "",
  strengths: "",
  interests: "",
  focus_areas: "",
  personalization_consent: false,
  analytics_consent: false,
};

function parseSnapshot(raw: string | undefined | null): TwinSnapshotData | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TwinSnapshotData;
  } catch {
    return null;
  }
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function CareerTwin() {
  const { user, loading } = useAuth();
  const notify = useToast();

  const [twin, setTwin] = useState<CareerTwin | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const t = await twinApi.get();
      setTwin(t);
      setForm({
        work_style: t.work_style ?? "",
        experience_level: t.experience_level ?? "",
        primary_goal: t.primary_goal ?? "",
        strengths: parseList(t.strengths).join(", "),
        interests: parseList(t.interests).join(", "),
        focus_areas: parseList(t.focus_areas).join(", "),
        personalization_consent: t.personalization_consent,
        analytics_consent: t.analytics_consent,
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    load();
  }, [loading, user, load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      await twinApi.refresh();
      await load();
      notify("Snapshot refreshed", "success");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [load, notify]);

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setBusy(true);
      setError("");
      try {
        await twinApi.update({
          work_style: form.work_style || null,
          experience_level: form.experience_level || null,
          primary_goal: form.primary_goal.trim() || null,
          strengths: splitCsv(form.strengths),
          interests: splitCsv(form.interests),
          focus_areas: splitCsv(form.focus_areas),
          personalization_consent: form.personalization_consent,
          analytics_consent: form.analytics_consent,
        });
        await load();
        notify("Twin saved", "success");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [form, load, notify],
  );

  const exportJson = useCallback(async () => {
    try {
      const data = await twinApi.export();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "career-twin-export.json";
      a.click();
      URL.revokeObjectURL(url);
      notify("Twin exported", "success");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [notify]);

  const deleteTwin = useCallback(async () => {
    if (!window.confirm("Delete your Career Twin and its history? This cannot be undone.")) {
      return;
    }
    try {
      await twinApi.delete();
      await load();
      notify("Twin deleted", "info");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [load, notify]);

  if (loading || !user) return <Loader label="Loading your career twin…" />;

  const snapshot = parseSnapshot(twin?.snapshot);
  const score = snapshot?.score ?? twin?.snapshot_score ?? 0;
  const breakdown = snapshot?.skill_breakdown ?? {};
  const actions = snapshot?.next_actions ?? [];

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="page-title">Career Twin</h1>
            <p className="page-sub">
              A consent-gated, explainable view of your own readiness. Every
              number is derived from real data — nothing is guessed.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={refresh} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh snapshot"}
            </button>
            <button className="btn-ghost" onClick={exportJson}>
              Export JSON
            </button>
            <button className="btn-ghost text-rose-600" onClick={deleteTwin}>
              Delete twin
            </button>
          </div>
        </div>
      </Reveal>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <Reveal>
            <TiltCard>
              <GlassCard className="p-4 sm:p-5" sheen>
                <div className="flex flex-wrap items-center gap-5">
                  <AnimatedRing
                    value={Math.round(score)}
                    size={132}
                    thickness={11}
                    label="Readiness"
                    color="#22d3ee"
                    trackClassName="stroke-brand-100 dark:stroke-slate-700"
                  />
                  <div className="min-w-[12rem] flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Readiness
                    </p>
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-white">
                      {score.toFixed(1)}{" "}
                      <span className="text-base font-medium text-slate-400">/ 100</span>
                    </h2>
                    {snapshot && (
                      <p className="muted mt-1 text-xs">
                        {snapshot.total_earned} of {snapshot.total_max} signal points
                        {snapshot.generated_at
                          ? ` · snapshot ${new Date(snapshot.generated_at).toLocaleString()}`
                          : ""}
                      </p>
                    )}
                    <div className="mt-4">
                      <ProgressBar value={score} label="Overall readiness" />
                    </div>
                  </div>
                </div>
              </GlassCard>
            </TiltCard>
          </Reveal>

          <Reveal>
            <div className="card p-4 sm:p-5">
              <p className="section-title">How your score breaks down</p>
              {Object.keys(breakdown).length === 0 ? (
                <p className="muted text-sm">
                  Refresh your snapshot to see the explainable breakdown.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {Object.entries(breakdown).map(([key, s]) => (
                    <div key={key}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium capitalize text-slate-700 dark:text-slate-300">
                          {key.replace(/_/g, " ")}
                        </span>
                        <span className="font-mono text-xs">
                          {s.earned}/{s.max}
                        </span>
                      </div>
                      <ProgressBar
                        value={s.max ? Math.round((s.earned / s.max) * 100) : 0}
                        label={s.explanation}
                      />
                    </div>
                  ))}
                </div>
              )}
              <p className="muted mt-3 text-xs">
                Each signal is capped so no single activity inflates the score.
                The breakdown is shown so you can see why — it is an aid, not a
                promise of any outcome.
              </p>
            </div>
          </Reveal>

          <Reveal>
            <div className="card p-4 sm:p-5">
              <p className="section-title">Next actions</p>
              {actions.length === 0 ? (
                <p className="muted text-sm">
                  Refresh your snapshot to generate honest suggestions.
                </p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                  {actions.map((a, i) => (
                    <li key={i}>• {a}</li>
                  ))}
                </ul>
              )}
            </div>
          </Reveal>
        </div>

        <div className="space-y-5 lg:col-span-2">
          <Reveal>
            <form className="card space-y-4 p-4 sm:p-5" onSubmit={submit}>
              <p className="section-title">Editable twin inputs</p>
              <div>
                <label className="label">Work style</label>
                <select
                  className="input"
                  value={form.work_style}
                  onChange={(e) => setForm({ ...form, work_style: e.target.value })}
                >
                  <option value="">Pick one</option>
                  {WORK_STYLES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Experience level</label>
                <select
                  className="input"
                  value={form.experience_level}
                  onChange={(e) =>
                    setForm({ ...form, experience_level: e.target.value })
                  }
                >
                  <option value="">Pick one</option>
                  {EXPERIENCE_LEVELS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Primary goal</label>
                <input
                  className="input"
                  value={form.primary_goal}
                  onChange={(e) => setForm({ ...form, primary_goal: e.target.value })}
                  placeholder="e.g. Become a Data Analyst"
                />
              </div>
              <div>
                <label className="label">Strengths (comma separated)</label>
                <input
                  className="input"
                  value={form.strengths}
                  onChange={(e) => setForm({ ...form, strengths: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Interests (comma separated)</label>
                <input
                  className="input"
                  value={form.interests}
                  onChange={(e) => setForm({ ...form, interests: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Focus areas (comma separated)</label>
                <input
                  className="input"
                  value={form.focus_areas}
                  onChange={(e) => setForm({ ...form, focus_areas: e.target.value })}
                />
              </div>
              <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-brand-600"
                    checked={form.personalization_consent}
                    onChange={(e) =>
                      setForm({ ...form, personalization_consent: e.target.checked })
                    }
                  />
                  Allow personalization using my data
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-brand-600"
                    checked={form.analytics_consent}
                    onChange={(e) =>
                      setForm({ ...form, analytics_consent: e.target.checked })
                    }
                  />
                  Allow anonymous analytics
                </label>
                <p className="muted text-xs">
                  These only control whether your data is used to tailor
                  suggestions. Your scores are computed the same way either way.
                </p>
              </div>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Save twin"}
              </button>
            </form>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

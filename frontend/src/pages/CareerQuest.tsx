// Career Quest page.
//
// Points, level, badges and the verified-action ledger for a signed-in user.
// Every number comes from the backend /quest endpoint, which reconciles the
// ledger against the user's real, verifiable data — no fabricated points.
//
//   GET /quest -> { points, level, badges, events, timeline, note }
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { questApi, type QuestSummary } from "../lib/api";
import { ErrorBanner, GlassCard, Loader, ProgressBar, Reveal, TiltCard, AnimatedRing } from "../components/ui";

export default function CareerQuest() {
  const { user, loading } = useAuth();

  const [summary, setSummary] = useState<QuestSummary | null>(null);
  const [error, setError] = useState<string>("");

  const load = useCallback(async () => {
    setError("");
    try {
      setSummary(await questApi.summary());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    load();
  }, [loading, user, load]);

  if (loading || !user) return <Loader label="Loading your quest progress…" />;

  if (error) {
    return (
      <div className="card flex flex-col items-center justify-center py-16 text-center">
        <ErrorBanner message={error} />
        <button className="btn-ghost mt-3" onClick={load}>Retry</button>
      </div>
    );
  }

  if (!summary) return <Loader label="Loading your quest progress…" />;

  const { points, level, badges, events: ledgerEvents = [] } = summary;
  const earned = badges?.earned ?? [];
  const upcoming = badges?.upcoming ?? [];
  const totalBadges = badges?.total_badges ?? 0;
  const progress = level?.progress_to_next ?? 100;

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="page-title">Career Quest</h1>
            <p className="page-sub">
              Track verified, real-world actions and earn points toward your
              next level.
            </p>
          </div>
          <div className="text-sm text-slate-500">
            <span className="font-semibold text-slate-700 dark:text-slate-300">{points}</span> points
            <span className="mx-1">•</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">Level {level?.level}</span>
            <span className="mx-1">•</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">{totalBadges} badges</span>
          </div>
        </div>
      </Reveal>

      {level && (
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-5">
            <Reveal>
              <TiltCard>
                <GlassCard className="p-4 sm:p-5" sheen>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <AnimatedRing
                        value={progress}
                        size={104}
                        thickness={9}
                        label="Level"
                        color="#8b5cf6"
                        trackClassName="stroke-brand-100 dark:stroke-slate-700"
                      />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          {level.title}
                        </p>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                          Level {level.level}
                        </h2>
                        <p className="muted mt-1 text-sm">
                          {points} total points
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Progress</p>
                      <p className="text-3xl font-bold text-brand-600">{progress}%</p>
                    </div>
                  </div>
                  <p className="muted mt-2 text-sm">
                    {level.next_level
                      ? `${level.next_points ?? "—"} points to reach ${level.next_title}`
                      : "You have reached the highest level."}
                  </p>
                  <div className="mt-4">
                    <ProgressBar value={progress} label="Level progress" />
                  </div>
                </GlassCard>
              </TiltCard>
            </Reveal>

            <Reveal>
              <div className="card p-4 sm:p-5">
                <p className="section-title">Points history</p>
                {ledgerEvents.length === 0 ? (
                  <p className="muted text-sm">No verified actions yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {ledgerEvents.map((e) => (
                      <li key={e.id} className="flex justify-between gap-3 py-2 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-white">{e.label}</span>
                          <span className="ml-2 text-slate-400">{e.kind}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-800 dark:text-white">+{e.points}</span>
                          <span className="ml-1 text-xs text-slate-400">{new Date(e.day).toLocaleDateString()}</span>
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
                <p className="section-title">Badges earned</p>
                {earned.length === 0 ? (
                  <p className="muted text-sm">No badges earned yet. Complete real actions to unlock them.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {earned.map((b) => (
                      <span key={b.id} className="badge-purple" title={b.desc}>
                        {b.name} ({b.points} pts)
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Reveal>

            <Reveal>
              <div className="card p-4 sm:p-5">
                <p className="section-title">Pending badges</p>
                {upcoming.length === 0 ? (
                  <p className="muted text-sm">All badges earned!</p>
                ) : (
                  <ul className="text-sm text-slate-600 dark:text-slate-400">
                    {upcoming.map((b) => (
                      <li key={b.id} className="flex justify-between py-1">
                        <span>{b.name}</span>
                        <span className="font-mono text-xs">{b.remaining} pts to go</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Reveal>

            <Reveal>
              <div className="card p-4 sm:p-5">
                <p className="section-title">How points work</p>
                <p className="muted text-sm">{summary.note}</p>
              </div>
            </Reveal>
          </div>
        </div>
      )}
    </div>
  );
}

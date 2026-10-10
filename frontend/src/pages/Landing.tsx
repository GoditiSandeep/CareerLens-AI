import { Link } from "react-router-dom";
import { SITE } from "../lib/site";

const FEATURES: { icon: string; title: string; body: string }[] = [
  { icon: "◎", title: "Career discovery", body: "Explore 13+ career paths with skills, salary bands, demand levels and explainable fit scores." },
  { icon: "◈", title: "Skill gap analysis", body: "See exactly where you stand versus your target role, with prioritized recommendations." },
  { icon: "➛", title: "Personal roadmaps", body: "Generate a month-by-month learning plan with deadlines, resources and progress tracking." },
  { icon: "✎", title: "Resume intelligence", body: "ATS scoring, section checks, keyword coverage and job-description match reports." },
  { icon: "▦", title: "Application tracking", body: "A Kanban board for wishlist, applied, assessment, interview, offer and rejected stages." },
  { icon: "✦", title: "AI career mentor", body: "Ask about preparation, interviews, projects and next steps — works offline in mock mode." },
];

export default function Landing() {
  return (
    <div className="bg-aurora relative min-h-screen overflow-hidden dark:bg-slate-950">
      {/* Restrained floating decorations — decorative only, pointer-events off */}
      <span className="orb orb-a -left-16 top-10 h-56 w-56" aria-hidden />
      <span className="orb orb-b right-0 top-40 h-72 w-72" aria-hidden />
      <span className="orb orb-c left-1/3 bottom-0 h-64 w-64" aria-hidden />

      <header className="anim-fade-in relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 font-bold text-white">
            C
          </span>
          <span className="font-bold text-slate-900 dark:text-white">CareerLens AI</span>
        </div>
        <nav className="flex items-center gap-2" aria-label="Primary">
          <Link to="/about" className="btn-ghost hidden sm:inline-flex">About</Link>
          <Link to="/contact" className="btn-ghost hidden sm:inline-flex">Contact</Link>
          <Link to="/login" className="btn-ghost">Sign in</Link>
          <Link to="/register" className="btn-primary">Get started</Link>
        </nav>
      </header>

      <section className="relative mx-auto max-w-6xl px-4 py-16 text-center sm:py-24">
        <span className="badge-brand anim-fade-up mb-4">Built for students · Free & open</span>
        <h1 className="anim-fade-up stagger-1 mx-auto max-w-3xl text-4xl font-extrabold leading-tight text-slate-900 dark:text-white sm:text-5xl">
          Discover. Prepare. Grow.{" "}
          <span className="text-brand-600 dark:text-brand-400">Get Career-Ready.</span>
        </h1>
        <p className="anim-fade-up stagger-2 mx-auto mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          CareerLens AI turns your skills, goals and progress into a personalized career plan —
          with honest, explainable guidance instead of guesswork.
        </p>
        <div className="anim-fade-up stagger-3 mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/register" className="btn-primary !px-6 !py-3 !text-base">
            Create free account
          </Link>
          <Link to="/login" className="btn-ghost !px-6 !py-3 !text-base">
            Sign in
          </Link>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Demo account available after seeding: <code>demo@careerlens.ai</code> / <code>Demo@12345</code>
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-slate-800 dark:text-brand-400" aria-hidden>
                {f.icon}
              </span>
              <h2 className="mt-3 font-semibold text-slate-900 dark:text-white">{f.title}</h2>
              <p className="muted mt-1">{f.body}</p>
            </div>
          ))}
        </div>
        <div className="card mt-8 flex flex-col items-start gap-3 border-brand-200 bg-brand-50/50 dark:border-brand-900 dark:bg-brand-950/40 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="section-title">Ready to see your career readiness score?</p>
            <p className="muted">Takes about 2 minutes to set up your profile.</p>
          </div>
          <Link to="/register" className="btn-primary">Start onboarding →</Link>
        </div>
        <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-400 dark:border-slate-800">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-center sm:text-left">
              CareerLens AI — demonstration platform. Jobs and projects are seeded sample data,
              not live listings. AI features run in deterministic mock mode unless API credentials
              are configured.
            </p>
            <nav className="flex flex-wrap items-center justify-center gap-3" aria-label="Footer">
              <Link className="hover:text-brand-600" to="/about">About</Link>
              <Link className="hover:text-brand-600" to="/contact">Contact</Link>
              <Link className="hover:text-brand-600" to="/privacy">Privacy</Link>
              <Link className="hover:text-brand-600" to="/terms">Terms</Link>
            </nav>
          </div>
          <p className="mt-3 text-center">
            Owner: {SITE.ownerName} ·{" "}
            <a className="hover:text-brand-600" href={`mailto:${SITE.email}`}>{SITE.email}</a> ·{" "}
            <a className="hover:text-brand-600" href={`tel:${SITE.phone}`}>{SITE.phone}</a>
          </p>
        </footer>
      </section>
    </div>
  );
}

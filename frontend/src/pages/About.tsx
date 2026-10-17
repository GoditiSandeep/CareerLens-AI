import { Link } from "react-router-dom";
import { SITE } from "../lib/site";
import SiteFooter from "../components/SiteFooter";

const PRINCIPLES = [
  { title: "Honest, explainable guidance", body: "Every score explains its factors and separates self-reported skills from assessed evidence. We never guarantee employment or salary." },
  { title: "Useful beyond IT", body: "Built for students, exam aspirants, career-changers, working professionals and lifelong learners across every education level." },
  { title: "Your data stays yours", body: "Inspect, correct, export or delete your information at any time. Personal data is only sent to external AI with your consent." },
  { title: "Works out of the box", body: "Runs fully on your machine with a deterministic mock AI. Configure OpenAI or Gemini credentials only when you want live responses." },
];

export default function About() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 font-bold text-white">C</span>
          <span className="font-bold text-slate-900 dark:text-white">{SITE.name}</span>
        </Link>
        <nav className="flex items-center gap-2" aria-label="Primary">
          <Link to="/about" className="btn-ghost">About</Link>
          <Link to="/contact" className="btn-ghost">Contact</Link>
          <Link to="/login" className="btn-primary">Sign in</Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-10">
        <div className="anim-fade-up">
          <span className="badge-brand mb-3">About {SITE.name}</span>
          <h1 className="page-title">A career companion for every stage of life.</h1>
          <p className="page-sub mt-2">
            {SITE.tagline}
          </p>
        </div>

        <div className="anim-fade-up stagger-1 card mt-6 space-y-4 text-sm text-slate-700 dark:text-slate-300">
          <p>
            {SITE.name} helps you discover career opportunities, understand your skills, learn
            new abilities, build personalized plans, prepare for jobs and examinations, manage
            applications, and grow professionally throughout your life.
          </p>
          <p>
            Whether you are a school or college student, preparing for a competitive exam,
            pursuing a certification, changing careers, or developing professionally, the platform
            adapts to <span className="font-semibold">your</span> goals, schedule, budget and
            learning style — without assumptions about your education level or profession.
          </p>
          <p>
            Created and maintained by <span className="font-semibold">{SITE.ownerName}</span>.
          </p>
        </div>

        <h2 className="section-title mt-10">What guides us</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {PRINCIPLES.map((p, i) => (
            <div key={p.title} className={`card card-interactive anim-fade-up stagger-${Math.min(8, i + 1)}`}>
              <p className="font-semibold text-slate-900 dark:text-white">{p.title}</p>
              <p className="muted mt-1 text-sm">{p.body}</p>
            </div>
          ))}
        </div>

        <h2 className="section-title mt-10">How recommendations work</h2>
        <p className="muted mt-2 text-sm">
          Career discovery, skill-gap analysis, readiness scores and roadmaps are computed
          transparently from your profile and the platform's career dataset. When an AI provider
          is configured, the mentor can also generate natural-language guidance — but it is always
          clearly labelled, grounded in your own information, and grounded in trusted configured
          resources where possible. Any resume score is a transparent estimate, not a guaranteed
          ATS result.
        </p>

        <div className="card mt-8 border-brand-200 bg-brand-50/50 text-center dark:border-brand-900 dark:bg-brand-950/40">
          <p className="section-title">Ready to begin?</p>
          <p className="muted">Set up your profile in about two minutes.</p>
          <Link to="/register" className="btn-primary mt-3">Create free account</Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

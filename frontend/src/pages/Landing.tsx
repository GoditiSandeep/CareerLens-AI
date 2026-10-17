import { useState } from "react";
import { Link } from "react-router-dom";
import { SITE } from "../lib/site";
import SiteFooter from "../components/SiteFooter";
import {
  AnimatedRing,
  GradientButton,
  GlassCard,
  ParticleField,
  ScrollReveal,
  TiltCard,
} from "../components/ui";

const FEATURES: { icon: string; title: string; body: string }[] = [
  { icon: "◎", title: "Career Universe", body: "Explore an interactive map of 13+ career paths, their skills, prerequisites and related opportunities." },
  { icon: "◈", title: "Skill gap analysis", body: "See exactly where you stand versus your target role, with prioritized recommendations." },
  { icon: "➛", title: "Adaptive roadmaps", body: "Generate a month-by-month learning plan with deadlines, resources and progress tracking." },
  { icon: "✎", title: "Resume intelligence", body: "ATS scoring, section checks, keyword coverage and job-description match reports." },
  { icon: "▦", title: "Application tracking", body: "A Kanban board for wishlist, applied, assessment, interview, offer and rejected stages." },
  { icon: "✦", title: "AI career mentor", body: "Ask about preparation, interviews, projects and next steps — works offline in mock mode." },
];

const STEPS: { n: string; title: string; body: string }[] = [
  { n: "1", title: "Tell us about you", body: "A short, friendly onboarding captures your education, skills, interests and goals — without assuming your field." },
  { n: "2", title: "Get your career twin", body: "See explainable fit scores, transferable skills and gaps, then explore paths side by side in the Career Universe." },
  { n: "3", title: "Follow your plan", body: "Work an adaptive roadmap, practise interviews, track applications and watch your readiness grow." },
];

const FAQS: { q: string; a: string }[] = [
  { q: "Is CareerLens AI free to use?", a: "Yes. The platform is free to explore and the core planning, resume, interview and tracking tools run locally with no paid services required." },
  { q: "Are the jobs and opportunities real?", a: "Jobs, internships and projects shown are clearly labelled seeded sample data for demonstration — not live listings. When live sources are configured they are labelled and linked; we never invent openings." },
  { q: "How do the AI features work?", a: "AI features use a provider you configure (such as OpenAI or Gemini). When no credentials are set, CareerLens AI falls back to a deterministic mock mode that is always clearly labelled so you know a real model was not called." },
  { q: "Is my data private?", a: "Your profile, resumes and progress live in your own deployment's database and are never shared publicly. Private data is only sent to an AI provider if you explicitly consent." },
  { q: "Are the readiness scores guaranteed?", a: "No. All readiness, fit and ATS-style scores are transparent estimates to guide your effort — not guaranteed outcomes for interviews, salaries or job offers." },
];

export default function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  return (
    <div className="bg-aurora relative min-h-screen overflow-hidden dark:bg-slate-950">
      {/* Subtle ambient particles + floating decorations — purely decorative */}
      <ParticleField count={22} />
      <span className="orb orb-a -left-16 top-10 h-56 w-56" aria-hidden />
      <span className="orb orb-b right-0 top-40 h-72 w-72" aria-hidden />
      <span className="orb orb-c left-1/3 bottom-0 h-64 w-64" aria-hidden />

      <header className="anim-fade-in relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 font-bold text-white">C</span>
          <span className="font-bold text-slate-900 dark:text-white">{SITE.name}</span>
        </div>
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300 sm:flex">
          <a className="hover:text-brand-600" href="#features">Features</a>
          <a className="hover:text-brand-600" href="#how">How it works</a>
          <a className="hover:text-brand-600" href="#faq">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login" className="btn-ghost !py-1.5 !text-sm">Sign in</Link>
          <Link to="/register" className="btn-primary !py-1.5 !text-sm">Get started</Link>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 lg:grid-cols-2 lg:py-16">
        <ScrollReveal className="anim-fade-up">
          <span className="badge-brand anim-fade-up mb-4 inline-flex items-center gap-1.5">
            <span className="pulse-dot" aria-hidden /> Built for every career stage · Free &amp; open
          </span>
          <h1 className="text-4xl font-extrabold leading-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
            Discover. Prepare. Grow.{" "}
            <span className="text-gradient-anim bg-gradient-to-r from-brand-600 via-violet-500 to-cyan-400 bg-clip-text text-transparent">
              Get Career-Ready.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-slate-600 dark:text-slate-300">
            CareerLens AI turns your skills, goals and progress into a personalized
            career plan — with honest, explainable guidance instead of guesswork.
          </p>
          <div className="anim-fade-up stagger-2 mt-8 flex flex-wrap items-center gap-3">
            <GradientButton href="/register" className="!px-6 !py-3 !text-base">
              Create free account
              <span aria-hidden>→</span>
            </GradientButton>
            <Link to="/login" className="btn-ghost !px-6 !py-3 !text-base">Explore demo</Link>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Seeded demo account: <code>demo@careerlens.ai</code> / <code>Demo@12345</code>
          </p>
        </ScrollReveal>

        {/* Animated product preview — represents the in-app readiness view */}
        <ScrollReveal delay={2} className="anim-fade-up stagger-2">
          <TiltCard className="float-slow">
            <GlassCard strong sheen className="!p-6">
              <div className="flex items-center justify-between">
                <p className="section-title !text-base">Your career readiness</p>
                <span className="badge-green">Live preview</span>
              </div>
              <div className="mt-5 flex items-center gap-6">
                <AnimatedRing
                  value={68}
                  size={96}
                  thickness={8}
                  label="Ready"
                  color="#22d3ee"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  {[
                    { label: "Skills", value: 72 },
                    { label: "Projects", value: 55 },
                    { label: "Interview prep", value: 40 },
                  ].map((r) => (
                    <div key={r.label}>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{r.label}</span><span>{r.value}%</span>
                      </div>
                      <div className="progress-track mt-1">
                        <span style={{ width: `${r.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="muted mt-4 text-xs">
                Scores are transparent estimates to guide your effort — never guaranteed outcomes.
              </p>
            </GlassCard>
          </TiltCard>
        </ScrollReveal>
      </section>

      {/* ---------- Features ---------- */}
      <section className="relative mx-auto max-w-6xl px-4 py-14">
        <div className="anim-fade-up mx-auto max-w-2xl text-center">
          <p className="section-title">Everything you need to get career-ready</p>
          <p className="muted mt-2">
            From discovering your fit to landing interviews — tools that adapt to your
            stage, field and goals, not a one-size-fits-all template.
          </p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <ScrollReveal key={f.title} delay={(i % 3) + 1}>
              <TiltCard>
                <GlassCard className="h-full !p-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-xl text-brand-700 dark:bg-brand-900/40 dark:text-brand-200" aria-hidden>{f.icon}</span>
                  <p className="mt-4 font-semibold text-slate-900 dark:text-white">{f.title}</p>
                  <p className="muted mt-1 text-sm">{f.body}</p>
                </GlassCard>
              </TiltCard>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="relative mx-auto max-w-6xl px-4 py-14">
        <div className="anim-fade-up mx-auto max-w-2xl text-center">
          <p className="section-title">How CareerLens AI works</p>
          <p className="muted mt-2">Three simple steps to a plan that grows with you.</p>
        </div>
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.n} className={`card anim-fade-up stagger-${i + 1} relative`}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 font-bold text-white">{s.n}</span>
              <p className="mt-4 font-semibold text-slate-900 dark:text-white">{s.title}</p>
              <p className="muted mt-1 text-sm">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="relative mx-auto max-w-3xl px-4 py-14">
        <div className="anim-fade-up text-center">
          <p className="section-title">Frequently asked questions</p>
          <p className="muted mt-2">Honest answers about data, AI and expectations.</p>
        </div>
        <div className="mt-8 space-y-3">
          {FAQS.map((f, i) => (
            <div key={f.q} className="card !p-0 overflow-hidden">
              <button
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-expanded={openFaq === i}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span>{f.q}</span>
                <span className={`flex-shrink-0 text-brand-600 transition-transform ${openFaq === i ? "rotate-45" : ""}`} aria-hidden>+</span>
              </button>
              {openFaq === i && (
                <p className="muted px-4 pb-4 text-sm anim-fade-in">{f.a}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="relative mx-auto max-w-6xl px-4 pb-16">
        <div className="card anim-fade-up relative overflow-hidden text-center !p-10">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-600/10 via-transparent to-violet-600/10" aria-hidden />
          <p className="section-title">Ready to get career-ready?</p>
          <p className="muted mx-auto mt-2 max-w-xl">
            Create your career twin, explore the universe of paths, and start a plan
            that adapts to you — free, private and yours to control.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link to="/register" className="btn-primary !px-6 !py-3 !text-base">Create free account</Link>
            <Link to="/login" className="btn-ghost !px-6 !py-3 !text-base">Sign in</Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

import { Link } from "react-router-dom";
import { SITE } from "../lib/site";
import SiteFooter from "../components/SiteFooter";

export default function Terms() {
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

      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <span className="badge-brand mb-3">Terms</span>
        <h1 className="page-title">Terms of use</h1>
        <p className="page-sub mt-2">
          A plain-language overview of using {SITE.name}. This is not legal advice.
        </p>

        <div className="card mt-6 space-y-5 text-sm text-slate-700 dark:text-slate-300">
          <section>
            <p className="font-semibold text-slate-900 dark:text-white">Demonstration &amp; sample data</p>
            <p className="muted mt-1">
              Career paths, jobs, internships, scholarships and courses may include seeded{" "}
              <span className="font-semibold">sample</span> data that is clearly labelled. Sample
              records are illustrative and are not verified or live listings. Do not treat sample
              opportunities as real openings or deadlines.
            </p>
          </section>
          <section>
            <p className="font-semibold text-slate-900 dark:text-white">Guidance, not guarantees</p>
            <p className="muted mt-1">
              Career, readiness and resume scores are transparent estimates to help you prepare. They
              do not guarantee employment, salary, admission, or any ATS outcome. Final decisions
              always rest with you and the relevant employers or institutions.
            </p>
          </section>
          <section>
            <p className="font-semibold text-slate-900 dark:text-white">Your account</p>
            <p className="muted mt-1">
              You are responsible for keeping your password secure and for the content you add. Do
              not upload material you do not have the right to share.
            </p>
          </section>
          <section>
            <p className="font-semibold text-slate-900 dark:text-white">Acceptable use</p>
            <p className="muted mt-1">
              Use the platform lawfully and respectfully. Administrators may disable accounts that
              abuse or threaten the service.
            </p>
          </section>
          <section>
            <p className="font-semibold text-slate-900 dark:text-white">Changes &amp; contact</p>
            <p className="muted mt-1">
              These terms may be updated as the platform evolves. Questions? Contact the owner at{" "}
              <a className="text-brand-600 hover:underline" href={`mailto:${SITE.email}`}>{SITE.email}</a>.
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

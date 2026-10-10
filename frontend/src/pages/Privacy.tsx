import { Link } from "react-router-dom";
import { SITE } from "../lib/site";
import SiteFooter from "../components/SiteFooter";

export default function Privacy() {
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
        <span className="badge-brand mb-3">Privacy</span>
        <h1 className="page-title">Privacy summary</h1>
        <p className="page-sub mt-2">
          How {SITE.name} handles your information. This is a plain-language summary, not legal advice.
        </p>

        <div className="card mt-6 space-y-5 text-sm text-slate-700 dark:text-slate-300">
          <section>
            <p className="font-semibold text-slate-900 dark:text-white">What we store</p>
            <p className="muted mt-1">
              Your account (name, email, a securely hashed password), profile, skills, goals,
              roadmaps, resumes you upload, and application notes — all saved in the application's
              database on the server it runs on.
            </p>
          </section>
          <section>
            <p className="font-semibold text-slate-900 dark:text-white">Passwords &amp; secrets</p>
            <p className="muted mt-1">
              Passwords are stored only as secure hashes — never in plain text. Passwords, hashes,
              secret keys and API keys are never shown in the interface or logs.
            </p>
          </section>
          <section>
            <p className="font-semibold text-slate-900 dark:text-white">AI and your data</p>
            <p className="muted mt-1">
              When no AI provider is configured, the mentor uses a deterministic on-device mock and
              no data leaves the server. If you configure OpenAI or Gemini, personal content is only
              sent to that provider <span className="font-semibold">with your consent</span> for the
              specific request. Credentials stay in server environment variables.
            </p>
          </section>
          <section>
            <p className="font-semibold text-slate-900 dark:text-white">Your control</p>
            <p className="muted mt-1">
              You can inspect, correct, export or delete your saved information at any time from your
              profile. For help, contact the owner at{" "}
              <a className="text-brand-600 hover:underline" href={`mailto:${SITE.email}`}>{SITE.email}</a>.
            </p>
          </section>
          <section>
            <p className="font-semibold text-slate-900 dark:text-white">Compliance</p>
            <p className="muted mt-1">
              We do not claim any specific legal or regulatory compliance. If you deploy this
              platform, review the applicable privacy laws for your users and region.
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

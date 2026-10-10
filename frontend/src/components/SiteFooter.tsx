import { Link } from "react-router-dom";
import { SITE } from "../lib/site";

// Public footer shown on marketing/about/contact pages. Uses only public
// owner/contact information — never credentials.
export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">
              C
            </span>
            <span className="font-bold text-slate-900 dark:text-white">{SITE.name}</span>
          </div>
          <p className="muted mt-3 text-sm">{SITE.tagline}</p>
        </div>

        <nav aria-label="Platform">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Platform</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="text-slate-600 hover:text-brand-600 dark:text-slate-400" to="/about">About</Link></li>
            <li><Link className="text-slate-600 hover:text-brand-600 dark:text-slate-400" to="/contact">Contact</Link></li>
            <li><Link className="text-slate-600 hover:text-brand-600 dark:text-slate-400" to="/register">Get started</Link></li>
          </ul>
        </nav>

        <nav aria-label="Legal">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Legal</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="text-slate-600 hover:text-brand-600 dark:text-slate-400" to="/privacy">Privacy</Link></li>
            <li><Link className="text-slate-600 hover:text-brand-600 dark:text-slate-400" to="/terms">Terms</Link></li>
          </ul>
        </nav>

        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Owner &amp; support</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <li>{SITE.ownerName}</li>
            <li>
              <a className="hover:text-brand-600" href={`mailto:${SITE.email}`}>{SITE.email}</a>
            </li>
            <li>
              <a className="hover:text-brand-600" href={`tel:${SITE.phone}`}>{SITE.phone}</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-400 dark:border-slate-800">
        © {SITE.name}. Jobs and projects are seeded sample data, not live listings. AI
        features run in deterministic mock mode unless API credentials are configured.
      </div>
    </footer>
  );
}

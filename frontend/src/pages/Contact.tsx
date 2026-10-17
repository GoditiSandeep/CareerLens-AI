import { useState } from "react";
import { Link } from "react-router-dom";
import { SITE } from "../lib/site";
import SiteFooter from "../components/SiteFooter";

const TOPICS = [
  "General question",
  "Account or login help",
  "Feature feedback",
  "Report a problem",
  "Privacy or data request",
];

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  // Local-only confirmation. No message is transmitted anywhere — this platform
  // has no public mail backend by design (keeps it private and self-hosted).
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Please fill in your name, email and message.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setSent(true);
  };

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

      <main className="anim-fade-up mx-auto w-full max-w-4xl px-4 py-10">
        <span className="badge-brand mb-3">Contact</span>
        <h1 className="page-title">We're here to help.</h1>
        <p className="page-sub mt-2">
          Reach the {SITE.name} team using the details below, or send a message.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="card">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Email</p>
            <a className="mt-1 block font-semibold text-brand-600 hover:underline" href={`mailto:${SITE.email}`}>
              {SITE.email}
            </a>
          </div>
          <div className="card">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Phone</p>
            <a className="mt-1 block font-semibold text-brand-600 hover:underline" href={`tel:${SITE.phone}`}>
              {SITE.phone}
            </a>
          </div>
          <div className="card sm:col-span-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Owner</p>
            <p className="mt-1 font-semibold text-slate-900 dark:text-white">{SITE.ownerName}</p>
            <p className="muted text-sm">Administrator: {SITE.adminDisplayName}</p>
          </div>
        </div>

        <form onSubmit={submit} className="card mt-6 grid gap-3">
          <p className="section-title">Send a message</p>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {sent ? (
            <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
              <p className="font-semibold">Thanks, {name.trim()}!</p>
              <p className="mt-1">
                Your note has been captured in this form. {SITE.name} runs self-hosted with no
                public mail backend, so please also email{" "}
                <a className="underline" href={`mailto:${SITE.email}`}>{SITE.email}</a> directly to
                reach the owner, and reference topic “{topic}”.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="cName">Your name</label>
                  <input id="cName" className="input" value={name}
                    onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="cEmail">Your email</label>
                  <input id="cEmail" type="email" className="input" value={email}
                    onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="cTopic">Topic</label>
                <select id="cTopic" className="input" value={topic}
                  onChange={(e) => setTopic(e.target.value)}>
                  {TOPICS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="cMsg">Message</label>
                <textarea id="cMsg" className="input" rows={4} value={message}
                  onChange={(e) => setMessage(e.target.value)} />
              </div>
              <div>
                <button className="btn-primary">Send message</button>
              </div>
            </>
          )}
        </form>
      </main>

      <SiteFooter />
    </div>
  );
}

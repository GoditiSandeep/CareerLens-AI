// App shell: sidebar navigation (responsive), topbar with theme toggle.
import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface NavItem {
  to: string;
  label: string;
  icon: string;
}
const PRIMARY: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: "◫" },
  { to: "/careers", label: "Careers", icon: "◎" },
  { to: "/skills", label: "Skills & Gaps", icon: "◈" },
  { to: "/roadmap", label: "Roadmap", icon: "➛" },
  { to: "/jobs", label: "Jobs", icon: "⌂" },
  { to: "/applications", label: "Applications", icon: "▦" },
  { to: "/resumes", label: "Resume", icon: "✎" },
];
const PRACTICE: NavItem[] = [
  { to: "/practice", label: "Practice Hub", icon: "◉" },
  { to: "/projects", label: "Projects", icon: "❖" },
  { to: "/chat", label: "AI Mentor", icon: "✦" },
  { to: "/profile", label: "Profile & Settings", icon: "☰" },
];
const ADMIN: NavItem = { to: "/admin", label: "Admin", icon: "⚙" };

function linkClass({ isActive }: { isActive: boolean }) {
  return [
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-brand-600 text-white shadow-sm"
      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  ].join(" ");
}

function ThemeToggle() {
  const [dark, setDark] = useState(document.documentElement.classList.contains("dark"));
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("careerlens_theme", next ? "dark" : "light");
  };
  return (
    <button
      onClick={toggle}
      className="btn-ghost !px-3"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
    >
      {dark ? "☀" : "☾"}
    </button>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 font-bold text-white">
          C
        </span>
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">CareerLens AI</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Discover. Prepare. Grow.
          </p>
        </div>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4" aria-label="Main">
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Overview
          </p>
          {PRIMARY.map((i) => (
            <NavLink key={i.to} to={i.to} className={linkClass} onClick={() => setOpen(false)}>
              <span aria-hidden className="w-4 text-center">{i.icon}</span>
              {i.label}
            </NavLink>
          ))}
        </div>
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Grow
          </p>
          {PRACTICE.map((i) => (
            <NavLink key={i.to} to={i.to} className={linkClass} onClick={() => setOpen(false)}>
              <span aria-hidden className="w-4 text-center">{i.icon}</span>
              {i.label}
            </NavLink>
          ))}
        </div>
        {user?.role === "admin" && (
          <div className="space-y-1">
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Manage
            </p>
            <NavLink key={ADMIN.to} to={ADMIN.to} className={linkClass} onClick={() => setOpen(false)}>
              <span aria-hidden className="w-4 text-center">{ADMIN.icon}</span>
              {ADMIN.label}
            </NavLink>
          </div>
        )}
      </nav>
      <div className="border-t border-slate-200 px-4 py-4 dark:border-slate-800">
        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
          {user?.full_name}
        </p>
        <p className="truncate text-xs text-slate-500">{user?.email}</p>
        <button onClick={logout} className="btn-ghost mt-3 w-full !text-xs">
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl dark:bg-slate-900">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-center gap-3">
            <button
              className="btn-ghost !px-2 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open navigation menu"
            >
              ☰
            </button>
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {PRIMARY.concat(PRACTICE).concat(user?.role === "admin" ? [ADMIN] : [])
                .find((i) => location.pathname.startsWith(i.to))?.label ??
                "CareerLens AI"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user?.is_demo && <span className="badge-amber">Demo account</span>}
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

// Shared UI primitives: toasts, loaders, empty/error states, bars.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// ---------- Toasts ----------
type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}
const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((message: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg ${
              t.kind === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                : t.kind === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200"
                  : "border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-200"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

// ---------- States ----------
export function Loader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-14 text-slate-500 dark:text-slate-400">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-2xl dark:bg-slate-800" aria-hidden>
        ◍
      </div>
      <p className="section-title">{title}</p>
      {hint && <p className="muted mt-1 max-w-md">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
    >
      <span>{message}</span>
      {onRetry && (
        <button className="btn-ghost !py-1 !text-xs" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

// ---------- Display ----------
export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div>
      {label && (
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{label}</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">{v.toFixed(0)}%</span>
        </div>
      )}
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent = "brand",
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "brand" | "green" | "amber" | "rose";
}) {
  const ring =
    accent === "green"
      ? "text-emerald-600 dark:text-emerald-400"
      : accent === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : accent === "rose"
          ? "text-rose-600 dark:text-rose-400"
          : "text-brand-600 dark:text-brand-400";
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className={`mt-1 text-3xl font-bold ${ring}`}>{value}</p>
      {hint && <p className="muted mt-1 text-xs">{hint}</p>}
    </div>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 75 ? "badge-green" : score >= 50 ? "badge-amber" : "badge-rose";
  return <span className={cls}>{score.toFixed(0)}%</span>;
}

export function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

export function formatDate(raw: string | null | undefined): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// ---------- Motion helpers (Phase I) ----------

/** True when the user prefers reduced motion; animations are skipped. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Animated count-up for genuine numeric statistics. If the value is not a
 * finite number (or reduced-motion is set) it renders the number directly —
 * so it never implies motion for non-numeric data.
 */
export function CountUp({
  value,
  duration = 900,
}: {
  value: number | string;
  duration?: number;
}) {
  const isNumeric = typeof value === "number" && Number.isFinite(value);
  const [display, setDisplay] = useState<number>(isNumeric ? 0 : (value as number));

  useEffect(() => {
    if (!isNumeric) return;
    if (prefersReducedMotion()) {
      setDisplay(value as number);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const target = value as number;
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf); // clean up on unmount/value change
  }, [value, isNumeric, duration]);

  if (!isNumeric) return <>{value}</>;
  return <>{display.toLocaleString()}</>;
}

/** Skeleton placeholder for genuine async loading states. */
export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

/**
 * Reveal-on-mount wrapper. Adds a staggered fade-up entrance; purely
 * decorative, and the children are always rendered (never gated behind the
 * animation), so reduced-motion and no-JS users still see content.
 */
export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  as?: React.ElementType;
  className?: string;
}) {
  const stagger = delay > 0 ? ` stagger-${Math.min(8, Math.max(1, delay))}` : "";
  return <Tag className={`anim-fade-up${stagger} ${className}`}>{children}</Tag>;
}

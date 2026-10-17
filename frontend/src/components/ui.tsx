// Shared UI primitives: toasts, loaders, empty/error states, bars.
import {
  Component,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ErrorInfo,
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
  const [toasts, setToasts] = useState<(Toast & { leaving?: boolean })[]>([]);
  const notify = useCallback((message: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    // Begin exit after a pause, then remove once the fade-out completes.
    window.setTimeout(() => {
      setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
      window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 280);
    }, 4000);
  }, []);
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg transition-all duration-300 ease-out ${
              t.leaving ? "translate-x-4 opacity-0" : "translate-x-0 opacity-100 toast-in"
            } ${
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

// ---------- Error boundary ----------
// Wraps page sections so an unexpected render crash (e.g. malformed API data)
// shows a friendly card instead of a blank white page. The error is still
// reported to the browser console for debugging.
interface ErrorBoundaryProps {
  children: ReactNode;
  label?: string;
}
interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ""}]`,
      error,
      info.componentStack,
    );
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" className="card flex flex-col items-center py-14 text-center">
        <p className="section-title">Something went wrong</p>
        <p className="muted mt-2 max-w-md text-sm">
          {this.props.label ?? "This page"} hit an unexpected error and could not
          finish rendering. Details are in the browser console (F12).
        </p>
        <p className="mt-3 max-w-full break-all rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {error.message}
        </p>
        <button
          className="btn-primary mt-4"
          onClick={() => this.setState({ error: null })}
        >
          Try again
        </button>
      </div>
    );
  }
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
  suffix,
  hint,
  accent = "brand",
}: {
  label: string;
  value: string | number;
  /** Optional suffix (e.g. "%") rendered after a numeric value; ignored for strings. */
  suffix?: string;
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
  const isNumeric = typeof value === "number" && Number.isFinite(value);
  return (
    <div className="card card-interactive">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className={`mt-1 text-3xl font-bold ${ring}`}>
        {isNumeric ? <CountUp value={value as number} /> : value}
        {isNumeric && suffix && (
          <span className="text-lg font-semibold opacity-70">{suffix}</span>
        )}
      </p>
      {hint && <p className="muted mt-1 text-xs">{hint}</p>}
    </div>
  );
}

/**
 * Animated labelled bar. The fill width transitions in whenever `value`
 * changes, and the read-out counts up. Non-numeric values render statically so
 * we never fake motion for data that isn't a real measurement.
 */
export function AnimatedBar({
  value,
  label,
  suffix = "%",
  accent = "brand",
}: {
  value: number;
  label?: string;
  suffix?: string;
  accent?: "brand" | "green" | "amber" | "rose";
}) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const fill =
    accent === "green"
      ? "bg-emerald-500"
      : accent === "amber"
        ? "bg-amber-500"
        : accent === "rose"
          ? "bg-rose-500"
          : "bg-brand-600";

  // Mount the fill at 0, then transition to the real value on the next tick.
  // A CSS width transition only animates when the value changes *after* the
  // first paint, so rendering straight at `v%` would never animate at all.
  // Under reduced motion we mount straight at the final value so the very
  // first paint is already correct and no transition ever fires.
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? v : 0));
  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(v);
      return;
    }
    const id = window.setTimeout(() => setShown(v), 60);
    return () => window.clearTimeout(id);
  }, [v]);
  const width = Math.max(0, Math.min(100, shown || 0));

  return (
    <div>
      {label && (
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="truncate pr-2">{label}</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            <CountUp value={Math.round(v)} />{suffix}
          </span>
        </div>
      )}
      <div className="progress-track" role="presentation">
        <div
          className={`progress-fill ${fill}`}
          style={{
            width: `${width}%`,
            transition: "width 900ms cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      </div>
    </div>
  );
}

/**
 * Staggered chip list. Children appear with a short, sequenced fade so matched
 * / missing skill lists read as a graceful cascade rather than a hard pop. The
 * chips are always in the DOM (accessibility + reduced-motion safe).
 */
export function SkillChips({
  items,
  tone = "green",
  emptyHint,
  icon,
}: {
  items: string[];
  tone?: "green" | "rose" | "amber" | "brand";
  emptyHint?: string;
  icon?: string;
}) {
  const pill =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
      : tone === "rose"
        ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          : "border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-200";
  if (!items.length) {
    return emptyHint ? <p className="muted text-xs italic">{emptyHint}</p> : null;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((raw, i) => (
        <li
          key={`${raw}-${i}`}
          className={`anim-fade-up stagger-${Math.min(8, (i % 8) + 1)} inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${pill}`}
        >
          {icon && <span aria-hidden className="opacity-70">{icon}</span>}
          {raw}
        </li>
      ))}
    </ul>
  );
}

/** Three-dot "typing" indicator shown only while a real request is in flight. */
export function TypingDots({ label = "Mentor is thinking" }: { label?: string }) {
  return (
    <div className="flex justify-start" role="status" aria-live="polite">
      <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <span className="flex items-end gap-1" aria-hidden>
          {[0, 1, 2].map((d) => (
            <span
              key={d}
              className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500"
              style={{ animationDelay: `${d * 0.15}s` }}
            />
          ))}
        </span>
        <span className="sr-only">{label}</span>
        <span aria-hidden className="text-xs">{label}…</span>
      </div>
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
  // Count up from 0 — unless reduced motion is set, in which case mount
  // straight at the final number so the value never flashes "0" first.
  const [display, setDisplay] = useState<number>(() =>
    isNumeric && !prefersReducedMotion() ? 0 : (value as number),
  );

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

// ---------- Next-gen visual primitives (Phase B) ----------
// All decorative: content is always rendered, and every motion effect is
// disabled under `prefers-reduced-motion` (or when the relevant API is
// unavailable) so accessibility and no-JS users lose nothing.

/**
 * Scroll-triggered reveal. Adds `.reveal` and flips to `.reveal.in` once the
 * element scrolls into view (IntersectionObserver, one-shot). Under reduced
 * motion, or where IntersectionObserver is missing, it reveals immediately so
 * content is never trapped invisible.
 */
export function ScrollReveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: React.ElementType;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      className={`reveal${shown ? " in" : ""} ${className}`}
      style={delay ? { transitionDelay: `${Math.min(delay, 8) * 70}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}

/**
 * 3D tilt card. On fine-pointer movement it rotates the inner element subtly
 * toward the cursor via the `.tilt` transform. Touch devices and reduced-motion
 * users get a perfectly static card; the effect never blocks interaction.
 */
export function TiltCard({
  children,
  className = "",
  max = 7,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion()) return;
    const el = ref.current;
    if (!el) return;
    if (e.pointerType && e.pointerType !== "mouse") return; // skip touch/pen
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const rx = (0.5 - py) * max * 2;
    const ry = (px - 0.5) * max * 2;
    el.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
  };
  const reset = () => {
    const el = ref.current;
    if (el) el.style.transform = "rotateX(0deg) rotateY(0deg)";
  };

  return (
    <div className="tilt-scene" onPointerMove={onMove} onPointerLeave={reset}>
      <div ref={ref} className={`tilt ${className}`}>
        {children}
      </div>
    </div>
  );
}

/**
 * Layered glass surface: frosted panel with an optional top sheen highlight
 * and ambient glow. Presentational only — children always render.
 */
export function GlassCard({
  children,
  className = "",
  strong = false,
  glow = true,
  sheen = false,
}: {
  children: ReactNode;
  className?: string;
  strong?: boolean;
  glow?: boolean;
  sheen?: boolean;
}) {
  return (
    <div
      className={`${strong ? "glass-strong" : "glass"} ${glow ? "card-glow" : ""} ${
        sheen ? "glass-sheen" : ""
      } relative overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Animated SVG progress ring driven by a real 0..100 value. The stroke is a
 * CSS transition so it animates whenever the value changes; the accessible
 * number is always present for screen readers and reduced-motion users.
 */
export function AnimatedRing({
  value,
  size = 120,
  thickness = 10,
  label,
  color = "#6366f1",
  trackClassName = "stroke-slate-200 dark:stroke-slate-700",
}: {
  value: number;
  size?: number;
  thickness?: number;
  label?: string;
  color?: string;
  trackClassName?: string;
}) {
  // Mount the arc at 0 (full dash offset = nothing drawn), then sweep to the
  // real value on the next tick — a transition only fires when the value
  // changes after the first paint. Under reduced motion we mount at the final
  // value instead, so there is nothing to transition.
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));
  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(value);
      return;
    }
    const id = window.setTimeout(() => setShown(value), 60);
    return () => window.clearTimeout(id);
  }, [value]);

  const pct = Math.max(0, Math.min(100, shown || 0));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label ? label + ": " : ""}${Math.round(value)}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={thickness}
          className={trackClassName}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={thickness}
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={c}
          style={{
            // Driven via inline style (not an SVG attribute) so the browser's
            // CSS transition engine reliably animates the sweep from 0 → value.
            strokeDashoffset: c - (pct / 100) * c,
            transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-slate-800 dark:text-white">
          <CountUp value={Math.round(value)} />
          <span className="text-sm font-semibold text-slate-400">%</span>
        </span>
        {label && (
          <span className="mt-0.5 px-2 text-center text-[11px] font-medium uppercase tracking-wider text-slate-400">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Primary gradient call-to-action with a moving sheen on hover. Renders as a
 * <button> (or <a> when `href` is set) and forwards extra props (type, onClick,
 * disabled, aria-*) so it drops into existing forms unchanged.
 */
type GradientButtonProps = {
  children: ReactNode;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement> &
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { href?: string };

export function GradientButton({
  children,
  className = "",
  href,
  ...rest
}: GradientButtonProps) {
  const cls = `shine inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 via-brand-600 to-cyan-500 px-5 py-2.5 font-semibold text-white shadow-lg shadow-brand-600/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-600/40 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${className}`;
  if (href) {
    return (
      <a className={cls} href={href} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }
  return (
    <button className={cls} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}

/**
 * Decorative particle field. A fixed, absolutely-positioned layer of drifting
 * dots rendered via CSS animations (no JS loop, GPU-friendly). Purely ambient;
 * hidden from assistive tech and fully static under reduced-motion.
 */
export function ParticleField({ count = 18 }: { count?: number }) {
  const dots = Array.from({ length: count }, (_, i) => i);
  // Deterministic pseudo-random placement so SSR/tests are stable.
  const pos = (i: number, salt: number) => ((i * 37 + salt * 91) % 100);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {dots.map((i) => (
        <span
          key={i}
          className="absolute rounded-full bg-cyan-400/30 dark:bg-cyan-300/20"
          style={{
            left: `${pos(i, 1)}%`,
            top: `${pos(i, 2)}%`,
            width: `${2 + (i % 3)}px`,
            height: `${2 + (i % 3)}px`,
            animation: `float-y ${6 + (i % 5)}s ease-in-out ${i * 0.3}s infinite`,
          }}
        />
      ))}
    </div>
  );
}


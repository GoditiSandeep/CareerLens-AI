// Career Universe — an interactive, data-driven graph of career paths and the
// skills that connect them. Uses the real /careers catalogue and the signed-in
// user's /skills/mine to highlight the pathway from current skills to a goal.
//
// Honesty notes:
//  - Career/skill nodes come from the configured database (seeded sample data).
//  - "Fit"/pathway highlighting compares your saved skills to required skills.
//  - Salary ranges are shown only as seeded ranges, not guarantees.
//  - No employment, salary or outcome is guaranteed anywhere in this view.
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Career, type Skill } from "../lib/api";
import { EmptyState, ErrorBanner, GlassCard, Loader, Reveal, parseList } from "../components/ui";

// Coordinate space for the SVG; scales responsively via viewBox.
const W = 1000;
const H = 640;
const HUB = { x: W / 2, y: H / 2 };
const RING_RADIUS = 224;
const SKILL_ORBIT = 74;

// Deterministic accent per category so the graph reads as one system.
const CATEGORY_COLORS: Record<string, string> = {
  Technology: "#22d3ee",
  Data: "#a78bfa",
  Design: "#f472b6",
  Business: "#34d399",
  Finance: "#fbbf24",
  Healthcare: "#fb7185",
  Education: "#60a5fa",
  Engineering: "#38bdf8",
  Media: "#c084fc",
  Government: "#4ade80",
};
function categoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? "#818cf8";
}

// required_skills can be a list or a {skill: weight} map; normalise to names.
function skillsOf(c: Career): string[] {
  const rs = c.required_skills;
  if (Array.isArray(rs)) return rs.map(String);
  if (rs && typeof rs === "object") return Object.keys(rs);
  return parseList(typeof rs === "string" ? rs : "");
}

// roadmap is a JSON string of [{month, title, items[]}] objects.
interface RoadmapStep {
  month: number;
  title: string;
  items: string[];
}
function roadmapOf(c: Career): RoadmapStep[] {
  const raw = c.roadmap;
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((step) => {
      const s = step as Record<string, unknown>;
      const items = Array.isArray(s.items) ? s.items.map(String) : [];
      return {
        month: Number(s.month ?? 0),
        title: String(s.title ?? "Milestone"),
        items,
      };
    })
    .filter((s) => s.title || s.items.length);
}

interface SkillPoint {
  name: string;
  x: number;
  y: number;
  owned: boolean;
}
interface Placed {
  career: Career;
  x: number;
  y: number;
  skills: SkillPoint[];
  fit: number;
  color: string;
}

export default function CareerUniverse() {
  const [careers, setCareers] = useState<Career[] | null>(null);
  const [mySkills, setMySkills] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        api.get<Career[]>("/careers"),
        api.get<Skill[]>("/skills/mine").catch(() => [] as Skill[]),
      ]);
      setCareers(c);
      setMySkills(new Set(s.map((sk) => sk.name.toLowerCase())));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the career universe");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const categories = useMemo(
    () => Array.from(new Set((careers ?? []).map((c) => c.category))).sort(),
    [careers],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (careers ?? []).filter((c) => {
      if (category && c.category !== category) return false;
      if (!q) return true;
      const hay = [c.name, c.category, c.description, ...skillsOf(c)].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [careers, query, category]);

  // Lay careers out on a ring around the hub, with their skills orbiting them.
  const placed = useMemo<Placed[]>(() => {
    const n = filtered.length;
    if (!n) return [];
    return filtered.map((c, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = HUB.x + RING_RADIUS * Math.cos(angle);
      const y = HUB.y + RING_RADIUS * Math.sin(angle);
      const names = skillsOf(c).slice(0, 6);
      const skills: SkillPoint[] = names.map((name, j) => {
        const a = angle + (j - (names.length - 1) / 2) * 0.42;
        return {
          name,
          x: x + SKILL_ORBIT * Math.cos(a),
          y: y + SKILL_ORBIT * Math.sin(a),
          owned: mySkills.has(name.toLowerCase()),
        };
      });
      const owned = names.filter((name) => mySkills.has(name.toLowerCase())).length;
      const fit = names.length ? Math.round((owned / names.length) * 100) : 0;
      return { career: c, x, y, skills, fit, color: categoryColor(c.category) };
    });
  }, [filtered, mySkills]);

  const selectedPlaced = placed.find((p) => p.career.id === selected) ?? null;

  return (
    <div className="space-y-5">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="page-title">Career Universe</h1>
            <p className="page-sub">
              An interactive map of careers and the skills that connect them. Click a
              career to see its pathway; your saved skills highlight what you already have.
            </p>
          </div>
        </div>
      </Reveal>

      {/* Controls */}
      <div className="card grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="cu-search">Search careers or skills</label>
          <input
            id="cu-search"
            className="input"
            placeholder="e.g. Data Scientist, Python, Design…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="cu-cat">Area</label>
          <select id="cu-cat" className="input" value={category}
            onChange={(e) => setCategory(e.target.value)}>
            <option value="">All areas</option>
            {categories.map((cat) => <option key={cat}>{cat}</option>)}
          </select>
        </div>
        <button className="btn-ghost" onClick={() => { setQuery(""); setCategory(""); setSelected(null); }}>
          Reset
        </button>
      </div>

      {loading && <Loader label="Mapping the career universe…" />}
      {error && <ErrorBanner message={error} onRetry={load} />}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          title="No careers match"
          hint="Try clearing the search or choosing a different area."
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* ---- Interactive graph ---- */}
          <GlassCard className="!p-0 overflow-hidden" sheen>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="h-auto w-full"
              role="img"
              aria-label="Career universe graph. Use the career list below to select a path with the keyboard."
            >
              <defs>
                <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Edges: hub -> career -> skills */}
              {placed.map((p) => {
                const isSel = p.career.id === selected;
                return (
                  <g key={`edges-${p.career.id}`}>
                    <line x1={HUB.x} y1={HUB.y} x2={p.x} y2={p.y}
                      stroke={isSel ? p.color : "#334155"} strokeOpacity={isSel ? 0.7 : 0.28}
                      strokeWidth={isSel ? 2 : 1} />
                    {p.skills.map((s) => (
                      <line key={`${p.career.id}-${s.name}`} x1={p.x} y1={p.y} x2={s.x} y2={s.y}
                        stroke={s.owned ? "#34d399" : "#475569"} strokeOpacity={isSel ? (s.owned ? 0.8 : 0.4) : 0.2}
                        strokeWidth={isSel ? 1.6 : 1} />
                    ))}
                  </g>
                );
              })}

              {/* Hub */}
              <circle cx={HUB.x} cy={HUB.y} r={78} fill="url(#hubGlow)" />
              <circle cx={HUB.x} cy={HUB.y} r={46} className="fill-brand-600" />
              <text x={HUB.x} y={HUB.y + 4} textAnchor="middle"
                className="fill-white text-[15px] font-bold">You</text>

              {/* Skill satellites */}
              {placed.map((p) => p.skills.map((s) => (
                <g key={`sk-${p.career.id}-${s.name}`} opacity={selected === null || selected === p.career.id ? 1 : 0.35}>
                  <circle cx={s.x} cy={s.y} r={5}
                    className={s.owned ? "fill-emerald-400" : "fill-slate-500"} />
                  <text x={s.x} y={s.y - 9} textAnchor="middle"
                    className="fill-slate-300 text-[9px]">{s.name.length > 14 ? s.name.slice(0, 13) + "…" : s.name}</text>
                </g>
              )))}

              {/* Career nodes */}
              {placed.map((p) => {
                const isSel = p.career.id === selected;
                return (
                  <g
                    key={p.career.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSel}
                    aria-label={`${p.career.name}, ${p.fit}% skill match`}
                    className="cursor-pointer outline-none"
                    onClick={() => setSelected(isSel ? null : p.career.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(isSel ? null : p.career.id); }
                    }}
                  >
                    <circle cx={p.x} cy={p.y} r={isSel ? 40 : 32}
                      fill={p.color} fillOpacity={isSel ? 0.95 : 0.55}
                      stroke={isSel ? "#fff" : p.color} strokeWidth={isSel ? 3 : 1.5} />
                    <circle cx={p.x} cy={p.y} r={isSel ? 40 : 32} fill="none"
                      stroke={p.color} strokeOpacity={isSel ? 0.5 : 0} strokeWidth={isSel ? 10 : 0} />
                    <text x={p.x} y={p.y + 4} textAnchor="middle"
                      className="pointer-events-none fill-white text-[11px] font-bold">
                      {p.fit}%
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Accessible selection row (keyboard-friendly alternative to the graph) */}
            <div className="border-t border-slate-200 p-3 dark:border-slate-800">
              <p className="muted mb-2 text-xs">
                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400 align-middle" />a skill you have ·
                <span className="mx-1 inline-block h-2 w-2 rounded-full bg-slate-500 align-middle" />a skill to build ·
                percentages estimate your current match.
              </p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Select a career path">
                {placed.map((p) => (
                  <button key={p.career.id}
                    className={p.career.id === selected ? "btn-primary !py-1 !text-xs" : "btn-ghost !py-1 !text-xs"}
                    aria-pressed={p.career.id === selected}
                    onClick={() => setSelected(p.career.id === selected ? null : p.career.id)}>
                    <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                      style={{ background: p.color }} />{p.career.name}
                  </button>
                ))}
              </div>
            </div>
          </GlassCard>
          {/* ---- Detail panel ---- */}
          <div className="space-y-4">
            {!selectedPlaced && (
              <div className="card flex h-full flex-col items-center justify-center text-center">
                <div className="text-4xl" aria-hidden>◎</div>
                <p className="section-title mt-2">Select a career</p>
                <p className="muted mt-1 text-sm">
                  Click a node in the graph (or pick one above) to see its required
                  skills, learning path, and where you stand today.
                </p>
              </div>
            )}
            {selectedPlaced && (() => {
              const c = selectedPlaced.career;
              const owned = selectedPlaced.skills.filter((s) => s.owned);
              const missing = selectedPlaced.skills.filter((s) => !s.owned);
              const steps = roadmapOf(c);
              return (
                <>
                  <div className="card">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="section-title">{c.name}</h2>
                        <p className="muted text-xs">{c.category} · {c.demand_level} demand</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold" style={{ color: selectedPlaced.color }}>
                          {selectedPlaced.fit}%
                        </p>
                        <p className="muted text-[10px] uppercase">est. match</p>
                      </div>
                    </div>
                    {c.description && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{c.description}</p>}
                    {c.salary_range && (
                      <p className="muted mt-2 text-xs">Seeded salary range (illustrative, not a guarantee): {c.salary_range}</p>
                    )}

                    <div className="mt-4">
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${selectedPlaced.fit}%`, background: selectedPlaced.color }} />
                      </div>
                      <p className="muted mt-1 text-xs">{owned.length} of {selectedPlaced.skills.length} shown skills already in your profile.</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="card">
                      <p className="section-title mb-2 text-emerald-600">You have</p>
                      {owned.length === 0 ? <p className="muted text-sm">None of the listed skills yet.</p> : (
                        <div className="flex flex-wrap gap-1">
                          {owned.map((s) => <span key={s.name} className="badge-green">{s.name}</span>)}
                        </div>
                      )}
                    </div>
                    <div className="card">
                      <p className="section-title mb-2 text-brand-600">To build</p>
                      {missing.length === 0 ? <p className="muted text-sm">You cover every listed skill.</p> : (
                        <div className="flex flex-wrap gap-1">
                          {missing.map((s) => <span key={s.name} className="badge-slate">{s.name}</span>)}
                        </div>
                      )}
                    </div>
                  </div>

                  {steps.length > 0 && (
                    <div className="card">
                      <p className="section-title mb-2">Learning path</p>
                      <ol className="space-y-3">
                        {steps.map((s, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-900/60 dark:text-brand-200">
                              {s.month || i + 1}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{s.title}</p>
                              {s.items.length > 0 && (
                                <ul className="muted mt-1 list-disc pl-4 text-xs">
                                  {s.items.map((it, j) => <li key={j}>{it}</li>)}
                                </ul>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <div className="card">
                    <p className="section-title mb-2">Related opportunities</p>
                    <p className="muted text-sm">
                      Explore roles and internships for this field on the{" "}
                      <a className="text-brand-600 hover:underline" href="/jobs">Opportunities</a> page.
                      Listings there are labelled sample or real — never fabricated.
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

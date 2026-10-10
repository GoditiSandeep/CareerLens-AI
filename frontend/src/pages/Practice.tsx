import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  api, type AptitudeQuestion, type CodingQuestion, type InterviewSession,
} from "../lib/api";
import { EmptyState, ErrorBanner, Loader, useToast } from "../components/ui";

type Tab = "interview" | "aptitude" | "coding";
type Notify = (message: string, kind?: "success" | "error" | "info") => void;

export default function Practice() {
  const notify = useToast();
  const [tab, setTab] = useState<Tab>("interview");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Practice hub</h1>
        <p className="page-sub">
          Interview mock sessions, aptitude drills and coding practice — scored by your own
          backend (deterministic feedback unless AI credentials are configured).
        </p>
      </div>

      <div className="flex rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
        {([["interview", "Interview"], ["aptitude", "Aptitude"], ["coding", "Coding"]] as const)
          .map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${tab === key
                ? "bg-brand-600 text-white" : "text-slate-600 dark:text-slate-300"}`}>
              {label}
            </button>
          ))}
      </div>

      {tab === "interview" && <InterviewPanel notify={notify} />}
      {tab === "aptitude" && <AptitudePanel notify={notify} />}
      {tab === "coding" && <CodingPanel notify={notify} />}
    </div>
  );
}

function InterviewPanel({ notify }: { notify: Notify }) {
  const [sessions, setSessions] = useState<InterviewSession[] | null>(null);
  const [error, setError] = useState("");
  const [role, setRole] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [itype, setItype] = useState("practice");
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<InterviewSession | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<{ score: number; feedback: string; improved_answer: string } | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setSessions(await api.get<InterviewSession[]>("/interviews"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const start = async (e: FormEvent) => {
    e.preventDefault();
    if (!role.trim()) {
      notify("Enter a target role, e.g. 'Backend Developer'", "error");
      return;
    }
    setBusy(true);
    try {
      const s = await api.post<InterviewSession>("/interviews/start", {
        role: role.trim(), difficulty, interview_type: itype,
      });
      setActive(s);
      setFeedback(null);
      setAnswer("");
      notify("Session started — answer each question in turn", "success");
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not start session", "error");
    } finally {
      setBusy(false);
    }
  };

  const currentQ = active
    ? active.questions[Math.min(active.current_index, active.questions.length - 1)]
    : null;

  const submitAnswer = async (e: FormEvent) => {
    e.preventDefault();
    if (!active || !currentQ || answer.trim().length < 5) {
      notify("Write at least a sentence before submitting", "error");
      return;
    }
    setSending(true);
    try {
      const res = await api.post<{
        score: number; feedback: string; improved_answer: string; completed: boolean;
      }>(`/interviews/${active.id}/answer`, { answer: answer.trim() });
      setFeedback({ score: res.score, feedback: res.feedback, improved_answer: res.improved_answer });
      setActive({ ...active, current_index: active.current_index + 1 });
      setAnswer("");
      if (res.completed) {
        notify("Session completed — report generated", "success");
        await loadReport({ ...active, id: active.id });
      }
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Submit failed", "error");
    } finally {
      setSending(false);
    }
  };

  const loadReport = async (s: InterviewSession) => {
    try {
      const rep = await api.get<{ report: string; status: string }>(`/interviews/${s.id}/report`);
      setActive({ ...s, report: rep.report, status: rep.status });
      setFeedback(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not load report", "error");
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <form onSubmit={start} className="card space-y-3">
        <p className="section-title">Start a mock interview</p>
        <div>
          <label className="label" htmlFor="iRole">Target role *</label>
          <input id="iRole" className="input" value={role} onChange={(e) => setRole(e.target.value)}
            placeholder="Frontend Developer" />
        </div>
        <div>
          <label className="label" htmlFor="iDiff">Difficulty</label>
          <select id="iDiff" className="input" value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="iType">Type</label>
          <select id="iType" className="input" value={itype}
            onChange={(e) => setItype(e.target.value)}>
            <option value="practice">Practice (with feedback)</option>
            <option value="mock">Mock (full report)</option>
          </select>
        </div>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Starting…" : "Start session"}
        </button>
      </form>
      <div className="space-y-4 lg:col-span-2">
        {error && <ErrorBanner message={error} onRetry={load} />}

        {active && (
          <div className="card">
            <div className="mb-3 flex items-center justify-between">
              <p className="section-title">
                {active.role} · {active.difficulty} · {active.status}
              </p>
              <button className="btn-ghost !text-xs" onClick={() => setActive(null)}>Close</button>
            </div>

            {active.status !== "completed" && currentQ && (
              <div>
                <span className="badge-brand">{currentQ.category}</span>
                <p className="mt-2 font-medium text-slate-800 dark:text-slate-200">
                  Q{Math.min(active.current_index + 1, active.questions.length)}: {currentQ.question}
                </p>
                <form onSubmit={submitAnswer} className="mt-3">
                  <textarea className="input" rows={4} value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Answer in STAR structure: Situation → Task → Action → Result…" />
                  <button className="btn-primary mt-2" disabled={sending}>
                    {sending ? "Scoring…" : "Submit answer"}
                  </button>
                </form>
              </div>
            )}

            {feedback && (
              <div className="mt-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
                <div className="flex items-center gap-3">
                  <span className={feedback.score >= 70 ? "badge-green" : "badge-amber"}>
                    {feedback.score.toFixed(0)}/100
                  </span>
                  <span className="text-xs text-slate-500">
                    deterministic score (length + structure heuristics)
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{feedback.feedback}</p>
                <p className="mt-2 text-sm text-brand-700 dark:text-brand-300">
                  <strong>Improved answer:</strong> {feedback.improved_answer}
                </p>
              </div>
            )}

            {active.status === "completed" && active.report && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                <p className="mb-1 font-semibold">Session report</p>
                <p className="whitespace-pre-line">{active.report}</p>
              </div>
            )}
          </div>
        )}
        <div className="card">
          <p className="section-title mb-3">Past sessions</p>
          {!sessions && <Loader />}
          {sessions && sessions.length === 0 && (
            <EmptyState title="No sessions yet" hint="Start your first mock interview on the left." />
          )}
          <div className="space-y-2">
            {sessions?.map((s) => (
              <div key={s.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{s.role}</p>
                  <p className="text-xs text-slate-500">
                    {s.difficulty} · {s.interview_type} · {s.status}
                  </p>
                </div>
                <button className="btn-ghost !py-1 !text-xs" onClick={() => void loadReport(s)}>
                  View report
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AptitudePanel({ notify }: { notify: Notify }) {
  const [questions, setQuestions] = useState<AptitudeQuestion[] | null>(null);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [results, setResults] = useState<Record<number, {
    correct: boolean; correct_index: number; explanation: string;
    score: number; total: number;
  }>>({});
  const [submitting, setSubmitting] = useState<number | null>(null);

  useEffect(() => {
    api.get<AptitudeQuestion[]>("/aptitude/questions")
      .then(setQuestions)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load questions"));
  }, []);

  const submit = async (q: AptitudeQuestion) => {
    const idx = answers[q.id];
    if (idx === undefined) {
      notify("Select an option first", "error");
      return;
    }
    setSubmitting(q.id);
    try {
      const res = await api.post<{
        correct: boolean; correct_index: number; explanation: string;
        score: number; total: number;
      }>("/aptitude/submit", { question_id: q.id, selected_index: idx, category: q.category });
      setResults((r) => ({ ...r, [q.id]: res }));
      notify(res.correct ? "Correct!" : "Not quite — read the explanation", res.correct ? "success" : "info");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Submit failed", "error");
    } finally {
      setSubmitting(null);
    }
  };

  const attempted = Object.keys(results).length;
  const correct = Object.values(results).filter((r) => r.correct).length;

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      {!questions && !error && <Loader label="Loading questions…" />}
      {questions && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
            <span className="badge-brand">{questions.length} questions</span>
            <span className="badge-green">Session: {correct}/{attempted} correct</span>
            <span className="muted text-xs">Answers persist server-side as attempts.</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {questions.map((q) => {
              const res = results[q.id];
              return (
                <div key={q.id} className="card">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <span className="badge-slate">{q.category}</span>
                    <span className="badge-slate">{q.topic}</span>
                    <span className="badge-amber">{q.difficulty}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{q.question}</p>
                  <div className="mt-3 space-y-2">
                    {q.options.map((opt, i) => {
                      const chosen = answers[q.id] === i;
                      let cls = "border-slate-200 dark:border-slate-700";
                      if (res) {
                        if (i === res.correct_index) cls = "border-emerald-500 bg-emerald-50 dark:bg-emerald-950";
                        else if (chosen) cls = "border-rose-500 bg-rose-50 dark:bg-rose-950";
                      } else if (chosen) {
                        cls = "border-brand-500 bg-brand-50 dark:bg-brand-950";
                      }
                      return (
                        <label key={i}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm ${cls}`}>
                          <input type="radio" name={`q${q.id}`} disabled={!!res}
                            checked={chosen}
                            onChange={() => setAnswers((a) => ({ ...a, [q.id]: i }))} />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                  {!res && (
                    <button className="btn-primary mt-3 !py-1.5 !text-xs"
                      disabled={submitting === q.id}
                      onClick={() => void submit(q)}>
                      {submitting === q.id ? "Checking…" : "Check answer"}
                    </button>
                  )}
                  {res && (
                    <div className={`mt-3 rounded-lg p-3 text-xs ${res.correct
                      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                      : "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200"}`}>
                      <p className="font-semibold">{res.correct ? "✓ Correct" : "✗ Incorrect"}</p>
                      {res.explanation && <p className="mt-1">{res.explanation}</p>}
                      <p className="mt-1 text-slate-500">Running total: {res.score}/{res.total}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function CodingPanel({ notify }: { notify: Notify }) {
  const [questions, setQuestions] = useState<CodingQuestion[] | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<CodingQuestion | null>(null);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("python");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    passed: number; total: number; status: string;
    results: { input: string; expected: string; passed: boolean }[];
  } | null>(null);
  const [attempts, setAttempts] = useState<Record<number, string>>({});

  useEffect(() => {
    api.get<CodingQuestion[]>("/coding/questions")
      .then(setQuestions)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load questions"));
  }, []);

  const run = async () => {
    if (!selected) return;
    if (code.trim().length < 10) {
      notify("Write some code first", "error");
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const res = await api.post<{
        passed: number; total: number; status: string;
        results: { input: string; expected: string; passed: boolean }[];
      }>(`/coding/${selected.id}/submit`, { code, language });
      setResult(res);
      setAttempts((a) => ({ ...a, [selected.id]: res.status }));
      notify(`Tests: ${res.passed}/${res.total} passed (${res.status})`,
        res.status === "passed" ? "success" : "info");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Run failed", "error");
    } finally {
      setRunning(false);
    }
  };

  const starter = (q: CodingQuestion) =>
    language === "python"
      ? `def solve():\n    # ${q.title}\n    pass\n`
      : `// ${q.title}\nfunction solve() {\n\n}\n`;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="card">
        <p className="section-title mb-3">Problem set</p>
        {error && <ErrorBanner message={error} />}
        {!questions && !error && <Loader />}
        <div className="space-y-2">
          {questions?.map((q) => {
            const prev = attempts[q.id];
            return (
              <button key={q.id}
                onClick={() => {
                  setSelected(q);
                  setCode(starter(q));
                  setResult(null);
                }}
                className={`w-full rounded-lg border p-3 text-left text-sm ${selected?.id === q.id
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-950"
                  : "border-slate-200 dark:border-slate-800"}`}>
                <span className="font-medium text-slate-800 dark:text-slate-200">{q.title}</span>
                <span className="mt-1 flex gap-1.5">
                  <span className="badge-slate">{q.difficulty}</span>
                  <span className="badge-slate">{q.category}</span>
                  {prev && <span className={prev === "passed" ? "badge-green" : "badge-amber"}>{prev}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 lg:col-span-2">
        {!selected && (
          <EmptyState title="Pick a problem" hint="Choose a question on the left to start coding." />
        )}
        {selected && (
          <div className="card">
            <p className="section-title">{selected.title}</p>
            <p className="muted mt-1 text-xs">
              {selected.description ?? "Solve the problem and run the test cases."}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <label className="label !mb-0" htmlFor="lang">Language</label>
              <select id="lang" className="input !w-40" value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  setCode(starter({ ...selected }));
                }}>
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
              </select>
            </div>
            <textarea
              className="input mt-3 font-mono text-sm"
              rows={10}
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-label="Code editor"
            />
            <button className="btn-primary mt-3" onClick={() => void run()} disabled={running}>
              {running ? "Running tests…" : "▶ Run tests"}
            </button>

            {result && (
              <div className="mt-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className={result.status === "passed" ? "badge-green" : "badge-amber"}>
                    {result.passed}/{result.total} tests
                  </span>
                  <span className="muted text-xs">
                    Simplified local checker — verifies expected-value tokens/length, not a full
                    sandboxed runtime.
                  </span>
                </div>
                <div className="space-y-1.5">
                  {result.results.map((r, i) => (
                    <div key={i}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${r.passed
                        ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950"
                        : "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950"}`}>
                      <span>input: {r.input ?? "—"} → expected: {r.expected ?? "—"}</span>
                      <span className="font-semibold">{r.passed ? "PASS" : "FAIL"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

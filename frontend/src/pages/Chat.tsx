import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { api, type ChatMessage } from "../lib/api";
import { ErrorBanner, Loader, useToast } from "../components/ui";

const SUGGESTIONS = [
  "What should I learn first for backend development?",
  "How do I improve my resume ATS score?",
  "Give me a 30-day plan for interview prep.",
  "Which projects impress recruiters the most?",
];

export default function Chat() {
  const notify = useToast();
  const [history, setHistory] = useState<ChatMessage[] | null>(null);
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await api.get<ChatMessage[] | { messages: ChatMessage[] }>("/ai/chat/history");
      setHistory(Array.isArray(res) ? res : res.messages ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || sending) return;
    setInput("");
    setSending(true);
    const optimistic: ChatMessage = {
      id: Date.now(), role: "user", content: message, created_at: new Date().toISOString(),
    };
    setHistory((h) => [...(h ?? []), optimistic]);
    try {
      const res = await api.post<{ reply: string }>("/ai/chat", { message });
      setHistory((h) => [
        ...(h ?? []),
        { id: Date.now() + 1, role: "assistant", content: res.reply, created_at: new Date().toISOString() },
      ]);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Message failed", "error");
      setHistory((h) => (h ?? []).filter((m) => m.id !== optimistic.id));
      setInput(message);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const submitForm = (e: FormEvent) => {
    e.preventDefault();
    void send();
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col">
      <div className="mb-3">
        <h1 className="page-title">AI career mentor</h1>
        <p className="page-sub">
          Answers use your profile context. Without AI credentials configured the backend serves a
          deterministic mock mentor — honest, useful, but not a live LLM.
        </p>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="card flex-1 overflow-y-auto">
        {!history && <Loader label="Loading conversation…" />}
        {history && history.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="section-title">Ask me anything about your career</p>
            <p className="muted mt-1 mb-4">Try one of these:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="btn-ghost !text-xs" onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-4">
          {history?.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
              }`}>
                <p className="whitespace-pre-wrap">{m.content}</p>
                <p className={`mt-1 text-[10px] ${m.role === "user" ? "text-brand-200" : "text-slate-400"}`}>
                  {m.role === "user" ? "You" : "Mentor"} · {new Date(m.created_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-500 dark:bg-slate-800">
                Thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={submitForm} className="mt-3 flex gap-2">
        <textarea className="input flex-1" rows={1} value={input} onKeyDown={onKeyDown}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about skills, roadmaps, interviews… (Enter to send)"
          aria-label="Message the mentor" />
        <button className="btn-primary" disabled={sending || !input.trim()}>Send</button>
      </form>
    </div>
  );
}

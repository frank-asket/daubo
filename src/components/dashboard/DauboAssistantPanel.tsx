"use client";

import { MessageCircle, Send, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { dauboBffUrl } from "@/lib/daubo-api";

type Turn = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "daubo-assistant-open";

const STARTERS = [
  "How does Human apply work in Daubo?",
  "What do the pipeline stages mean?",
  "How do I connect Gmail to create application drafts?",
  "How can I prepare for an interview after I applied?",
];

export function DauboAssistantPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const v = sessionStorage.getItem(STORAGE_KEY);
      if (v === "1") setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, open]);

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      setError(null);
      setSending(true);
      const priorHistory = messages.map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);

      try {
        const r = await fetch(dauboBffUrl("v1/chat"), {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            history: priorHistory,
          }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error((j as { detail?: string }).detail ?? r.statusText);
        }
        const data = (await r.json()) as { reply: string };
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      } catch (e) {
        setMessages((prev) => prev.slice(0, -1));
        setError(e instanceof Error ? e.message : "Could not reach Daubo Assistant");
      } finally {
        setSending(false);
      }
    },
    [messages, sending],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = input;
    setInput("");
    void sendText(t);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold shadow-lg transition sm:bottom-6 sm:right-6 ${
          open
            ? "border-zinc-600 bg-zinc-900 text-white"
            : "border-emerald-500/40 bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
        }`}
        aria-expanded={open}
        aria-label={open ? "Close Daubo Assistant" : "Open Daubo Assistant"}
      >
        {open ? (
          <>
            <X className="h-4 w-4" />
            Close
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Assistant
          </>
        )}
      </button>

      {open ? (
        <div
          className="fixed bottom-[4.75rem] right-5 z-[60] flex max-h-[min(72vh,560px)] w-[min(calc(100vw-1.5rem),400px)] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c0c0c] shadow-2xl sm:bottom-[5.25rem] sm:right-6"
          role="dialog"
          aria-label="Daubo Assistant chat"
        >
          <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <MessageCircle className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">Daubo Assistant</p>
              <p className="truncate text-[11px] text-zinc-500">
                Pipeline, apply handoff, Gmail drafts &amp; prep
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.length === 0 ? (
              <div className="space-y-2">
                <p className="text-xs leading-relaxed text-zinc-500">
                  Ask anything about your workspace: stages, generating application packages, opening
                  postings yourself, or interview prep.
                </p>
                <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                  Try
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {STARTERS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={sending}
                      onClick={() => void sendText(q)}
                      className="rounded-full border border-zinc-800 bg-black/50 px-2.5 py-1.5 text-left text-[11px] leading-snug text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ul className="space-y-3">
                {messages.map((m, i) => (
                  <li
                    key={`${i}-${m.role}-${m.content.slice(0, 12)}`}
                    className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "ml-6 bg-zinc-800/80 text-zinc-100"
                        : "mr-4 border border-zinc-800/80 bg-black/40 text-zinc-300"
                    }`}
                  >
                    {m.content}
                  </li>
                ))}
              </ul>
            )}
            {sending ? (
              <p className="text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="h-3 w-3 animate-pulse text-emerald-400" />
                  Thinking…
                </span>
              </p>
            ) : null}
            {error ? <p className="text-xs text-red-400">{error}</p> : null}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={onSubmit} className="border-t border-zinc-800 p-3">
            <div className="flex gap-2">
              <label className="sr-only" htmlFor="daubo-assistant-input">
                Message
              </label>
              <textarea
                id="daubo-assistant-input"
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendText(input);
                    setInput("");
                  }
                }}
                placeholder="Ask Daubo Assistant…"
                disabled={sending}
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-zinc-600 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="flex shrink-0 items-center justify-center rounded-xl bg-emerald-500 px-3 text-zinc-950 disabled:opacity-40"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              className="mt-2 text-[11px] text-zinc-600 hover:text-zinc-400"
              onClick={() => {
                setMessages([]);
                setError(null);
              }}
            >
              Clear conversation
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}

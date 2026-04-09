"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { dauboBffUrl } from "@/lib/daubo-api";

type Application = {
  id: string;
  title: string;
  company: string;
  status: string;
  interview_prep: Record<string, unknown> | null;
};

function asStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

export function InterviewPrepBoard() {
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(dauboBffUrl("v1/me/applications"), { credentials: "same-origin" });
      if (!r.ok) return;
      const all = (await r.json()) as Application[];
      setItems(
        all
          .filter((a) => a.status === "interview" || a.status === "applied")
          .map((a) => ({
            id: a.id,
            title: a.title,
            company: a.company,
            status: a.status,
            interview_prep: (a as { interview_prep?: Record<string, unknown> | null }).interview_prep ?? null,
          })),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runPrep(id: string) {
    setGeneratingId(id);
    setError(null);
    try {
      const r = await fetch(dauboBffUrl(`v1/me/applications/${id}/interview-prep`), {
        method: "POST",
        credentials: "same-origin",
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { detail?: string }).detail ?? r.statusText);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prep failed");
    } finally {
      setGeneratingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-sm text-zinc-500">
        After you apply, generate a focused prep pack for each role. Daubo uses your resume and the
        job context—then you practice answers before the real conversation.
      </p>
      <p className="max-w-2xl text-sm text-zinc-500">
        Roles shown here are in stages{" "}
        <strong className="text-zinc-300">applied</strong> or{" "}
        <strong className="text-zinc-300">interview</strong>. Update stages in{" "}
        <Link href="/dashboard/applications" className="text-emerald-400 hover:underline">
          Applications
        </Link>
        .
      </p>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No active prep targets yet. Mark a role as applied or interview in Applications first.
        </p>
      ) : (
        <ul className="space-y-4">
          {items.map((row) => {
            const prep = row.interview_prep;
            const questions = asStringList(prep?.likely_questions);
            const topics = asStringList(prep?.study_topics);
            const gaps = asStringList(prep?.weakness_gaps);
            const disc =
              typeof prep?.disclaimer === "string" ? (prep.disclaimer as string) : null;

            return (
              <li
                key={row.id}
                className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] px-4 py-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-white">
                      {row.title} <span className="text-zinc-500">· {row.company}</span>
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">{row.status}</p>
                  </div>
                  <button
                    type="button"
                    disabled={generatingId !== null}
                    onClick={() => void runPrep(row.id)}
                    className="shrink-0 rounded-full border border-emerald-500/40 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                  >
                    {generatingId === row.id ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Generating…
                      </span>
                    ) : prep ? (
                      "Regenerate prep"
                    ) : (
                      "Generate prep pack"
                    )}
                  </button>
                </div>

                {disc ? (
                  <p className="mt-3 text-[11px] text-amber-200/80">{disc}</p>
                ) : null}

                {questions.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Likely questions
                    </p>
                    <ul className="mt-2 list-inside list-decimal space-y-1.5 text-sm text-zinc-300">
                      {questions.map((q) => (
                        <li key={q}>{q}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {topics.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Study topics
                    </p>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-400">
                      {topics.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {gaps.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Gaps to address honestly
                    </p>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-500">
                      {gaps.map((g) => (
                        <li key={g}>{g}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {!prep && generatingId !== row.id ? (
                  <p className="mt-3 text-xs text-zinc-600">
                    Run generation to get questions and study topics tailored to this posting.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

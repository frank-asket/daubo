"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { dauboBffUrl } from "@/lib/daubo-api";
import { jobStageLabel } from "@/lib/job-stages";

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
      setError(e instanceof Error ? e.message : "Couldn’t refresh practice questions. Try again.");
    } finally {
      setGeneratingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-sm text-zinc-600">
        After you apply, get practice questions for each role. Daubo uses your résumé and the job
        context—then you rehearse answers before the real conversation.
      </p>
      <p className="max-w-2xl text-sm text-zinc-600">
        Roles listed here have status{" "}
        <strong className="text-zinc-900">{jobStageLabel("applied")}</strong> or{" "}
        <strong className="text-zinc-900">{jobStageLabel("interview")}</strong>. Update status in{" "}
        <Link href="/dashboard/pipeline" className="text-emerald-600 hover:underline">
          Pipeline
        </Link>
        .
      </p>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-600">
          No active prep targets yet. Mark a role as applied or interview in Pipeline first.
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
                className="rounded-[28px] border border-zinc-200 bg-white px-5 py-5 shadow-[0_1px_0_rgba(255,255,255,0.8),0_18px_40px_rgba(24,24,27,0.04)]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-2xl font-semibold tracking-tight text-zinc-950">
                      {row.company}
                    </p>
                    <p className="text-base text-zinc-700">{row.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Status: <span className="font-medium text-zinc-700">{jobStageLabel(row.status)}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={generatingId !== null}
                    onClick={() => void runPrep(row.id)}
                    className="shrink-0 rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {generatingId === row.id ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Generating…
                      </span>
                    ) : prep ? (
                      "Refresh questions"
                    ) : (
                      "Get practice questions"
                    )}
                  </button>
                </div>

                {disc ? (
                  <p className="mt-3 text-[11px] text-amber-700">{disc}</p>
                ) : null}

                {questions.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Likely questions
                    </p>
                    <ul className="mt-2 list-inside list-decimal space-y-2 text-sm text-zinc-800">
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
                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-700">
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
                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-600">
                      {gaps.map((g) => (
                        <li key={g}>{g}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {!prep && generatingId !== row.id ? (
                  <p className="mt-3 text-xs text-zinc-500">
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

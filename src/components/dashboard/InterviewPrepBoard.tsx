"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { dauboBffUrl, detailFromApiJson } from "@/lib/daubo-api";
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

type StarStory = {
  headline?: string;
  situation?: string;
  task?: string;
  action?: string;
  result?: string;
  reflection?: string;
};

function asStarStories(v: unknown): StarStory[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is StarStory => x !== null && typeof x === "object");
}

type CompanyBrief = {
  summary?: string;
  tech_stack_signals?: unknown;
  culture_signals?: unknown;
  recent_momentum?: unknown;
};

function asCompanyBrief(v: unknown): CompanyBrief | null {
  if (!v || typeof v !== "object") return null;
  return v as CompanyBrief;
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
      const r = await fetch(dauboBffUrl("v1/me/prep/generate"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ application_id: id }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(detailFromApiJson(j, r.statusText));
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
      <p className="max-w-2xl text-sm text-zinc-500">
        After you apply, get practice questions for each role. Daubo uses your résumé and the job
        context—then you rehearse answers before the real conversation.
      </p>
      <p className="max-w-2xl text-sm text-zinc-500">
        Roles listed here have status{" "}
        <strong className="text-zinc-300">{jobStageLabel("applied")}</strong> or{" "}
        <strong className="text-zinc-300">{jobStageLabel("interview")}</strong>. Update status in{" "}
        <Link href="/dashboard/pipeline" className="text-emerald-400 hover:underline">
          Pipeline
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
          No active prep targets yet. Mark a role as applied or interview in Pipeline first.
        </p>
      ) : (
        <ul className="space-y-4">
          {items.map((row) => {
            const prep = row.interview_prep;
            const questions = asStringList(prep?.likely_questions);
            const topics = asStringList(prep?.study_topics);
            const gaps = asStringList(prep?.weakness_gaps);
            const starStories = asStarStories(prep?.star_stories);
            const brief = asCompanyBrief(prep?.company_brief);
            const disc =
              typeof prep?.disclaimer === "string" ? (prep.disclaimer as string) : null;

            return (
              <li
                key={row.id}
                className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] px-5 py-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-3xl font-semibold text-white/95">{row.company}</p>
                    <p className="mt-1 text-2xl text-zinc-300">{row.title}</p>
                    <p className="mt-2 text-xs text-zinc-500">
                      Status: <span className="font-medium text-zinc-400">{jobStageLabel(row.status)}</span>
                    </p>
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
                      "Refresh questions"
                    ) : (
                      "Get practice questions"
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

                {starStories.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      STAR-R stories (from your résumé)
                    </p>
                    {starStories.map((s, idx) => (
                      <div
                        key={`${row.id}-star-${idx}`}
                        className="rounded-xl border border-zinc-800 bg-black/30 px-3 py-3 text-sm text-zinc-300"
                      >
                        <p className="font-medium text-zinc-100">
                          {(s.headline ?? `Story ${idx + 1}`).trim()}
                        </p>
                        <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-zinc-400">
                          {s.situation ? (
                            <li>
                              <span className="text-zinc-500">Situation:</span> {s.situation}
                            </li>
                          ) : null}
                          {s.task ? (
                            <li>
                              <span className="text-zinc-500">Task:</span> {s.task}
                            </li>
                          ) : null}
                          {s.action ? (
                            <li>
                              <span className="text-zinc-500">Action:</span> {s.action}
                            </li>
                          ) : null}
                          {s.result ? (
                            <li>
                              <span className="text-zinc-500">Result:</span> {s.result}
                            </li>
                          ) : null}
                          {s.reflection ? (
                            <li>
                              <span className="text-zinc-500">Reflection:</span> {s.reflection}
                            </li>
                          ) : null}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : null}

                {brief?.summary ? (
                  <div className="mt-4 rounded-xl border border-zinc-800 bg-black/30 px-3 py-3 text-sm text-zinc-300">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Company brief
                    </p>
                    <p className="mt-2 leading-relaxed text-zinc-300">{brief.summary}</p>
                    {asStringList(brief.tech_stack_signals).length > 0 ? (
                      <div className="mt-3">
                        <p className="text-[11px] font-medium text-zinc-500">Tech &amp; product</p>
                        <ul className="mt-1 list-inside list-disc space-y-0.5 text-[13px] text-zinc-400">
                          {asStringList(brief.tech_stack_signals).map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {asStringList(brief.culture_signals).length > 0 ? (
                      <div className="mt-3">
                        <p className="text-[11px] font-medium text-zinc-500">Culture signals</p>
                        <ul className="mt-1 list-inside list-disc space-y-0.5 text-[13px] text-zinc-400">
                          {asStringList(brief.culture_signals).map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {asStringList(brief.recent_momentum).length > 0 ? (
                      <div className="mt-3">
                        <p className="text-[11px] font-medium text-zinc-500">Recent momentum</p>
                        <ul className="mt-1 list-inside list-disc space-y-0.5 text-[13px] text-zinc-400">
                          {asStringList(brief.recent_momentum).map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
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

"use client";

import Link from "next/link";

export type ApprovalQueueItem = {
  id: string;
  application_id: string;
  title: string;
  company: string;
  apply_channel: string | null;
  channel?: string;
  notes: string | null;
  application_status: string;
  draft_body?: string;
  package_draft?: {
    cover_letter?: string;
    linkedin_note?: string;
  } | null;
};

export type DraftEdits = { cover_letter: string; linkedin_note: string };

export function isLinkedInChannel(item: ApprovalQueueItem) {
  return item.apply_channel?.toLowerCase() === "linkedin" || item.channel === "linkedin";
}

function channelBadge(item: ApprovalQueueItem) {
  const raw = (item.apply_channel || item.channel || "email").toLowerCase();
  if (raw === "linkedin") {
    return { label: "LinkedIn", emoji: "👥" as const };
  }
  if (raw === "web") {
    return { label: "Company site", emoji: "🌐" as const };
  }
  return { label: "Email", emoji: "✉" as const };
}

export function ApprovalCard({
  item,
  actingId,
  draftEdit,
  onLinkedinNoteChange,
  onCoverLetterChange,
  onApprove,
  onReject,
}: {
  item: ApprovalQueueItem;
  actingId: string | null;
  draftEdit: DraftEdits;
  onLinkedinNoteChange: (value: string) => void;
  onCoverLetterChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const li = isLinkedInChannel(item);
  const badge = channelBadge(item);
  const subjectHint = li
    ? "LinkedIn connection note"
    : `Application: ${item.title}`;

  return (
    <article className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-semibold text-emerald-200">
            {item.company.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold text-white">{item.company}</p>
            <p className="text-sm text-zinc-300">{item.title}</p>
          </div>
        </div>
        <span
          className="shrink-0 rounded-[6px] border border-zinc-700 px-2 py-0.5 text-[11px] font-medium text-zinc-300"
          title={`Apply channel: ${badge.label}`}
        >
          {badge.emoji} {badge.label}
        </span>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Subject: {subjectHint}
      </p>
      <div className="mt-3 space-y-2">
        {li ? (
          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              LinkedIn note (edit before approve)
            </span>
            <textarea
              className="mt-1 min-h-[140px] w-full resize-y rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm leading-relaxed text-zinc-200 outline-none focus:border-zinc-600"
              value={draftEdit.linkedin_note}
              onChange={(e) => onLinkedinNoteChange(e.target.value)}
              disabled={actingId !== null}
              placeholder="Connection note shown to the recipient…"
            />
          </label>
        ) : (
          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Email / cover text (edit before approve)
            </span>
            <textarea
              className="mt-1 min-h-[160px] w-full resize-y rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm leading-relaxed text-zinc-200 outline-none focus:border-zinc-600"
              value={draftEdit.cover_letter}
              onChange={(e) => onCoverLetterChange(e.target.value)}
              disabled={actingId !== null}
              placeholder={
                item.notes?.trim() ||
                "Cover letter or email body — nothing is sent until you approve."
              }
            />
          </label>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={actingId !== null}
          onClick={onApprove}
          className="rounded-md border border-zinc-600 bg-zinc-100 px-3 py-1.5 text-[12px] font-semibold text-zinc-900 hover:bg-white active:scale-[0.98] disabled:opacity-60"
        >
          Approve &amp; send
        </button>
        <Link
          href={`/dashboard/pipeline?focus=${encodeURIComponent(item.application_id)}`}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-zinc-900 active:scale-[0.98]"
        >
          Edit draft
        </Link>
        <button
          type="button"
          disabled={actingId !== null}
          onClick={onReject}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-zinc-900 active:scale-[0.98] disabled:opacity-60"
        >
          Reject
        </button>
      </div>
    </article>
  );
}

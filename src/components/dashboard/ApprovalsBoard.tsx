"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dauboBffUrl, detailFromApiJson } from "@/lib/daubo-api";
import { makeIdempotencyKey } from "@/lib/idempotency-key";
import {
  ApprovalCard,
  type ApprovalQueueItem,
  type DraftEdits,
  isLinkedInChannel,
} from "@/components/dashboard/ApprovalCard";

function initialEditsForItem(item: ApprovalQueueItem): DraftEdits {
  const pkg = item.package_draft;
  const fallback = (item.draft_body ?? "").trim();
  const li = isLinkedInChannel(item);
  const cov = (pkg?.cover_letter ?? "").trim();
  const note = (pkg?.linkedin_note ?? "").trim();
  return {
    cover_letter: cov || (li ? "" : fallback),
    linkedin_note: note || (li ? fallback : ""),
  };
}

export function ApprovalsBoard() {
  const [items, setItems] = useState<ApprovalQueueItem[]>([]);
  const [draftEdits, setDraftEdits] = useState<Record<string, DraftEdits>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const pendingIdempotencyKeys = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(dauboBffUrl("v1/me/approvals"), { credentials: "same-origin" });
      if (!r.ok) {
        setItems([]);
        setError("Could not load pending approvals right now.");
        return;
      }
      const list = (await r.json()) as ApprovalQueueItem[];
      setItems(list);
    } catch {
      setItems([]);
      setError("Could not load pending approvals right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const next: Record<string, DraftEdits> = {};
    for (const item of items) {
      next[item.id] = initialEditsForItem(item);
    }
    setDraftEdits(next);
  }, [items]);

  async function approve(item: ApprovalQueueItem) {
    setActingId(item.id);
    setError(null);
    setInfoMessage(null);
    try {
      const ed = draftEdits[item.id] ?? initialEditsForItem(item);
      const li = isLinkedInChannel(item);
      const body: { cover_letter?: string; linkedin_note?: string } = {};
      if (li) body.linkedin_note = ed.linkedin_note;
      else body.cover_letter = ed.cover_letter;
      const actionTag = `approve:${item.id}`;
      const idempotencyKey =
        pendingIdempotencyKeys.current[actionTag] ??
        makeIdempotencyKey(`approval-${actionTag}`);
      pendingIdempotencyKeys.current[actionTag] = idempotencyKey;
      const r = await fetch(dauboBffUrl(`v1/me/approvals/${item.id}/approve`), {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(
          detailFromApiJson(j, "Could not approve this application."),
        );
      }
      const data = (await r.json()) as {
        gmail_draft?: { gmail_web_url?: string };
        gmail_warning?: string | null;
        linkedin_handoff?: {
          note_text: string;
          job_url?: string | null;
          context_line?: string;
        } | null;
      };
      if (data.gmail_warning?.trim()) {
        setError(data.gmail_warning.trim());
      }
      const gurl = data.gmail_draft?.gmail_web_url;
      if (gurl) window.open(gurl, "_blank", "noopener,noreferrer");
      const handoff = data.linkedin_handoff;
      if (handoff?.note_text) {
        try {
          await navigator.clipboard.writeText(handoff.note_text);
        } catch {
          /* ignore */
        }
        if (handoff.job_url?.trim()) {
          window.open(handoff.job_url.trim(), "_blank", "noopener,noreferrer");
        }
        setInfoMessage(
          "LinkedIn note copied to clipboard. Paste it in the LinkedIn app when you connect or message the team.",
        );
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not approve this application.");
    } finally {
      delete pendingIdempotencyKeys.current[`approve:${item.id}`];
      setActingId(null);
    }
  }

  async function reject(approvalId: string) {
    setActingId(approvalId);
    setError(null);
    setInfoMessage(null);
    try {
      const actionTag = `reject:${approvalId}`;
      const idempotencyKey =
        pendingIdempotencyKeys.current[actionTag] ??
        makeIdempotencyKey(`approval-${actionTag}`);
      pendingIdempotencyKeys.current[actionTag] = idempotencyKey;
      const r = await fetch(dauboBffUrl(`v1/me/approvals/${approvalId}/reject`), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Idempotency-Key": idempotencyKey },
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(detailFromApiJson(j, "Could not reject this approval."));
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reject this approval.");
    } finally {
      delete pendingIdempotencyKeys.current[`reject:${approvalId}`];
      setActingId(null);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  const header = useMemo(() => {
    if (loading) return "Loading applications ready for your review…";
    if (items.length === 0) return "No approvals pending. New AI drafts will appear here.";
    if (items.length === 1) {
      return "1 application ready for your review. AI drafted; nothing sent until you approve.";
    }
    return `${items.length} applications ready for your review. AI drafted; nothing sent until you approve.`;
  }, [items.length, loading]);

  return (
    <section className="space-y-4">
      <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        {header}
      </p>

      {infoMessage ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {infoMessage}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <ApprovalCard
            key={item.id}
            item={item}
            actingId={actingId}
            draftEdit={draftEdits[item.id] ?? initialEditsForItem(item)}
            onLinkedinNoteChange={(value) =>
              setDraftEdits((prev) => {
                const cur = prev[item.id] ?? initialEditsForItem(item);
                return { ...prev, [item.id]: { ...cur, linkedin_note: value } };
              })
            }
            onCoverLetterChange={(value) =>
              setDraftEdits((prev) => {
                const cur = prev[item.id] ?? initialEditsForItem(item);
                return { ...prev, [item.id]: { ...cur, cover_letter: value } };
              })
            }
            onApprove={() => void approve(item)}
            onReject={() => void reject(item.id)}
          />
        ))}
      </div>
    </section>
  );
}

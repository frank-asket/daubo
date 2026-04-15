"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { dauboBffUrl } from "@/lib/daubo-api";

type GmailStatus = {
  configured: boolean;
  connected: boolean;
  google_email: string | null;
};

export function GmailConnectCard() {
  const searchParams = useSearchParams();
  const gmailFlash = searchParams.get("gmail");

  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(dauboBffUrl("v1/me/integrations/gmail/status"), {
        credentials: "same-origin",
      });
      if (!r.ok) {
        setStatus(null);
        return;
      }
      setStatus((await r.json()) as GmailStatus);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function disconnect() {
    if (!confirm("Disconnect Gmail? Daubo will remove stored tokens; drafts you already created stay in Gmail.")) {
      return;
    }
    setDisconnecting(true);
    try {
      const r = await fetch(dauboBffUrl("v1/me/integrations/gmail"), {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!r.ok) {
        console.error("Gmail disconnect failed", r.status);
      }
    } finally {
      setDisconnecting(false);
      await load();
    }
  }

  const flashMessage =
    gmailFlash === "connected"
      ? { kind: "ok" as const, text: "Gmail connected. You can create drafts from the application handoff flow." }
      : gmailFlash === "missing_config"
        ? {
            kind: "warn" as const,
            text: "Gmail isn’t set up for this app yet. If you’re seeing this as a member, try again later or contact support.",
          }
        : gmailFlash === "error"
          ? {
              kind: "err" as const,
              text: "We couldn’t finish connecting Gmail. Check that pop-ups are allowed, then try again. If it keeps failing, contact support.",
            }
          : null;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-2 text-emerald-400">
          <Mail className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-white">Gmail drafts</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Connect Google with the{" "}
            <strong className="font-medium text-zinc-400">gmail.compose</strong> scope. Daubo only
            creates <strong className="font-medium text-zinc-400">drafts</strong> in your Gmail—you
            review and send. No auto-send.
          </p>
          <p className="mt-1 text-[11px] text-zinc-600">
            Only needed for <span className="text-zinc-500">email-channel</span> workflows. If you mostly apply
            via LinkedIn or company forms, you can skip this step.
          </p>
        </div>
      </div>

      {flashMessage ? (
        <p
          className={`mt-4 rounded-lg px-3 py-2 text-xs ${
            flashMessage.kind === "ok"
              ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              : flashMessage.kind === "warn"
                ? "border border-amber-500/30 bg-amber-500/10 text-amber-100"
                : "border border-red-500/30 bg-red-500/10 text-red-100"
          }`}
        >
          {flashMessage.text}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking Gmail link…
        </div>
      ) : status && !status.configured ? (
        <p className="mt-4 text-sm text-zinc-500">
          API Google OAuth is not configured. Add{" "}
          <code className="rounded bg-zinc-900 px-1 text-[11px] text-zinc-400">
            GOOGLE_OAUTH_CLIENT_ID
          </code>
          ,{" "}
          <code className="rounded bg-zinc-900 px-1 text-[11px] text-zinc-400">
            GOOGLE_OAUTH_CLIENT_SECRET
          </code>
          , and{" "}
          <code className="rounded bg-zinc-900 px-1 text-[11px] text-zinc-400">
            GOOGLE_OAUTH_REDIRECT_URI
          </code>{" "}
          on the FastAPI service (see <code className="text-zinc-400">.env.example</code>).
        </p>
      ) : status?.connected ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-zinc-300">
            Connected as{" "}
            <span className="font-medium text-white">{status.google_email ?? "your Google account"}</span>
          </p>
          <button
            type="button"
            disabled={disconnecting}
            onClick={() => void disconnect()}
            className="rounded-full border border-zinc-600 px-4 py-2 text-xs font-semibold text-zinc-300 hover:border-red-500/50 hover:text-red-300 disabled:opacity-50"
          >
            {disconnecting ? "Disconnecting…" : "Disconnect Gmail"}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-zinc-500">Not connected yet.</p>
          <a
            href="/api/gmail/oauth/start"
            className="inline-flex rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-300"
          >
            Connect Gmail
          </a>
          <p className="text-[11px] text-zinc-600">
            We only request permission to create drafts—we don’t read your whole inbox.
          </p>
        </div>
      )}

      <p className="mt-6 text-[11px] text-zinc-600">
        After connecting, open <Link href="/dashboard/applications" className="text-emerald-400 hover:underline">My jobs</Link>{" "}
        → <strong className="text-zinc-500">Apply yourself</strong> → save a draft when the role asks for email.
      </p>
    </div>
  );
}

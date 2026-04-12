/** Short disclosure for Settings: how AI features use account data (résumé, job context). */
export function DashboardPrivacyNoteCard() {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-5">
      <p className="text-sm font-semibold text-white">AI &amp; your data</p>
      <ul className="mt-3 list-inside list-disc space-y-2 text-[13px] leading-relaxed text-zinc-400">
        <li>
          <strong className="font-medium text-zinc-300">Coach</strong> (bottom-right) answers how-to questions
          via our chat API—messages are processed like support chat, not live web search.
        </li>
        <li>
          <strong className="font-medium text-zinc-300">Web job search</strong> (sidebar when enabled) can
          include a résumé excerpt in its instructions so searches match your background. It uses the live
          web (e.g. job postings), not your inbox.
        </li>
        <li>
          Tailored drafts and interview prep use your saved résumé and jobs only to generate text—you
          review before anything is sent or submitted on employer sites.
        </li>
      </ul>
    </div>
  );
}

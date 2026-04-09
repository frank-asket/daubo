const cols = [
  {
    title: "Your real experience, first",
    body: "Upload or paste your résumé once. Daubo uses what you provide—no invented employers, dates, or credentials.",
  },
  {
    title: "Materials that fit each posting",
    body: "For each saved role, get suggestions shaped to that job’s wording and requirements—not one copy-paste for everyone.",
  },
  {
    title: "You stay in the sender’s seat",
    body: "Apply on official career sites yourself. With Gmail, use drafts you edit and send from your own address.",
  },
];

export function ProcessStrip() {
  return (
    <section className="border-b border-zinc-800 bg-black py-16">
      <div className="mx-auto grid max-w-6xl gap-0 px-4 sm:grid-cols-3 sm:px-6 lg:px-8">
        {cols.map((c, i) => (
          <div
            key={c.title}
            className={`px-4 py-8 sm:px-6 ${
              i > 0 ? "border-t border-zinc-800 sm:border-l sm:border-t-0 sm:border-zinc-800" : ""
            }`}
          >
            <h3 className="text-lg font-semibold text-white">{c.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{c.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

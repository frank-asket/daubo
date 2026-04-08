const items = [
  {
    title: "Maximum clarity",
    body: "Every match comes with reasons you can verify—not a black-box score.",
  },
  {
    title: "Fast packaging",
    body: "Generate drafts, answers, and resume variants aligned to each listing.",
  },
  {
    title: "Sender identity",
    body: "Optional Gmail path keeps threads and replies on the address you own.",
  },
  {
    title: "Premium flow",
    body: "Dark, focused UI that stays out of your way during high-stakes searches.",
  },
];

export function Benefits() {
  return (
    <section id="why" className="border-b border-zinc-800/80 bg-[#050505] py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            Why choose Daubo?
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Benefits shaped for a seamless, cautious, and scalable job search—
            multi-agent power with human gates at the moments that matter.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 transition hover:border-zinc-700"
            >
              <div className="mb-4 h-1 w-10 rounded-full bg-[var(--mint)]" />
              <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-zinc-100">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

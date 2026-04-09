const cols = [
  {
    title: "Profile in, truth preserved",
    body: "Upload your base resume and preferences so agents never invent employers, dates, or credentials.",
  },
  {
    title: "Agents tailor, you verify",
    body: "Each job gets a fresh resume variant plus email body; you edit or reject before anything is queued to send.",
  },
  {
    title: "Send as yourself",
    body: "Approved applications go out through your connected email—the hiring team always sees the candidate they expect: you.",
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

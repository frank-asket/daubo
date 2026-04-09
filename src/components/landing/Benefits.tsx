import { FileUser, Mail, BadgeCheck, LayoutGrid } from "lucide-react";

const items = [
  {
    title: "Per-job wording from your résumé",
    body: "Get ideas for bullets, letters, and notes aligned to each listing—not one generic CV blast for every employer.",
    icon: FileUser,
  },
  {
    title: "Optional Gmail drafts",
    body: "Connect Google if you want application emails saved as drafts. You review and send; employers see your address.",
    icon: Mail,
  },
  {
    title: "Honest to each posting",
    body: "Suggestions reflect that employer’s requirements and tone. You adjust everything before you use it.",
    icon: BadgeCheck,
  },
  {
    title: "One calm workspace",
    body: "Saved jobs, application prep, and interview practice share the same context—less context-switching.",
    icon: LayoutGrid,
  },
];

export function Benefits() {
  return (
    <section id="why" className="border-b border-zinc-800 bg-black">
      <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Why choose Daubo?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-400">
          Built for <span className="text-zinc-300">people in any field</span>: care, trades,
          office work, clinical roles, hospitality, technology—any title you’re pursuing. You
          keep control of applying; we help with preparation and clarity.
        </p>

        <div className="mt-14 grid border-l border-t border-zinc-800 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="border-b border-r border-zinc-800 p-8 text-left sm:p-10"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-700 text-zinc-200">
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {item.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

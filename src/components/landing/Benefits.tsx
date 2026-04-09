import { FileUser, Mail, BadgeCheck, LayoutGrid } from "lucide-react";

const items = [
  {
    title: "Resume tailored per offer",
    body: "Agents rewrite and structure your resume for each listing—skills, bullets, and emphasis aligned to that job—not one generic PDF for everyone.",
    icon: FileUser,
  },
  {
    title: "Apply from your inbox",
    body: "Connect your email so applications send as you: employers see your address, and replies land in your thread (included on Pro).",
    icon: Mail,
  },
  {
    title: "You approve every send",
    body: "Multi-agent drafting stops before the wire. Review the package, then one tap to send from your account—no silent autopilot.",
    icon: BadgeCheck,
  },
  {
    title: "One continuous workspace",
    body: "Matching, packages, outbound status, and interview prep share the same job + profile context end to end.",
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
          Built for <span className="text-zinc-300">global labour markets</span>: nurses,
          drivers, teachers, builders, accountants, baristas, engineers—any title you
          chase. Personalized resumes per offer and sends from your own email, with
          you approving every message.
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

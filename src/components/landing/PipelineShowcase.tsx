import Link from "next/link";

const roles = [
  { title: "ICU Nurse", company: "Metro Health", match: "94%", delta: "+4.2%", up: true },
  { title: "Warehouse Lead", company: "Continental Line", match: "89%", delta: "+2.1%", up: true },
  { title: "High School Teacher", company: "Northfield District", match: "87%", delta: "-0.6%", up: false },
  { title: "Field Accountant", company: "Summit Co-op", match: "91%", delta: "+3.4%", up: true },
  { title: "DevOps Engineer", company: "Ioncraft", match: "85%", delta: "+1.8%", up: true },
];

function Initial({ name }: { name: string }) {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-white">
      {name.slice(0, 1)}
    </span>
  );
}

export function PipelineShowcase() {
  return (
    <section id="product" className="border-b border-zinc-800 bg-black py-20">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Every sector, matched worldwide
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Nurses, teachers, drivers, clinicians, accountants, technicians—Daubo is for anyone
            updating their career. Save roles you find (or ideas from our search helper), then get{" "}
            <span className="text-zinc-300">tailored wording</span> and a clear path to{" "}
            <span className="text-zinc-300">apply on the real site</span>. Connect Gmail if you want
            application emails saved as <span className="text-zinc-300">drafts</span> to edit and send.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-emerald-400 hover:text-emerald-300"
          >
            Open dashboard <span aria-hidden>&gt;</span>
          </Link>
        </div>
        <div className="flex flex-wrap justify-center gap-3 sm:justify-end">
          {roles.concat(roles).map((c, i) => (
            <div
              key={`${c.title}-${i}`}
              className="flex min-w-[140px] flex-col gap-2 rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-4"
            >
              <div className="flex items-center gap-2">
                <Initial name={c.company} />
                <span className="text-sm font-semibold text-white">{c.title}</span>
              </div>
              <p className="text-xs text-zinc-500">{c.company}</p>
              <p className="font-mono text-sm text-white">{c.match}</p>
              <p
                className={`text-xs font-semibold ${
                  c.up ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {c.delta}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

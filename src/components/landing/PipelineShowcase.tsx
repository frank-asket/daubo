import Link from "next/link";

const roles = [
  { title: "Staff Backend", company: "Rivermint", match: "94%", delta: "+4.2%", up: true },
  { title: "Product Engineer", company: "Northbeam", match: "89%", delta: "+2.1%", up: true },
  { title: "ML Platform", company: "Cinder", match: "87%", delta: "-0.6%", up: false },
  { title: "Security", company: "Latchkey", match: "91%", delta: "+3.4%", up: true },
  { title: "Design Systems", company: "Parcel", match: "85%", delta: "+1.8%", up: true },
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
    <section id="pipeline" className="border-b border-zinc-800 bg-black py-20">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            All roles, one pipeline
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Every saved role can generate its own{" "}
            <span className="text-zinc-300">resume variant</span> and{" "}
            <span className="text-zinc-300">outbound email</span>—queued to send from
            your inbox once you approve.
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

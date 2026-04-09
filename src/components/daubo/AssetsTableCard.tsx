import { TrendingUp, TrendingDown } from "lucide-react";

const rows = [
  {
    role: "ICU Nurse",
    company: "Metro Health",
    match: "94%",
    stage: "Ready for review",
    updated: "2h ago",
    delta: "+4%",
    up: true,
  },
  {
    role: "Warehouse Supervisor",
    company: "Continental Line",
    match: "89%",
    stage: "Draft",
    updated: "5h ago",
    delta: "+2%",
    up: true,
  },
  {
    role: "Secondary Math Teacher",
    company: "Northfield District",
    match: "87%",
    stage: "Sent",
    updated: "1d ago",
    delta: "-1%",
    up: false,
  },
];

export function AssetsTableCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Match</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3 font-medium">Δ Match</th>
            </tr>
          </thead>
          <tbody className="text-zinc-300">
            {rows.map((r) => (
              <tr key={r.role + r.company} className="border-b border-zinc-800/80 last:border-0">
                <td className="px-4 py-3 font-semibold text-white">{r.role}</td>
                <td className="px-4 py-3 text-zinc-400">{r.company}</td>
                <td className="px-4 py-3 font-medium text-white">{r.match}</td>
                <td className="px-4 py-3 text-zinc-400">{r.stage}</td>
                <td className="px-4 py-3 text-zinc-500">{r.updated}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 font-semibold ${
                      r.up ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {r.up ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    {r.delta}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

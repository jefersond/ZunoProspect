const STATS = [
  { numero: "+2.000", label: "profissionais ativos" },
  { numero: "180k+", label: "leads mapeados" },
  { numero: "< 5min", label: "do nicho à abordagem" },
  { numero: "4.9★", label: "satisfação média" },
];

export function StatsSection() {
  return (
    <div className="border-b border-[#1f2d29]/40 bg-[#0b0f0e]">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 divide-x divide-y divide-[#1f2d29]/40 md:grid-cols-4 md:divide-y-0">
          {STATS.map((s) => (
            <div key={s.label} className="px-6 py-8 text-center first:pl-0 last:pr-0">
              <div className="text-3xl font-extrabold tracking-tight text-[#10d98a] md:text-4xl">
                {s.numero}
              </div>
              <div className="mt-1 text-xs font-medium text-[#6b7280]">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const STATS = [
  { numero: "7 dias", label: "de teste no plano escolhido" },
  { numero: "R$ 0", label: "cobrado hoje" },
  { numero: "300 leads", label: "por mês no plano Starter" },
  { numero: "3 canais", label: "WhatsApp, Instagram e e-mail" },
];

export function StatsSection() {
  return (
    <div className="border-b border-[#1f2d29]/40 bg-[#0b0f0e]">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 divide-x divide-y divide-[#1f2d29]/40 md:grid-cols-4 md:divide-y-0">
          {STATS.map((s) => (
            <div key={s.label} className="px-6 py-8 text-center first:pl-0 last:pr-0">
              <div className="text-xl font-extrabold tracking-tight text-[#10d98a] md:text-2xl">
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

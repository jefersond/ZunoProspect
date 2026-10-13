import { useState } from "react";
import { ArrowRight, Building2, Check, MapPin, MessageSquareText, Radar, Sparkles } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

const cities = ["São Paulo, SP", "Belo Horizonte, MG", "Curitiba, PR"] as const;

const scenarios = [
  {
    id: "clinicas",
    label: "Clínicas",
    category: "Clínica estética",
    signal: "Presença digital e canais públicos reunidos para análise.",
    angle: "Captação de novos agendamentos",
    message: "Oi! Encontrei sua clínica em {city} e observei alguns pontos na presença digital que podem abrir espaço para novos agendamentos. Posso compartilhar uma análise rápida?",
  },
  {
    id: "restaurantes",
    label: "Restaurantes",
    category: "Restaurante",
    signal: "Perfil local e canais de contato organizados em um lugar.",
    angle: "Visibilidade na região",
    message: "Oi! Vi o restaurante de vocês em {city}. Reuni alguns pontos da presença digital que podem ajudar a atrair mais pessoas da região. Posso mostrar o que observei?",
  },
  {
    id: "imobiliarias",
    label: "Imobiliárias",
    category: "Imobiliária",
    signal: "Site e presença local disponíveis para contextualizar a abordagem.",
    angle: "Geração de novas conversas",
    message: "Oi! Encontrei sua imobiliária em {city} e identifiquei oportunidades de melhorar a presença digital para iniciar mais conversas com interessados. Posso enviar uma análise breve?",
  },
] as const;

interface MockupHeroProspeccaoProps {
  onStart: () => void;
}

export function MockupHeroProspeccao({ onStart }: MockupHeroProspeccaoProps) {
  const [scenarioId, setScenarioId] = useState<(typeof scenarios)[number]["id"]>("clinicas");
  const [city, setCity] = useState<(typeof cities)[number]>("São Paulo, SP");
  const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];

  return (
    <div className="zuno-demo-shell relative overflow-hidden rounded-[24px] border border-[#12D98B]/25 bg-[#0D1713] shadow-[0_35px_100px_rgba(0,0,0,0.55)]">
      <div className="zuno-demo-sheen pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative flex flex-wrap items-center justify-between gap-2 border-b border-[#20312A] bg-[#07100D]/80 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-[#E55757]/70" />
            <span className="h-2 w-2 rounded-full bg-[#F3F7F5]/35" />
            <span className="h-2 w-2 rounded-full bg-[#12D98B]/70" />
          </div>
          <span className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[#A9B8B1]">Zuno / simulação</span>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#12D98B]/25 bg-[#12D98B]/10 px-2.5 py-1 text-[10px] font-bold text-[#21E6A0]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#12D98B]" />
          Interativa
        </span>
      </div>

      <div className="relative space-y-4 p-4 sm:p-5">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#12D98B]">
            <Radar className="h-4 w-4" />
            Explore uma busca
          </div>
          <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-3" role="group" aria-label="Escolha um nicho para a simulação">
            {scenarios.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={scenarioId === item.id}
                onClick={() => {
                  setScenarioId(item.id);
                  trackEvent("landing_demo_niche_selected", { niche: item.id });
                }}
                className={"rounded-lg border px-2 py-2 text-center text-[11px] font-bold transition-all hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#21E6A0] sm:text-xs " + (scenarioId === item.id
                  ? "border-[#12D98B] bg-[#12D98B]/15 text-[#F3F7F5] shadow-[inset_0_0_18px_rgba(18,217,139,0.12)]"
                  : "border-[#20312A] bg-[#07100D]/70 text-[#A9B8B1] hover:border-[#12D98B]/50 hover:text-[#F3F7F5]")}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-wrap items-center gap-2 rounded-xl border border-[#20312A] bg-[#07100D]/75 px-3 py-2.5 min-[320px]:gap-3">
          <MapPin className="h-4 w-4 shrink-0 text-[#12D98B]" />
          <span className="text-xs text-[#A9B8B1]">Cidade</span>
          <select
            value={city}
            onChange={(event) => {
              const nextCity = event.target.value as (typeof cities)[number];
              setCity(nextCity);
              trackEvent("landing_demo_city_selected", { city: nextCity });
            }}
            className="min-w-0 w-full cursor-pointer bg-transparent text-left text-xs font-semibold text-[#F3F7F5] outline-none focus-visible:ring-2 focus-visible:ring-[#21E6A0] min-[320px]:ml-auto min-[320px]:w-auto min-[320px]:max-w-[62%] min-[320px]:text-right [&_option]:bg-[#0D1713]"
          >
            {cities.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>

        <div key={`${scenarioId}-${city}-result`} className="zuno-demo-result zuno-demo-reveal rounded-2xl border border-[#12D98B]/25 bg-[#111D18] p-4 shadow-[0_0_35px_rgba(18,217,139,0.07)]" aria-live="polite">
          <div className="mb-3 flex flex-col items-start gap-1 min-[320px]:flex-row min-[320px]:items-center min-[320px]:justify-between">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#12D98B]">Exemplo de resultado</span>
            <span className="text-[11px] text-[#A9B8B1]">Dados ilustrativos</span>
          </div>
          <div className="flex items-center gap-2 min-[320px]:gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#12D98B]/20 bg-[#12D98B]/10 min-[320px]:h-11 min-[320px]:w-11">
              <Building2 className="h-5 w-5 text-[#12D98B]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#F3F7F5] max-[319px]:text-xs">Empresa demonstrativa</p>
              <p className="break-words text-xs text-[#A9B8B1]">{scenario.category} · {city}</p>
            </div>
            <Check className="ml-auto hidden h-4 w-4 shrink-0 text-[#12D98B] min-[320px]:block" aria-hidden="true" />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-[#20312A] bg-[#07100D]/70 p-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#A9B8B1]">Contexto</p>
              <p className="text-[11px] leading-relaxed text-[#F3F7F5]">{scenario.signal}</p>
            </div>
            <div className="rounded-lg border border-[#20312A] bg-[#07100D]/70 p-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#A9B8B1]">Ângulo de abordagem</p>
              <p className="text-[11px] leading-relaxed text-[#F3F7F5]">{scenario.angle}</p>
            </div>
          </div>
        </div>

        <div key={`${scenarioId}-${city}-message`} className="zuno-demo-message zuno-demo-reveal relative rounded-xl border border-[#20312A] bg-[#07100D]/80 p-4">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#12D98B]">
            <MessageSquareText className="h-3.5 w-3.5" />
            Abordagem sugerida
          </div>
          <p className="text-xs leading-relaxed text-[#D7E4DC]">“{scenario.message.replace("{city}", city)}”</p>
          <p className="mt-2 text-[11px] text-[#A9B8B1]">Você revisa e decide se quer enviar.</p>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="group relative flex w-full items-center justify-center rounded-xl bg-[#12D98B] px-10 py-3 text-center text-sm font-extrabold text-[#07100D] shadow-[0_12px_28px_rgba(18,217,139,0.17)] transition-colors hover:bg-[#21E6A0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#21E6A0]"
        >
          <span>Ver planos e começar</span>
          <ArrowRight className="absolute right-4 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[#A9B8B1]">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
          Esta é uma simulação. Os resultados reais dependem dos dados públicos disponíveis.
        </p>
      </div>
    </div>
  );
}

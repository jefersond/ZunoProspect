import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { XCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

export function AntesDepoisSection() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };
  const itensImproviso = [
    "Busca empresas manualmente",
    "Joga contatos em planilhas",
    "Escolhe quem abordar no chute",
    "Manda mensagens genéricas",
    "Esquece follow-up",
    "Não sabe o que funcionou",
  ];

  const itensZuno = [
    "Busca empresas por cidade e nicho",
    "Organiza contatos em um só lugar",
    "Analisa oportunidades com IA",
    "Gera abordagens com contexto",
    "Usa WhatsApp, Instagram e e-mail",
    "Prospecta com mais clareza",
  ];

  return (
    <section id="antes-depois" className="relative overflow-hidden bg-[#0b0f0e] py-20 border-b border-[#1f2d29]/40">
      {/* Luz de fundo sutil no canto direito */}
      <div className="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-[#10d98a]/5 blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <Badge variant="outline" className="mb-4 border-[#1f2d29] text-[#9ca3af] bg-[#111816]/50">
            Comparativo de Eficiência
          </Badge>
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-[#f4f4f5] md:text-5xl">
            Sua prospecção ainda depende de Google, planilha e tentativa?
          </h2>
          <p className="text-base text-[#9ca3af] md:text-lg">
            Compare o caos da busca manual e fria com a clareza de um sistema estruturado para conversão.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 max-w-5xl mx-auto">
          {/* Coluna Esquerda: Improviso */}
          <Card className="relative overflow-hidden rounded-xl border border-zinc-800 bg-[#141517]/50 p-6 md:p-8 backdrop-blur transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-zinc-600/30" />
            
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-zinc-400">Prospecção no improviso</h3>
              <span className="rounded-full bg-zinc-800/60 px-3 py-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Improvisado
              </span>
            </div>

            <p className="mb-6 text-sm text-zinc-500">
              Perda de tempo diária com listas desorganizadas e cópias frias enviadas sem relevância técnica ou dores mapeadas.
            </p>

            <ul className="space-y-4">
              {itensImproviso.map((item, index) => (
                <li key={index} className="flex items-start gap-3 text-zinc-400">
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500/70" />
                  <span className="text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-lg bg-zinc-900/30 p-4 border border-zinc-800/40 text-center text-xs text-zinc-600 font-mono">
              Resultado: horas perdidas por dia e baixa taxa de resposta.
            </div>
          </Card>

          {/* Coluna Direita: Zuno */}
          <Card className="relative overflow-hidden rounded-xl border border-[#1f2d29] bg-[#111816]/70 p-6 md:p-8 shadow-[0_0_50px_rgba(16,217,138,0.03)] backdrop-blur transition-all duration-300 hover:border-[#10d98a]/30 group">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-[#10d98a]" />
            
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-[#f4f4f5]">Prospecção com a Zuno</h3>
              <span className="rounded-full bg-[#10d98a]/10 px-3 py-1 text-xs font-semibold text-[#10d98a] uppercase tracking-wider">
                Eficiente
              </span>
            </div>

            <p className="mb-6 text-sm text-[#9ca3af]">
              Um fluxo previsível que ajuda a encontrar oportunidades ocultas por região e gerar roteiros de conversas qualificadas.
            </p>

            <ul className="space-y-4">
              {itensZuno.map((item, index) => (
                <li key={index} className="flex items-start gap-3 text-[#f4f4f5] transition-all group-hover:translate-x-0.5">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#10d98a]" />
                  <span className="text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-lg bg-[#10d98a]/5 p-4 border border-[#10d98a]/10 text-center text-xs text-[#10d98a] font-mono">
              Resultado: lista de 30 leads com contatos em ~5 minutos.
            </div>
          </Card>
        </div>

        <div className="mt-14 text-center">
          <Button
            size="lg"
            className="h-14 rounded-lg bg-[#10d98a] text-[#0b0f0e] font-bold shadow-[0_0_30px_rgba(16,217,138,0.2)] hover:bg-[#10d98a]/90 transition-all px-8 text-base md:text-lg"
            onClick={() => {
              trackEvent("cta_clicked", { cta: "comecar_gratis", location: "antes_depois" });
              scrollToSection("precos");
            }}
          >
            Quero prospectar com clareza
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <p className="text-xs font-semibold text-[#9ca3af] mt-3 tracking-wide">
            Hoje R$0 • Cancele antes da cobrança
          </p>
        </div>
      </div>
    </section>
  );
}

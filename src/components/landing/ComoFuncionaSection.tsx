import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  MapPin, 
  Search, 
  Sparkles, 
  ArrowRight, 
  Bot, 
  Building2,
  MessageSquare,
  Instagram,
  Mail,
  Zap
} from "lucide-react";
import { trackEvent } from "@/lib/analytics";

export function ComoFuncionaSection() {
  const [passoAtivo, setPassoAtivo] = useState(0);

  const passos = [
    {
      titulo: "1. Escolha cidade e nicho",
      subtitulo: "Diga onde e quem quer prospectar",
      descricao: "Defina a região e o nicho de mercado (ex: Clínicas Odontológicas em Ribeirão Preto). A Zuno localiza empresas de forma focada e cirúrgica.",
      icone: MapPin,
    },
    {
      titulo: "2. Encontre empresas",
      subtitulo: "Lista organizada com dados completos",
      descricao: "Acesse dados cruciais de contato e presença digital: WhatsApp ativo, redes sociais, site e canais de comunicação compilados em segundos.",
      icone: Building2,
    },
    {
      titulo: "3. Analise oportunidades com IA",
      subtitulo: "Diagnóstico e score de conversão",
      descricao: "A IA da Zuno varre o ecossistema do lead e lista pontos fracos técnicos (Meta Pixel ausente, site lento ou lento no celular) calculando um score comercial.",
      icone: Bot,
    },
    {
      titulo: "4. Gere abordagens qualificadas",
      subtitulo: "Copies para WhatsApp, Instagram e e-mail",
      descricao: "A IA redige textos de abordagens altamente contextualizados para múltiplos canais, alinhando as fragilidades técnicas do lead com seus serviços.",
      icone: Sparkles,
    },
    {
      titulo: "5. Copie e comece a conversa",
      subtitulo: "Abordagem com um clique",
      descricao: "Copie a mensagem gerada e abra o canal de contato direto do lead. Inicie diálogos de vendas sem bloqueios criativos e com alta taxa de resposta.",
      icone: Zap,
    },
  ];

  const etapasFluxo = [
    { label: "Cidade + Nicho", icone: MapPin, index: 0 },
    { label: "Empresas Encontradas", icone: Building2, index: 1 },
    { label: "Score / Oportunidade", icone: Bot, index: 2 },
    { label: "Mensagem Gerada", icone: Sparkles, index: 3 },
    { label: "Canal de Envio", icone: Zap, index: 4 }
  ];

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="como-funciona" className="relative overflow-hidden bg-[#0b0f0e] py-20 border-b border-[#1f2d29]/40">
      {/* Brilhos de fundo */}
      <div className="absolute right-1/4 bottom-10 h-80 w-80 rounded-full bg-[#10d98a]/5 blur-[100px] pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <Badge variant="outline" className="mb-4 border-[#1f2d29] text-[#9ca3af] bg-[#111816]/50">
            Como funciona
          </Badge>
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-[#f4f4f5] md:text-5xl">
            Da busca à abordagem em poucos passos
          </h2>
          <p className="text-base text-[#9ca3af] md:text-lg">
            Escolha onde e quem quer prospectar. A Zuno ajuda a encontrar empresas, entender oportunidades e gerar mensagens com IA.
          </p>
        </div>

        {/* Sequência Visual Horizontal (Esteira de Prospecção) - O Coração do Produto */}
        <div className="mx-auto mb-10 max-w-6xl rounded-xl border border-[#1f2d29] bg-[#111816]/40 p-4 md:p-5 backdrop-blur shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-1.5 lg:gap-2">
            {etapasFluxo.map((etapa, idx) => {
              const ativo = passoAtivo === etapa.index;
              const concluido = passoAtivo > etapa.index;
              return (
                <div key={idx} className="flex-1 flex items-center">
                  <button
                    onClick={() => setPassoAtivo(etapa.index)}
                    className={`flex flex-col md:flex-row items-center gap-2 md:gap-1.5 lg:gap-2.5 px-3 py-2.5 md:px-1.5 md:py-2 lg:px-3 lg:py-2.5 rounded-lg border text-left transition-all duration-300 w-full ${
                      ativo
                        ? "bg-[#111816] border-[#10d98a] text-[#10d98a] shadow-[0_0_15px_rgba(16,217,138,0.1)] scale-[1.02]"
                        : concluido
                        ? "bg-[#111816]/20 border-[#10d98a]/20 text-[#10d98a]/80"
                        : "bg-transparent border-transparent text-[#9ca3af] hover:text-[#f4f4f5]"
                    }`}
                  >
                    <div className={`flex h-8 w-8 md:h-7 md:w-7 lg:h-8 lg:w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                      ativo
                        ? "border-[#10d98a] bg-[#10d98a]/10 text-[#10d98a]"
                        : concluido
                        ? "border-[#10d98a]/30 bg-[#10d98a]/5 text-[#10d98a]"
                        : "border-[#1f2d29] text-[#9ca3af]"
                    }`}>
                      <etapa.icone className="h-4 w-4 md:h-3.5 md:w-3.5 lg:h-4 lg:w-4" />
                    </div>
                    <div>
                      <p className="text-[9px] md:text-[8px] lg:text-[9px] uppercase font-mono tracking-wider text-[#9ca3af]">Etapa {idx + 1}</p>
                      <p className="text-xs md:text-[10px] lg:text-xs font-bold whitespace-nowrap">{etapa.label}</p>
                    </div>
                  </button>
                  {idx < etapasFluxo.length - 1 && (
                    <div className="hidden md:block mx-1.5 lg:mx-2 xl:mx-3 text-[#1f2d29] font-bold text-base lg:text-lg">➔</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] items-center max-w-6xl mx-auto">
          {/* Lado Esquerdo: Lista de Passos */}
          <div className="space-y-3">
            {passos.map((passo, index) => {
              const ativo = passoAtivo === index;
              return (
                <button
                  key={index}
                  onClick={() => setPassoAtivo(index)}
                  className={`w-full text-left p-5 rounded-xl border transition-all duration-300 relative overflow-hidden flex items-start gap-4 ${
                    ativo 
                      ? "bg-[#111816] border-[#10d98a]/30 shadow-[0_0_30px_rgba(16,217,138,0.02)]" 
                      : "bg-[#111816]/30 border-[#1f2d29]/60 opacity-60 hover:opacity-95"
                  }`}
                >
                  {ativo && (
                    <div className="absolute top-0 left-0 w-[4px] h-full bg-[#10d98a]" />
                  )}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                    ativo ? "border-[#10d98a]/30 bg-[#10d98a]/10 text-[#10d98a]" : "border-[#1f2d29] text-[#9ca3af]"
                  }`}>
                    <passo.icone className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className={`text-base font-bold transition-colors ${ativo ? "text-[#f4f4f5]" : "text-[#9ca3af]"}`}>
                      {passo.titulo}
                    </h3>
                    <p className="text-xs text-[#10d98a]/80 mt-0.5 font-medium">{passo.subtitulo}</p>
                    {ativo && (
                      <p className="text-xs text-[#9ca3af] mt-2 leading-relaxed animate-fadeIn">
                        {passo.descricao}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Lado Direito: Simulador de Interface (Muda conforme o passo) */}
          <div className="relative overflow-hidden rounded-xl border border-[#1f2d29] bg-[#111816] shadow-2xl p-4 lg:p-6 min-h-[400px] flex flex-col justify-between">
            {/* Abas superiores da janela */}
            <div className="absolute top-0 left-0 w-full h-[3px] bg-[#10d98a]" />
            <div className="flex items-center gap-1.5 border-b border-[#1f2d29]/60 pb-3 mb-4 text-xs font-mono text-[#9ca3af] uppercase tracking-wider">
              <span className="h-2 w-2 rounded-full bg-[#10d98a]" />
              <span>Zuno Software • {etapasFluxo[passoAtivo].label}</span>
            </div>

            <div className="flex-1 flex flex-col justify-center">
              {/* PASSO 1: Busca */}
              {passoAtivo === 0 && (
                <div className="space-y-4 py-4 animate-fadeIn">
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-[#9ca3af] uppercase tracking-wider font-mono">
                      Nicho de Prospecção
                    </label>
                    <div className="flex items-center gap-2 rounded-lg border border-[#1f2d29] bg-[#0b0f0e] p-3 text-sm text-[#f4f4f5]">
                      <Search className="h-4 w-4 text-[#10d98a]" />
                      <span>Clínica Odontológica</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold text-[#9ca3af] uppercase tracking-wider font-mono">
                      Cidade e Região
                    </label>
                    <div className="flex items-center gap-2 rounded-lg border border-[#1f2d29] bg-[#0b0f0e] p-3 text-sm text-[#f4f4f5]">
                      <MapPin className="h-4 w-4 text-[#10d98a]" />
                      <span>Ribeirão Preto - SP</span>
                    </div>
                  </div>

                  <div className="w-full h-12 rounded-lg bg-[#10d98a] text-[#0b0f0e] font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,217,138,0.2)]">
                    <Zap className="h-4 w-4 fill-current" />
                    Buscar Empresas com IA
                  </div>
                </div>
              )}

              {/* PASSO 2: Leads Encontrados */}
              {passoAtivo === 1 && (
                <div className="space-y-3 py-2 animate-fadeIn">
                  <p className="text-xs text-[#9ca3af] mb-1 font-mono">
                    Resultados encontrados na região:
                  </p>
                  
                  <div className="rounded-lg border border-[#10d98a]/20 bg-[#0b0f0e]/60 p-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-[#f4f4f5]">Odonto Care Centro</h4>
                      <p className="text-[11px] text-[#9ca3af]">Ribeirão Preto • (16) 99281-XXXX</p>
                      <div className="mt-1.5 flex gap-1.5">
                        <span className="rounded bg-red-950/30 px-1.5 py-0.5 text-[9px] font-mono text-red-400 border border-red-900/30">Sem Pixel</span>
                        <span className="rounded bg-[#1f2d29]/40 px-1.5 py-0.5 text-[9px] font-mono text-[#9ca3af] border border-[#1f2d29]">Site Lento</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-[#10d98a] bg-[#10d98a]/10 px-2 py-0.5 rounded-full font-mono border border-[#10d98a]/20">92% Match</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#1f2d29] bg-[#0b0f0e]/20 p-3 opacity-60 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-[#f4f4f5]">Sorriso & Cia</h4>
                      <p className="text-[11px] text-[#9ca3af]">Ribeirão Preto • (16) 98177-XXXX</p>
                    </div>
                    <span className="text-xs font-bold text-zinc-400 bg-zinc-800/30 px-2 py-0.5 rounded-full font-mono">78% Match</span>
                  </div>
                </div>
              )}

              {/* PASSO 3: Diagnóstico IA */}
              {passoAtivo === 2 && (
                <div className="space-y-3 py-2 animate-fadeIn">
                  <div className="rounded-lg border border-[#1f2d29] bg-[#0b0f0e] p-3 text-xs text-[#9ca3af]">
                    <div className="flex items-center gap-1.5 text-[#10d98a] font-bold mb-2 font-mono">
                      <Bot className="h-3.5 w-3.5" />
                      <span>Diagnóstico de Oportunidades:</span>
                    </div>
                    <ul className="space-y-1.5 text-[11px] list-disc list-inside">
                      <li>Sem Tag de Anúncios (Pixel ausente no site oficial)</li>
                      <li>Velocidade mobile insatisfatória (carregamento &gt; 4.2s)</li>
                      <li>Perfil de Instagram ativo com alto engajamento orgânico</li>
                    </ul>
                  </div>

                  <div className="rounded-lg border border-[#1f2d29] bg-[#0b0f0e]/50 p-3 text-xs text-[#f4f4f5] border-l-2 border-l-[#10d98a] flex items-center justify-between">
                    <div>
                      <p className="font-bold">Pontuação de Vendas (Score)</p>
                      <p className="text-[10px] text-[#9ca3af]">Potencial de conversão em serviços</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-extrabold text-[#10d98a] font-mono">92/100</p>
                      <p className="text-[8px] uppercase tracking-wider text-[#10d98a] font-bold">Excelente</p>
                    </div>
                  </div>
                </div>
              )}

              {/* PASSO 4: Copies de Abordagem */}
              {passoAtivo === 3 && (
                <div className="space-y-3 py-1 animate-fadeIn">
                  <div className="flex border-b border-[#1f2d29] pb-1.5 gap-2">
                    <span className="text-xs font-bold text-[#10d98a] border-b-2 border-[#10d98a] pb-1.5 px-1 cursor-default">WhatsApp</span>
                    <span className="text-xs text-[#9ca3af] pb-1.5 px-1 cursor-default opacity-60">Instagram Direct</span>
                    <span className="text-xs text-[#9ca3af] pb-1.5 px-1 cursor-default opacity-60">E-mail</span>
                  </div>
                  
                  <div className="rounded-lg border border-[#1f2d29] bg-[#0b0f0e]/80 p-3 text-xs text-[#f4f4f5] italic border-l-2 border-[#10d98a] leading-relaxed max-h-[140px] overflow-y-auto">
                    "Olá, notei que sua clínica em Ribeirão Preto possui excelentes avaliações orgânicas, mas analisando o site oficial vi que o Pixel do Meta Ads está inativo. Isso significa que vocês estão perdendo potenciais clientes que entram no site e saem sem agendar. Tenho uma estratégia local rápida para capturar esse público..."
                  </div>
                </div>
              )}

              {/* PASSO 5: Início da Conversa */}
              {passoAtivo === 4 && (
                <div className="space-y-4 py-3 animate-fadeIn text-center">
                  <div className="rounded-lg border border-[#10d98a]/10 bg-[#10d98a]/5 p-3 text-xs text-[#10d98a] font-medium leading-relaxed max-w-sm mx-auto">
                    Copy copiada para a área de transferência!
                  </div>

                  <div className="flex justify-center gap-3">
                    <div className="rounded-lg border border-[#1f2d29] bg-[#0b0f0e] p-3 text-center w-32">
                      <Instagram className="h-5 w-5 mx-auto text-pink-400 mb-1" />
                      <span className="text-xs font-bold text-[#f4f4f5]">Direct</span>
                    </div>
                    <div className="rounded-lg border border-[#10d98a]/30 bg-[#10d98a]/10 p-3 text-center w-32 border-2 shadow-[0_0_15px_rgba(16,217,138,0.05)]">
                      <MessageSquare className="h-5 w-5 mx-auto text-[#10d98a] mb-1" />
                      <span className="text-xs font-bold text-[#f4f4f5]">WhatsApp</span>
                    </div>
                    <div className="rounded-lg border border-[#1f2d29] bg-[#0b0f0e] p-3 text-center w-32">
                      <Mail className="h-5 w-5 mx-auto text-blue-400 mb-1" />
                      <span className="text-xs font-bold text-[#f4f4f5]">E-mail</span>
                    </div>
                  </div>

                  <div className="w-full h-11 rounded-lg bg-transparent border border-[#10d98a] text-[#10d98a] font-bold flex items-center justify-center gap-2 hover:bg-[#10d98a]/10 transition-colors">
                    <Zap className="h-4 w-4" />
                    Iniciar Conversa no WhatsApp
                  </div>
                </div>
              )}
            </div>

            {/* Footer do Simulador */}
            <div className="mt-4 border-t border-[#1f2d29]/40 pt-3 flex items-center justify-between text-[11px] text-[#9ca3af]">
              <span>Esteira Comercial Inteligente</span>
              <span className="text-[#10d98a]">Simulação da Plataforma</span>
            </div>
          </div>
        </div>

        {/* CTA final da seção */}
        <div className="mt-14 text-center">
          <Button
            size="lg"
            className="h-14 rounded-lg bg-[#10d98a] text-[#0b0f0e] font-bold shadow-[0_0_30px_rgba(16,217,138,0.2)] hover:bg-[#10d98a]/90 transition-all px-8 text-base md:text-lg"
            onClick={() => {
              trackEvent("cta_clicked", { cta: "comecar_gratis", location: "como_funciona" });
              scrollToSection("precos");
            }}
          >
            Começar teste grátis de 7 dias
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <p className="text-xs font-semibold text-[#9ca3af] mt-3 tracking-wide">
            Hoje R$0 • Cartão necessário • Cancele antes da cobrança
          </p>
        </div>
      </div>
    </section>
  );
}

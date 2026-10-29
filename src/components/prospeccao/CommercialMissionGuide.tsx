import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Target, Sparkles, X, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";

export const COMMERCIAL_MISSION_STEPS = [
  {
    stepNumber: 1,
    title: "1. Encontrar Oportunidades",
    anchor: "tour-leads-container",
    anchorFallback: "leads-table-container",
    targets: ["tour-leads-container", "leads-table-container"],
    contextHint: "Tabela de Leads",
    pageHint: "/prospeccao",
    description: "Sua busca retornou potenciais clientes no nicho desejado. Cada empresa traz dados de contato e sinais digitais para você analisar antes de abordar.",
  },
  {
    stepNumber: 2,
    title: "2. Salvar uma Oportunidade",
    anchor: "tour-btn-salvar-lead",
    anchorFallback: "tour-btn-salvar-leads-all",
    targets: ["tour-btn-salvar-lead", "tour-btn-salvar-leads-all"],
    contextHint: "Salvar nos Favoritos",
    pageHint: "/prospeccao",
    description: "Salve as empresas mais promissoras clicando no ícone de favorito. Leads salvos ficam organizados na sua carteira comercial para acompanhamento contínuo.",
  },
  {
    stepNumber: 3,
    title: "3. Abrir o Diagnóstico Comercial",
    anchor: "tour-btn-ver-plano",
    anchorFallback: "tour-diagnostico-ia",
    targets: ["tour-btn-ver-plano", "tour-diagnostico-ia"],
    contextHint: "Botão Ver Plano",
    pageHint: "/prospeccao",
    description: "Clique em 'Ver Plano' para abrir a análise inteligente do lead. A Zuno analisa presença digital e canais para apontar oportunidades e hipóteses de abordagem. As análises da IA são hipóteses comerciais para enriquecer sua conversa, não fatos comprovados.",
  },
  {
    stepNumber: 4,
    title: "4. Conhecer a Copy Personalizada",
    anchor: "tour-plano-copies",
    anchorFallback: "plano-7-dias",
    targets: ["tour-plano-copies", "plano-7-dias"],
    contextHint: "Modal de Plano do Lead",
    pageHint: "modal",
    description: "Aqui estão as mensagens comerciais estruturadas especificamente para o nicho desta empresa. Você pode copiar, adaptar com suas próprias palavras e enviar manualmente pelo canal escolhido. Copiar uma mensagem ou abrir o WhatsApp não consome créditos nem contabiliza contato automaticamente.",
  },
  {
    stepNumber: 5,
    title: "5. Registrar a Abordagem Realizada",
    anchor: "tour-bloco-registro-comercial",
    anchorFallback: undefined,
    targets: ["tour-bloco-registro-comercial"],
    contextHint: "Registro Comercial",
    pageHint: "modal",
    description: "Quando você realmente realizar o contato com a empresa, confirme aqui para atualizar seu histórico e avançar sua meta comercial diária. Você só deve registrar contatos que realmente aconteceram.",
  },
  {
    stepNumber: 6,
    title: "6. Acompanhamento e Próxima Ação",
    anchor: "tour-campo-anotacoes-followup",
    anchorFallback: undefined,
    targets: ["tour-campo-anotacoes-followup"],
    contextHint: "Anotações Comerciais",
    pageHint: "modal",
    description: "Registre aqui o que foi conversado e planeje sua próxima tentativa de contato. Se o cliente não responder de imediato, a constância no acompanhamento é o que transforma conversas em reuniões e vendas.",
  },
  {
    stepNumber: 7,
    title: "7. Meta Comercial e Desempenho",
    anchor: "tour-painel-metas",
    anchorFallback: undefined,
    targets: ["tour-painel-metas"],
    contextHint: "Painel de Metas",
    pageHint: "/leads-salvos",
    description: "Acompanhe seu ritmo de prospecção em três visões: Diário (contatos confirmados hoje e tarefas pendentes), Semanal (histograma de consistência) e Mensal (produtividade e resultados de funil). Suas metas são 100% personalizáveis.",
  },
] as const;

export interface CommercialMissionGuideProps {
  phase: "idle" | "invite" | "commercial_mission" | "completed";
  currentStep: number;
  onStartMission: () => void;
  onStepChange: (step: number) => void;
  onDismiss: () => void;
  onComplete: () => void;
}

export function CommercialMissionGuide({
  phase,
  currentStep,
  onStartMission,
  onStepChange,
  onDismiss,
  onComplete,
}: CommercialMissionGuideProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const [elementFound, setElementFound] = useState<boolean>(false);
  const [targetVersion, setTargetVersion] = useState<number>(0);

  const safeStepIndex = Math.min(Math.max(currentStep, 1), COMMERCIAL_MISSION_STEPS.length) - 1;
  const step = COMMERCIAL_MISSION_STEPS[safeStepIndex];

  // Cálculo e posicionamento do Spotlight com fallback gracioso se o elemento ainda não estiver montado
  useLayoutEffect(() => {
    if (phase !== "commercial_mission") {
      setPosition(null);
      setElementFound(false);
      return;
    }

    const targetIds = step.targets;
    const targets = targetIds.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const anchor = document.getElementById(step.anchor) || (step.anchorFallback ? document.getElementById(step.anchorFallback) : null);

    if (!anchor || targets.length === 0) {
      setElementFound(false);
      // Fallback gracioso: posiciona o card flutuante na parte inferior direita sem travar
      const vpWidth = window.visualViewport?.width ?? window.innerWidth;
      const vpHeight = window.visualViewport?.height ?? window.innerHeight;
      const cardWidth = Math.min(340, vpWidth - 24);
      setPosition({
        top: Math.max(20, vpHeight - 340),
        left: Math.max(12, vpWidth - cardWidth - 20),
        width: cardWidth,
        maxHeight: 400,
      });

      const observer = new MutationObserver(() => {
        const found = document.getElementById(step.anchor) || (step.anchorFallback && document.getElementById(step.anchorFallback));
        if (found) {
          observer.disconnect();
          setTargetVersion((v) => v + 1);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      return () => observer.disconnect();
    }

    setElementFound(true);
    const highlighted = targets;
    const previous = highlighted.map((element) => ({
      element,
      position: element.style.position,
      zIndex: element.style.zIndex,
      boxShadow: element.style.boxShadow,
      borderRadius: element.style.borderRadius,
    }));

    highlighted.forEach((element) => {
      element.style.position = "relative";
      element.style.zIndex = "51";
      element.style.boxShadow = "0 0 0 4px rgba(16,217,138,.9), 0 8px 28px rgba(0,0,0,.35)";
      element.style.borderRadius = "10px";
    });

    anchor.scrollIntoView({ behavior: "smooth", block: "center" });

    const update = () => {
      const rect = anchor.getBoundingClientRect();
      const bounds = highlighted.map((element) => element.getBoundingClientRect());
      const groupTop = Math.min(...bounds.map((item) => item.top));
      const groupBottom = Math.max(...bounds.map((item) => item.bottom));

      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportWidth = viewport?.width ?? window.innerWidth;

      const width = Math.min(340, viewportWidth - 24);
      const height = popupRef.current?.scrollHeight ?? 240;

      const spaceBelow = viewportTop + viewportHeight - groupBottom - 20;
      const spaceAbove = groupTop - viewportTop - 20;
      const placeBelow = spaceBelow >= Math.min(height, 160) || spaceBelow >= spaceAbove;
      const maxHeight = Math.max(100, Math.floor(placeBelow ? spaceBelow : spaceAbove));
      const top = placeBelow ? groupBottom + 12 : groupTop - Math.min(height, maxHeight) - 12;

      setPosition({
        top: Math.max(viewportTop + 8, top),
        left: Math.max(12, Math.min(rect.left, viewportWidth - width - 12)),
        width,
        maxHeight,
      });
    };

    update();
    const frame = requestAnimationFrame(update);
    const afterScroll = window.setTimeout(update, 350);

    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(afterScroll);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      previous.forEach(({ element, position, zIndex, boxShadow, borderRadius }) => {
        Object.assign(element.style, { position, zIndex, boxShadow, borderRadius });
      });
    };
  }, [phase, currentStep, targetVersion, step]);

  // Tecla Escape para fechar
  useEffect(() => {
    if (phase === "idle" || phase === "completed") return;

    document.body.classList.add("zuno-mission-active");
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onEscape);

    return () => {
      document.body.classList.remove("zuno-mission-active");
      window.removeEventListener("keydown", onEscape);
    };
  }, [phase, onDismiss]);

  if (phase === "idle" || phase === "completed") {
    return null;
  }

  // MODAL / CARD DE CONVITE (FASE DE TRANSIÇÃO)
  if (phase === "invite") {
    return createPortal(
      <>
        <div aria-hidden="true" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Convite para Missão Comercial"
          className="fixed left-1/2 top-1/2 z-[60] w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-emerald-500/40 bg-zinc-950 p-6 text-zinc-100 shadow-2xl"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Target className="h-6 w-6" />
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
              aria-label="Fechar convite"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <h3 className="text-lg font-bold text-zinc-100">
            Você encontrou suas primeiras oportunidades!
          </h3>
          <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
            Agora vamos preparar uma abordagem personalizada, entender como registrar contatos e organizar seu próximo acompanhamento.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
            <Button
              type="button"
              onClick={onStartMission}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold gap-2 text-sm h-11"
            >
              <span>Iniciar Missão Comercial</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onDismiss}
              className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm h-11"
            >
              Explorar sozinho
            </Button>
          </div>
        </div>
      </>,
      document.body
    );
  }

  // GUIA PROGRESSIVO DA MISSÃO COM SPOTLIGHT
  return createPortal(
    <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 bg-black/50" />
      <div
        ref={popupRef}
        role="dialog"
        aria-modal="false"
        aria-label="Guia da Missão Comercial"
        className="fixed z-[60] overflow-y-auto rounded-xl border border-emerald-500/40 bg-zinc-950 p-4 text-zinc-100 shadow-2xl"
        style={{
          top: position?.top ?? 12,
          left: position?.left ?? 12,
          width: position?.width ?? 320,
          maxHeight: position?.maxHeight ?? 420,
          visibility: position ? "visible" : "hidden",
        }}
      >
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-zinc-400">
          <div className="flex items-center gap-1.5 font-medium text-emerald-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Missão Comercial • Passo {step.stepNumber} de {COMMERCIAL_MISSION_STEPS.length}</span>
          </div>
          <button
            type="button"
            className="min-h-8 rounded px-2 text-xs text-zinc-400 hover:text-zinc-200 underline"
            onClick={onDismiss}
          >
            Pular missão
          </button>
        </div>

        <h3 className="text-base font-semibold text-zinc-100">{step.title}</h3>
        <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-zinc-300">{step.description}</p>

        {!elementFound && (
          <div className="mt-2.5 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-emerald-400">Dica:</span>
              <span>Acesse a área de {step.contextHint} para ver este recurso em destaque.</span>
            </div>
            {step.pageHint === "/leads-salvos" && (
              <a
                href="/leads-salvos"
                className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium underline"
              >
                Abrir Carteira de Leads Salvos →
              </a>
            )}
            {step.pageHint === "/prospeccao" && (
              <a
                href="/prospeccao"
                className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium underline"
              >
                Abrir Buscar Leads →
              </a>
            )}
            {step.pageHint === "modal" && (
              <p className="text-[10px] text-zinc-500">
                Você pode abrir qualquer lead clicando no botão "Ver Plano" na tabela.
              </p>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/60">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentStep === 1}
            onClick={() => onStepChange(currentStep - 1)}
            className="border-zinc-800 bg-zinc-900 text-zinc-300 text-xs h-9 gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Voltar</span>
          </Button>

          {currentStep < COMMERCIAL_MISSION_STEPS.length ? (
            <Button
              type="button"
              size="sm"
              onClick={() => onStepChange(currentStep + 1)}
              className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs h-9 gap-1"
            >
              <span>Próximo</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={onComplete}
              className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs h-9 gap-1"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Concluir Missão</span>
            </Button>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

export const GUIDE_STEPS = [
  { targets: ["tour-pais", "tour-estado", "tour-cidade"], anchor: "tour-estado", title: "Localização", description: "Primeiro, escolha onde deseja encontrar seus futuros clientes." },
  { targets: ["tour-nicho"], anchor: "tour-nicho", title: "Nicho", description: "Agora informe o tipo de empresa que deseja prospectar. Exemplo: clínicas de estética." },
  { targets: ["tour-quantidade"], anchor: "tour-quantidade", title: "Quantidade de leads", description: "Escolha quantas empresas deseja encontrar nesta busca, respeitando os limites do seu plano." },
  { targets: ["tour-foco"], anchor: "tour-foco", title: "Foco", description: "Selecione o serviço que você deseja oferecer. A Zuno utilizará essa informação para orientar a busca e personalizar suas mensagens comerciais. Isso não altera seu perfil comercial." },
  { targets: ["tour-canais"], anchor: "tour-canais", title: "Canais e configurações", description: "Escolha os canais que deseja utilizar na sua estratégia de prospecção. Você também pode ajustar a busca por proximidade." },
  { targets: ["btn-buscar-leads"], anchor: "btn-buscar-leads", title: "Buscar Leads", description: "Tudo pronto! Agora você pode encontrar suas primeiras oportunidades de negócio. Clique no botão destacado para buscar." },
  { targets: ["leads-table-container"], anchor: "leads-table-container", title: "Resultados", description: "Aqui estão suas oportunidades! Explore os leads encontrados e prepare sua primeira abordagem." },
] as const;

type SearchStatus = "idle" | "searching" | "success" | "zero_leads" | "error";
export interface FirstSearchGuideProps {
  currentStep: number;
  onStepChange: (step: number) => void;
  onDismiss: () => void;
  onComplete: () => void;
  searchResultStatus?: SearchStatus;
  searchResultLeadsCount?: number;
  onViewResults?: () => void;
  onRequestCommercialMission?: () => void;
}

export function FirstSearchGuide({ currentStep, onStepChange, onDismiss, onComplete, searchResultStatus = "idle", searchResultLeadsCount = 0, onViewResults, onRequestCommercialMission }: FirstSearchGuideProps) {
  const success = currentStep === GUIDE_STEPS.length && searchResultStatus === "success" && searchResultLeadsCount > 0;
  const step = GUIDE_STEPS[Math.min(Math.max(currentStep, 1), GUIDE_STEPS.length) - 1];
  const targetIds: readonly string[] = step.targets;
  const popupRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const [targetVersion, setTargetVersion] = useState(0);

  useLayoutEffect(() => {
    const targets = targetIds.map((id) => document.getElementById(id));
    const target = document.getElementById(step.anchor);
    if (!target || targets.some((element) => !element)) {
      setPosition(null);
      const observer = new MutationObserver(() => {
        if (targetIds.every((id) => document.getElementById(id))) {
          observer.disconnect();
          setTargetVersion((value) => value + 1);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      return () => observer.disconnect();
    }
    const highlighted = targets as HTMLElement[];
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
      element.style.boxShadow = "0 0 0 4px rgba(16,185,129,.9), 0 8px 28px rgba(0,0,0,.28)";
      element.style.borderRadius = "10px";
    });
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    const update = () => {
      const rect = target.getBoundingClientRect();
      const bounds = highlighted.map((element) => element.getBoundingClientRect());
      const groupTop = Math.min(...bounds.map((item) => item.top));
      const groupBottom = Math.max(...bounds.map((item) => item.bottom));
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const width = Math.min(320, viewportWidth - 24);
      const height = popupRef.current?.scrollHeight ?? 220;
      const spaceBelow = viewportTop + viewportHeight - groupBottom - 20;
      const spaceAbove = groupTop - viewportTop - 20;
      const placeBelow = spaceBelow >= Math.min(height, 160) || spaceBelow >= spaceAbove;
      const maxHeight = Math.max(80, Math.floor(placeBelow ? spaceBelow : spaceAbove));
      const top = placeBelow ? groupBottom + 12 : groupTop - Math.min(height, maxHeight) - 12;
      setPosition({ top: Math.max(viewportTop + 8, top), left: Math.max(12, Math.min(rect.left, viewportWidth - width - 12)), width, maxHeight });
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
  }, [currentStep, targetVersion, step]);

  useEffect(() => {
    document.body.classList.add("zuno-tour-active");
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onDismiss(); };
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.classList.remove("zuno-tour-active");
      window.removeEventListener("keydown", onEscape);
    };
  }, [onDismiss]);

  const statusMessage = searchResultStatus === "searching" && currentStep === 6 ? "Buscando empresas..."
    : searchResultStatus === "zero_leads" && currentStep === 6 ? "Nenhuma empresa nesta busca. Ajuste o nicho ou a região e tente novamente."
    : searchResultStatus === "error" && currentStep === 6 ? "A busca falhou. Confira a mensagem de erro e tente novamente."
    : success ? `${searchResultLeadsCount} empresa${searchResultLeadsCount === 1 ? "" : "s"} encontrada${searchResultLeadsCount === 1 ? "" : "s"} nesta busca.` : null;

  return createPortal(<>
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 bg-black/45" />
    <div ref={popupRef} role="dialog" aria-modal="false" aria-label="Tutorial da primeira busca"
      className="fixed z-[60] overflow-y-auto rounded-xl border border-emerald-500/40 bg-card p-4 text-card-foreground shadow-2xl"
      style={{ top: position?.top ?? 12, left: position?.left ?? 12, width: position?.width ?? 320, maxHeight: position?.maxHeight ?? 420, visibility: position ? "visible" : "hidden" }}>
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Passo {currentStep} de {GUIDE_STEPS.length}</span>
        <button type="button" className="min-h-10 rounded px-2 underline" onClick={onDismiss}>Pular tutorial</button>
      </div>
      <h3 className="text-base font-semibold">{step.title}</h3>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{step.description}</p>
      {statusMessage && <p role="status" className="mt-3 rounded-md bg-muted p-2 text-sm">{statusMessage}</p>}
      <div className="mt-4 flex justify-between gap-2">
        <Button type="button" variant="outline" className="min-h-11" disabled={currentStep === 1} onClick={() => onStepChange(currentStep - 1)}>Voltar</Button>
        {currentStep < 6 ? <Button type="button" className="min-h-11" onClick={() => onStepChange(currentStep + 1)}>Próximo</Button>
          : currentStep === 6 ? <Button type="button" className="min-h-11" disabled={searchResultStatus !== "success" || searchResultLeadsCount < 1} onClick={() => onStepChange(7)}>Próximo</Button>
          : <Button type="button" className="min-h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold" disabled={!success} onClick={() => {
              if (onRequestCommercialMission) {
                onRequestCommercialMission();
              } else {
                onViewResults?.();
                onComplete();
              }
            }}>
              Iniciar Missão Comercial
            </Button>}
      </div>
    </div>
  </>, document.body);
}

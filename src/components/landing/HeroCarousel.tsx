import { useEffect, useState, useCallback } from "react";
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselApi,
} from "@/components/ui/carousel";

import screenshot01 from "@/assets/screenshots/screenshot-01.png";
import screenshot02 from "@/assets/screenshots/screenshot-02.png";
import screenshot03 from "@/assets/screenshots/screenshot-03.png";
import screenshot04 from "@/assets/screenshots/screenshot-04.png";
import screenshot05 from "@/assets/screenshots/screenshot-05.png";
import screenshot06 from "@/assets/screenshots/screenshot-06.png";
import screenshot07 from "@/assets/screenshots/screenshot-07.png";
import screenshot08 from "@/assets/screenshots/screenshot-08.png";
import screenshot09 from "@/assets/screenshots/screenshot-09.png";
import screenshot10 from "@/assets/screenshots/screenshot-10.png";

const screenshots = [
  { src: screenshot01, alt: "Busca de leads por nicho e cidade", caption: "Busque leads por nicho e localização" },
  { src: screenshot02, alt: "Seleção de foco de serviço", caption: "Escolha o foco do seu serviço" },
  { src: screenshot03, alt: "Configuração de canais de prospecção", caption: "Defina os canais de prospecção" },
  { src: screenshot04, alt: "Leads encontrados com análise", caption: "Leads qualificados com análise IA" },
  { src: screenshot05, alt: "Detalhes do lead com probabilidade", caption: "Probabilidade de conversão por lead" },
  { src: screenshot06, alt: "Plano de prospecção de 7 dias", caption: "Plano de abordagem de 7 dias" },
  { src: screenshot07, alt: "Leads salvos para follow-up", caption: "Organize seus leads salvos" },
  { src: screenshot08, alt: "Pipeline de vendas Kanban", caption: "Pipeline visual estilo Kanban" },
  { src: screenshot09, alt: "Relatórios e métricas avançadas", caption: "Relatórios e métricas detalhadas" },
  { src: screenshot10, alt: "Dashboard de performance", caption: "Dashboard de performance completo" },
];

export function HeroCarousel() {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  const onSelect = useCallback(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
  }, [api]);

  useEffect(() => {
    if (!api) return;
    
    onSelect();
    api.on("select", onSelect);
    
    return () => {
      api.off("select", onSelect);
    };
  }, [api, onSelect]);

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 blur-3xl opacity-30 dark:opacity-50" />
      
      <Carousel
        setApi={setApi}
        opts={{
          loop: true,
          align: "center",
        }}
        plugins={[
          Autoplay({
            delay: 3500,
            stopOnInteraction: false,
            stopOnMouseEnter: true,
          }),
        ]}
        className="relative w-full"
      >
        <CarouselContent>
          {screenshots.map((screenshot, index) => (
            <CarouselItem key={index}>
              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-xl border-2 border-border/50 shadow-2xl dark:shadow-primary/10 bg-card">
                  <img
                    src={screenshot.src}
                    alt={screenshot.alt}
                    className="w-full h-auto object-cover"
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                </div>
                <p className="text-center text-sm font-medium text-muted-foreground">
                  {screenshot.caption}
                </p>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {/* Pagination Dots */}
      <div className="flex justify-center gap-2 mt-4">
        {screenshots.map((_, index) => (
          <button
            key={index}
            onClick={() => api?.scrollTo(index)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              current === index 
                ? "bg-primary w-6" 
                : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
            }`}
            aria-label={`Ir para slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

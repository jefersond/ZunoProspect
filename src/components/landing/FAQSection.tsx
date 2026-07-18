import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FAQ_ITEMS } from "./data";
import { trackMetaCustomEvent } from "@/lib/metaPixel";

export function FAQSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        trackMetaCustomEvent("FAQ_View", {
          page: "landing",
          section: "faq",
        });
        observer.disconnect();
      },
      { threshold: 0.3 },
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="faq" ref={sectionRef} className="py-20 bg-[#0b0f0e] border-b border-[#1f2d29]/40">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4 border-[#1f2d29] text-[#9ca3af] bg-[#111816]/50">Dúvidas frequentes</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-[#f4f4f5]">
            Antes de sair, leia isso
          </h2>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {FAQ_ITEMS.map((item, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-[#111816] rounded-lg px-6 border border-[#1f2d29] text-[#f4f4f5]"
              >
                <AccordionTrigger className="text-left font-semibold hover:no-underline hover:text-[#10d98a] py-4 transition-colors">
                  {item.pergunta}
                </AccordionTrigger>
                <AccordionContent className="text-[#9ca3af] leading-relaxed pb-4">
                  {item.resposta}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}

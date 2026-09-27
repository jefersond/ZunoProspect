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
    <section id="faq" ref={sectionRef} className="py-20 bg-[#07100D] border-b border-[#20312A]/40">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4 border-[#20312A] text-[#A9B8B1] bg-[#0D1713]/50">Dúvidas frequentes</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-[#F3F7F5]">
            Dúvidas antes de começar
          </h2>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {FAQ_ITEMS.map((item, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-[#0D1713] rounded-lg px-6 border border-[#20312A] text-[#F3F7F5]"
              >
                <AccordionTrigger className="text-left font-semibold hover:no-underline hover:text-[#21E6A0] py-4 transition-colors">
                  {item.pergunta}
                </AccordionTrigger>
                <AccordionContent className="text-[#A9B8B1] leading-relaxed pb-4">
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

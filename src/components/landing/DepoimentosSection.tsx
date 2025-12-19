import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { DEPOIMENTOS } from "./data";

const AVATAR_COLORS = [
  "bg-primary",
  "bg-emerald-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-amber-500",
];

export function DepoimentosSection() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth"
    });
  };
  const [currentIndex, setCurrentIndex] = useState(0);
  const itemsPerPage = 3;
  const totalPages = Math.ceil(DEPOIMENTOS.length / itemsPerPage);
  const nextSlide = () => setCurrentIndex(prev => (prev + 1) % totalPages);
  const prevSlide = () => setCurrentIndex(prev => (prev - 1 + totalPages) % totalPages);
  const visibleDepoimentos = DEPOIMENTOS.slice(currentIndex * itemsPerPage, (currentIndex + 1) * itemsPerPage);
  
  return (
    <section id="depoimentos" className="py-20 bg-secondary/20 dark:bg-secondary/10">
      <div className="container mx-auto px-4">
        <div className="relative">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleDepoimentos.map((depoimento, index) => (
              <Card key={depoimento.id} className="p-6 hover:shadow-lg hover:shadow-primary/5 transition-all dark:border-border/50">
                <p className="text-muted-foreground mb-6 italic">"{depoimento.texto}"</p>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold ${AVATAR_COLORS[(depoimento.id - 1) % AVATAR_COLORS.length]}`}>
                    {depoimento.nome.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold">{depoimento.nome}</div>
                    <div className="text-sm text-muted-foreground">
                      {depoimento.cargo} • {depoimento.empresa}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-4 mt-8">
              <Button variant="outline" size="icon" onClick={prevSlide}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === currentIndex ? "bg-primary" : "bg-muted"}`} />
                ))}
              </div>
              <Button variant="outline" size="icon" onClick={nextSlide}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="text-center mt-12">
          <Button size="lg" variant="success" onClick={() => scrollToSection("precos")}>
            Quero começar agora
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
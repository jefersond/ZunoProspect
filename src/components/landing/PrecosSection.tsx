import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2 } from "lucide-react";
import { PLANOS, Plano } from "./data";
import { CheckoutDialog } from "./CheckoutDialog";
import { trackViewContent, trackLead } from "@/lib/metaPixel";

export function PrecosSection() {
  const navigate = useNavigate();
  const [isAnual, setIsAnual] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlano, setSelectedPlano] = useState<Plano | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const hasTrackedView = useRef(false);

  // Track ViewContent when pricing section enters viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasTrackedView.current) {
            hasTrackedView.current = true;
            trackViewContent({
              content_name: 'Pricing Section',
              content_category: 'Pricing',
              content_type: 'product_group'
            });
          }
        });
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleSelectPlano = (plano: Plano) => {
    // Track Lead event when user clicks on any plan
    trackLead({
      content_name: plano.nome,
      content_category: plano.gratuito ? 'Free Plan' : 'Paid Plan',
      value: isAnual ? plano.precoAnual : plano.precoMensal,
      currency: 'BRL'
    });

    if (plano.gratuito) {
      navigate("/auth?tab=signup");
      return;
    }
    setSelectedPlano(plano);
    setCheckoutOpen(true);
  };

  return (
    <section id="precos" ref={sectionRef} className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4">Planos</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Escolha o plano ideal para você
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Comece grátis e escale conforme sua necessidade. Cancele quando quiser.
          </p>

          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm font-medium ${!isAnual ? "text-foreground" : "text-muted-foreground"}`}>
              Mensal
            </span>
            <Switch checked={isAnual} onCheckedChange={setIsAnual} className="data-[state=checked]:bg-primary" />
            <span className={`text-sm font-medium ${isAnual ? "text-foreground" : "text-muted-foreground"}`}>
              Anual
            </span>
            {isAnual && (
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                Economize 17%
              </Badge>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {PLANOS.map((plano, index) => {
            const preco = isAnual ? plano.precoAnual : plano.precoMensal;
            const precoMensal = isAnual ? Math.round(plano.precoAnual / 12) : plano.precoMensal;
            
            return (
              <Card
                key={index}
                className={`relative p-8 flex flex-col ${
                  plano.destaque
                    ? "border-2 border-primary shadow-xl shadow-primary/20 dark:shadow-primary/10 scale-105"
                    : "border border-border/50 dark:border-border/30"
                }`}
              >
                {plano.destaque && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="px-4 py-1 shadow-lg">Mais popular</Badge>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold mb-2">{plano.nome}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{plano.descricao}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    {plano.gratuito ? (
                      <span className="text-4xl font-bold">Grátis</span>
                    ) : (
                      <>
                        <span className="text-4xl font-bold">R$ {precoMensal}</span>
                        <span className="text-muted-foreground">/mês</span>
                      </>
                    )}
                  </div>
                  {isAnual && !plano.gratuito && (
                    <p className="text-xs text-muted-foreground mt-2">
                      cobrado R$ {preco} por ano
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plano.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant="success"
                  onClick={() => handleSelectPlano(plano)}
                >
                  {plano.cta}
                </Button>
              </Card>
            );
          })}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Todos os planos incluem atualizações gratuitas.
        </p>
      </div>

      <CheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} plano={selectedPlano} isAnual={isAnual} />
    </section>
  );
}

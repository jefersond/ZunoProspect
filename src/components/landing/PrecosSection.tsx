import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, Building2, Kanban, BarChart3, Code2, Headphones, Infinity, Globe, MapPin, Sparkles, MessageCircle, Target } from "lucide-react";
import { PLANOS, PLANO_AGENCIA, Plano } from "./data";
import { CheckoutDialog } from "./CheckoutDialog";
import { trackViewContent, trackLead } from "@/lib/metaPixel";

export function PrecosSection() {
  const navigate = useNavigate();
  const [isAnual, setIsAnual] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlano, setSelectedPlano] = useState<Plano | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const hasTrackedView = useRef(false);

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

  const agenciaPrecoMensal = isAnual ? Math.round(PLANO_AGENCIA.precoAnual / 12) : PLANO_AGENCIA.precoMensal;

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

        {/* Grid for Starter, Iniciante, Pro */}
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

        {/* Agência - Card especial embaixo */}
        <div className="max-w-5xl mx-auto mt-12">
          <Card className="relative overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-primary/5">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative p-8 md:p-10">
              <div className="flex flex-col md:flex-row gap-8 md:gap-12">
                {/* Left side - Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <Badge variant="outline" className="border-primary/30 text-primary">
                      Para Agências
                    </Badge>
                  </div>
                  
                  <h3 className="text-2xl md:text-3xl font-bold mb-2">{PLANO_AGENCIA.nome}</h3>
                  <p className="text-muted-foreground mb-6">{PLANO_AGENCIA.descricao}</p>
                  
                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-4xl md:text-5xl font-bold">R$ {agenciaPrecoMensal}</span>
                    <span className="text-muted-foreground">/mês</span>
                  </div>
                  
                  {isAnual && (
                    <p className="text-sm text-muted-foreground mb-6">
                      cobrado R$ {PLANO_AGENCIA.precoAnual} por ano
                    </p>
                  )}
                  
                  <Button
                    size="lg"
                    variant="success"
                    className="w-full md:w-auto px-8"
                    onClick={() => handleSelectPlano(PLANO_AGENCIA)}
                  >
                    {PLANO_AGENCIA.cta}
                  </Button>
                </div>

                {/* Right side - Inclui Pro + Diferenciais */}
                <div className="flex-1 space-y-6">
                  {/* Base do Pro */}
                  <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400">Tudo do plano Pro incluído</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Análise completa, plano de prospecção, CRM, templates e exportação Excel
                    </p>
                  </div>

                  {/* Diferenciais */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                      + Recursos exclusivos
                    </p>
                    <div className="grid gap-3">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <div className="p-2 rounded-md bg-emerald-500/20">
                          <Infinity className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-emerald-600 dark:text-emerald-400">Leads Ilimitados</p>
                          <p className="text-xs text-muted-foreground">Sem limite de buscas por mês</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <div className="p-2 rounded-md bg-emerald-500/20">
                          <Kanban className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-emerald-600 dark:text-emerald-400">Pipeline Kanban</p>
                          <p className="text-xs text-muted-foreground">Gerencie leads com drag-and-drop</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <div className="p-2 rounded-md bg-emerald-500/20">
                          <BarChart3 className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-emerald-600 dark:text-emerald-400">Relatórios Completos</p>
                          <p className="text-xs text-muted-foreground">Dashboards e métricas avançadas</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <div className="p-2 rounded-md bg-emerald-500/20">
                          <Code2 className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-emerald-600 dark:text-emerald-400">Acesso à API</p>
                          <p className="text-xs text-muted-foreground">Integre com seus sistemas</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <div className="p-2 rounded-md bg-emerald-500/20">
                          <Headphones className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-emerald-600 dark:text-emerald-400">Suporte Prioritário</p>
                          <p className="text-xs text-muted-foreground">Canal direto de atendimento</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* USA Addon - Card especial */}
        <div className="max-w-5xl mx-auto mt-12">
          <Card className="relative overflow-hidden border-2 border-blue-500/30 bg-gradient-to-br from-blue-500/5 via-background to-red-500/5">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-red-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative p-8 md:p-10">
              <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-center">
                {/* Left side - Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Globe className="h-6 w-6 text-blue-500" />
                    </div>
                    <Badge variant="outline" className="border-blue-500/30 text-blue-500">
                      Add-on
                    </Badge>
                    <span className="text-2xl">🇺🇸</span>
                  </div>
                  
                  <h3 className="text-2xl md:text-3xl font-bold mb-2">Prospecção nos Estados Unidos</h3>
                  <p className="text-muted-foreground mb-6">
                    Expanda seu alcance para o mercado americano. Prospecte leads em todas as 50 estados dos EUA + DC.
                  </p>
                  
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-3xl md:text-4xl font-bold text-blue-600 dark:text-blue-400">+ R$ 57</span>
                    <span className="text-muted-foreground">/mês</span>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-6">
                    Adicione ao seu plano atual (Iniciante, Pro ou Agência)
                  </p>
                  
                  <Button
                    size="lg"
                    className="w-full md:w-auto px-8 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => {
                      window.open("https://pay.kiwify.com.br/FNkABm6", "_blank");
                    }}
                  >
                    <Globe className="mr-2 h-4 w-4" />
                    Ativar Prospecção USA
                  </Button>
                </div>

                {/* Right side - Benefits */}
                <div className="flex-1 space-y-4">
                  <p className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                    O que está incluído
                  </p>
                  <div className="grid gap-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <div className="p-2 rounded-md bg-blue-500/20">
                        <MapPin className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-blue-600 dark:text-blue-400">Todos os 50 estados + DC</p>
                        <p className="text-xs text-muted-foreground">Miami, New York, Los Angeles, Houston...</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <div className="p-2 rounded-md bg-blue-500/20">
                        <Sparkles className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-blue-600 dark:text-blue-400">Análise detalhada em Português</p>
                        <p className="text-xs text-muted-foreground">Diagnóstico e score de conversão</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <div className="p-2 rounded-md bg-blue-500/20">
                        <MessageCircle className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-blue-600 dark:text-blue-400">Mensagens prontas em Inglês</p>
                        <p className="text-xs text-muted-foreground">Plano de prospecção e CTA em inglês</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <div className="p-2 rounded-md bg-blue-500/20">
                        <Target className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-blue-600 dark:text-blue-400">Mesma IA poderosa</p>
                        <p className="text-xs text-muted-foreground">Sinais digitais, website, Instagram e mais</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

      </div>

      <CheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} plano={selectedPlano} isAnual={isAnual} />
    </section>
  );
}

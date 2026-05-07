import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Building2, Kanban, BarChart3, Code2, Headphones, Globe, MapPin, Sparkles, MessageCircle, Target } from "lucide-react";
import { PLANOS, PLANO_AGENCIA, LEAD_QUANTITIES, LEAD_PRICING_CONFIG, Plano } from "./data";
import { CheckoutDialog } from "./CheckoutDialog";
import { UsaAddonDialog } from "./UsaAddonDialog";
import { trackViewContent, trackLead } from "@/lib/metaPixel";
import { useLeadPricing } from "@/hooks/useLeadPricing";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createStripeCheckout } from "@/services/stripeCheckout";

export function PrecosSection() {
  const navigate = useNavigate();
  const isAnual = false;
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlano, setSelectedPlano] = useState<Plano | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<Record<string, number>>({
    starter: 300,
    pro: 800,
    agencia: 2000,
  });
  const [usaDialogOpen, setUsaDialogOpen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const hasTrackedView = useRef(false);
  const { calculatePrice, getDisplayPrice } = useLeadPricing();

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

  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const handleSelectPlano = async (plano: Plano, leadsQty: number) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    // Se não estiver logado, vai para o cadastro
    if (!session) {
      navigate(`/auth?tab=signup&plan=${encodeURIComponent(plano.planKey)}&leadsQty=${encodeURIComponent(String(leadsQty))}&anual=false`);
      return;
    }

    const preco = calculatePrice(plano.planKey, leadsQty, isAnual);
    if (!plano || !Number.isFinite(preco) || Number.isNaN(preco)) {
      toast.error("Preço inválido para o plano selecionado.");
      return;
    }

    trackLead({
      content_name: `${plano.nome} - ${leadsQty} leads`,
      content_category: 'Paid Plan',
      value: preco,
      currency: 'BRL'
    });

    setIsProcessing(plano.planKey);
    try {
      toast.loading("Gerando link de pagamento seguro...");

      const data = await createStripeCheckout({
        selectedPlan: plano,
        billingCycle: "monthly",
      });

      toast.dismiss();
      
      window.location.href = data.url;
      
    } catch (error: any) {
      toast.dismiss();
      if (error?.status === 401) {
        navigate(`/auth?tab=login&plan=${encodeURIComponent(plano.planKey)}&leadsQty=${encodeURIComponent(String(leadsQty))}&anual=false`);
        return;
      }
      toast.error("Não foi possível iniciar o pagamento", { description: error.message });
    } finally {
      setIsProcessing(null);
    }
  };

  const handleLeadsChange = (planKey: string, value: string) => {
    setSelectedLeads(prev => ({ ...prev, [planKey]: parseInt(value) }));
  };

  // Calculate Agência price
  const agenciaLeads = PLANO_AGENCIA.leadsLimit;
  const agenciaPrecoMensal = getDisplayPrice('agencia', agenciaLeads, isAnual);
  const agenciaPrecoTotal = calculatePrice('agencia', agenciaLeads, isAnual);

  return (
    <section id="precos" ref={sectionRef} className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4">Planos</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Escolha o plano ideal para você
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Escolha o plano e a quantidade de leads que você precisa. Cancele quando quiser.
          </p>

        </div>

        {/* Grid for Iniciante, Pro */}
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {PLANOS.map((plano, index) => {
            const leadsQty = plano.leadsLimit;
            const precoMensal = getDisplayPrice(plano.planKey, leadsQty, isAnual);
            const precoTotal = calculatePrice(plano.planKey, leadsQty, isAnual);
            
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
                  
                  {/* Lead Quantity Selector */}
                  <div className="mb-4">
                    <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm font-medium">
                      {plano.leadsLimit.toLocaleString('pt-BR')} leads/mês + {plano.aiLimit} análises com IA
                    </div>
                  </div>

                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">R$ {precoMensal}</span>
                    <span className="text-muted-foreground">/mês</span>
                  </div>
                  {isAnual && (
                    <p className="text-xs text-muted-foreground mt-2">
                      cobrado R$ {precoTotal.toLocaleString('pt-BR')} por ano
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground text-sm font-medium">{leadsQty.toLocaleString('pt-BR')} leads por mês</span>
                  </li>
                  {plano.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 text-base shadow-lg shadow-emerald-600/20"
                  onClick={() => handleSelectPlano(plano, leadsQty)}
                  disabled={isProcessing === plano.planKey}
                >
                  {isProcessing === plano.planKey ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    plano.cta
                  )}
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
                  
                  {/* Lead Quantity Selector for Agência */}
                  <div className="mb-6">
                    <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm font-medium">
                      {PLANO_AGENCIA.leadsLimit.toLocaleString('pt-BR')} leads/mês + {PLANO_AGENCIA.aiLimit} análises com IA
                    </div>
                  </div>
                  
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl md:text-5xl font-bold">R$ {agenciaPrecoMensal}</span>
                    <span className="text-muted-foreground">/mês</span>
                  </div>
                  
                  {isAnual && (
                    <p className="text-sm text-muted-foreground mb-6">
                      cobrado R$ {agenciaPrecoTotal.toLocaleString('pt-BR')} por ano
                    </p>
                  )}
                  
                  <Button
                    size="lg"
                    className="w-full md:w-auto px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/20 h-14 text-lg"
                    onClick={() => handleSelectPlano(PLANO_AGENCIA, agenciaLeads)}
                    disabled={isProcessing === 'agencia'}
                  >
                    {isProcessing === 'agencia' ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      PLANO_AGENCIA.cta
                    )}
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

        {/* Seção de Complementos Opcionais */}
        <div className="max-w-5xl mx-auto mt-20 pt-12 border-t border-border/50">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-4 border-blue-500/30 text-blue-500">
              Complementos Opcionais
            </Badge>
            <h3 className="text-2xl md:text-3xl font-bold mb-3">
              Expanda suas possibilidades
            </h3>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Adicione recursos extras a qualquer plano pago
            </p>
          </div>

          {/* USA Addon - Card especial */}
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
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-500">
                      Planos Pagos
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
                    Disponível para Iniciante, Pro e Agência
                  </p>
                  
                  <Button
                    size="lg"
                    className="w-full md:w-auto px-8 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => setUsaDialogOpen(true)}
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
                        <p className="text-xs text-muted-foreground">Análise e prospecção inteligente</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <CheckoutDialog 
        open={checkoutOpen} 
        onOpenChange={setCheckoutOpen} 
        plano={selectedPlano} 
        isAnual={isAnual}
        selectedLeads={(selectedPlano as any)?.selectedLeads || 100}
      />
      <UsaAddonDialog open={usaDialogOpen} onOpenChange={setUsaDialogOpen} isAnual={isAnual} />
    </section>
  );
}

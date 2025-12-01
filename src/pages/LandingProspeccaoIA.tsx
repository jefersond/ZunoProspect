import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Search, Zap, Target, MessageSquare, Clock, Users, TrendingUp, CheckCircle2, Play, ArrowRight, Star, Globe, Smartphone, ChevronLeft, ChevronRight, Building2, Megaphone, Palette, Code, LineChart, CreditCard, QrCode, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";

// ============================================
// MOCK DATA - FÁCIL DE EDITAR
// ============================================

const DEPOIMENTOS = [{
  id: 1,
  nome: "Ricardo Mendes",
  cargo: "Gestor de Tráfego",
  empresa: "RM Digital",
  foto: null,
  texto: "Em 2 semanas consegui 15 reuniões com leads qualificados. O plano de prospecção de 7 dias é genial, economizo umas 10h por semana.",
  estrelas: 5
}, {
  id: 2,
  nome: "Camila Santos",
  cargo: "Owner de Agência",
  empresa: "Agência Impulso",
  foto: null,
  texto: "Antes eu passava horas no Google procurando empresas. Agora em minutos tenho uma lista pronta com diagnóstico e até as mensagens de abordagem.",
  estrelas: 5
}, {
  id: 3,
  nome: "Felipe Oliveira",
  cargo: "Freela de Social Media",
  empresa: "Autônomo",
  foto: null,
  texto: "O diferencial é a análise de sinais digitais. Consigo identificar quem realmente precisa dos meus serviços antes de abordar.",
  estrelas: 5
}, {
  id: 4,
  nome: "Juliana Costa",
  cargo: "Especialista em SEO",
  empresa: "SEO Masters",
  foto: null,
  texto: "Finalmente uma ferramenta que entende o mercado de marketing. Os leads vêm com contexto e eu sei exatamente como abordar cada um.",
  estrelas: 5
}, {
  id: 5,
  nome: "Bruno Almeida",
  cargo: "Webdesigner",
  empresa: "Studio Criativo",
  foto: null,
  texto: "Minha taxa de resposta subiu muito depois que comecei a usar os planos de prospecção. As mensagens são personalizadas e não parecem spam.",
  estrelas: 5
}];
const METRICAS = [{
  numero: "+2.300",
  label: "Leads gerados",
  descricao: "por usuários da plataforma"
}, {
  numero: "5x",
  label: "Mais reuniões",
  descricao: "em média comparado à prospecção manual"
}, {
  numero: "10h",
  label: "Economizadas por semana",
  descricao: "em tempo de prospecção"
}, {
  numero: "87%",
  label: "Taxa de satisfação",
  descricao: "dos usuários recomendam"
}];
const LOGOS_CLIENTES = [{
  nome: "Agência Pulso Digital"
}, {
  nome: "Traffic Masters"
}, {
  nome: "Studio Criativo"
}, {
  nome: "SEO Pro Brasil"
}, {
  nome: "Social Hub"
}, {
  nome: "Growth Labs"
}];
const PERFIS_ALVO = [{
  titulo: "Agências Full Service",
  icone: Building2,
  bullets: ["Escale sua operação de prospecção sem contratar mais SDRs", "Tenha um pipeline previsível de novos clientes"]
}, {
  titulo: "Gestores de Tráfego",
  icone: TrendingUp,
  bullets: ["Encontre empresas que ainda não fazem anúncios pagos", "Aborde com diagnóstico pronto sobre a presença digital"]
}, {
  titulo: "Especialistas em SEO",
  icone: LineChart,
  bullets: ["Identifique sites sem otimização básica", "Use dados técnicos na sua abordagem comercial"]
}, {
  titulo: "Social Media",
  icone: Megaphone,
  bullets: ["Prospecte negócios locais que precisam de redes sociais", "Tenha cadências prontas para Instagram e WhatsApp"]
}, {
  titulo: "Webdesigners",
  icone: Palette,
  bullets: ["Encontre empresas com sites desatualizados", "Aborde com proposta de valor clara"]
}, {
  titulo: "Desenvolvedores",
  icone: Code,
  bullets: ["Prospecte PMEs que precisam de soluções digitais", "Identifique oportunidades de sistemas e automações"]
}];
const PLANOS = [{
  nome: "Starter",
  precoMensal: 0,
  precoAnual: 0,
  descricao: "Para testar a plataforma",
  destaque: false,
  features: ["Até 10 leads por mês", "Análise básica de leads", "1 plano de prospecção por lead", "Exportação para Excel"],
  cta: "Começar grátis",
  gratuito: true
}, {
  nome: "Pro",
  precoMensal: 97,
  precoAnual: 970,
  // ~17% desconto
  descricao: "Para freelancers e profissionais",
  destaque: true,
  features: ["Até 100 leads por mês", "Análise completa com IA", "Plano de 7 dias personalizado", "Diagnóstico de sinais digitais", "Exportação ilimitada", "Suporte prioritário"],
  cta: "Assinar Pro",
  gratuito: false
}, {
  nome: "Agência",
  precoMensal: 247,
  precoAnual: 2470,
  // ~17% desconto
  descricao: "Para agências e times",
  destaque: false,
  features: ["Leads ilimitados", "Tudo do plano Pro", "Múltiplos usuários", "API de integração", "Relatórios avançados", "Gerente de sucesso dedicado"],
  cta: "Assinar Agência",
  gratuito: false
}];
const FAQ_ITEMS = [{
  pergunta: "Preciso saber programar para usar?",
  resposta: "Não! A plataforma foi feita para profissionais de marketing, não para devs. Basta informar o nicho, cidade e quantidade de leads que você quer encontrar. Todo o resto é automático."
}, {
  pergunta: "Quantos leads posso gerar por mês?",
  resposta: "Depende do seu plano. No plano gratuito você pode fazer buscas limitadas para testar. Nos planos pagos, você tem acesso a volumes maiores de leads por mês."
}, {
  pergunta: "Posso exportar os leads para Excel ou CRM?",
  resposta: "Sim! Você pode exportar todos os leads encontrados para Excel com um clique. A integração com CRMs está no roadmap."
}, {
  pergunta: "Vocês já mandam mensagem automática no WhatsApp?",
  resposta: "Hoje o app gera o plano de prospecção completo com as mensagens prontas para cada dia. Você copia e envia manualmente. Estamos desenvolvendo um SDR com IA que vai automatizar esse envio no futuro."
}, {
  pergunta: "Os leads são realmente qualificados?",
  resposta: "Sim! Além de encontrar as empresas, analisamos o site, presença em redes sociais e sinais de marketing digital. Você recebe um diagnóstico completo e probabilidade de conversão para cada lead."
}, {
  pergunta: "Funciona para qualquer cidade do Brasil?",
  resposta: "Sim! Usamos o Google Places como base, então qualquer cidade com empresas cadastradas no Google funciona. Quanto maior a cidade, mais resultados."
}, {
  pergunta: "Tem teste grátis?",
  resposta: "Sim! Você pode criar uma conta e fazer suas primeiras buscas gratuitamente para conhecer a plataforma antes de assinar."
}];

// ============================================
// COMPONENTES DA LANDING PAGE
// ============================================

const LPHeader = () => {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth"
    });
  };
  return <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Target className="h-7 w-7 text-primary" />
            <span className="font-bold text-lg">Zuno Propect</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => scrollToSection("como-funciona")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Como funciona
            </button>
            <button onClick={() => scrollToSection("depoimentos")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Depoimentos
            </button>
            <button onClick={() => scrollToSection("para-quem")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Para quem é
            </button>
            <button onClick={() => scrollToSection("precos")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Preços
            </button>
            <button onClick={() => scrollToSection("faq")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              FAQ
            </button>
          </nav>
          
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button asChild>
              <a href="/auth">Começar agora</a>
            </Button>
          </div>
        </div>
      </div>
    </header>;
};
const HeroSection = () => {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth"
    });
  };
  return <section className="relative overflow-hidden bg-gradient-to-br from-background via-primary/5 to-accent/10 dark:from-background dark:via-primary/10 dark:to-accent/5 py-16 md:py-24">
      {/* Decorative elements for dark mode */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl dark:bg-primary/20" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl dark:bg-accent/15" />
      
      <div className="container mx-auto px-4 relative">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Conteúdo */}
          <div className="space-y-8">
            <Badge variant="secondary" className="text-sm px-4 py-2">
              🚀 Feito para agências, gestores de tráfego e freelas de marketing
            </Badge>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
              Encontre clientes{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                prontos para comprar
              </span>{" "}
              seus serviços de marketing
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-lg">
              Prospecte leads qualificados em minutos. A IA analisa empresas, gera diagnósticos e cria planos de abordagem personalizados de 7 dias.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="text-lg px-8 shadow-lg shadow-primary/25" asChild>
                <a href="/auth">
                  Começar agora
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8" onClick={() => scrollToSection("como-funciona")}>
                Ver como funciona
              </Button>
            </div>
            
            <div className="flex items-center gap-6 pt-4">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map(i => <div key={i} className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border-2 border-background flex items-center justify-center">
                    <Users className="h-4 w-4 text-primary" />
                  </div>)}
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">+500 profissionais</span>
                <br />
                já usam a plataforma
              </div>
            </div>
          </div>
          
          {/* Card Mock da Interface */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 blur-3xl opacity-30 dark:opacity-50" />
            <Card className="relative border-2 shadow-2xl dark:border-border/50 dark:shadow-primary/10">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="ml-2 text-sm text-muted-foreground">Prospecção com IA</span>
                </div>
                
                <div className="space-y-3 p-4 bg-secondary/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Buscar leads</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-background rounded border border-border/50 text-sm">🏙️ São Paulo</div>
                    <div className="p-2 bg-background rounded border border-border/50 text-sm">🏢 Restaurantes</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm font-medium">Leads encontrados</div>
                  {["Restaurante Sabor & Arte", "Bistrô da Vila", "Cantina Italiana"].map((nome, i) => <div key={i} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border border-border/30">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-sm font-medium">{nome}</span>
                      </div>
                      <Badge variant={i === 0 ? "default" : "secondary"} className="text-xs">
                        {85 - i * 10}%
                      </Badge>
                    </div>)}
                </div>
                
                <div className="p-3 border border-primary/30 rounded-lg bg-primary/5 dark:bg-primary/10">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary mb-2">
                    <Zap className="h-4 w-4" />
                    Plano de 7 dias gerado!
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Dia 1: WhatsApp • Dia 2: Email • Dia 3: WhatsApp...
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>;
};
const BeneficiosSection = () => {
  const beneficios = [{
    icone: Clock,
    titulo: "Prospecte em minutos",
    descricao: "Encontre dezenas de leads qualificados em poucos cliques, não em horas de pesquisa."
  }, {
    icone: MessageSquare,
    titulo: "Cadências prontas",
    descricao: "Planos de 7 dias com mensagens para WhatsApp, email e Instagram já escritas."
  }, {
    icone: Target,
    titulo: "Diagnóstico com IA",
    descricao: "Cada lead vem com análise de presença digital e probabilidade de conversão."
  }, {
    icone: TrendingUp,
    titulo: "Mais reuniões",
    descricao: "Abordagens personalizadas que geram até 5x mais respostas positivas."
  }];
  return <section className="py-16 bg-secondary/30 dark:bg-secondary/10">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {beneficios.map((beneficio, index) => <div key={index} className="flex items-start gap-4 p-6 bg-background rounded-xl shadow-sm border border-border/50 dark:border-border/30">
              <div className="p-3 rounded-lg bg-primary/10 dark:bg-primary/20">
                <beneficio.icone className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">{beneficio.titulo}</h3>
                <p className="text-sm text-muted-foreground">{beneficio.descricao}</p>
              </div>
            </div>)}
        </div>
      </div>
    </section>;
};
const ComoFuncionaSection = () => {
  const passos = [{
    numero: "01",
    icone: Search,
    titulo: "Defina sua busca",
    descricao: "Informe o nicho, cidade e quantidade de leads que você quer encontrar."
  }, {
    numero: "02",
    icone: Globe,
    titulo: "IA analisa tudo",
    descricao: "O sistema busca empresas, analisa sites, detecta sinais de marketing e enriquece cada lead."
  }, {
    numero: "03",
    icone: Zap,
    titulo: "Receba o plano pronto",
    descricao: "Cada lead vem com diagnóstico completo e plano de prospecção de 7 dias personalizado."
  }];
  return <section id="como-funciona" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4">Como funciona</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            3 passos para ter leads qualificados
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Simples, rápido e sem complicação. Você foca em fechar negócios, a IA faz o trabalho pesado.
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {passos.map((passo, index) => <div key={index} className="relative">
              {index < 2 && <div className="hidden md:block absolute top-12 left-full w-full h-0.5 bg-gradient-to-r from-primary/50 to-transparent -translate-x-1/2" />}
              <Card className="text-center p-8 hover:shadow-lg hover:shadow-primary/5 transition-all dark:border-border/50">
                <div className="text-5xl font-bold text-primary/20 dark:text-primary/30 mb-4">{passo.numero}</div>
                <div className="w-16 h-16 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center mx-auto mb-6">
                  <passo.icone className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{passo.titulo}</h3>
                <p className="text-muted-foreground">{passo.descricao}</p>
              </Card>
            </div>)}
        </div>
      </div>
    </section>;
};
const DepoimentosSection = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const itemsPerPage = 3;
  const totalPages = Math.ceil(DEPOIMENTOS.length / itemsPerPage);
  const nextSlide = () => {
    setCurrentIndex(prev => (prev + 1) % totalPages);
  };
  const prevSlide = () => {
    setCurrentIndex(prev => (prev - 1 + totalPages) % totalPages);
  };
  const visibleDepoimentos = DEPOIMENTOS.slice(currentIndex * itemsPerPage, (currentIndex + 1) * itemsPerPage);
  return <section id="depoimentos" className="py-20 bg-secondary/20 dark:bg-secondary/10">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4">Depoimentos</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            O que outros profissionais de marketing estão dizendo
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Veja como a plataforma está ajudando agências e freelas a conseguir mais clientes.
          </p>
        </div>
        
        <div className="relative">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleDepoimentos.map(depoimento => <Card key={depoimento.id} className="p-6 hover:shadow-lg hover:shadow-primary/5 transition-all dark:border-border/50">
                <div className="flex items-center gap-1 mb-4">
                  {Array.from({
                length: depoimento.estrelas
              }).map((_, i) => <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-muted-foreground mb-6 italic">"{depoimento.texto}"</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                    <span className="text-lg font-bold text-primary">
                      {depoimento.nome.split(" ").map(n => n[0]).join("")}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold">{depoimento.nome}</div>
                    <div className="text-sm text-muted-foreground">
                      {depoimento.cargo} • {depoimento.empresa}
                    </div>
                  </div>
                </div>
              </Card>)}
          </div>
          
          {totalPages > 1 && <div className="flex justify-center gap-4 mt-8">
              <Button variant="outline" size="icon" onClick={prevSlide}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                {Array.from({
              length: totalPages
            }).map((_, i) => <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === currentIndex ? "bg-primary" : "bg-muted"}`} />)}
              </div>
              <Button variant="outline" size="icon" onClick={nextSlide}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>}
        </div>
      </div>
    </section>;
};
const MetricasSection = () => {
  return <section className="py-20 bg-gradient-to-br from-primary to-primary/80">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {METRICAS.map((metrica, index) => <div key={index} className="text-center text-primary-foreground">
              <div className="text-5xl md:text-6xl font-bold mb-2">{metrica.numero}</div>
              <div className="text-xl font-semibold mb-1">{metrica.label}</div>
              <div className="text-primary-foreground/70 text-sm">{metrica.descricao}</div>
            </div>)}
        </div>
      </div>
    </section>;
};
const LogosSection = () => {
  return <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <p className="text-muted-foreground">
            Profissionais e agências que confiam na plataforma
          </p>
        </div>
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
          {LOGOS_CLIENTES.map((cliente, index) => <div key={index} className="px-6 py-3 bg-secondary/50 rounded-lg text-muted-foreground font-medium hover:bg-secondary transition-colors">
              {cliente.nome}
            </div>)}
        </div>
      </div>
    </section>;
};
const VideoCaseSection = () => {
  return <section className="py-20 bg-secondary/20 dark:bg-secondary/10">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Video Placeholder */}
          
          
          {/* Case Content */}
          <div className="space-y-6">
            <Badge variant="secondary">Case de Sucesso</Badge>
            <h2 className="text-3xl md:text-4xl font-bold">
              Como a Agência Impulso aumentou em 40% suas reuniões
            </h2>
            <p className="text-lg text-muted-foreground">
              A Agência Impulso estava gastando 15 horas por semana prospectando manualmente. Com a plataforma, reduziram para 3 horas e aumentaram o número de reuniões agendadas.
            </p>
            <ul className="space-y-3">
              {["De 5 para 12 reuniões por semana", "80% de redução no tempo de prospecção", "ROI positivo já no primeiro mês"].map((item, index) => <li key={index} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                  <span>{item}</span>
                </li>)}
            </ul>
          </div>
        </div>
      </div>
    </section>;
};
const ParaQuemSection = () => {
  return <section id="para-quem" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4">Para quem é</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Feito para quem vende serviços de marketing
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Se você precisa de mais clientes para sua agência ou trabalho freelancer, essa ferramenta é para você.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PERFIS_ALVO.map((perfil, index) => <Card key={index} className="p-6 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/50 transition-all dark:border-border/50">
              <div className="w-12 h-12 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center mb-4">
                <perfil.icone className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-4">{perfil.titulo}</h3>
              <ul className="space-y-3">
                {perfil.bullets.map((bullet, i) => <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{bullet}</span>
                  </li>)}
              </ul>
            </Card>)}
        </div>
      </div>
    </section>;
};

// ============================================
// CHECKOUT DIALOG
// ============================================

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plano: typeof PLANOS[0] | null;
  isAnual: boolean;
}
const CheckoutDialog = ({
  open,
  onOpenChange,
  plano,
  isAnual
}: CheckoutDialogProps) => {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [metodoPagamento, setMetodoPagamento] = useState<"pix" | "cartao">("pix");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  if (!plano) return null;
  const preco = isAnual ? plano.precoAnual : plano.precoMensal;
  const periodo = isAnual ? "/ano" : "/mês";
  const economia = isAnual ? Math.round((plano.precoMensal * 12 - plano.precoAnual) / (plano.precoMensal * 12) * 100) : 0;
  const formatCPF = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 11);
    return cleaned.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };
  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 16);
    return cleaned.replace(/(\d{4})/g, "$1 ").trim();
  };
  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 4);
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + "/" + cleaned.slice(2);
    }
    return cleaned;
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !email || !cpf) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (metodoPagamento === "cartao" && (!cardNumber || !cardExpiry || !cardCvv)) {
      toast.error("Preencha todos os dados do cartão");
      return;
    }
    setIsProcessing(true);

    // Simular processamento
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsProcessing(false);
    onOpenChange(false);
    toast.success(metodoPagamento === "pix" ? "QR Code PIX gerado! Verifique seu email." : "Pagamento processado com sucesso!");
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Checkout - Plano {plano.nome}
          </DialogTitle>
          <DialogDescription>
            {plano.gratuito ? "Crie sua conta gratuita" : `R$ ${preco}${periodo}${isAnual && economia > 0 ? ` (${economia}% de desconto)` : ""}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Dados pessoais */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Dados pessoais</h4>
            
            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo *</Label>
              <Input id="nome" placeholder="Seu nome completo" value={nome} onChange={e => setNome(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf">CPF *</Label>
              <Input id="cpf" placeholder="000.000.000-00" value={cpf} onChange={e => setCpf(formatCPF(e.target.value))} required />
            </div>
          </div>

          {/* Método de pagamento (apenas se não for gratuito) */}
          {!plano.gratuito && <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Forma de pagamento</h4>
              
              <RadioGroup value={metodoPagamento} onValueChange={value => setMetodoPagamento(value as "pix" | "cartao")} className="grid grid-cols-2 gap-4">
                <div>
                  <RadioGroupItem value="pix" id="pix" className="peer sr-only" />
                  <Label htmlFor="pix" className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                    <QrCode className="h-6 w-6" />
                    <span className="font-medium">PIX</span>
                    <span className="text-xs text-muted-foreground">Aprovação imediata</span>
                  </Label>
                </div>
                
                <div>
                  <RadioGroupItem value="cartao" id="cartao" className="peer sr-only" />
                  <Label htmlFor="cartao" className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                    <CreditCard className="h-6 w-6" />
                    <span className="font-medium">Cartão</span>
                    <span className="text-xs text-muted-foreground">Crédito ou débito</span>
                  </Label>
                </div>
              </RadioGroup>

              {/* Campos do cartão */}
              {metodoPagamento === "cartao" && <div className="space-y-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="cardNumber">Número do cartão</Label>
                    <Input id="cardNumber" placeholder="0000 0000 0000 0000" value={cardNumber} onChange={e => setCardNumber(formatCardNumber(e.target.value))} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cardExpiry">Validade</Label>
                      <Input id="cardExpiry" placeholder="MM/AA" value={cardExpiry} onChange={e => setCardExpiry(formatExpiry(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cardCvv">CVV</Label>
                      <Input id="cardCvv" placeholder="123" maxLength={4} value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} />
                    </div>
                  </div>
                </div>}

              {/* Info PIX */}
              {metodoPagamento === "pix" && <div className="p-4 bg-secondary/50 rounded-lg border border-border/50">
                  <p className="text-sm text-muted-foreground">
                    Após confirmar, você receberá um QR Code PIX para pagamento. A aprovação é instantânea.
                  </p>
                </div>}
            </div>}

          {/* Resumo */}
          <div className="p-4 bg-secondary/30 rounded-lg border border-border/50">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total</span>
              <span className="text-2xl font-bold">
                {plano.gratuito ? "Grátis" : `R$ ${preco}`}
              </span>
            </div>
            {isAnual && !plano.gratuito && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                Você economiza R$ {plano.precoMensal * 12 - plano.precoAnual} por ano!
              </p>}
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={isProcessing}>
            {isProcessing ? "Processando..." : plano.gratuito ? "Criar conta gratuita" : metodoPagamento === "pix" ? "Gerar QR Code PIX" : "Finalizar pagamento"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>;
};
const PrecosSection = () => {
  const [isAnual, setIsAnual] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlano, setSelectedPlano] = useState<typeof PLANOS[0] | null>(null);
  const handleSelectPlano = (plano: typeof PLANOS[0]) => {
    setSelectedPlano(plano);
    setCheckoutOpen(true);
  };
  return <section id="precos" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4">Planos</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Escolha o plano ideal para você
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Comece grátis e escale conforme sua necessidade. Cancele quando quiser.
          </p>

          {/* Toggle Mensal/Anual */}
          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm font-medium ${!isAnual ? "text-foreground" : "text-muted-foreground"}`}>
              Mensal
            </span>
            <Switch checked={isAnual} onCheckedChange={setIsAnual} className="data-[state=checked]:bg-primary" />
            <span className={`text-sm font-medium ${isAnual ? "text-foreground" : "text-muted-foreground"}`}>
              Anual
            </span>
            {isAnual && <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                Economize 17%
              </Badge>}
          </div>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {PLANOS.map((plano, index) => {
          const preco = isAnual ? plano.precoAnual : plano.precoMensal;
          const precoMensal = isAnual ? Math.round(plano.precoAnual / 12) : plano.precoMensal;
          return <Card key={index} className={`relative p-8 flex flex-col ${plano.destaque ? "border-2 border-primary shadow-xl shadow-primary/20 dark:shadow-primary/10 scale-105" : "border border-border/50 dark:border-border/30"}`}>
                {plano.destaque && <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="px-4 py-1 shadow-lg">Mais popular</Badge>
                  </div>}
                
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold mb-2">{plano.nome}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{plano.descricao}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    {plano.gratuito ? <span className="text-4xl font-bold">Grátis</span> : <>
                        <span className="text-4xl font-bold">R$ {precoMensal}</span>
                        <span className="text-muted-foreground">/mês</span>
                      </>}
                  </div>
                  {isAnual && !plano.gratuito && <p className="text-xs text-muted-foreground mt-2">
                      cobrado R$ {preco} por ano
                    </p>}
                </div>
                
                <ul className="space-y-3 mb-8 flex-1">
                  {plano.features.map((feature, i) => <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground text-sm">{feature}</span>
                    </li>)}
                </ul>
                
                <Button className="w-full" variant={plano.destaque ? "default" : "outline"} onClick={() => handleSelectPlano(plano)}>
                  {plano.cta}
                </Button>
              </Card>;
        })}
        </div>
        
        <p className="text-center text-sm text-muted-foreground mt-8">
          Todos os planos incluem atualizações gratuitas e acesso às novas funcionalidades.
        </p>
      </div>

      <CheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} plano={selectedPlano} isAnual={isAnual} />
    </section>;
};
const FAQSection = () => {
  return <section id="faq" className="py-20 bg-secondary/20 dark:bg-secondary/10">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4">Dúvidas frequentes</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Perguntas frequentes
          </h2>
        </div>
        
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {FAQ_ITEMS.map((item, index) => <AccordionItem key={index} value={`item-${index}`} className="bg-background rounded-lg px-6 border border-border/50 dark:border-border/30">
                <AccordionTrigger className="text-left font-semibold hover:no-underline">
                  {item.pergunta}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {item.resposta}
                </AccordionContent>
              </AccordionItem>)}
          </Accordion>
        </div>
      </div>
    </section>;
};
const CTAFinalSection = () => {
  return <section className="py-20 bg-gradient-to-br from-primary via-primary to-accent">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-6">
          Pare de ficar horas caçando clientes manualmente
        </h2>
        <p className="text-xl text-primary-foreground/80 max-w-2xl mx-auto mb-10">
          Comece agora a prospectar com IA e tenha leads qualificados com planos de abordagem prontos em minutos.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" variant="secondary" className="text-lg px-8 shadow-lg" asChild>
            <a href="/auth">
              Começar agora
              <ArrowRight className="ml-2 h-5 w-5" />
            </a>
          </Button>
          <Button size="lg" variant="outline" className="text-lg px-8 bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" asChild>
            <a href="https://wa.me/5500000000000" target="_blank" rel="noopener noreferrer">
              <Smartphone className="mr-2 h-5 w-5" />
              Falar com suporte
            </a>
          </Button>
        </div>
      </div>
    </section>;
};
const Footer = () => {
  return <footer className="py-8 bg-background border-t">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            <span className="font-bold">Zuno Propect</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2024 Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>;
};

// ============================================
// PÁGINA PRINCIPAL
// ============================================

export default function LandingProspeccaoIA() {
  return <div className="min-h-screen bg-background">
      <LPHeader />
      <HeroSection />
      <BeneficiosSection />
      <ComoFuncionaSection />
      <DepoimentosSection />
      <MetricasSection />
      <LogosSection />
      
      <ParaQuemSection />
      <PrecosSection />
      <FAQSection />
      <CTAFinalSection />
      <Footer />
    </div>;
}
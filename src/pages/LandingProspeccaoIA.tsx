import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Search, Zap, Target, MessageSquare, Clock, Users, TrendingUp, CheckCircle2, Play, ArrowRight, Star, Globe, Smartphone, ChevronLeft, ChevronRight, Building2, Megaphone, Palette, Code, LineChart, CreditCard, QrCode, X, Copy, Loader2, RefreshCw, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

// Avatar imports
import avatar1 from "@/assets/avatars/avatar-1.jpg";
import avatar2 from "@/assets/avatars/avatar-2.jpg";
import avatar3 from "@/assets/avatars/avatar-3.jpg";
import avatar4 from "@/assets/avatars/avatar-4.jpg";
import avatar5 from "@/assets/avatars/avatar-5.jpg";
import avatar6 from "@/assets/avatars/avatar-6.jpg";

// Depoimentos avatars
import depoRicardo from "@/assets/avatars/depo-ricardo.jpg";
import depoCamila from "@/assets/avatars/depo-camila.jpg";
import depoFelipe from "@/assets/avatars/depo-felipe.jpg";
import depoJuliana from "@/assets/avatars/depo-juliana.jpg";
import depoBruno from "@/assets/avatars/depo-bruno.jpg";
const HERO_AVATARS = [avatar1, avatar2, avatar3, avatar4, avatar5, avatar6];
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";

// ============================================
// MOCK DATA - FÁCIL DE EDITAR
// ============================================

const DEPOIMENTOS = [{
  id: 1,
  nome: "Ricardo Mendes",
  cargo: "Gestor de Tráfego",
  empresa: "RM Digital",
  foto: depoRicardo,
  texto: "Em 2 semanas consegui 15 reuniões com leads qualificados. O plano de prospecção de 7 dias é genial, economizo umas 10h por semana.",
  estrelas: 5
}, {
  id: 2,
  nome: "Camila Santos",
  cargo: "Owner de Agência",
  empresa: "Agência Impulso",
  foto: depoCamila,
  texto: "Antes eu passava horas no Google procurando empresas. Agora em minutos tenho uma lista pronta com diagnóstico e até as mensagens de abordagem.",
  estrelas: 5
}, {
  id: 3,
  nome: "Felipe Oliveira",
  cargo: "Freela de Social Media",
  empresa: "Autônomo",
  foto: depoFelipe,
  texto: "O diferencial é a análise de sinais digitais. Consigo identificar quem realmente precisa dos meus serviços antes de abordar.",
  estrelas: 5
}, {
  id: 4,
  nome: "Juliana Costa",
  cargo: "Especialista em SEO",
  empresa: "SEO Masters",
  foto: depoJuliana,
  texto: "Finalmente uma ferramenta que entende o mercado de marketing. Os leads vêm com contexto e eu sei exatamente como abordar cada um.",
  estrelas: 5
}, {
  id: 5,
  nome: "Bruno Almeida",
  cargo: "Webdesigner",
  empresa: "Studio Criativo",
  foto: depoBruno,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth"
    });
    setMobileMenuOpen(false);
  };
  
  return <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <Logo className="[&_svg]:w-6 [&_svg]:h-6 sm:[&_svg]:w-8 sm:[&_svg]:h-8 [&_span:first-of-type]:text-base sm:[&_span:first-of-type]:text-xl [&_span:last-of-type]:text-base sm:[&_span:last-of-type]:text-xl" />
          
          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6">
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
          
          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild>
              <a href="/auth?tab=login">Entrar</a>
            </Button>
            <Button size="sm" onClick={() => scrollToSection("precos")}>
              Começar
            </Button>
          </div>
          
          {/* Mobile Actions */}
          <div className="flex lg:hidden items-center gap-2">
            <ThemeToggle />
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="px-2">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[320px]">
                <nav className="flex flex-col gap-4 mt-8">
                  <button 
                    onClick={() => scrollToSection("como-funciona")} 
                    className="text-left py-3 px-4 rounded-lg hover:bg-secondary transition-colors"
                  >
                    Como funciona
                  </button>
                  <button 
                    onClick={() => scrollToSection("depoimentos")} 
                    className="text-left py-3 px-4 rounded-lg hover:bg-secondary transition-colors"
                  >
                    Depoimentos
                  </button>
                  <button 
                    onClick={() => scrollToSection("para-quem")} 
                    className="text-left py-3 px-4 rounded-lg hover:bg-secondary transition-colors"
                  >
                    Para quem é
                  </button>
                  <button 
                    onClick={() => scrollToSection("precos")} 
                    className="text-left py-3 px-4 rounded-lg hover:bg-secondary transition-colors"
                  >
                    Preços
                  </button>
                  <button 
                    onClick={() => scrollToSection("faq")} 
                    className="text-left py-3 px-4 rounded-lg hover:bg-secondary transition-colors"
                  >
                    FAQ
                  </button>
                  
                  <div className="border-t pt-4 mt-2 space-y-3">
                    <Button variant="outline" className="w-full" asChild>
                      <a href="/auth?tab=login">Entrar</a>
                    </Button>
                    <Button className="w-full" onClick={() => scrollToSection("precos")}>
                      Começar agora
                    </Button>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
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
  return <section className="relative overflow-hidden bg-gradient-to-br from-background via-primary/5 to-accent/10 dark:from-background dark:via-primary/10 dark:to-accent/5 pt-24 pb-16 md:py-24">
      {/* Decorative elements for dark mode */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl dark:bg-primary/20" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl dark:bg-accent/15" />
      
      <div className="container mx-auto px-4 relative">
        <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Conteúdo */}
          <div className="space-y-6 md:space-y-8">
            <Badge variant="secondary" className="text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2">
              🚀 Feito para agências, gestores de tráfego e freelas de marketing
            </Badge>
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
              Encontre clientes{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                prontos para comprar
              </span>{" "}
              seus serviços de marketing
            </h1>
            
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-lg">
              Prospecte leads qualificados em minutos. A IA analisa empresas, gera diagnósticos e cria planos de abordagem personalizados de 7 dias.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Button size="lg" className="text-base sm:text-lg px-6 sm:px-8 shadow-lg shadow-primary/25" onClick={() => scrollToSection("precos")}>
                Começar agora
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-base sm:text-lg px-6 sm:px-8" onClick={() => scrollToSection("como-funciona")}>
                Ver como funciona
              </Button>
            </div>
            
            <div className="flex items-center gap-4 sm:gap-6 pt-2 sm:pt-4">
              <div className="flex -space-x-2">
                {HERO_AVATARS.map((avatar, i) => <img key={i} src={avatar} alt={`Usuário ${i + 1}`} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-background object-cover" />)}
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary border-2 border-background flex items-center justify-center">
                  <span className="text-[10px] sm:text-xs font-bold text-primary-foreground">+500</span>
                </div>
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">+500 profissionais</span>
                <br />
                já usam a plataforma
              </div>
            </div>
          </div>
          
          {/* Card Mock da Interface - esconde em mobile */}
          <div className="relative hidden lg:block">
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
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth"
    });
  };
  
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
        <div className="text-center mt-10">
          <Button size="lg" onClick={() => scrollToSection("precos")} className="shadow-lg">
            Ver planos disponíveis
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>;
};
const ComoFuncionaSection = () => {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth"
    });
  };
  
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
          {passos.map((passo, index) => <div key={index} className="relative h-full">
              {index < 2}
              <Card className="text-center p-8 h-full hover:shadow-lg hover:shadow-primary/5 transition-all dark:border-border/50">
                <div className="text-5xl font-bold text-primary/20 dark:text-primary/30 mb-4">{passo.numero}</div>
                <div className="w-16 h-16 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center mx-auto mb-6">
                  <passo.icone className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{passo.titulo}</h3>
                <p className="text-muted-foreground">{passo.descricao}</p>
              </Card>
            </div>)}
        </div>
        
        <div className="text-center mt-12">
          <Button size="lg" variant="outline" onClick={() => scrollToSection("precos")}>
            Escolher meu plano
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>;
};
const DepoimentosSection = () => {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth"
    });
  };
  
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
                  <img src={depoimento.foto} alt={depoimento.nome} loading="lazy" className="w-12 h-12 rounded-full object-cover" />
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
        
        <div className="text-center mt-12">
          <Button size="lg" onClick={() => scrollToSection("precos")}>
            Quero começar agora
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>;
};
const MetricasSection = () => {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth"
    });
  };
  
  return <section className="py-20 bg-gradient-to-br from-primary to-primary/80">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          {METRICAS.map((metrica, index) => <div key={index} className="text-center text-primary-foreground">
              <div className="text-5xl md:text-6xl font-bold mb-2">{metrica.numero}</div>
              <div className="text-xl font-semibold mb-1">{metrica.label}</div>
              <div className="text-primary-foreground/70 text-sm">{metrica.descricao}</div>
            </div>)}
        </div>
        <div className="text-center">
          <Button size="lg" variant="secondary" onClick={() => scrollToSection("precos")} className="shadow-lg">
            Assinar agora
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
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
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth"
    });
  };
  
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
        
        <div className="text-center mt-12">
          <Button size="lg" variant="outline" onClick={() => scrollToSection("precos")}>
            Ver preços e planos
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
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
  const [step, setStep] = useState<"form" | "qrcode" | "confirmed">("form");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [metodoPagamento, setMetodoPagamento] = useState<"pix" | "cartao">("pix");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [pixData, setPixData] = useState<{
    paymentId: string;
    pixCopiaECola: string;
    qrCodeBase64: string;
    vencimento: string;
  } | null>(null);

  // Poll para verificar pagamento PIX
  useEffect(() => {
    if (step !== "qrcode" || !pixData?.paymentId) return;
    const interval = setInterval(async () => {
      try {
        const {
          data,
          error
        } = await supabase.functions.invoke("check-pix-payment", {
          body: {
            paymentId: pixData.paymentId
          }
        });
        if (error) {
          console.error("Error checking payment:", error);
          return;
        }
        if (data?.confirmed) {
          setStep("confirmed");
          clearInterval(interval);
          toast.success("Pagamento confirmado!");
          setTimeout(() => {
            handleClose();
          }, 2000);
        }
      } catch (err) {
        console.error("Error in payment check:", err);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [step, pixData?.paymentId]);
  if (!plano) return null;
  const preco = isAnual ? plano.precoAnual : plano.precoMensal;
  const periodo = isAnual ? "/ano" : "/mês";
  const economia = isAnual ? Math.round((plano.precoMensal * 12 - plano.precoAnual) / (plano.precoMensal * 12) * 100) : 0;
  const formatCPF = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 11);
    return cleaned.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };
  const formatWhatsapp = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").replace(/(-\d{4})\d+?$/, "$1");
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
  const handleGeneratePix = async () => {
    if (!nome.trim()) {
      toast.error("Informe seu nome completo");
      return;
    }
    if (!email.trim()) {
      toast.error("Informe seu email");
      return;
    }
    if (!cpf || cpf.replace(/\D/g, "").length < 11) {
      toast.error("Informe um CPF válido");
      return;
    }
    if (!whatsapp || whatsapp.replace(/\D/g, "").length < 10) {
      toast.error("Informe um WhatsApp válido");
      return;
    }
    setIsProcessing(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("create-pix-asaas", {
        body: {
          plano: plano.nome,
          isAnual,
          customerName: nome,
          customerCpf: cpf,
          customerEmail: email,
          customerWhatsapp: whatsapp
        }
      });
      if (error) throw error;
      if (data?.success) {
        setPixData({
          paymentId: data.paymentId,
          pixCopiaECola: data.pixCopiaECola,
          qrCodeBase64: data.qrCodeBase64,
          vencimento: data.vencimento
        });
        setStep("qrcode");
        toast.success("QR Code PIX gerado com sucesso!");
      } else {
        throw new Error(data?.error || "Erro ao gerar PIX");
      }
    } catch (error: any) {
      console.error("Error generating PIX:", error);
      toast.error("Erro ao gerar PIX", {
        description: error.message || "Tente novamente mais tarde."
      });
    } finally {
      setIsProcessing(false);
    }
  };
  const handleCopyPix = () => {
    if (pixData?.pixCopiaECola) {
      navigator.clipboard.writeText(pixData.pixCopiaECola);
      toast.success("Código PIX copiado!");
    }
  };
  const handleCheckPayment = async () => {
    if (!pixData?.paymentId) return;
    setIsChecking(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("check-pix-payment", {
        body: {
          paymentId: pixData.paymentId
        }
      });
      if (error) throw error;
      if (data?.confirmed) {
        setStep("confirmed");
        toast.success("Pagamento confirmado!");
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else {
        toast.info("Pagamento ainda não confirmado", {
          description: "Aguarde alguns segundos após efetuar o pagamento."
        });
      }
    } catch (error: any) {
      toast.error("Erro ao verificar pagamento");
    } finally {
      setIsChecking(false);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !email || !cpf) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (metodoPagamento === "pix") {
      await handleGeneratePix();
      return;
    }
    if (metodoPagamento === "cartao" && (!cardNumber || !cardExpiry || !cardCvv)) {
      toast.error("Preencha todos os dados do cartão");
      return;
    }
    setIsProcessing(true);

    // Simular processamento cartão
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsProcessing(false);
    handleClose();
    toast.success("Pagamento processado com sucesso!");
  };
  const handleClose = () => {
    if (!isProcessing) {
      setStep("form");
      setPixData(null);
      setNome("");
      setEmail("");
      setCpf("");
      setWhatsapp("");
      setCardNumber("");
      setCardExpiry("");
      setCardCvv("");
      onOpenChange(false);
    }
  };
  return <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "confirmed" ? <>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Pagamento Confirmado
              </> : step === "qrcode" ? <>
                <QrCode className="h-5 w-5 text-primary" />
                Pagamento via PIX
              </> : <>Checkout - Plano {plano.nome}</>}
          </DialogTitle>
          <DialogDescription>
            {step === "confirmed" && "Sua assinatura foi ativada com sucesso!"}
            {step === "qrcode" && "Escaneie o QR Code ou copie o código para pagar."}
            {step === "form" && (plano.gratuito ? "Crie sua conta gratuita" : `R$ ${preco}${periodo}${isAnual && economia > 0 ? ` (${economia}% de desconto)` : ""}`)}
          </DialogDescription>
        </DialogHeader>

        {step === "confirmed" && <div className="py-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-emerald-500">Pagamento Confirmado!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Sua assinatura foi ativada com sucesso.
              </p>
            </div>
          </div>}

        {step === "qrcode" && pixData && <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-lg">
                <img src={`data:image/png;base64,${pixData.qrCodeBase64}`} alt="QR Code PIX" className="w-48 h-48" />
              </div>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">R$ {preco.toLocaleString("pt-BR")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Vencimento: {new Date(pixData.vencimento).toLocaleDateString("pt-BR")}
              </p>
            </div>

            <div className="space-y-2">
              <Label>PIX Copia e Cola</Label>
              <div className="flex gap-2">
                <Input value={pixData.pixCopiaECola} readOnly className="text-xs" />
                <Button variant="outline" size="icon" onClick={handleCopyPix}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={handleCheckPayment} disabled={isChecking}>
              {isChecking ? <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verificando...
                </> : <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Verificar Pagamento
                </>}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              O pagamento será verificado automaticamente a cada 5 segundos.
            </p>
          </div>}

        {step === "form" && <form onSubmit={handleSubmit} className="space-y-6 mt-4">
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

              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp *</Label>
                <Input id="whatsapp" placeholder="(11) 99999-9999" value={whatsapp} onChange={e => setWhatsapp(formatWhatsapp(e.target.value))} maxLength={15} required />
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
                      O QR Code PIX será exibido na tela para pagamento imediato.
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
              {isProcessing ? <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </> : plano.gratuito ? "Criar conta gratuita" : metodoPagamento === "pix" ? "Gerar QR Code PIX" : "Finalizar pagamento"}
            </Button>
          </form>}
      </DialogContent>
    </Dialog>;
};
const PrecosSection = () => {
  const navigate = useNavigate();
  const [isAnual, setIsAnual] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlano, setSelectedPlano] = useState<typeof PLANOS[0] | null>(null);
  const handleSelectPlano = (plano: typeof PLANOS[0]) => {
    if (plano.gratuito) {
      navigate("/auth?tab=signup");
      return;
    }
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
        
        <p className="text-center text-sm text-muted-foreground mt-8">Todos os planos incluem atualizações gratuitas.</p>
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
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth"
    });
  };
  
  return <section className="py-12 sm:py-16 md:py-20 bg-gradient-to-br from-primary to-primary/80">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-4 sm:mb-6 text-center">
          Pare de ficar horas caçando clientes manualmente
        </h2>
        <p className="text-base sm:text-lg md:text-xl text-primary-foreground/80 max-w-2xl mx-auto mb-6 sm:mb-8 md:mb-10 text-center">
          Comece agora a prospectar com IA e tenha leads qualificados com planos de abordagem prontos em minutos.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center max-w-md sm:max-w-none mx-auto">
          <Button size="lg" variant="secondary" className="text-base sm:text-lg px-6 sm:px-8 shadow-lg w-full sm:w-auto" onClick={() => scrollToSection("precos")}>
            Começar agora
            <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <Button size="lg" variant="outline" className="text-base sm:text-lg px-6 sm:px-8 bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 w-full sm:w-auto" asChild>
            <a href="https://wa.me/5500000000000" target="_blank" rel="noopener noreferrer">
              <Smartphone className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              Falar com suporte
            </a>
          </Button>
        </div>
      </div>
    </section>;
};
const Footer = () => {
  return <footer className="py-6 sm:py-8 bg-background border-t">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4">
          <Logo className="[&_svg]:w-5 [&_svg]:h-5 sm:[&_svg]:w-6 sm:[&_svg]:h-6 [&_span:first-of-type]:text-base sm:[&_span:first-of-type]:text-lg [&_span:last-of-type]:text-base sm:[&_span:last-of-type]:text-lg" />
          <p className="text-xs sm:text-sm text-muted-foreground text-center">
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
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (session?.user) {
        navigate("/prospeccao", {
          replace: true
        });
      } else {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();

    // Listen for auth changes
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        navigate("/prospeccao", {
          replace: true
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Show nothing while checking auth to avoid flash
  if (isCheckingAuth) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>;
  }
  return <div className="min-h-screen bg-background overflow-x-hidden">
      <LPHeader />
      <HeroSection />
      <BeneficiosSection />
      <ComoFuncionaSection />
      <DepoimentosSection />
      <MetricasSection />
      
      
      <ParaQuemSection />
      <PrecosSection />
      <FAQSection />
      <CTAFinalSection />
      <Footer />
    </div>;
}
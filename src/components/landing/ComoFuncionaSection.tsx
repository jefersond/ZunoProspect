import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Globe, Zap, ArrowRight } from "lucide-react";

export function ComoFuncionaSection() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const passos = [
    {
      numero: "01",
      icone: Search,
      titulo: "Defina sua busca",
      descricao: "Informe o nicho, cidade e quantidade de leads que você quer encontrar."
    },
    {
      numero: "02",
      icone: Globe,
      titulo: "IA analisa tudo",
      descricao: "O sistema busca empresas, analisa sites, detecta sinais de marketing e enriquece cada lead."
    },
    {
      numero: "03",
      icone: Zap,
      titulo: "Receba o plano pronto",
      descricao: "Cada lead vem com diagnóstico completo e plano de prospecção de 7 dias personalizado."
    }
  ];

  return (
    <section id="como-funciona" className="py-20 bg-background">
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
          {passos.map((passo, index) => (
            <div key={index} className="relative h-full">
              <Card className="text-center p-8 h-full hover:shadow-lg hover:shadow-primary/5 transition-all dark:border-border/50">
                <div className="text-5xl font-bold text-primary/20 dark:text-primary/30 mb-4">{passo.numero}</div>
                <div className="w-16 h-16 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center mx-auto mb-6">
                  <passo.icone className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{passo.titulo}</h3>
                <p className="text-muted-foreground">{passo.descricao}</p>
              </Card>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Button size="lg" variant="success" onClick={() => scrollToSection("precos")}>
            Escolher meu plano
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}

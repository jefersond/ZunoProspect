import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Unlock } from "lucide-react";

interface UpsellCardProps {
  leadsOcultos: number;
  onUpgrade: () => void;
}

export const UpsellCard = ({ leadsOcultos, onUpgrade }: UpsellCardProps) => {
  if (leadsOcultos <= 0) return null;

  return (
    <Card className="mt-6 bg-zinc-900/80 border-emerald-500/30 border-2">
      <CardContent className="py-8 text-center space-y-4">
        {/* Ícone */}
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-emerald-500/10 ring-2 ring-emerald-500/30">
            <Lock className="h-10 w-10 text-emerald-500" />
          </div>
        </div>

        {/* Texto Principal - Número Real */}
        <h3 className="text-xl font-bold text-foreground">
          Encontramos mais <span className="text-emerald-500">{leadsOcultos}</span> empresas para esta busca!
        </h3>

        {/* Subtexto */}
        <p className="text-muted-foreground max-w-md mx-auto">
          Seu plano atual limita a visualização. Faça upgrade para acessar a lista completa agora.
        </p>

        {/* Botão CTA - Largo e Chamativo */}
        <Button
          onClick={onUpgrade}
          size="lg"
          className="w-full max-w-sm bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base py-6 shadow-lg shadow-emerald-500/25"
        >
          <Unlock className="h-5 w-5 mr-2" />
          Desbloquear Todos os Leads
        </Button>
      </CardContent>
    </Card>
  );
};

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, TrendingUp, MessageSquare, Mail, RefreshCw, Instagram, Copy, Check } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { copyToClipboard } from "@/utils/templateUtils";
import type { PlanoProspeccaoDia, PlanosPorCanal } from "@/types/lead";

interface LeadAnalysisProps {
  diagnostico: string[] | null;
  probabilidade: number | null;
  plano: PlanoProspeccaoDia[] | PlanosPorCanal | null;
  geradoEm: string | null;
  onReanalyze?: () => void;
  isReanalyzing?: boolean;
}

// Helper para verificar se é o formato antigo (array) ou novo (objeto por canal)
function isPlanosPorCanal(plano: PlanoProspeccaoDia[] | PlanosPorCanal): plano is PlanosPorCanal {
  return !Array.isArray(plano) && typeof plano === 'object';
}

// Componente para renderizar um dia do plano
const PlanoDiaItem = ({ 
  dia, 
  copiedDia, 
  onCopy 
}: { 
  dia: PlanoProspeccaoDia; 
  copiedDia: number | null;
  onCopy: (diaNum: number, mensagem: string) => void;
}) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="font-semibold">
        Dia {dia.dia}
      </Badge>
      <Badge
        variant={dia.canal === "whatsapp" ? "default" : dia.canal === "instagram" ? "outline" : "secondary"}
        className="gap-1"
      >
        {dia.canal === "whatsapp" ? (
          <MessageSquare className="h-3 w-3" />
        ) : dia.canal === "instagram" ? (
          <Instagram className="h-3 w-3" />
        ) : (
          <Mail className="h-3 w-3" />
        )}
        {dia.canal === "whatsapp" ? "WhatsApp" : dia.canal === "instagram" ? "Instagram" : "Email"}
      </Badge>
    </div>

    <div className="pl-4 space-y-2 text-sm">
      <div className="bg-primary/5 p-3 rounded-md border border-primary/10 relative">
        <div className="flex items-start justify-between">
          <p className="font-medium text-primary mb-1">Mensagem:</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCopy(dia.dia, dia.mensagem)}
            className="h-7 w-7 p-0 -mt-1 -mr-1"
          >
            {copiedDia === dia.dia ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="whitespace-pre-wrap pr-6">{dia.mensagem}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="bg-orange-50 dark:bg-orange-950/20 p-2 rounded border border-orange-200 dark:border-orange-800">
          <p className="font-medium text-orange-700 dark:text-orange-400 text-xs mb-1">
            Objeção Provável:
          </p>
          <p className="text-xs text-orange-900 dark:text-orange-300">
            {dia.objecao_provavel}
          </p>
        </div>

        <div className="bg-green-50 dark:bg-green-950/20 p-2 rounded border border-green-200 dark:border-green-800">
          <p className="font-medium text-green-700 dark:text-green-400 text-xs mb-1">
            Resposta Sugerida:
          </p>
          <p className="text-xs text-green-900 dark:text-green-300">
            {dia.resposta_sugerida}
          </p>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950/20 p-2 rounded border border-blue-200 dark:border-blue-800">
        <p className="font-medium text-blue-700 dark:text-blue-400 text-xs mb-1">
          CTA:
        </p>
        <p className="text-xs text-blue-900 dark:text-blue-300">{dia.cta}</p>
      </div>
    </div>
  </div>
);

// Componente para lista de dias de um plano
const PlanoList = ({ 
  dias, 
  copiedDia, 
  onCopy 
}: { 
  dias: PlanoProspeccaoDia[]; 
  copiedDia: number | null;
  onCopy: (diaNum: number, mensagem: string) => void;
}) => (
  <div className="space-y-6">
    {dias.map((dia, index) => (
      <div key={dia.dia}>
        <PlanoDiaItem dia={dia} copiedDia={copiedDia} onCopy={onCopy} />
        {index < dias.length - 1 && <Separator className="my-4" />}
      </div>
    ))}
  </div>
);

export const LeadAnalysis = ({ diagnostico, probabilidade, plano, geradoEm, onReanalyze, isReanalyzing }: LeadAnalysisProps) => {
  const [copiedDia, setCopiedDia] = useState<number | null>(null);
  const { toast } = useToast();

  const handleCopyMessage = async (dia: number, mensagem: string) => {
    const success = await copyToClipboard(mensagem);
    if (success) {
      setCopiedDia(dia);
      toast({
        title: "Copiado!",
        description: `Mensagem do Dia ${dia} copiada`,
      });
      setTimeout(() => setCopiedDia(null), 2000);
    }
  };

  if (!diagnostico || !probabilidade || !plano) {
    return (
      <Card className="mt-4">
        <CardContent className="py-6 text-center space-y-3">
          <p className="text-muted-foreground">Análise de IA ainda não gerada para este lead</p>
          {onReanalyze && (
            <Button
              onClick={onReanalyze}
              disabled={isReanalyzing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isReanalyzing ? 'animate-spin' : ''}`} />
              {isReanalyzing ? 'Analisando...' : 'Gerar Análise'}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const getProbabilidadeColor = (prob: number) => {
    if (prob >= 70) return "text-green-600 bg-green-50 border-green-200";
    if (prob >= 40) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  // Determina se é formato novo (por canal) ou antigo (array misto)
  const isPorCanal = isPlanosPorCanal(plano);
  
  // Converte formato antigo (array) para novo formato (objeto por canal)
  let planosPorCanal: PlanosPorCanal;
  if (isPorCanal) {
    planosPorCanal = plano;
  } else {
    // Formato antigo: agrupa por canal
    const planoArray = plano as PlanoProspeccaoDia[];
    planosPorCanal = {};
    const canaisEncontrados = [...new Set(planoArray.map(p => p.canal))];
    for (const canal of canaisEncontrados) {
      planosPorCanal[canal] = planoArray.filter(p => p.canal === canal);
    }
  }

  // Detecta quais canais estão disponíveis
  const hasWhatsApp = planosPorCanal.whatsapp && planosPorCanal.whatsapp.length > 0;
  const hasEmail = planosPorCanal.email && planosPorCanal.email.length > 0;
  const hasInstagram = planosPorCanal.instagram && planosPorCanal.instagram.length > 0;

  // Define aba default
  const defaultTab = hasWhatsApp ? "whatsapp" : hasEmail ? "email" : hasInstagram ? "instagram" : "whatsapp";

  return (
    <div className="space-y-4 mt-4">
      {/* Diagnóstico e Probabilidade */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Brain className="h-5 w-5 text-primary" />
                  Diagnóstico Digital
                </CardTitle>
                {geradoEm && (
                  <CardDescription className="text-xs mt-1">
                    Gerado em {new Date(geradoEm).toLocaleDateString('pt-BR')}
                  </CardDescription>
                )}
              </div>
              {onReanalyze && (
                <Button
                  onClick={onReanalyze}
                  disabled={isReanalyzing}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isReanalyzing ? 'animate-spin' : ''}`} />
                  {isReanalyzing ? 'Analisando...' : 'Reanalisar'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {diagnostico.map((bullet, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              Probabilidade de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <div
                className={`text-6xl font-bold ${getProbabilidadeColor(probabilidade).split(' ')[0]}`}
              >
                {probabilidade}%
              </div>
              <Badge
                className={`mt-3 ${getProbabilidadeColor(probabilidade)}`}
                variant="outline"
              >
                {probabilidade >= 70
                  ? "Alta Probabilidade"
                  : probabilidade >= 40
                  ? "Probabilidade Média"
                  : "Baixa Probabilidade"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plano de Prospecção 7 Dias com abas por canal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Plano de Prospecção 7 Dias
          </CardTitle>
          <CardDescription>
            Escolha o canal para ver a cadência completa de 7 dias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              {hasWhatsApp && (
                <TabsTrigger value="whatsapp" className="gap-1.5">
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </TabsTrigger>
              )}
              {hasEmail && (
                <TabsTrigger value="email" className="gap-1.5">
                  <Mail className="h-4 w-4" />
                  <span className="hidden sm:inline">Email</span>
                </TabsTrigger>
              )}
              {hasInstagram && (
                <TabsTrigger value="instagram" className="gap-1.5">
                  <Instagram className="h-4 w-4" />
                  <span className="hidden sm:inline">Instagram</span>
                </TabsTrigger>
              )}
            </TabsList>

            {hasWhatsApp && (
              <TabsContent value="whatsapp">
                <PlanoList 
                  dias={planosPorCanal.whatsapp!} 
                  copiedDia={copiedDia} 
                  onCopy={handleCopyMessage} 
                />
              </TabsContent>
            )}

            {hasEmail && (
              <TabsContent value="email">
                <PlanoList 
                  dias={planosPorCanal.email!} 
                  copiedDia={copiedDia} 
                  onCopy={handleCopyMessage} 
                />
              </TabsContent>
            )}

            {hasInstagram && (
              <TabsContent value="instagram">
                <PlanoList 
                  dias={planosPorCanal.instagram!} 
                  copiedDia={copiedDia} 
                  onCopy={handleCopyMessage} 
                />
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

import React from "react";
import {
  CheckCircle2,
  HelpCircle,
  AlertTriangle,
  Compass,
  Building2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LeadProspeccao } from "@/types/lead";
import { buildLeadCommercialDossier } from "@/services/leadCommercialDossier";

interface LeadCommercialDossierProps {
  lead: Partial<LeadProspeccao>;
  userServiceName?: string;
  commercialObjective?: string;
  minScoreThreshold?: number;
}

export const LeadCommercialDossier: React.FC<LeadCommercialDossierProps> = ({
  lead,
  userServiceName,
  commercialObjective,
  minScoreThreshold = 70,
}) => {
  const dossier = buildLeadCommercialDossier(lead, {
    userServiceName,
    commercialObjective,
    minScoreThreshold,
  });

  return (
    <div className="space-y-4">
      {/* Cabeçalho Explicativo: Por que vale analisar esta empresa? */}
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Compass className="h-4 w-4 text-emerald-500" />
              Por que vale analisar esta empresa?
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-500">
                Compatibilidade: {dossier.compatibility.score}/100
              </Badge>
              <Badge variant="secondary" className="text-[11px]">
                Oferta: {dossier.serviceProfile.categoryLabel}
              </Badge>
            </div>
          </div>
          <CardDescription className="text-xs text-foreground/90 font-medium pt-1">
            {dossier.porQueValeAnalisar.headline}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-1">
          <div className="flex flex-wrap gap-1.5">
            {dossier.porQueValeAnalisar.reasons.map((reason, idx) => (
              <span
                key={idx}
                className="text-[11px] px-2 py-0.5 rounded bg-background/80 border border-border/60 text-muted-foreground"
              >
                {reason}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* BLOCO 1: O QUE SABEMOS (Estritamente Fatos Verificados) */}
        <Card className="border-border/80">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                O QUE SABEMOS
              </CardTitle>
              <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30">
                Fatos Verificados
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Informações reais observadas nos registros públicos e no histórico do Zuno
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {dossier.oQueSabemos.map((fact, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between gap-2 p-2 rounded-md border border-border/50 bg-muted/20 text-xs"
              >
                <div className="flex items-start gap-2">
                  {fact.verified ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-semibold text-foreground">{fact.label}: </span>
                    <span className="text-muted-foreground break-all">{fact.value}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* BLOCO 2: POSSÍVEIS ÂNGULOS COMERCIAIS (Hipóteses e Perguntas para Investigar) */}
        <Card className="border-border/80">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Sparkles className="h-4 w-4 text-blue-500" />
                POSSÍVEIS ÂNGULOS COMERCIAIS
              </CardTitle>
              <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-500/30">
                Hipóteses para Investigar
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Hipóteses consultivas e perguntas para validar na conversa (não são fatos consumados)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dossier.possiveisAngulosComerciais.map((angle) => (
              <div
                key={angle.id}
                className="p-3 rounded-md border border-blue-500/20 bg-blue-500/5 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-blue-400" />
                    {angle.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Base: {angle.basisFact}</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">{angle.hypothesis}</p>
                <div className="p-2 rounded bg-background/80 border border-border/60">
                  <span className="font-semibold text-blue-400 flex items-center gap-1 text-[11px] mb-0.5">
                    <HelpCircle className="h-3 w-3" />
                    Pergunta sugerida para investigar:
                  </span>
                  <p className="text-foreground italic">"{angle.investigativeQuestion}"</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* BLOCO 3: Limitações e Informações Não Verificadas */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="py-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground">
                Limitações da análise (Informações não verificadas):{" "}
              </span>
              <span className="text-muted-foreground">
                {dossier.limitacoesAnalise.join(" • ")}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

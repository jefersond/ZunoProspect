import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";
import type { DataQualitySummary } from "@/types/lead";

interface Props {
  quality: DataQualitySummary;
}

export function LeadDataQualityBadge({ quality }: Props) {
  const config = {
    alto:  { label: "Dados confiáveis", color: "bg-green-100 text-green-800 border-green-200",  icon: <CheckCircle className="w-3 h-3" /> },
    medio: { label: "Dados parciais",   color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: <Info className="w-3 h-3" /> },
    baixo: { label: "Dados incertos",   color: "bg-red-100 text-red-800 border-red-200",       icon: <AlertTriangle className="w-3 h-3" /> },
  } as const;

  const { label, color, icon } = config[quality.level];

  const sourceLabels: Record<string, string> = {
    google_places: "Google Places",
    scraped:       "Scraping de site",
    cnpj_api:      "Receita Federal",
    manual:        "Inserção manual",
    estimado:      "Estimado pela IA",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`flex items-center gap-1 text-xs font-medium border ${color} cursor-help`}
          >
            {icon}
            {label}
            {quality.usedFallback && (
              <span className="ml-1 opacity-60">(fallback)</span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs space-y-1 text-xs">
          {Object.entries(quality.sources).length > 0 && (
            <div>
              <p className="font-semibold mb-1">Fontes dos dados:</p>
              {Object.entries(quality.sources).map(([field, src]) => (
                <p key={field} className="text-muted-foreground">
                  <span className="font-medium text-foreground">{field}:</span>{" "}
                  {sourceLabels[src] ?? src}
                </p>
              ))}
            </div>
          )}
          {quality.usedFallback && (
            <div className="border-t pt-1 mt-1">
              <p className="font-semibold text-yellow-700">Análise IA usou fallback</p>
              {quality.fallbackReason && (
                <p className="text-muted-foreground">{quality.fallbackReason}</p>
              )}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function buildDataQualitySummary(lead: {
  data_sources?: Record<string, string>;
  ai_used_fallback?: boolean;
  ai_fallback_reason?: string | null;
  sinais?: { has_meta_pixel: boolean; has_gtag: boolean };
  website?: string | null;
  cnpj?: string | null;
}): DataQualitySummary {
  const sources = lead.data_sources ?? {};
  const values = Object.values(sources);

  let level: "alto" | "medio" | "baixo" = "alto";
  if (values.includes("estimado"))      level = "baixo";
  else if (values.includes("scraped"))  level = "medio";

  // Penaliza se site não pôde ser analisado mas existe
  if (lead.website && !lead.sinais?.has_meta_pixel && !lead.sinais?.has_gtag) {
    if (level === "alto") level = "medio";
  }

  return {
    level,
    usedFallback: lead.ai_used_fallback ?? false,
    fallbackReason: lead.ai_fallback_reason ?? null,
    sources,
  };
}

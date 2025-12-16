import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, MapPin, Phone, MessageSquare, Instagram, Mail, UserCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { LeadProspeccao } from "@/types/lead";

interface LeadCardProps {
  lead: LeadProspeccao;
}

export const LeadCard = ({ lead }: LeadCardProps) => {
  // Extrai primeiro nome do responsável
  const primeiroNomeResponsavel = lead.nome_responsavel?.split(' ')[0] || null;

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">{lead.nome}</CardTitle>
            {/* Indicador do nome do responsável via CNPJ */}
            {primeiroNomeResponsavel && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant="outline" 
                      className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/20 cursor-help"
                    >
                      <UserCheck className="h-3 w-3 mr-1" />
                      Sócio: {primeiroNomeResponsavel}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Nome do sócio/responsável obtido via consulta CNPJ na Receita Federal</p>
                    <p className="text-xs text-muted-foreground mt-1">Nome completo: {lead.nome_responsavel}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {lead.endereco && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>{lead.endereco}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Badge variant="outline">{lead.nicho}</Badge>
            <Badge variant="secondary">{lead.foco}</Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Contatos */}
        <div className="flex flex-wrap gap-2">
          {lead.telefone && (
            <a
              href={`tel:${lead.telefone}`}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <Phone className="h-3 w-3" />
              {lead.telefone}
            </a>
          )}
          
          {lead.whatsapp_link && (
            <a
              href={lead.whatsapp_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-green-600 hover:underline"
            >
              <MessageSquare className="h-3 w-3" />
              WhatsApp
            </a>
          )}

          {lead.email && (
            <a
              href={`mailto:${lead.email}`}
              className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              <Mail className="h-3 w-3" />
              Email
            </a>
          )}
          
          {lead.instagram_url && (
            <a
              href={lead.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-pink-600 hover:underline"
            >
              <Instagram className="h-3 w-3" />
              Instagram
            </a>
          )}
          
          {lead.website && (
            <a
              href={lead.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Website
            </a>
          )}
        </div>
        
        {/* Sinais Digitais */}
        <div className="flex flex-wrap gap-1">
          {lead.sinais.has_whatsapp_on_site && (
            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 border-green-500/20">
              WhatsApp no Site
            </Badge>
          )}
          {lead.sinais.has_meta_pixel && (
            <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 border-blue-500/20">
              Meta Pixel
            </Badge>
          )}
          {lead.sinais.has_gtag && (
            <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-700 border-orange-500/20">
              Google Analytics
            </Badge>
          )}
          {lead.sinais.has_gtm && (
            <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-700 border-purple-500/20">
              GTM
            </Badge>
          )}
        </div>
        
        {/* Dados CNPJ */}
        {lead.cnpj && (
          <div className="pt-2 border-t space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dados Oficiais (Receita)</span>
              <Badge
                variant="outline"
                className={
                  lead.situacao_cadastral === "ATIVA"
                    ? "text-xs bg-green-500/10 text-green-700 border-green-500/20"
                    : "text-xs bg-red-500/10 text-red-700 border-red-500/20"
                }
              >
                {lead.situacao_cadastral || "N/A"}
              </Badge>
            </div>
            
            {lead.razao_social && lead.razao_social !== lead.nome && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Razão Social:</span> {lead.razao_social}
              </p>
            )}
            
            <p className="text-xs text-muted-foreground font-mono">
              CNPJ: {lead.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}
            </p>
            
            <div className="flex flex-wrap gap-2 text-sm">
              {lead.cnpj_telefone && (
                <a href={`tel:${lead.cnpj_telefone}`} className="text-primary hover:underline">
                  📞 {lead.cnpj_telefone}
                </a>
              )}
              {lead.cnpj_email && (
                <a href={`mailto:${lead.cnpj_email}`} className="text-primary hover:underline">
                  ✉️ {lead.cnpj_email}
                </a>
              )}
            </div>
            
            <div className="flex flex-wrap gap-1">
              {lead.porte_empresa && (
                <Badge variant="secondary" className="text-xs">{lead.porte_empresa}</Badge>
              )}
              {lead.cnae_principal && (
                <Badge variant="outline" className="text-xs">{lead.cnae_principal}</Badge>
              )}
            </div>
          </div>
        )}

        {/* Análise IA */}
        {lead.probabilidade_conversao > 0 && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Probabilidade de Conversão:</span>
              <Badge
                className={
                  lead.probabilidade_conversao >= 70
                    ? "bg-green-100 text-green-700 border-green-200"
                    : lead.probabilidade_conversao >= 40
                    ? "bg-yellow-100 text-yellow-700 border-yellow-200"
                    : "bg-red-100 text-red-700 border-red-200"
                }
                variant="outline"
              >
                {lead.probabilidade_conversao}%
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

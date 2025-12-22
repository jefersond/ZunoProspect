import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, MapPin, Phone, MessageSquare, Instagram, Mail, UserCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CopyableField } from "./CopyableField";
import type { LeadProspeccao } from "@/types/lead";

interface LeadCardProps {
  lead: LeadProspeccao;
}

// Função para formatar número de telefone brasileiro
const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

// Função para extrair número do link WhatsApp
const extractWhatsAppNumber = (link: string | null): string | null => {
  if (!link) return null;
  const match = link.match(/(\d{10,13})/);
  return match ? match[1] : null;
};

export const LeadCard = ({ lead }: LeadCardProps) => {
  // Extrai primeiro nome do responsável
  const primeiroNomeResponsavel = lead.nome_responsavel?.split(' ')[0] || null;
  const whatsappNumber = extractWhatsAppNumber(lead.whatsapp_link);

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
        {/* Contatos com botão copiar */}
        <div className="flex flex-wrap gap-3">
          {lead.telefone && (
            <CopyableField value={lead.telefone} displayValue={formatPhoneNumber(lead.telefone)}>
              <a
                href={`tel:${lead.telefone}`}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Phone className="h-3 w-3" />
                {formatPhoneNumber(lead.telefone)}
              </a>
            </CopyableField>
          )}
          
          {lead.whatsapp_link && (
            <CopyableField 
              value={whatsappNumber || lead.whatsapp_link} 
              displayValue={whatsappNumber ? formatPhoneNumber(whatsappNumber) : 'WhatsApp'}
            >
              <a
                href={lead.whatsapp_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-green-600 hover:underline"
              >
                <MessageSquare className="h-3 w-3" />
                {whatsappNumber ? formatPhoneNumber(whatsappNumber) : 'WhatsApp'}
              </a>
            </CopyableField>
          )}

          {lead.email && (
            <CopyableField value={lead.email}>
              <a
                href={`mailto:${lead.email}`}
                className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
              >
                <Mail className="h-3 w-3" />
                {lead.email}
              </a>
            </CopyableField>
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
            
            <CopyableField 
              value={lead.cnpj} 
              displayValue={lead.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}
              className="text-xs text-muted-foreground font-mono"
            >
              <span>CNPJ: {lead.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}</span>
            </CopyableField>
            
            <div className="flex flex-wrap gap-3 text-sm">
              {lead.cnpj_telefone && (
                <CopyableField value={lead.cnpj_telefone} displayValue={formatPhoneNumber(lead.cnpj_telefone)}>
                  <a href={`tel:${lead.cnpj_telefone}`} className="text-primary hover:underline">
                    📞 {formatPhoneNumber(lead.cnpj_telefone)}
                  </a>
                </CopyableField>
              )}
              {lead.cnpj_email && (
                <CopyableField value={lead.cnpj_email}>
                  <a href={`mailto:${lead.cnpj_email}`} className="text-primary hover:underline">
                    ✉️ {lead.cnpj_email}
                  </a>
                </CopyableField>
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

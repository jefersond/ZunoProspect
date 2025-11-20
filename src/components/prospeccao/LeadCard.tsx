import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, MapPin, Phone, MessageSquare, Instagram } from "lucide-react";
import type { LeadProspeccao } from "@/types/lead";

interface LeadCardProps {
  lead: LeadProspeccao;
}

export const LeadCard = ({ lead }: LeadCardProps) => {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">{lead.nome}</CardTitle>
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

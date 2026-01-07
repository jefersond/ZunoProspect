import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Phone, 
  Mail, 
  Instagram, 
  Globe, 
  MessageCircle,
  Building2,
  MapPin,
  Target,
  GripVertical
} from 'lucide-react';
import { LeadProspeccao } from '@/types/lead';

interface PipelineCardProps {
  lead: LeadProspeccao;
  onViewDetails: (lead: LeadProspeccao) => void;
}

export function PipelineCard({ lead, onViewDetails }: PipelineCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getProbabilidadeColor = (prob: number | null) => {
    if (!prob) return 'bg-muted text-muted-foreground';
    if (prob >= 70) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (prob >= 40) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  const isValidMobilePhone = (phone: string | null): boolean => {
    if (!phone) return false;
    const digits = phone.replace(/\D/g, '');
    return digits.length === 11 && digits[2] === '9';
  };

  const formatWhatsAppLink = (phone: string | null, leadName: string): string => {
    if (!phone) return '#';
    const digits = phone.replace(/\D/g, '');
    const message = encodeURIComponent(
      `Olá! Vi sua empresa ${leadName} e gostaria de conversar sobre uma oportunidade.`
    );
    return `https://wa.me/55${digits}?text=${message}`;
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`p-3 bg-card border-border/50 hover:border-border transition-all ${
        isDragging ? 'opacity-50 shadow-lg shadow-primary/10 scale-105' : ''
      }`}
    >
      {/* Header with Drag Handle */}
      <div className="flex items-start gap-2 mb-2">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab active:cursor-grabbing touch-none p-0.5 -ml-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <h4 
          className="font-medium text-sm text-foreground truncate flex-1 cursor-pointer hover:text-primary transition-colors"
          onClick={() => onViewDetails(lead)}
        >
          {lead.nome}
        </h4>
        {lead.probabilidade_conversao && (
          <Badge 
            variant="outline" 
            className={`text-xs shrink-0 ${getProbabilidadeColor(lead.probabilidade_conversao)}`}
          >
            {lead.probabilidade_conversao}%
          </Badge>
        )}
      </div>

      {/* Info */}
      <div className="space-y-1 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{lead.cidade}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3" />
          <span className="truncate">{lead.nicho}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Target className="h-3 w-3" />
          <span className="truncate">{lead.foco}</span>
        </div>
      </div>

      {/* Digital Signals */}
      <div className="flex flex-wrap gap-1 mb-3">
        {lead.sinais.has_whatsapp_on_site && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
            <MessageCircle className="h-2.5 w-2.5 mr-0.5" />
            WA
          </Badge>
        )}
        {lead.sinais.has_meta_pixel && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-400 border-blue-500/30">
            Meta
          </Badge>
        )}
        {lead.sinais.has_gtag && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-orange-500/10 text-orange-400 border-orange-500/30">
            GA
          </Badge>
        )}
        {lead.sinais.has_gtm && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-500/10 text-purple-400 border-purple-500/30">
            GTM
          </Badge>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-1 pt-2 border-t border-border/30">
        {isValidMobilePhone(lead.telefone) && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
            onClick={(e) => {
              e.stopPropagation();
              window.open(formatWhatsAppLink(lead.telefone, lead.nome), '_blank');
            }}
          >
            <Phone className="h-3.5 w-3.5" />
          </Button>
        )}
        {lead.email && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`mailto:${lead.email}`, '_blank');
            }}
          >
            <Mail className="h-3.5 w-3.5" />
          </Button>
        )}
        {lead.instagram_url && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-pink-400 hover:text-pink-300 hover:bg-pink-500/10"
            onClick={(e) => {
              e.stopPropagation();
              window.open(lead.instagram_url!, '_blank');
            }}
          >
            <Instagram className="h-3.5 w-3.5" />
          </Button>
        )}
        {lead.website && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation();
              window.open(lead.website!, '_blank');
            }}
          >
            <Globe className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </Card>
  );
}

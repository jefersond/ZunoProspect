export type Foco = 
  | "Full Service" 
  | "Tráfego" 
  | "Automação" 
  | "Design" 
  | "Social" 
  | "SEO" 
  | "Sites/Landing" 
  | "CRM"
  | "servicos_profissionais"
  | "zuno_internal_prospecting";

export interface SinaisDigitais {
  has_whatsapp_on_site: boolean;
  has_meta_pixel: boolean;
  has_gtag: boolean;
  has_gtm: boolean;
}

export interface PlanoProspeccaoDia {
  dia: number;
  canal: "whatsapp" | "email" | "instagram";
  objetivo?: string;
  goal?: string;
  personalization_basis?: string[];
  angle?: string;
  signal_used?: string;
  acao_sugerida: string;
  mensagem: string;
  objecao_provavel: string;
  resposta_sugerida: string;
  cta: string;
  variations?: {
    direct?: string;
    consultative?: string;
    light_provocation?: string;
  };
}

export interface LeadPersonalizationSnapshot {
  lead_id?: string | null;
  company_name?: string | null;
  personalization_used?: string[];
  data_signals?: string[];
}

export interface LeadProspeccao {
  id: string;
  placeId: string | null;
  nome: string;
  telefone: string | null;
  whatsapp_number?: string | null;
  whatsapp_link: string | null;
  email: string | null;
  website: string | null;
  instagram_url: string | null;
  instagram_context: string | null; // reservado para futuro
  endereco: string | null;
  cidade: string;
  nicho: string;
  foco: Foco;
  proximidadeAtiva: boolean;
  raioKm: number | null;
  
  sinais: SinaisDigitais;
  
  diagnostico_bullets: string[];
  probabilidade_conversao: number;
  plano_prospecao_7dias: PlanoProspeccaoDia[];
  
  // Campos adicionais úteis
  rating: number | null;
  total_reviews: number | null;
  status: string;
  created_at: string;
  ai_analise_gerada_em: string | null;
  salvo: boolean;
  notas: string | null;
  
  // Campos CNPJ
  cnpj: string | null;
  razao_social: string | null;
  nome_responsavel: string | null;
  cnpj_telefone: string | null;
  cnpj_email: string | null;
  situacao_cadastral: string | null;
  porte_empresa: string | null;
  cnae_principal: string | null;
  
  // Lead bloqueado (além da cota)
  isLocked?: boolean;

  // Admin: campos customizáveis (chave-valor livre, só admin escreve)
  custom_fields?: Record<string, string>;

  // Admin: rastreamento de qualidade dos dados
  data_sources?: Record<string, 'google_places' | 'scraped' | 'cnpj_api' | 'manual' | 'estimado'>;
  ai_used_fallback?: boolean;
  ai_fallback_reason?: string | null;
}

export interface LeadCustomField {
  key: string;
  value: string;
}

export type DataSourceLevel = 'alto' | 'medio' | 'baixo';

export interface DataQualitySummary {
  level: DataSourceLevel;
  usedFallback: boolean;
  fallbackReason?: string | null;
  sources: Record<string, string>;
  ai_personalization?: LeadPersonalizationSnapshot | null;
}

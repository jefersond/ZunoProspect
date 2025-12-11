export type Foco = 
  | "Full Service" 
  | "Tráfego" 
  | "Automação" 
  | "Design" 
  | "Social" 
  | "SEO" 
  | "Sites/Landing" 
  | "CRM";

export interface SinaisDigitais {
  has_whatsapp_on_site: boolean;
  has_meta_pixel: boolean;
  has_gtag: boolean;
  has_gtm: boolean;
}

export interface PlanoProspeccaoDia {
  dia: number;
  canal: "whatsapp" | "email" | "instagram";
  acao_sugerida: string;
  mensagem: string;
  objecao_provavel: string;
  resposta_sugerida: string;
  cta: string;
}

export interface LeadProspeccao {
  id: string;
  placeId: string | null;
  nome: string;
  telefone: string | null;
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
}

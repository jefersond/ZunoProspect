export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string | null
          id: string
          key_hash: string
          key_preview: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key_hash: string
          key_preview: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key_hash?: string
          key_preview?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          created_at: string | null
          key: string
          value: string
        }
        Insert: {
          created_at?: string | null
          key: string
          value: string
        }
        Update: {
          created_at?: string | null
          key?: string
          value?: string
        }
        Relationships: []
      }
      campanhas: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          id: string
          nome: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          nome: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_campaigns: {
        Row: {
          assunto: string
          conteudo: string
          created_at: string
          id: string
          nome: string
          segmento: string
          status: string
          total_abertos: number
          total_enviados: number
          updated_at: string
        }
        Insert: {
          assunto: string
          conteudo: string
          created_at?: string
          id?: string
          nome: string
          segmento: string
          status?: string
          total_abertos?: number
          total_enviados?: number
          updated_at?: string
        }
        Update: {
          assunto?: string
          conteudo?: string
          created_at?: string
          id?: string
          nome?: string
          segmento?: string
          status?: string
          total_abertos?: number
          total_enviados?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          campaign_id: string | null
          clicked_at: string | null
          error_message: string | null
          id: string
          opened_at: string | null
          sent_at: string
          status: string
          user_email_encrypted: string | null
          user_email_masked: string
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          clicked_at?: string | null
          error_message?: string | null
          id?: string
          opened_at?: string | null
          sent_at?: string
          status?: string
          user_email_encrypted?: string | null
          user_email_masked: string
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          clicked_at?: string | null
          error_message?: string | null
          id?: string
          opened_at?: string | null
          sent_at?: string
          status?: string
          user_email_encrypted?: string | null
          user_email_masked?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      interacoes: {
        Row: {
          conteudo: string
          created_at: string
          data_interacao: string
          id: string
          lead_id: string
          tipo: string
          user_id: string
        }
        Insert: {
          conteudo: string
          created_at?: string
          data_interacao?: string
          id?: string
          lead_id: string
          tipo: string
          user_id: string
        }
        Update: {
          conteudo?: string
          created_at?: string
          data_interacao?: string
          id?: string
          lead_id?: string
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ai_analise_gerada_em: string | null
          cidade: string
          cnae_principal: string | null
          cnpj: string | null
          cnpj_email_encrypted: string | null
          cnpj_telefone_encrypted: string | null
          created_at: string
          diagnostico_bullets: Json | null
          digital_signals: Json | null
          email_encrypted: string | null
          endereco_encrypted: string | null
          foco: string
          google_place_id: string | null
          has_gtag: boolean | null
          has_gtm: boolean | null
          has_meta_pixel: boolean | null
          id: string
          instagram_context: string | null
          instagram_url_encrypted: string | null
          latitude: number | null
          longitude: number | null
          nicho: string
          nome: string
          nome_responsavel: string | null
          notas: string | null
          pais: string | null
          plano_prospeccao: Json | null
          porte_empresa: string | null
          probabilidade_conversao: number | null
          proximidade_ativa: boolean | null
          raio_km: number | null
          rating: number | null
          razao_social: string | null
          salvo: boolean | null
          situacao_cadastral: string | null
          status: string | null
          telefone_encrypted: string | null
          total_reviews: number | null
          updated_at: string
          user_id: string
          website_encrypted: string | null
          whatsapp_number_encrypted: string | null
          whatsapp_on_site: boolean | null
        }
        Insert: {
          ai_analise_gerada_em?: string | null
          cidade: string
          cnae_principal?: string | null
          cnpj?: string | null
          cnpj_email_encrypted?: string | null
          cnpj_telefone_encrypted?: string | null
          created_at?: string
          diagnostico_bullets?: Json | null
          digital_signals?: Json | null
          email_encrypted?: string | null
          endereco_encrypted?: string | null
          foco: string
          google_place_id?: string | null
          has_gtag?: boolean | null
          has_gtm?: boolean | null
          has_meta_pixel?: boolean | null
          id?: string
          instagram_context?: string | null
          instagram_url_encrypted?: string | null
          latitude?: number | null
          longitude?: number | null
          nicho: string
          nome: string
          nome_responsavel?: string | null
          notas?: string | null
          pais?: string | null
          plano_prospeccao?: Json | null
          porte_empresa?: string | null
          probabilidade_conversao?: number | null
          proximidade_ativa?: boolean | null
          raio_km?: number | null
          rating?: number | null
          razao_social?: string | null
          salvo?: boolean | null
          situacao_cadastral?: string | null
          status?: string | null
          telefone_encrypted?: string | null
          total_reviews?: number | null
          updated_at?: string
          user_id: string
          website_encrypted?: string | null
          whatsapp_number_encrypted?: string | null
          whatsapp_on_site?: boolean | null
        }
        Update: {
          ai_analise_gerada_em?: string | null
          cidade?: string
          cnae_principal?: string | null
          cnpj?: string | null
          cnpj_email_encrypted?: string | null
          cnpj_telefone_encrypted?: string | null
          created_at?: string
          diagnostico_bullets?: Json | null
          digital_signals?: Json | null
          email_encrypted?: string | null
          endereco_encrypted?: string | null
          foco?: string
          google_place_id?: string | null
          has_gtag?: boolean | null
          has_gtm?: boolean | null
          has_meta_pixel?: boolean | null
          id?: string
          instagram_context?: string | null
          instagram_url_encrypted?: string | null
          latitude?: number | null
          longitude?: number | null
          nicho?: string
          nome?: string
          nome_responsavel?: string | null
          notas?: string | null
          pais?: string | null
          plano_prospeccao?: Json | null
          porte_empresa?: string | null
          probabilidade_conversao?: number | null
          proximidade_ativa?: boolean | null
          raio_km?: number | null
          rating?: number | null
          razao_social?: string | null
          salvo?: boolean | null
          situacao_cadastral?: string | null
          status?: string | null
          telefone_encrypted?: string | null
          total_reviews?: number | null
          updated_at?: string
          user_id?: string
          website_encrypted?: string | null
          whatsapp_number_encrypted?: string | null
          whatsapp_on_site?: boolean | null
        }
        Relationships: []
      }
      leads_access_log: {
        Row: {
          action_type: string
          created_at: string
          id: string
          ip_address: string | null
          lead_ids: string[] | null
          leads_count: number | null
          request_params: Json | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          ip_address?: string | null
          lead_ids?: string[] | null
          leads_count?: number | null
          request_params?: Json | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          lead_ids?: string[] | null
          leads_count?: number | null
          request_params?: Json | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      leads_audit_log: {
        Row: {
          billing_period_end: string | null
          billing_period_start: string | null
          corrected_at: string | null
          correction_reason: string | null
          id: string
          leads_count_in_period: number
          new_leads_used: number
          old_leads_used: number
          user_email: string | null
          user_id: string
        }
        Insert: {
          billing_period_end?: string | null
          billing_period_start?: string | null
          corrected_at?: string | null
          correction_reason?: string | null
          id?: string
          leads_count_in_period: number
          new_leads_used: number
          old_leads_used: number
          user_email?: string | null
          user_id: string
        }
        Update: {
          billing_period_end?: string | null
          billing_period_start?: string | null
          corrected_at?: string | null
          correction_reason?: string | null
          id?: string
          leads_count_in_period?: number
          new_leads_used?: number
          old_leads_used?: number
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      leads_campanhas: {
        Row: {
          campanha_id: string
          created_at: string
          id: string
          lead_id: string
          status: string
        }
        Insert: {
          campanha_id: string
          created_at?: string
          id?: string
          lead_id: string
          status?: string
        }
        Update: {
          campanha_id?: string
          created_at?: string
          id?: string
          lead_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_campanhas_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_campanhas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          empresa: string | null
          id: string
          nome_completo: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          empresa?: string | null
          id: string
          nome_completo?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          empresa?: string | null
          id?: string
          nome_completo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      templates_globais: {
        Row: {
          assunto: string | null
          ativo: boolean | null
          categoria: string
          conteudo: string
          created_at: string
          id: string
          nome: string
          ordem: number | null
          tags: string[] | null
          tipo: string
          updated_at: string
        }
        Insert: {
          assunto?: string | null
          ativo?: boolean | null
          categoria: string
          conteudo: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number | null
          tags?: string[] | null
          tipo: string
          updated_at?: string
        }
        Update: {
          assunto?: string | null
          ativo?: boolean | null
          categoria?: string
          conteudo?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number | null
          tags?: string[] | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      templates_mensagens: {
        Row: {
          assunto: string | null
          conteudo: string
          created_at: string
          id: string
          nome: string
          tags: string[] | null
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assunto?: string | null
          conteudo: string
          created_at?: string
          id?: string
          nome: string
          tags?: string[] | null
          tipo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assunto?: string | null
          conteudo?: string
          created_at?: string
          id?: string
          nome?: string
          tags?: string[] | null
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          billing_period_end: string
          billing_period_start: string
          created_at: string
          id: string
          is_annual: boolean
          leads_limit: number
          leads_used_this_month: number
          plan_name: string
          updated_at: string
          usa_addon: boolean | null
          usa_addon_active_until: string | null
          user_id: string
        }
        Insert: {
          billing_period_end?: string
          billing_period_start?: string
          created_at?: string
          id?: string
          is_annual?: boolean
          leads_limit?: number
          leads_used_this_month?: number
          plan_name?: string
          updated_at?: string
          usa_addon?: boolean | null
          usa_addon_active_until?: string | null
          user_id: string
        }
        Update: {
          billing_period_end?: string
          billing_period_start?: string
          created_at?: string
          id?: string
          is_annual?: boolean
          leads_limit?: number
          leads_used_this_month?: number
          plan_name?: string
          updated_at?: string
          usa_addon?: boolean | null
          usa_addon_active_until?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_leads_count_inconsistencies: {
        Args: never
        Returns: {
          actual_leads_count: number
          billing_period_end: string
          billing_period_start: string
          difference: number
          leads_used_this_month: number
          user_email: string
          user_id: string
        }[]
      }
      check_leads_rate_limit: {
        Args: {
          p_max_requests?: number
          p_user_id: string
          p_window_minutes?: number
        }
        Returns: Json
      }
      decrypt_sensitive: { Args: { encrypted_data: string }; Returns: string }
      encrypt_sensitive: { Args: { plain_text: string }; Returns: string }
      fix_leads_count_inconsistencies: {
        Args: never
        Returns: {
          actual_leads_count: number
          old_leads_used: number
          user_email: string
          user_id: string
          was_corrected: boolean
        }[]
      }
      get_lead_decrypted_by_id: {
        Args: { p_lead_id: string; p_user_id?: string }
        Returns: {
          ai_analise_gerada_em: string
          cidade: string
          cnae_principal: string
          cnpj: string
          cnpj_email: string
          cnpj_telefone: string
          created_at: string
          diagnostico_bullets: Json
          digital_signals: Json
          email: string
          endereco: string
          foco: string
          google_place_id: string
          has_gtag: boolean
          has_gtm: boolean
          has_meta_pixel: boolean
          id: string
          instagram_context: string
          instagram_url: string
          latitude: number
          longitude: number
          nicho: string
          nome: string
          nome_responsavel: string
          notas: string
          plano_prospeccao: Json
          porte_empresa: string
          probabilidade_conversao: number
          proximidade_ativa: boolean
          raio_km: number
          rating: number
          razao_social: string
          salvo: boolean
          situacao_cadastral: string
          status: string
          telefone: string
          total_reviews: number
          updated_at: string
          user_id: string
          website: string
          whatsapp_number: string
          whatsapp_on_site: boolean
        }[]
      }
      get_leads_decrypted: {
        Args: never
        Returns: {
          ai_analise_gerada_em: string
          cidade: string
          cnae_principal: string
          cnpj: string
          cnpj_email: string
          cnpj_telefone: string
          created_at: string
          diagnostico_bullets: Json
          digital_signals: Json
          email: string
          endereco: string
          foco: string
          google_place_id: string
          has_gtag: boolean
          has_gtm: boolean
          has_meta_pixel: boolean
          id: string
          instagram_context: string
          instagram_url: string
          latitude: number
          longitude: number
          nicho: string
          nome: string
          nome_responsavel: string
          notas: string
          plano_prospeccao: Json
          porte_empresa: string
          probabilidade_conversao: number
          proximidade_ativa: boolean
          raio_km: number
          rating: number
          razao_social: string
          salvo: boolean
          situacao_cadastral: string
          status: string
          telefone: string
          total_reviews: number
          updated_at: string
          user_id: string
          website: string
          whatsapp_number: string
          whatsapp_on_site: boolean
        }[]
      }
      get_leads_decrypted_filtered:
        | {
            Args: { p_salvo?: boolean }
            Returns: {
              ai_analise_gerada_em: string
              cidade: string
              cnae_principal: string
              cnpj: string
              cnpj_email: string
              cnpj_telefone: string
              created_at: string
              diagnostico_bullets: Json
              digital_signals: Json
              email: string
              endereco: string
              foco: string
              google_place_id: string
              has_gtag: boolean
              has_gtm: boolean
              has_meta_pixel: boolean
              id: string
              instagram_context: string
              instagram_url: string
              latitude: number
              longitude: number
              nicho: string
              nome: string
              nome_responsavel: string
              notas: string
              plano_prospeccao: Json
              porte_empresa: string
              probabilidade_conversao: number
              proximidade_ativa: boolean
              raio_km: number
              rating: number
              razao_social: string
              salvo: boolean
              situacao_cadastral: string
              status: string
              telefone: string
              total_reviews: number
              updated_at: string
              user_id: string
              website: string
              whatsapp_number: string
              whatsapp_on_site: boolean
            }[]
          }
        | {
            Args: { p_salvo?: boolean; p_user_id?: string }
            Returns: {
              ai_analise_gerada_em: string
              cidade: string
              cnae_principal: string
              cnpj: string
              cnpj_email: string
              cnpj_telefone: string
              created_at: string
              diagnostico_bullets: Json
              digital_signals: Json
              email: string
              endereco: string
              foco: string
              google_place_id: string
              has_gtag: boolean
              has_gtm: boolean
              has_meta_pixel: boolean
              id: string
              instagram_context: string
              instagram_url: string
              latitude: number
              longitude: number
              nicho: string
              nome: string
              nome_responsavel: string
              notas: string
              plano_prospeccao: Json
              porte_empresa: string
              probabilidade_conversao: number
              proximidade_ativa: boolean
              raio_km: number
              rating: number
              razao_social: string
              salvo: boolean
              situacao_cadastral: string
              status: string
              telefone: string
              total_reviews: number
              updated_at: string
              user_id: string
              website: string
              whatsapp_number: string
              whatsapp_on_site: boolean
            }[]
          }
      get_subscription_info: {
        Args: { p_user_id: string }
        Returns: {
          billing_period_end: string
          leads_limit: number
          leads_remaining: number
          leads_used: number
          plan_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_leads_used: {
        Args: { p_count: number; p_user_id: string }
        Returns: boolean
      }
      insert_email_log_encrypted: {
        Args: {
          p_campaign_id: string
          p_error_message?: string
          p_status: string
          p_user_email: string
          p_user_email_masked: string
          p_user_id: string
        }
        Returns: string
      }
      insert_lead_with_encryption:
        | {
            Args: {
              p_cidade: string
              p_digital_signals: Json
              p_endereco: string
              p_foco: string
              p_google_place_id: string
              p_has_gtag: boolean
              p_has_gtm: boolean
              p_has_meta_pixel: boolean
              p_instagram_url: string
              p_latitude: number
              p_longitude: number
              p_nicho: string
              p_nome: string
              p_proximidade_ativa: boolean
              p_raio_km: number
              p_rating: number
              p_telefone: string
              p_total_reviews: number
              p_user_id: string
              p_website: string
              p_whatsapp_number: string
              p_whatsapp_on_site: boolean
            }
            Returns: string
          }
        | {
            Args: {
              p_cidade: string
              p_digital_signals: Json
              p_email?: string
              p_endereco: string
              p_foco: string
              p_google_place_id: string
              p_has_gtag: boolean
              p_has_gtm: boolean
              p_has_meta_pixel: boolean
              p_instagram_url: string
              p_latitude: number
              p_longitude: number
              p_nicho: string
              p_nome: string
              p_proximidade_ativa: boolean
              p_raio_km: number
              p_rating: number
              p_telefone: string
              p_total_reviews: number
              p_user_id: string
              p_website: string
              p_whatsapp_number: string
              p_whatsapp_on_site: boolean
            }
            Returns: string
          }
      insert_lead_with_encryption_v2:
        | {
            Args: {
              p_cidade: string
              p_digital_signals: Json
              p_email?: string
              p_endereco: string
              p_foco: string
              p_google_place_id: string
              p_has_gtag: boolean
              p_has_gtm: boolean
              p_has_meta_pixel: boolean
              p_instagram_url: string
              p_latitude: number
              p_longitude: number
              p_nicho: string
              p_nome: string
              p_proximidade_ativa: boolean
              p_raio_km: number
              p_rating: number
              p_telefone: string
              p_total_reviews: number
              p_user_id: string
              p_website: string
              p_whatsapp_number: string
              p_whatsapp_on_site: boolean
            }
            Returns: Json
          }
        | {
            Args: {
              p_cidade: string
              p_digital_signals: Json
              p_email?: string
              p_endereco: string
              p_foco: string
              p_google_place_id: string
              p_has_gtag: boolean
              p_has_gtm: boolean
              p_has_meta_pixel: boolean
              p_instagram_url: string
              p_latitude: number
              p_longitude: number
              p_nicho: string
              p_nome: string
              p_pais?: string
              p_proximidade_ativa: boolean
              p_raio_km: number
              p_rating: number
              p_telefone: string
              p_total_reviews: number
              p_user_id: string
              p_website: string
              p_whatsapp_number: string
              p_whatsapp_on_site: boolean
            }
            Returns: Json
          }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      log_leads_access: {
        Args: {
          p_action_type: string
          p_ip_address?: string
          p_lead_ids?: string[]
          p_leads_count?: number
          p_request_params?: Json
          p_user_agent?: string
          p_user_id: string
        }
        Returns: string
      }
      reset_monthly_leads_count: { Args: never; Returns: undefined }
      update_lead_encrypted_fields: {
        Args: {
          p_email?: string
          p_instagram_url?: string
          p_lead_id: string
          p_whatsapp_number?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const

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
      leads: {
        Row: {
          ai_analise_gerada_em: string | null
          cidade: string
          created_at: string
          diagnostico_bullets: Json | null
          digital_signals: Json | null
          email: string | null
          endereco: string | null
          foco: string
          google_place_id: string | null
          has_gtag: boolean | null
          has_gtm: boolean | null
          has_meta_pixel: boolean | null
          id: string
          instagram_context: string | null
          instagram_url: string | null
          latitude: number | null
          longitude: number | null
          nicho: string
          nome: string
          notas: string | null
          plano_prospeccao: Json | null
          probabilidade_conversao: number | null
          proximidade_ativa: boolean | null
          raio_km: number | null
          rating: number | null
          status: string | null
          telefone: string | null
          total_reviews: number | null
          updated_at: string
          user_id: string
          website: string | null
          whatsapp_number: string | null
          whatsapp_on_site: boolean | null
        }
        Insert: {
          ai_analise_gerada_em?: string | null
          cidade: string
          created_at?: string
          diagnostico_bullets?: Json | null
          digital_signals?: Json | null
          email?: string | null
          endereco?: string | null
          foco: string
          google_place_id?: string | null
          has_gtag?: boolean | null
          has_gtm?: boolean | null
          has_meta_pixel?: boolean | null
          id?: string
          instagram_context?: string | null
          instagram_url?: string | null
          latitude?: number | null
          longitude?: number | null
          nicho: string
          nome: string
          notas?: string | null
          plano_prospeccao?: Json | null
          probabilidade_conversao?: number | null
          proximidade_ativa?: boolean | null
          raio_km?: number | null
          rating?: number | null
          status?: string | null
          telefone?: string | null
          total_reviews?: number | null
          updated_at?: string
          user_id: string
          website?: string | null
          whatsapp_number?: string | null
          whatsapp_on_site?: boolean | null
        }
        Update: {
          ai_analise_gerada_em?: string | null
          cidade?: string
          created_at?: string
          diagnostico_bullets?: Json | null
          digital_signals?: Json | null
          email?: string | null
          endereco?: string | null
          foco?: string
          google_place_id?: string | null
          has_gtag?: boolean | null
          has_gtm?: boolean | null
          has_meta_pixel?: boolean | null
          id?: string
          instagram_context?: string | null
          instagram_url?: string | null
          latitude?: number | null
          longitude?: number | null
          nicho?: string
          nome?: string
          notas?: string | null
          plano_prospeccao?: Json | null
          probabilidade_conversao?: number | null
          proximidade_ativa?: boolean | null
          raio_km?: number | null
          rating?: number | null
          status?: string | null
          telefone?: string | null
          total_reviews?: number | null
          updated_at?: string
          user_id?: string
          website?: string | null
          whatsapp_number?: string | null
          whatsapp_on_site?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_analyses: {
        Row: {
          away_team: string
          created_at: string
          home_team: string
          id: string
          match_id: string | null
          prediction_confidence: number | null
          prediction_market: string | null
          prediction_odd: number | null
          prediction_pick: string | null
          result: Json
          settlement_outcome: string | null
          settlement_status: "pending" | "won" | "lost" | "unresolvable"
          final_score: string | null
          settled_at: string | null
          user_id: string
        }
        Insert: {
          away_team: string
          created_at?: string
          home_team: string
          id?: string
          match_id?: string | null
          prediction_confidence?: number | null
          prediction_market?: string | null
          prediction_odd?: number | null
          prediction_pick?: string | null
          result: Json
          settlement_outcome?: string | null
          settlement_status?: "pending" | "won" | "lost" | "unresolvable"
          final_score?: string | null
          settled_at?: string | null
          user_id: string
        }
        Update: {
          away_team?: string
          created_at?: string
          home_team?: string
          id?: string
          match_id?: string | null
          prediction_confidence?: number | null
          prediction_market?: string | null
          prediction_odd?: number | null
          prediction_pick?: string | null
          result?: Json
          settlement_outcome?: string | null
          settlement_status?: "pending" | "won" | "lost" | "unresolvable"
          final_score?: string | null
          settled_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      community_predictions: {
        Row: {
          id: string
          user_id: string | null
          user_name: string
          fixture_id: number
          home_team: string
          away_team: string
          prediction: "home" | "draw" | "away"
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          user_name?: string
          fixture_id: number
          home_team: string
          away_team: string
          prediction: "home" | "draw" | "away"
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          user_name?: string
          fixture_id?: number
          home_team?: string
          away_team?: string
          prediction?: "home" | "draw" | "away"
          created_at?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      credits_ledger: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["credit_kind"]
          label: string
          meta: Json | null
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["credit_kind"]
          label: string
          meta?: Json | null
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["credit_kind"]
          label?: string
          meta?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["favorite_kind"]
          label: string | null
          notify: boolean
          ref_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["favorite_kind"]
          label?: string | null
          notify?: boolean
          ref_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["favorite_kind"]
          label?: string | null
          notify?: boolean
          ref_id?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_xaf: number
          created_at: string
          credited_at: string | null
          credits: number
          external_id: string
          id: string
          link: string | null
          pack_id: string
          provider: string
          status: string
          trans_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_xaf: number
          created_at?: string
          credited_at?: string | null
          credits: number
          external_id: string
          id?: string
          link?: string | null
          pack_id: string
          provider?: string
          status?: string
          trans_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_xaf?: number
          created_at?: string
          credited_at?: string | null
          credits?: number
          external_id?: string
          id?: string
          link?: string | null
          pack_id?: string
          provider?: string
          status?: string
          trans_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          credits: number
          display_name: string | null
          id: string
          plan: Database["public"]["Enums"]["plan_tier"]
          premium_until: string | null
          referral_code: string | null
          referred_by: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          credits?: number
          display_name?: string | null
          id: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          premium_until?: string | null
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          credits?: number
          display_name?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          premium_until?: string | null
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount_xaf: number
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          external_id: string
          id: string
          plan_id: string
          provider: string
          status: string
          trans_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_xaf: number
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_id: string
          id?: string
          plan_id: string
          provider?: string
          status?: string
          trans_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_xaf?: number
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_id?: string
          id?: string
          plan_id?: string
          provider?: string
          status?: string
          trans_id?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      consume_analysis_credit: {
        Args: {
          p_user_id: string
          p_cost: number
          p_home_team: string
          p_away_team: string
          p_match_id: string | null
          p_result: Json
        }
        Returns: {
          analysis_id: string
          new_balance: number
        }[]
      }
      credit_payment: {
        Args: {
          p_payment_id: string
          p_user_id: string
          p_credits: number
        }
        Returns: {
          credited: boolean
          new_balance: number
        }[]
      }
      activate_subscription: {
        Args: {
          p_subscription_id: string
          p_user_id: string
          p_period_start: string
          p_period_end: string
          p_plan_id: string
        }
        Returns: {
          activated: boolean
          new_balance: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      credit_kind: "analysis" | "topup" | "bonus" | "refund" | "subscription"
      favorite_kind: "team" | "competition" | "match"
      plan_tier: "free" | "premium"
      prediction_choice: "home" | "draw" | "away"
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
      app_role: ["admin", "user"],
      credit_kind: ["analysis", "topup", "bonus", "refund", "subscription"],
      favorite_kind: ["team", "competition", "match"],
      plan_tier: ["free", "premium"],
      prediction_choice: ["home", "draw", "away"],
    },
  },
} as const

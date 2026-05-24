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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          cancelled_at: string | null
          consumed_at: string | null
          created_at: string
          id: string
          token: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          consumed_at?: string | null
          created_at?: string
          id?: string
          token: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          consumed_at?: string | null
          created_at?: string
          id?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      calculators: {
        Row: {
          created_at: string
          description: string
          id: string
          owner_id: string
          public_token: string
          published: boolean
          soft_delete_at: string | null
          theme_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          owner_id: string
          public_token?: string
          published?: boolean
          soft_delete_at?: string | null
          theme_id?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          owner_id?: string
          public_token?: string
          published?: boolean
          soft_delete_at?: string | null
          theme_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cells: {
        Row: {
          calculator_id: string
          card_accent: string
          card_background_tint: string
          card_border: string
          card_size_hint: string
          created_at: string
          currency_code: string | null
          default_value: Json | null
          description: string
          description_render: string
          display_emphasis: string
          display_format: string
          display_order: number
          display_widget: string | null
          editability: string
          formula: string | null
          id: string
          kind: string
          label: string
          name: string
          numeric_max: number | null
          numeric_min: number | null
          numeric_step: number | null
          section_id: string
          select_options: Json | null
          text_colour: string
          text_size: string
          unit: string | null
          updated_at: string
          value_type: string
          visibility: string
        }
        Insert: {
          calculator_id: string
          card_accent?: string
          card_background_tint?: string
          card_border?: string
          card_size_hint?: string
          created_at?: string
          currency_code?: string | null
          default_value?: Json | null
          description?: string
          description_render?: string
          display_emphasis?: string
          display_format?: string
          display_order: number
          display_widget?: string | null
          editability: string
          formula?: string | null
          id?: string
          kind: string
          label?: string
          name: string
          numeric_max?: number | null
          numeric_min?: number | null
          numeric_step?: number | null
          section_id: string
          select_options?: Json | null
          text_colour?: string
          text_size?: string
          unit?: string | null
          updated_at?: string
          value_type: string
          visibility?: string
        }
        Update: {
          calculator_id?: string
          card_accent?: string
          card_background_tint?: string
          card_border?: string
          card_size_hint?: string
          created_at?: string
          currency_code?: string | null
          default_value?: Json | null
          description?: string
          description_render?: string
          display_emphasis?: string
          display_format?: string
          display_order?: number
          display_widget?: string | null
          editability?: string
          formula?: string | null
          id?: string
          kind?: string
          label?: string
          name?: string
          numeric_max?: number | null
          numeric_min?: number | null
          numeric_step?: number | null
          section_id?: string
          select_options?: Json | null
          text_colour?: string
          text_size?: string
          unit?: string | null
          updated_at?: string
          value_type?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "cells_calculator_id_fkey"
            columns: ["calculator_id"]
            isOneToOne: false
            referencedRelation: "calculators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cells_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          default_calculator_theme: string | null
          email: string
          id: string
          name: string
          pending_deletion_at: string | null
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_calculator_theme?: string | null
          email: string
          id: string
          name: string
          pending_deletion_at?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_calculator_theme?: string | null
          email?: string
          id?: string
          name?: string
          pending_deletion_at?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      scenarios: {
        Row: {
          calculator_id: string | null
          created_at: string
          description: string
          id: string
          owner_id: string
          share_token: string | null
          title: string
          updated_at: string
          values: Json
        }
        Insert: {
          calculator_id?: string | null
          created_at?: string
          description?: string
          id?: string
          owner_id: string
          share_token?: string | null
          title: string
          updated_at?: string
          values?: Json
        }
        Update: {
          calculator_id?: string | null
          created_at?: string
          description?: string
          id?: string
          owner_id?: string
          share_token?: string | null
          title?: string
          updated_at?: string
          values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "scenarios_calculator_id_fkey"
            columns: ["calculator_id"]
            isOneToOne: false
            referencedRelation: "calculators"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          calculator_id: string
          created_at: string
          description: string
          display_order: number
          id: string
          layout_pattern_id: string
          title: string
          updated_at: string
        }
        Insert: {
          calculator_id: string
          created_at?: string
          description?: string
          display_order: number
          id?: string
          layout_pattern_id?: string
          title?: string
          updated_at?: string
        }
        Update: {
          calculator_id?: string
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          layout_pattern_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_calculator_id_fkey"
            columns: ["calculator_id"]
            isOneToOne: false
            referencedRelation: "calculators"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_approvals: {
        Row: {
          consumed_at: string | null
          created_at: string
          id: string
          outcome: string | null
          token: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          id?: string
          outcome?: string | null
          token: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          id?: string
          outcome?: string | null
          token?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fn_clear_pending_email_change: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      fn_duplicate_calculator: {
        Args: { source_id: string }
        Returns: {
          default_section_id: string
          description: string
          id: string
          public_token: string
          published: boolean
          theme_id: string
          title: string
          updated_at: string
        }[]
      }
      fn_get_public_calculator: {
        Args: { p_token: string }
        Returns: {
          description: string
          id: string
          owner_id: string
          public_token: string
          published: boolean
          sections: Json
          soft_delete_at: string
          theme_id: string
          title: string
          updated_at: string
        }[]
      }
      fn_get_scenario_by_share_token: {
        Args: { p_calc_token: string; p_share_token: string }
        Returns: {
          calculator_payload: Json
          scenario_description: string
          scenario_id: string
          scenario_owner_id: string
          scenario_owner_name: string
          scenario_title: string
          scenario_updated_at: string
          scenario_values: Json
        }[]
      }
      gen_calculator_public_token: { Args: never; Returns: string }
      is_sysadmin: { Args: { uid: string }; Returns: boolean }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

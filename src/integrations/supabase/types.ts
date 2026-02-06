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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      contracts: {
        Row: {
          created_at: string
          created_by: string
          dealership_id: string
          file_name: string
          file_path: string
          id: string
          proposal_id: string
          signed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          dealership_id: string
          file_name: string
          file_path: string
          id?: string
          proposal_id: string
          signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          dealership_id?: string
          file_name?: string
          file_path?: string
          id?: string
          proposal_id?: string
          signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_dealership_id_fkey"
            columns: ["dealership_id"]
            isOneToOne: false
            referencedRelation: "dealerships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      dealerships: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          id: string
          invite_code: string
          name: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invite_code?: string
          name: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invite_code?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      installation_photos: {
        Row: {
          created_at: string
          dealership_id: string
          file_name: string
          file_path: string
          id: string
          proposal_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          dealership_id: string
          file_name: string
          file_path: string
          id?: string
          proposal_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          dealership_id?: string
          file_name?: string
          file_path?: string
          id?: string
          proposal_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "installation_photos_dealership_id_fkey"
            columns: ["dealership_id"]
            isOneToOne: false
            referencedRelation: "dealerships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installation_photos_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string
          customer_email: string | null
          dealership_id: string
          id: string
          proposal_id: string
          status: string
          stripe_invoice_id: string | null
          stripe_payment_link: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by: string
          customer_email?: string | null
          dealership_id: string
          id?: string
          proposal_id: string
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_link?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string
          customer_email?: string | null
          dealership_id?: string
          id?: string
          proposal_id?: string
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_link?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_dealership_id_fkey"
            columns: ["dealership_id"]
            isOneToOne: false
            referencedRelation: "dealerships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          dealership_id: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          dealership_id: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price_cents: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          dealership_id?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_dealership_id_fkey"
            columns: ["dealership_id"]
            isOneToOne: false
            referencedRelation: "dealerships"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          dealership_id: string | null
          email: string | null
          full_name: string
          id: string
          phone: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          dealership_id?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          dealership_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_dealership_id_fkey"
            columns: ["dealership_id"]
            isOneToOne: false
            referencedRelation: "dealerships"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          address: string
          bottled_water_cases: string | null
          chlorine: number | null
          created_at: string
          created_by: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          dealership_id: string
          hardness: number | null
          has_dishwasher: boolean | null
          has_dryer: boolean | null
          has_ice_maker: boolean | null
          has_water_heater: boolean | null
          home_age: string | null
          household_size: string | null
          id: string
          iron: number | null
          num_bathrooms: string | null
          num_showers: string | null
          ph: number | null
          presentation_url: string | null
          recommended_system: string
          tds: number | null
          water_concerns: string | null
          water_source: string | null
        }
        Insert: {
          address: string
          bottled_water_cases?: string | null
          chlorine?: number | null
          created_at?: string
          created_by: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          dealership_id: string
          hardness?: number | null
          has_dishwasher?: boolean | null
          has_dryer?: boolean | null
          has_ice_maker?: boolean | null
          has_water_heater?: boolean | null
          home_age?: string | null
          household_size?: string | null
          id?: string
          iron?: number | null
          num_bathrooms?: string | null
          num_showers?: string | null
          ph?: number | null
          presentation_url?: string | null
          recommended_system: string
          tds?: number | null
          water_concerns?: string | null
          water_source?: string | null
        }
        Update: {
          address?: string
          bottled_water_cases?: string | null
          chlorine?: number | null
          created_at?: string
          created_by?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          dealership_id?: string
          hardness?: number | null
          has_dishwasher?: boolean | null
          has_dryer?: boolean | null
          has_ice_maker?: boolean | null
          has_water_heater?: boolean | null
          home_age?: string | null
          household_size?: string | null
          id?: string
          iron?: number | null
          num_bathrooms?: string | null
          num_showers?: string | null
          ph?: number | null
          presentation_url?: string | null
          recommended_system?: string
          tds?: number | null
          water_concerns?: string | null
          water_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_dealership_id_fkey"
            columns: ["dealership_id"]
            isOneToOne: false
            referencedRelation: "dealerships"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_accounts: {
        Row: {
          created_at: string
          dealership_id: string
          id: string
          is_onboarded: boolean
          stripe_account_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dealership_id: string
          id?: string
          is_onboarded?: boolean
          stripe_account_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dealership_id?: string
          id?: string
          is_onboarded?: boolean
          stripe_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_accounts_dealership_id_fkey"
            columns: ["dealership_id"]
            isOneToOne: false
            referencedRelation: "dealerships"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          dealership_id: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          dealership_id: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          dealership_id?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_dealership_id_fkey"
            columns: ["dealership_id"]
            isOneToOne: false
            referencedRelation: "dealerships"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_dealership_for_current_user: {
        Args: { _name: string }
        Returns: {
          address: string | null
          created_at: string
          created_by: string | null
          id: string
          invite_code: string
          name: string
          phone: string | null
        }
        SetofOptions: {
          from: "*"
          to: "dealerships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      find_dealership_by_invite_code: {
        Args: { code: string }
        Returns: {
          id: string
          invite_code: string
          name: string
        }[]
      }
      get_user_dealership: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _dealership_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      user_role: "admin" | "rep"
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
      user_role: ["admin", "rep"],
    },
  },
} as const

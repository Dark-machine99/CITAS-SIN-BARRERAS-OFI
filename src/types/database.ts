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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accessibility_preferences: {
        Row: {
          colorblind_mode: boolean
          font_scale: number
          guided_reading: boolean
          high_contrast: boolean
          keyboard_enhancements: boolean
          large_cursor: boolean
          magnifier_enabled: boolean
          preset: string
          reduced_motion: boolean
          simple_mode: boolean
          updated_at: string
          user_id: string
          voice_control: boolean
        }
        Insert: {
          colorblind_mode?: boolean
          font_scale?: number
          guided_reading?: boolean
          high_contrast?: boolean
          keyboard_enhancements?: boolean
          large_cursor?: boolean
          magnifier_enabled?: boolean
          preset?: string
          reduced_motion?: boolean
          simple_mode?: boolean
          updated_at?: string
          user_id: string
          voice_control?: boolean
        }
        Update: {
          colorblind_mode?: boolean
          font_scale?: number
          guided_reading?: boolean
          high_contrast?: boolean
          keyboard_enhancements?: boolean
          large_cursor?: boolean
          magnifier_enabled?: boolean
          preset?: string
          reduced_motion?: boolean
          simple_mode?: boolean
          updated_at?: string
          user_id?: string
          voice_control?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "accessibility_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          code: string
          created_at: string
          doctor_id: string
          duration_minutes: number
          id: string
          patient_id: string
          reason: string | null
          specialty_id: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          code: string
          created_at?: string
          doctor_id: string
          duration_minutes: number
          id?: string
          patient_id: string
          reason?: string | null
          specialty_id: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          code?: string
          created_at?: string
          doctor_id?: string
          duration_minutes?: number
          id?: string
          patient_id?: string
          reason?: string | null
          specialty_id?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_doctor_specialty_fkey"
            columns: ["doctor_id", "specialty_id"]
            isOneToOne: false
            referencedRelation: "doctor_specialties"
            referencedColumns: ["doctor_id", "specialty_id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_schedule_exceptions: {
        Row: {
          date: string
          doctor_id: string
          end_time: string | null
          id: string
          kind: string
          reason: string | null
          start_time: string | null
        }
        Insert: {
          date: string
          doctor_id: string
          end_time?: string | null
          id?: string
          kind: string
          reason?: string | null
          start_time?: string | null
        }
        Update: {
          date?: string
          doctor_id?: string
          end_time?: string | null
          id?: string
          kind?: string
          reason?: string | null
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_schedule_exceptions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_specialties: {
        Row: {
          doctor_id: string
          specialty_id: string
        }
        Insert: {
          doctor_id: string
          specialty_id: string
        }
        Update: {
          doctor_id?: string
          specialty_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_specialties_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_specialties_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_weekly_availability: {
        Row: {
          active: boolean
          doctor_id: string
          end_time: string
          id: string
          slot_minutes: number
          start_time: string
          weekday: number
        }
        Insert: {
          active?: boolean
          doctor_id: string
          end_time: string
          id?: string
          slot_minutes: number
          start_time: string
          weekday: number
        }
        Update: {
          active?: boolean
          doctor_id?: string
          end_time?: string
          id?: string
          slot_minutes?: number
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "doctor_weekly_availability_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          active: boolean
          created_at: string
          id: string
          profile_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          profile_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          first_name: string
          id: string
          last_name: string
          must_change_password: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_name: string
          id: string
          last_name: string
          must_change_password?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          must_change_password?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      patient_tutorial_progress: {
        Row: {
          created_at: string
          current_step: number
          finished_at: string | null
          started_at: string | null
          status: "pending" | "in_progress" | "completed" | "skipped"
          tutorial_version: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_step?: number
          finished_at?: string | null
          started_at?: string | null
          status?: "pending" | "in_progress" | "completed" | "skipped"
          tutorial_version?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_step?: number
          finished_at?: string | null
          started_at?: string | null
          status?: "pending" | "in_progress" | "completed" | "skipped"
          tutorial_version?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_tutorial_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      specialties: {
        Row: {
          active: boolean
          description: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          description?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          description?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_appointment_overview: {
        Row: {
          appointment_date: string | null
          appointment_time: string | null
          code: string | null
          doctor_id: string | null
          duration_minutes: number | null
          id: string | null
          specialty_id: string | null
          status: Database["public"]["Enums"]["appointment_status"] | null
        }
        Relationships: []
      }
      admin_doctor_directory: {
        Row: {
          active: boolean | null
          doctor_id: string | null
          first_name: string | null
          last_name: string | null
          must_change_password: boolean | null
          specialty_ids: string[] | null
        }
        Relationships: []
      }
      admin_user_directory: {
        Row: {
          first_name: string | null
          last_name: string | null
          profile_id: string | null
          role: Database["public"]["Enums"]["user_role"] | null
        }
        Relationships: []
      }
      appointment_patient_names: {
        Row: {
          appointment_id: string | null
          first_name: string | null
          last_name: string | null
        }
        Relationships: []
      }
      doctor_directory: {
        Row: {
          doctor_id: string | null
          first_name: string | null
          last_name: string | null
          specialty_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_doctor_invite_state: { Args: { p_email: string }; Returns: Json }
      cancel_appointment: { Args: { p_appointment_id: string }; Returns: Json }
      cleanup_failed_doctor_invite: {
        Args: { p_profile_id: string }
        Returns: boolean
      }
      get_available_slots: {
        Args: { p_date: string; p_doctor_id: string; p_specialty_id: string }
        Returns: Json
      }
      promote_invited_doctor: {
        Args: {
          p_first_name: string
          p_last_name: string
          p_profile_id: string
          p_specialty_ids: string[]
        }
        Returns: Json
      }
      reschedule_appointment: {
        Args: {
          p_appointment_id: string
          p_new_date: string
          p_new_time: string
        }
        Returns: Json
      }
      reserve_appointment: {
        Args: {
          p_date: string
          p_doctor_id: string
          p_reason?: string | null
          p_specialty_id: string
          p_time: string
        }
        Returns: Json
      }
    }
    Enums: {
      appointment_status:
        | "pending"
        | "confirmed"
        | "attended"
        | "no_show"
        | "cancelled"
      user_role: "patient" | "doctor" | "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      appointment_status: [
        "pending",
        "confirmed",
        "attended",
        "no_show",
        "cancelled",
      ],
      user_role: ["patient", "doctor", "admin"],
    },
  },
} as const

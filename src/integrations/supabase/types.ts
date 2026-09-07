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
      ai_providers: {
        Row: {
          approved: boolean
          capability: Database["public"]["Enums"]["provider_capability"]
          cost_tier: Database["public"]["Enums"]["cost_tier"]
          created_at: string
          enabled: boolean
          id: string
          key: string
          label: string
          last_error: string | null
          last_used_at: string | null
          priority: number
          requires_approval: boolean
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          capability: Database["public"]["Enums"]["provider_capability"]
          cost_tier?: Database["public"]["Enums"]["cost_tier"]
          created_at?: string
          enabled?: boolean
          id?: string
          key: string
          label: string
          last_error?: string | null
          last_used_at?: string | null
          priority?: number
          requires_approval?: boolean
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved?: boolean
          capability?: Database["public"]["Enums"]["provider_capability"]
          cost_tier?: Database["public"]["Enums"]["cost_tier"]
          created_at?: string
          enabled?: boolean
          id?: string
          key?: string
          label?: string
          last_error?: string | null
          last_used_at?: string | null
          priority?: number
          requires_approval?: boolean
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audio_files: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          is_mock: boolean
          job_id: string
          kind: string
          provider: string | null
          public_url: string | null
          scene_id: string | null
          storage_path: string | null
          text: string | null
          user_id: string
          voice: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_mock?: boolean
          job_id: string
          kind?: string
          provider?: string | null
          public_url?: string | null
          scene_id?: string | null
          storage_path?: string | null
          text?: string | null
          user_id: string
          voice?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_mock?: boolean
          job_id?: string
          kind?: string
          provider?: string | null
          public_url?: string | null
          scene_id?: string | null
          storage_path?: string | null
          text?: string | null
          user_id?: string
          voice?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audio_files_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "production_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_files_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_schedules: {
        Row: {
          cadence: string
          created_at: string
          day_of_week: number
          enabled: boolean
          hour_utc: number
          id: string
          last_run_at: string | null
          next_run_at: string | null
          privacy_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cadence?: string
          created_at?: string
          day_of_week?: number
          enabled?: boolean
          hour_utc?: number
          id?: string
          last_run_at?: string | null
          next_run_at?: string | null
          privacy_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cadence?: string
          created_at?: string
          day_of_week?: number
          enabled?: boolean
          hour_utc?: number
          id?: string
          last_run_at?: string | null
          next_run_at?: string | null
          privacy_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      characters: {
        Row: {
          appearance: string | null
          clothes: string | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          personality: string | null
          reference_image_url: string | null
          updated_at: string
          user_id: string
          visual_style: string | null
        }
        Insert: {
          appearance?: string | null
          clothes?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          personality?: string | null
          reference_image_url?: string | null
          updated_at?: string
          user_id: string
          visual_style?: string | null
        }
        Update: {
          appearance?: string | null
          clothes?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          personality?: string | null
          reference_image_url?: string | null
          updated_at?: string
          user_id?: string
          visual_style?: string | null
        }
        Relationships: []
      }
      failed_jobs: {
        Row: {
          created_at: string
          error: string
          id: string
          job_id: string | null
          resolved: boolean
          status_code: number | null
          step: Database["public"]["Enums"]["pipeline_step"] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          error: string
          id?: string
          job_id?: string | null
          resolved?: boolean
          status_code?: number | null
          step?: Database["public"]["Enums"]["pipeline_step"] | null
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string
          id?: string
          job_id?: string | null
          resolved?: boolean
          status_code?: number | null
          step?: Database["public"]["Enums"]["pipeline_step"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "failed_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "production_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_images: {
        Row: {
          created_at: string
          height: number
          id: string
          is_mock: boolean
          job_id: string
          prompt: string | null
          provider: string | null
          public_url: string | null
          scene_id: string
          storage_path: string | null
          user_id: string
          width: number
        }
        Insert: {
          created_at?: string
          height?: number
          id?: string
          is_mock?: boolean
          job_id: string
          prompt?: string | null
          provider?: string | null
          public_url?: string | null
          scene_id: string
          storage_path?: string | null
          user_id: string
          width?: number
        }
        Update: {
          created_at?: string
          height?: number
          id?: string
          is_mock?: boolean
          job_id?: string
          prompt?: string | null
          provider?: string | null
          public_url?: string | null
          scene_id?: string
          storage_path?: string | null
          user_id?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "generated_images_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "production_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_images_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: true
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      job_locks: {
        Row: {
          created_at: string
          holder: string | null
          key: string
          locked_until: string
        }
        Insert: {
          created_at?: string
          holder?: string | null
          key: string
          locked_until: string
        }
        Update: {
          created_at?: string
          holder?: string | null
          key?: string
          locked_until?: string
        }
        Relationships: []
      }
      job_steps: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          detail: string | null
          id: string
          job_id: string
          output: Json | null
          position: number
          started_at: string | null
          status: Database["public"]["Enums"]["step_status"]
          step: Database["public"]["Enums"]["pipeline_step"]
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          job_id: string
          output?: Json | null
          position: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["step_status"]
          step: Database["public"]["Enums"]["pipeline_step"]
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          job_id?: string
          output?: Json | null
          position?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["step_status"]
          step?: Database["public"]["Enums"]["pipeline_step"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_steps_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "production_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      production_jobs: {
        Row: {
          attempts: number
          created_at: string
          current_step: Database["public"]["Enums"]["pipeline_step"]
          finished_at: string | null
          id: string
          language: string
          last_error: string | null
          low_cost_mode: boolean
          next_run_at: string
          paused_at: string | null
          paused_reason: string | null
          progress: number
          request_prompt: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          topic_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          current_step?: Database["public"]["Enums"]["pipeline_step"]
          finished_at?: string | null
          id?: string
          language?: string
          last_error?: string | null
          low_cost_mode?: boolean
          next_run_at?: string
          paused_at?: string | null
          paused_reason?: string | null
          progress?: number
          request_prompt?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          topic_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          current_step?: Database["public"]["Enums"]["pipeline_step"]
          finished_at?: string | null
          id?: string
          language?: string
          last_error?: string | null
          low_cost_mode?: boolean
          next_run_at?: string
          paused_at?: string | null
          paused_reason?: string | null
          progress?: number
          request_prompt?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          topic_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_jobs_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          default_language: string
          display_name: string | null
          email: string | null
          id: string
          low_cost_mode: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_language?: string
          display_name?: string | null
          email?: string | null
          id: string
          low_cost_mode?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_language?: string
          display_name?: string | null
          email?: string | null
          id?: string
          low_cost_mode?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      scenes: {
        Row: {
          animation: string | null
          characters: Json
          created_at: string
          description: string | null
          dialogue: string | null
          duration_seconds: number
          id: string
          image_prompt: string | null
          job_id: string
          narration: string | null
          scene_number: number
          sound_effects: string | null
          story_id: string | null
          user_id: string
        }
        Insert: {
          animation?: string | null
          characters?: Json
          created_at?: string
          description?: string | null
          dialogue?: string | null
          duration_seconds?: number
          id?: string
          image_prompt?: string | null
          job_id: string
          narration?: string | null
          scene_number: number
          sound_effects?: string | null
          story_id?: string | null
          user_id: string
        }
        Update: {
          animation?: string | null
          characters?: Json
          created_at?: string
          description?: string | null
          dialogue?: string | null
          duration_seconds?: number
          id?: string
          image_prompt?: string | null
          job_id?: string
          narration?: string | null
          scene_number?: number
          sound_effects?: string | null
          story_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "production_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenes_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          body: string
          created_at: string
          ending: string | null
          estimated_seconds: number | null
          hook: string | null
          id: string
          job_id: string
          language: string
          lesson: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          ending?: string | null
          estimated_seconds?: number | null
          hook?: string | null
          id?: string
          job_id: string
          language?: string
          lesson?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          ending?: string | null
          estimated_seconds?: number | null
          hook?: string | null
          id?: string
          job_id?: string
          language?: string
          lesson?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stories_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "production_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          category: string | null
          created_at: string
          id: string
          language: string
          last_used_at: string | null
          slug: string
          title: string
          used_count: number
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          language?: string
          last_used_at?: string | null
          slug: string
          title: string
          used_count?: number
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          language?: string
          last_used_at?: string | null
          slug?: string
          title?: string
          used_count?: number
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
          role?: Database["public"]["Enums"]["app_role"]
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
      videos: {
        Row: {
          created_at: string
          description: string | null
          duration_seconds: number | null
          height: number
          id: string
          job_id: string
          public_url: string | null
          quality_report: Json | null
          render_status: string
          storage_path: string | null
          subtitles_vtt: string | null
          tags: string[]
          title: string | null
          updated_at: string
          user_id: string
          width: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          height?: number
          id?: string
          job_id: string
          public_url?: string | null
          quality_report?: Json | null
          render_status?: string
          storage_path?: string | null
          subtitles_vtt?: string | null
          tags?: string[]
          title?: string | null
          updated_at?: string
          user_id: string
          width?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          height?: number
          id?: string
          job_id?: string
          public_url?: string | null
          quality_report?: Json | null
          render_status?: string
          storage_path?: string | null
          subtitles_vtt?: string | null
          tags?: string[]
          title?: string | null
          updated_at?: string
          user_id?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "videos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "production_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_accounts: {
        Row: {
          access_token: string | null
          channel_id: string | null
          channel_title: string | null
          connected_at: string
          id: string
          refresh_token: string | null
          scope: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          channel_id?: string | null
          channel_title?: string | null
          connected_at?: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          channel_id?: string | null
          channel_title?: string | null
          connected_at?: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      youtube_uploads: {
        Row: {
          created_at: string
          error: string | null
          id: string
          job_id: string | null
          privacy_status: string
          status: string
          updated_at: string
          user_id: string
          video_id: string | null
          youtube_video_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          job_id?: string | null
          privacy_status?: string
          status?: string
          updated_at?: string
          user_id: string
          video_id?: string | null
          youtube_video_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          job_id?: string | null
          privacy_status?: string
          status?: string
          updated_at?: string
          user_id?: string
          video_id?: string | null
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "youtube_uploads_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "production_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youtube_uploads_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
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
      verify_worker_token: { Args: { _token: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      cost_tier: "free" | "low" | "paid"
      job_status:
        | "queued"
        | "running"
        | "paused"
        | "completed"
        | "failed"
        | "cancelled"
      pipeline_step:
        | "pick_topic"
        | "write_story"
        | "split_scenes"
        | "generate_images"
        | "generate_voice"
        | "build_subtitles"
        | "render_video"
        | "quality_check"
        | "upload_youtube"
      provider_capability: "text" | "image" | "voice" | "music"
      step_status:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "skipped"
        | "blocked"
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
      app_role: ["admin", "user"],
      cost_tier: ["free", "low", "paid"],
      job_status: [
        "queued",
        "running",
        "paused",
        "completed",
        "failed",
        "cancelled",
      ],
      pipeline_step: [
        "pick_topic",
        "write_story",
        "split_scenes",
        "generate_images",
        "generate_voice",
        "build_subtitles",
        "render_video",
        "quality_check",
        "upload_youtube",
      ],
      provider_capability: ["text", "image", "voice", "music"],
      step_status: [
        "pending",
        "running",
        "completed",
        "failed",
        "skipped",
        "blocked",
      ],
    },
  },
} as const

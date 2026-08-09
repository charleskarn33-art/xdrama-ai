/**
 * Hand-written to exactly match supabase/migrations/*.sql, verified against
 * a real local Postgres in supabase/tests/. `supabase gen types typescript`
 * needs Docker (even in --db-url mode, to run its introspection container),
 * which wasn't available in the sandbox this was authored in. Regenerate
 * for real once linked to a live project:
 *   supabase gen types typescript --linked > src/lib/supabase/types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          is_platform_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          is_platform_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          is_platform_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          owner_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          owner_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organizations_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_members: {
        Row: {
          org_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["organization_role"];
          created_at: string;
        };
        Insert: {
          org_id: string;
          user_id: string;
          role?: Database["public"]["Enums"]["organization_role"];
          created_at?: string;
        };
        Update: {
          org_id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["organization_role"];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          id: number;
          org_id: string | null;
          actor_id: string | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: number;
          org_id?: string | null;
          actor_id?: string | null;
          action: string;
          target_type?: string | null;
          target_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: number;
          org_id?: string | null;
          actor_id?: string | null;
          action?: string;
          target_type?: string | null;
          target_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          description: string | null;
          status: Database["public"]["Enums"]["project_status"];
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          description?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          description?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      characters: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          description: string | null;
          appearance: string | null;
          personality: string | null;
          voice_description: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          description?: string | null;
          appearance?: string | null;
          personality?: string | null;
          voice_description?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          description?: string | null;
          appearance?: string | null;
          personality?: string | null;
          voice_description?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "characters_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      locations: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          description: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          description?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          description?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "locations_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      props: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          description: string | null;
          appearance: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          description?: string | null;
          appearance?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          description?: string | null;
          appearance?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "props_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      character_relationships: {
        Row: {
          id: string;
          project_id: string;
          character_id: string;
          related_character_id: string;
          relationship_type: string;
          description: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string;
          character_id: string;
          related_character_id: string;
          relationship_type: string;
          description?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          character_id?: string;
          related_character_id?: string;
          relationship_type?: string;
          description?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "character_relationships_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "character_relationships_related_character_id_fkey";
            columns: ["related_character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      timeline_events: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          description: string | null;
          in_story_date: string | null;
          event_order: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          description?: string | null;
          in_story_date?: string | null;
          event_order?: number;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          description?: string | null;
          in_story_date?: string | null;
          event_order?: number;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "timeline_events_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      story_bible_notes: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          content: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          content?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          content?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "story_bible_notes_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      scripts: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          content: string;
          status: Database["public"]["Enums"]["script_status"];
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          content?: string;
          status?: Database["public"]["Enums"]["script_status"];
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          content?: string;
          status?: Database["public"]["Enums"]["script_status"];
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scripts_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_models: {
        Row: {
          id: string;
          slug: string;
          name: string;
          category: Database["public"]["Enums"]["ai_model_category"];
          description: string | null;
          version: string;
          source_url: string | null;
          supported_features: string[];
          vram_gb: number | null;
          disk_gb: number | null;
          install_status: Database["public"]["Enums"]["ai_model_install_status"];
          is_enabled: boolean;
          health_status: Database["public"]["Enums"]["ai_model_health_status"];
          last_health_check_at: string | null;
          gpu_assignment: string | null;
          benchmark_results: Json | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          category: Database["public"]["Enums"]["ai_model_category"];
          description?: string | null;
          version?: string;
          source_url?: string | null;
          supported_features?: string[];
          vram_gb?: number | null;
          disk_gb?: number | null;
          install_status?: Database["public"]["Enums"]["ai_model_install_status"];
          is_enabled?: boolean;
          health_status?: Database["public"]["Enums"]["ai_model_health_status"];
          last_health_check_at?: string | null;
          gpu_assignment?: string | null;
          benchmark_results?: Json | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          category?: Database["public"]["Enums"]["ai_model_category"];
          description?: string | null;
          version?: string;
          source_url?: string | null;
          supported_features?: string[];
          vram_gb?: number | null;
          disk_gb?: number | null;
          install_status?: Database["public"]["Enums"]["ai_model_install_status"];
          is_enabled?: boolean;
          health_status?: Database["public"]["Enums"]["ai_model_health_status"];
          last_health_check_at?: string | null;
          gpu_assignment?: string | null;
          benchmark_results?: Json | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      routing_rules: {
        Row: {
          id: string;
          task_type: string;
          category: Database["public"]["Enums"]["ai_model_category"];
          description: string | null;
          preferred_model_slugs: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_type: string;
          category: Database["public"]["Enums"]["ai_model_category"];
          description?: string | null;
          preferred_model_slugs: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          task_type?: string;
          category?: Database["public"]["Enums"]["ai_model_category"];
          description?: string | null;
          preferred_model_slugs?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workflow_templates: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          category: string;
          graph: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          category: string;
          graph: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          category?: string;
          graph?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workflows: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          graph: Json;
          source_template_id: string | null;
          subject_type:
            Database["public"]["Enums"]["workflow_subject_type"] | null;
          subject_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          graph: Json;
          source_template_id?: string | null;
          subject_type?:
            Database["public"]["Enums"]["workflow_subject_type"] | null;
          subject_id?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          graph?: Json;
          source_template_id?: string | null;
          subject_type?:
            Database["public"]["Enums"]["workflow_subject_type"] | null;
          subject_id?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workflows_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflows_source_template_id_fkey";
            columns: ["source_template_id"];
            isOneToOne: false;
            referencedRelation: "workflow_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      render_jobs: {
        Row: {
          id: string;
          project_id: string;
          workflow_id: string;
          status: Database["public"]["Enums"]["render_job_status"];
          input_params: Json;
          output_asset_url: string | null;
          error_message: string | null;
          progress: number | null;
          created_by: string;
          created_at: string;
          updated_at: string;
          started_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          workflow_id: string;
          status?: Database["public"]["Enums"]["render_job_status"];
          input_params?: Json;
          output_asset_url?: string | null;
          error_message?: string | null;
          progress?: number | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          workflow_id?: string;
          status?: Database["public"]["Enums"]["render_job_status"];
          input_params?: Json;
          output_asset_url?: string | null;
          error_message?: string | null;
          progress?: number | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "render_jobs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "render_jobs_workflow_id_fkey";
            columns: ["workflow_id"];
            isOneToOne: false;
            referencedRelation: "workflows";
            referencedColumns: ["id"];
          },
        ];
      };
      scenes: {
        Row: {
          id: string;
          project_id: string;
          script_id: string | null;
          location_id: string | null;
          title: string;
          description: string | null;
          scene_order: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          script_id?: string | null;
          location_id?: string | null;
          title: string;
          description?: string | null;
          scene_order?: number;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          script_id?: string | null;
          location_id?: string | null;
          title?: string;
          description?: string | null;
          scene_order?: number;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scenes_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scenes_script_id_fkey";
            columns: ["script_id"];
            isOneToOne: false;
            referencedRelation: "scripts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scenes_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      shots: {
        Row: {
          id: string;
          project_id: string;
          scene_id: string;
          shot_order: number;
          shot_type: string | null;
          description: string;
          duration_seconds: number | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string;
          scene_id: string;
          shot_order?: number;
          shot_type?: string | null;
          description: string;
          duration_seconds?: number | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          scene_id?: string;
          shot_order?: number;
          shot_type?: string | null;
          description?: string;
          duration_seconds?: number | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shots_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shots_scene_id_fkey";
            columns: ["scene_id"];
            isOneToOne: false;
            referencedRelation: "scenes";
            referencedColumns: ["id"];
          },
        ];
      };
      shot_characters: {
        Row: {
          id: string;
          project_id: string;
          shot_id: string;
          character_id: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string;
          shot_id: string;
          character_id: string;
          created_by?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          shot_id?: string;
          character_id?: string;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shot_characters_shot_id_fkey";
            columns: ["shot_id"];
            isOneToOne: false;
            referencedRelation: "shots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shot_characters_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      movie_timelines: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          description: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          description?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          description?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "movie_timelines_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      timeline_clips: {
        Row: {
          id: string;
          project_id: string;
          timeline_id: string;
          shot_id: string;
          clip_order: number;
          trim_start_seconds: number | null;
          trim_end_seconds: number | null;
          transition_in: Database["public"]["Enums"]["timeline_transition"];
          source_render_job_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string;
          timeline_id: string;
          shot_id: string;
          clip_order?: number;
          trim_start_seconds?: number | null;
          trim_end_seconds?: number | null;
          transition_in?: Database["public"]["Enums"]["timeline_transition"];
          source_render_job_id?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          timeline_id?: string;
          shot_id?: string;
          clip_order?: number;
          trim_start_seconds?: number | null;
          trim_end_seconds?: number | null;
          transition_in?: Database["public"]["Enums"]["timeline_transition"];
          source_render_job_id?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "timeline_clips_timeline_id_fkey";
            columns: ["timeline_id"];
            isOneToOne: false;
            referencedRelation: "movie_timelines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "timeline_clips_shot_id_fkey";
            columns: ["shot_id"];
            isOneToOne: false;
            referencedRelation: "shots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "timeline_clips_source_render_job_id_fkey";
            columns: ["source_render_job_id"];
            isOneToOne: false;
            referencedRelation: "render_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      voice_lines: {
        Row: {
          id: string;
          project_id: string;
          character_id: string | null;
          shot_id: string | null;
          line_order: number;
          text: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          character_id?: string | null;
          shot_id?: string | null;
          line_order?: number;
          text: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          character_id?: string | null;
          shot_id?: string | null;
          line_order?: number;
          text?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "voice_lines_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "voice_lines_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "voice_lines_shot_id_fkey";
            columns: ["shot_id"];
            isOneToOne: false;
            referencedRelation: "shots";
            referencedColumns: ["id"];
          },
        ];
      };
      music_tracks: {
        Row: {
          id: string;
          project_id: string;
          scene_id: string | null;
          name: string;
          description: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          scene_id?: string | null;
          name: string;
          description?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          scene_id?: string | null;
          name?: string;
          description?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "music_tracks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "music_tracks_scene_id_fkey";
            columns: ["scene_id"];
            isOneToOne: false;
            referencedRelation: "scenes";
            referencedColumns: ["id"];
          },
        ];
      };
      subtitles: {
        Row: {
          id: string;
          project_id: string;
          timeline_id: string;
          voice_line_id: string | null;
          start_seconds: number;
          end_seconds: number;
          text: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string;
          timeline_id: string;
          voice_line_id?: string | null;
          start_seconds: number;
          end_seconds: number;
          text: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          timeline_id?: string;
          voice_line_id?: string | null;
          start_seconds?: number;
          end_seconds?: number;
          text?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subtitles_timeline_id_fkey";
            columns: ["timeline_id"];
            isOneToOne: false;
            referencedRelation: "movie_timelines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subtitles_voice_line_id_fkey";
            columns: ["voice_line_id"];
            isOneToOne: false;
            referencedRelation: "voice_lines";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_suggestions: {
        Row: {
          id: string;
          project_id: string;
          role: Database["public"]["Enums"]["ai_advisor_role"];
          prompt: string;
          status: Database["public"]["Enums"]["ai_suggestion_status"];
          result: Json | null;
          error_message: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          role: Database["public"]["Enums"]["ai_advisor_role"];
          prompt: string;
          status?: Database["public"]["Enums"]["ai_suggestion_status"];
          result?: Json | null;
          error_message?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          role?: Database["public"]["Enums"]["ai_advisor_role"];
          prompt?: string;
          status?: Database["public"]["Enums"]["ai_suggestion_status"];
          result?: Json | null;
          error_message?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_suggestions_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      export_presets: {
        Row: {
          id: string;
          slug: string;
          name: string;
          platform: string;
          width: number;
          height: number;
          format: string;
          fps: number;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          platform: string;
          width: number;
          height: number;
          format: string;
          fps?: number;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          platform?: string;
          width?: number;
          height?: number;
          format?: string;
          fps?: number;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      export_jobs: {
        Row: {
          id: string;
          project_id: string;
          timeline_id: string;
          preset_id: string | null;
          status: Database["public"]["Enums"]["export_job_status"];
          output_asset_url: string | null;
          error_message: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
          started_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          project_id?: string;
          timeline_id: string;
          preset_id?: string | null;
          status?: Database["public"]["Enums"]["export_job_status"];
          output_asset_url?: string | null;
          error_message?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          timeline_id?: string;
          preset_id?: string | null;
          status?: Database["public"]["Enums"]["export_job_status"];
          output_asset_url?: string | null;
          error_message?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "export_jobs_timeline_id_fkey";
            columns: ["timeline_id"];
            isOneToOne: false;
            referencedRelation: "movie_timelines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "export_jobs_preset_id_fkey";
            columns: ["preset_id"];
            isOneToOne: false;
            referencedRelation: "export_presets";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      select_model_for_task: {
        Args: { p_task_type: string; p_override_slug?: string | null };
        Returns: Database["public"]["Tables"]["ai_models"]["Row"];
      };
      create_organization: {
        Args: { p_name: string; p_slug: string };
        Returns: Database["public"]["Tables"]["organizations"]["Row"];
      };
      add_organization_member: {
        Args: {
          p_org_id: string;
          p_user_id: string;
          p_role?: Database["public"]["Enums"]["organization_role"];
        };
        Returns: Database["public"]["Tables"]["organization_members"]["Row"];
      };
      is_org_member: {
        Args: { p_org_id: string };
        Returns: boolean;
      };
      has_org_role: {
        Args: {
          p_org_id: string;
          p_roles: Database["public"]["Enums"]["organization_role"][];
        };
        Returns: boolean;
      };
      is_project_member: {
        Args: { p_project_id: string };
        Returns: boolean;
      };
      is_platform_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      organization_role: "owner" | "admin" | "member";
      project_status: "draft" | "in_progress" | "completed" | "archived";
      script_status: "draft" | "final";
      ai_model_category:
        "video" | "image" | "audio" | "voice" | "lip_sync" | "llm";
      ai_model_install_status:
        "not_installed" | "downloading" | "installed" | "failed";
      ai_model_health_status: "unknown" | "healthy" | "unhealthy";
      render_job_status:
        "queued" | "running" | "completed" | "failed" | "cancelled";
      workflow_subject_type:
        | "character"
        | "location"
        | "prop"
        | "shot"
        | "voice_line"
        | "music_track";
      timeline_transition: "cut" | "fade" | "dissolve" | "wipe";
      ai_advisor_role: "director" | "cinematographer" | "producer";
      ai_suggestion_status: "pending" | "running" | "completed" | "failed";
      export_job_status:
        "queued" | "running" | "completed" | "failed" | "cancelled";
    };
    CompositeTypes: Record<string, never>;
  };
};

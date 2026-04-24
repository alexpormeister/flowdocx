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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          ip_address: string | null
          organization_id: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          organization_id?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          organization_id?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      customer_lifecycle_connections: {
        Row: {
          created_at: string
          from_stage_id: string
          id: string
          label: string | null
          lifecycle_id: string
          to_stage_id: string
        }
        Insert: {
          created_at?: string
          from_stage_id: string
          id?: string
          label?: string | null
          lifecycle_id: string
          to_stage_id: string
        }
        Update: {
          created_at?: string
          from_stage_id?: string
          id?: string
          label?: string | null
          lifecycle_id?: string
          to_stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_lifecycle_connections_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "customer_lifecycle_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_lifecycle_connections_lifecycle_id_fkey"
            columns: ["lifecycle_id"]
            isOneToOne: false
            referencedRelation: "customer_lifecycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_lifecycle_connections_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "customer_lifecycle_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_lifecycle_stage_lifecycles: {
        Row: {
          created_at: string
          id: string
          linked_lifecycle_id: string
          stage_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          linked_lifecycle_id: string
          stage_id: string
        }
        Update: {
          created_at?: string
          id?: string
          linked_lifecycle_id?: string
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_lifecycle_stage_lifecycles_linked_lifecycle_id_fkey"
            columns: ["linked_lifecycle_id"]
            isOneToOne: false
            referencedRelation: "customer_lifecycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_lifecycle_stage_lifecycles_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "customer_lifecycle_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_lifecycle_stage_processes: {
        Row: {
          created_at: string
          id: string
          project_id: string
          stage_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          stage_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_lifecycle_stage_processes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_lifecycle_stage_processes_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "customer_lifecycle_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_lifecycle_stages: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          lifecycle_id: string | null
          name: string
          order_index: number
          organization_id: string
          position_x: number
          position_y: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lifecycle_id?: string | null
          name: string
          order_index?: number
          organization_id: string
          position_x?: number
          position_y?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lifecycle_id?: string | null
          name?: string
          order_index?: number
          organization_id?: string
          position_x?: number
          position_y?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_lifecycle_stages_lifecycle_id_fkey"
            columns: ["lifecycle_id"]
            isOneToOne: false
            referencedRelation: "customer_lifecycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_lifecycle_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_lifecycles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_lifecycles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deleted_organizations: {
        Row: {
          deleted_at: string
          deleted_by: string | null
          folders_data: Json | null
          id: string
          members_data: Json | null
          org_data: Json
          original_org_id: string
          projects_data: Json | null
          restored_at: string | null
        }
        Insert: {
          deleted_at?: string
          deleted_by?: string | null
          folders_data?: Json | null
          id?: string
          members_data?: Json | null
          org_data: Json
          original_org_id: string
          projects_data?: Json | null
          restored_at?: string | null
        }
        Update: {
          deleted_at?: string
          deleted_by?: string | null
          folders_data?: Json | null
          id?: string
          members_data?: Json | null
          org_data?: Json
          original_org_id?: string
          projects_data?: Json | null
          restored_at?: string | null
        }
        Relationships: []
      }
      element_links: {
        Row: {
          created_at: string
          element_id: string
          id: string
          linked_project_id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          element_id: string
          id?: string
          linked_project_id: string
          project_id: string
        }
        Update: {
          created_at?: string
          element_id?: string
          id?: string
          linked_project_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "element_links_linked_project_id_fkey"
            columns: ["linked_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "element_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      folder_shares: {
        Row: {
          created_at: string
          created_by: string
          folder_id: string
          id: string
          permission: string
          shared_with_email: string
          shared_with_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          folder_id: string
          id?: string
          permission: string
          shared_with_email: string
          shared_with_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          folder_id?: string
          id?: string
          permission?: string
          shared_with_email?: string
          shared_with_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folder_shares_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          organization_id: string | null
          parent_id: string | null
          system_tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          organization_id?: string | null
          parent_id?: string | null
          system_tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string | null
          parent_id?: string | null
          system_tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      member_folder_restrictions: {
        Row: {
          created_at: string
          created_by: string | null
          folder_id: string
          id: string
          member_id: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          folder_id: string
          id?: string
          member_id: string
          organization_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          folder_id?: string
          id?: string
          member_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_folder_restrictions_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_folder_restrictions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_folder_restrictions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_feature_flags: {
        Row: {
          created_at: string
          enabled: boolean
          feature_key: string
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_key: string
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_key?: string
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_feature_flags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_group_positions: {
        Row: {
          created_at: string
          group_id: string
          id: string
          position_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          position_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          position_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_group_positions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "organization_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_group_positions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "organization_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          organization_id: string
          position_id: string | null
          role: Database["public"]["Enums"]["org_role"]
          send_email_invite: boolean | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          organization_id: string
          position_id?: string | null
          role?: Database["public"]["Enums"]["org_role"]
          send_email_invite?: boolean | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          position_id?: string | null
          role?: Database["public"]["Enums"]["org_role"]
          send_email_invite?: boolean | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "organization_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_positions: {
        Row: {
          created_at: string
          id: string
          name: string
          order_index: number | null
          organization_id: string
          parent_position_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order_index?: number | null
          organization_id: string
          parent_position_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order_index?: number | null
          organization_id?: string
          parent_position_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_positions_parent_position_id_fkey"
            columns: ["parent_position_id"]
            isOneToOne: false
            referencedRelation: "organization_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_quotas: {
        Row: {
          created_at: string
          id: string
          max_projects: number | null
          max_systems: number | null
          max_users: number | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_projects?: number | null
          max_systems?: number | null
          max_users?: number | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_projects?: number | null
          max_systems?: number | null
          max_users?: number | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_quotas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_system_tags: {
        Row: {
          admin_position_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          group_id: string | null
          id: string
          link_url: string | null
          organization_id: string
          tag_name: string
        }
        Insert: {
          admin_position_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          group_id?: string | null
          id?: string
          link_url?: string | null
          organization_id: string
          tag_name: string
        }
        Update: {
          admin_position_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          group_id?: string | null
          id?: string
          link_url?: string | null
          organization_id?: string
          tag_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_system_tags_admin_position_id_fkey"
            columns: ["admin_position_id"]
            isOneToOne: false
            referencedRelation: "organization_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_system_tags_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "organization_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_system_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          accent_color: string | null
          business_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          logo_url: string | null
          name: string
          notes: string | null
          primary_color: string | null
          suspended_at: string | null
          suspended_reason: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          business_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          notes?: string | null
          primary_color?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          business_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          notes?: string | null
          primary_color?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      presentation_tokens: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id: string
          token?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "presentation_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      process_change_requests: {
        Row: {
          created_at: string
          current_description: string | null
          id: string
          organization_id: string
          proposed_description: string
          review_comment: string | null
          review_project_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_project_id: string
          status: string
          step_id: string | null
          step_name: string | null
          submitted_by: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_description?: string | null
          id?: string
          organization_id: string
          proposed_description?: string
          review_comment?: string | null
          review_project_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_project_id: string
          status?: string
          step_id?: string | null
          step_name?: string | null
          submitted_by: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_description?: string | null
          id?: string
          organization_id?: string
          proposed_description?: string
          review_comment?: string | null
          review_project_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_project_id?: string
          status?: string
          step_id?: string | null
          step_name?: string | null
          submitted_by?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          dashboard_background_url: string | null
          display_name: string | null
          id: string
          phone_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          dashboard_background_url?: string | null
          display_name?: string | null
          id?: string
          phone_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          dashboard_background_url?: string | null
          display_name?: string | null
          id?: string
          phone_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_shares: {
        Row: {
          created_at: string
          created_by: string
          id: string
          permission: string
          project_id: string
          shared_with_email: string
          shared_with_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          permission: string
          project_id: string
          shared_with_email: string
          shared_with_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          permission?: string
          project_id?: string
          shared_with_email?: string
          shared_with_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_shares_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          bpmn_xml: string
          created_at: string
          description: string | null
          folder_id: string | null
          id: string
          is_template: boolean | null
          name: string
          notes: string | null
          organization_id: string | null
          owner_email: string | null
          owner_name: string | null
          process_steps: Json | null
          status: string
          system_tags: string[] | null
          template_category: string | null
          thumbnail_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bpmn_xml: string
          created_at?: string
          description?: string | null
          folder_id?: string | null
          id?: string
          is_template?: boolean | null
          name?: string
          notes?: string | null
          organization_id?: string | null
          owner_email?: string | null
          owner_name?: string | null
          process_steps?: Json | null
          status?: string
          system_tags?: string[] | null
          template_category?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bpmn_xml?: string
          created_at?: string
          description?: string | null
          folder_id?: string | null
          id?: string
          is_template?: boolean | null
          name?: string
          notes?: string | null
          organization_id?: string | null
          owner_email?: string | null
          owner_name?: string | null
          process_steps?: Json | null
          status?: string
          system_tags?: string[] | null
          template_category?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      superadmins: {
        Row: {
          created_at: string
          email: string
          granted_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          granted_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          granted_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      system_tag_groups: {
        Row: {
          created_at: string
          group_id: string
          id: string
          system_tag_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          system_tag_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          system_tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_tag_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "organization_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_tag_groups_system_tag_id_fkey"
            columns: ["system_tag_id"]
            isOneToOne: false
            referencedRelation: "organization_system_tags"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_org_project: {
        Args: { _permission?: string; _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_org_folder: {
        Args: { _folder_id: string; _user_id: string }
        Returns: boolean
      }
      create_organization_with_owner: {
        Args: { org_business_id?: string; org_name: string }
        Returns: {
          accent_color: string | null
          business_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          logo_url: string | null
          name: string
          notes: string | null
          primary_color: string | null
          suspended_at: string | null
          suspended_reason: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_current_user_email: { Args: never; Returns: string }
      get_folder_system_tags: {
        Args: { _folder_id: string }
        Returns: string[]
      }
      get_my_restricted_folders: {
        Args: { _organization_id: string }
        Returns: string[]
      }
      has_folder_access: {
        Args: { _folder_id: string; _permission?: string; _user_id: string }
        Returns: boolean
      }
      has_org_role: {
        Args: {
          _min_role?: Database["public"]["Enums"]["org_role"]
          _organization_id: string
          _user_id: string
        }
        Returns: boolean
      }
      has_project_access: {
        Args: { _permission?: string; _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_folder_restricted_for_user: {
        Args: { _folder_id: string; _organization_id: string; _user_id: string }
        Returns: boolean
      }
      is_process_change_review_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_superadmin: { Args: { _user_id: string }; Returns: boolean }
      lookup_presentation_token: {
        Args: { _token: string }
        Returns: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          token: string
        }[]
        SetofOptions: {
          from: "*"
          to: "presentation_tokens"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      org_role: "owner" | "admin" | "editor" | "viewer"
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
      org_role: ["owner", "admin", "editor", "viewer"],
    },
  },
} as const

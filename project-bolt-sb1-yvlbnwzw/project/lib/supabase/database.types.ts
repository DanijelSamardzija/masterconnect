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
      ai_translation_log: {
        Row: {
          cache_hit: boolean
          cost_usd: number | null
          created_at: string
          id: string
          input_tokens: number | null
          message_id: string
          output_tokens: number | null
          target_lang: string
          user_id: string
        }
        Insert: {
          cache_hit?: boolean
          cost_usd?: number | null
          created_at?: string
          id?: string
          input_tokens?: number | null
          message_id: string
          output_tokens?: number | null
          target_lang: string
          user_id: string
        }
        Update: {
          cache_hit?: boolean
          cost_usd?: number | null
          created_at?: string
          id?: string
          input_tokens?: number | null
          message_id?: string
          output_tokens?: number | null
          target_lang?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_translation_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          active: boolean
          body: string
          body_de: string | null
          body_en: string | null
          body_es: string | null
          body_fr: string | null
          created_at: string
          created_by: string | null
          id: string
          title: string
          title_de: string | null
          title_en: string | null
          title_es: string | null
          title_fr: string | null
        }
        Insert: {
          active?: boolean
          body: string
          body_de?: string | null
          body_en?: string | null
          body_es?: string | null
          body_fr?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
        }
        Update: {
          active?: boolean
          body?: string
          body_de?: string | null
          body_en?: string | null
          body_es?: string | null
          body_fr?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
          title_de?: string | null
          title_en?: string | null
          title_es?: string | null
          title_fr?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_user_id: string
          blocker_user_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          blocked_user_id: string
          blocker_user_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          blocked_user_id?: string
          blocker_user_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_user_id_fkey"
            columns: ["blocked_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_user_id_fkey"
            columns: ["blocker_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_rules: {
        Row: {
          business_id: string
          cancellation_hours: number
          confirmation_mode: string
          created_at: string
          max_advance_days: number
          min_notice_minutes: number
          slot_interval_min: number
          updated_at: string
        }
        Insert: {
          business_id: string
          cancellation_hours?: number
          confirmation_mode?: string
          created_at?: string
          max_advance_days?: number
          min_notice_minutes?: number
          slot_interval_min?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          cancellation_hours?: number
          confirmation_mode?: string
          created_at?: string
          max_advance_days?: number
          min_notice_minutes?: number
          slot_interval_min?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_rules_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booking_type: string
          business_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_id: string
          confirmation_mode: string
          created_at: string
          currency: string | null
          deposit_amount: number | null
          duration_minutes: number
          ends_at: string
          id: string
          internal_notes: string | null
          location_id: string | null
          meta: Json
          notes: string | null
          party_size: number
          payment_status: string
          reminder_sent_at: string | null
          resource_id: string | null
          service_id: string | null
          service_name_snapshot: string | null
          staff_member_id: string | null
          starts_at: string
          status: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          booking_type: string
          business_id: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id: string
          confirmation_mode?: string
          created_at?: string
          currency?: string | null
          deposit_amount?: number | null
          duration_minutes: number
          ends_at: string
          id?: string
          internal_notes?: string | null
          location_id?: string | null
          meta?: Json
          notes?: string | null
          party_size?: number
          payment_status?: string
          reminder_sent_at?: string | null
          resource_id?: string | null
          service_id?: string | null
          service_name_snapshot?: string | null
          staff_member_id?: string | null
          starts_at: string
          status?: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          booking_type?: string
          business_id?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id?: string
          confirmation_mode?: string
          created_at?: string
          currency?: string | null
          deposit_amount?: number | null
          duration_minutes?: number
          ends_at?: string
          id?: string
          internal_notes?: string | null
          location_id?: string | null
          meta?: Json
          notes?: string | null
          party_size?: number
          payment_status?: string
          reminder_sent_at?: string | null
          resource_id?: string | null
          service_id?: string | null
          service_name_snapshot?: string | null
          staff_member_id?: string | null
          starts_at?: string
          status?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      business_locations: {
        Row: {
          address: string | null
          business_id: string
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          is_primary: boolean
          latitude: number | null
          longitude: number | null
          meta: Json
          name: string
          phone: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_id: string
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          latitude?: number | null
          longitude?: number | null
          meta?: Json
          name: string
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_id?: string
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          latitude?: number | null
          longitude?: number | null
          meta?: Json
          name?: string
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_locations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_plan_configs: {
        Row: {
          billing_period: string
          business_type: string
          created_at: string
          currency: string
          id: string
          included_count: number
          is_active: boolean
          price_per_additional: number | null
          resource_type: string
        }
        Insert: {
          billing_period?: string
          business_type: string
          created_at?: string
          currency?: string
          id?: string
          included_count?: number
          is_active?: boolean
          price_per_additional?: number | null
          resource_type: string
        }
        Update: {
          billing_period?: string
          business_type?: string
          created_at?: string
          currency?: string
          id?: string
          included_count?: number
          is_active?: boolean
          price_per_additional?: number | null
          resource_type?: string
        }
        Relationships: []
      }
      comment_reactions: {
        Row: {
          comment_id: string
          created_at: string | null
          emoji: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          emoji: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          emoji?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount: number
          anonymous: boolean
          created_at: string
          description: string | null
          id: string
          media_reward_type: string | null
          platform_fee: number
          receiver_id: string | null
          reference_id: string | null
          sender_id: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          anonymous?: boolean
          created_at?: string
          description?: string | null
          id?: string
          media_reward_type?: string | null
          platform_fee?: number
          receiver_id?: string | null
          reference_id?: string | null
          sender_id?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          anonymous?: boolean
          created_at?: string
          description?: string | null
          id?: string
          media_reward_type?: string | null
          platform_fee?: number
          receiver_id?: string | null
          reference_id?: string | null
          sender_id?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credits_balance: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credits_balance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deleted_account_analytics: {
        Row: {
          account_age_days: number
          country: string | null
          credit_balance: number
          deleted_at: string
          deleted_by: string
          deletion_comment: string | null
          deletion_reason: string | null
          id: string
          job_post_count: number
          service_listing_count: number
          signup_source: string | null
          social_post_count: number
          thread_count: number
          utm_source: string | null
          was_premium: boolean
        }
        Insert: {
          account_age_days?: number
          country?: string | null
          credit_balance?: number
          deleted_at?: string
          deleted_by?: string
          deletion_comment?: string | null
          deletion_reason?: string | null
          id?: string
          job_post_count?: number
          service_listing_count?: number
          signup_source?: string | null
          social_post_count?: number
          thread_count?: number
          utm_source?: string | null
          was_premium?: boolean
        }
        Update: {
          account_age_days?: number
          country?: string | null
          credit_balance?: number
          deleted_at?: string
          deleted_by?: string
          deletion_comment?: string | null
          deletion_reason?: string | null
          id?: string
          job_post_count?: number
          service_listing_count?: number
          signup_source?: string | null
          social_post_count?: number
          thread_count?: number
          utm_source?: string | null
          was_premium?: boolean
        }
        Relationships: []
      }
      followers: {
        Row: {
          created_at: string | null
          follower_id: string | null
          following_id: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          follower_id?: string | null
          following_id?: string | null
          id?: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string | null
          following_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followers_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followers_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_documents: {
        Row: {
          created_at: string
          document_type: string | null
          file_name: string
          file_url: string
          id: string
          is_public: boolean
          project_id: string
        }
        Insert: {
          created_at?: string
          document_type?: string | null
          file_name: string
          file_url: string
          id?: string
          is_public?: boolean
          project_id: string
        }
        Update: {
          created_at?: string
          document_type?: string | null
          file_name?: string
          file_url?: string
          id?: string
          is_public?: boolean
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "investment_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_interests: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          investor_id: string
          message: string | null
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          investor_id: string
          message?: string | null
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          investor_id?: string
          message?: string | null
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_interests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "investment_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_project_faqs: {
        Row: {
          answer: string
          created_at: string
          id: string
          project_id: string
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          project_id: string
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          project_id?: string
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_project_faqs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "investment_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_project_updates: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          project_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          project_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          project_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_project_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "investment_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_projects: {
        Row: {
          accepted_risk_terms: boolean
          amount_raised: number
          category: string | null
          city: string | null
          country: string | null
          created_at: string
          description: string | null
          escrow_status: string
          estimated_roi: string | null
          expected_return: string | null
          funding_deadline: string | null
          funding_goal: number | null
          id: string
          image_url: string | null
          is_hidden: boolean
          is_verified: boolean
          maximum_investment: number | null
          minimum_investment: number | null
          rejection_reason: string | null
          risk_level: string | null
          status: string
          suspended_at: string | null
          title: string
          updated_at: string
          user_id: string
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          accepted_risk_terms?: boolean
          amount_raised?: number
          category?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          escrow_status?: string
          estimated_roi?: string | null
          expected_return?: string | null
          funding_deadline?: string | null
          funding_goal?: number | null
          id?: string
          image_url?: string | null
          is_hidden?: boolean
          is_verified?: boolean
          maximum_investment?: number | null
          minimum_investment?: number | null
          rejection_reason?: string | null
          risk_level?: string | null
          status?: string
          suspended_at?: string | null
          title: string
          updated_at?: string
          user_id: string
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          accepted_risk_terms?: boolean
          amount_raised?: number
          category?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          escrow_status?: string
          estimated_roi?: string | null
          expected_return?: string | null
          funding_deadline?: string | null
          funding_goal?: number | null
          id?: string
          image_url?: string | null
          is_hidden?: boolean
          is_verified?: boolean
          maximum_investment?: number | null
          minimum_investment?: number | null
          rejection_reason?: string | null
          risk_level?: string | null
          status?: string
          suspended_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      investment_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          project_id: string
          reason: string
          reporter_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          project_id: string
          reason: string
          reporter_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          project_id?: string
          reason?: string
          reporter_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "investment_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          role: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: string
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          applicant_id: string
          bio: string | null
          city: string | null
          created_at: string
          cv_file_name: string | null
          cv_url: string | null
          email: string | null
          expected_salary_currency: string | null
          expected_salary_type: string | null
          expected_salary_value: number | null
          experience: string | null
          full_name: string
          id: string
          phone: string | null
          post_id: string
          profile_image_url: string | null
          skills: string | null
          status: string
          video_url: string | null
        }
        Insert: {
          applicant_id: string
          bio?: string | null
          city?: string | null
          created_at?: string
          cv_file_name?: string | null
          cv_url?: string | null
          email?: string | null
          expected_salary_currency?: string | null
          expected_salary_type?: string | null
          expected_salary_value?: number | null
          experience?: string | null
          full_name: string
          id?: string
          phone?: string | null
          post_id: string
          profile_image_url?: string | null
          skills?: string | null
          status?: string
          video_url?: string | null
        }
        Update: {
          applicant_id?: string
          bio?: string | null
          city?: string | null
          created_at?: string
          cv_file_name?: string | null
          cv_url?: string | null
          email?: string | null
          expected_salary_currency?: string | null
          expected_salary_type?: string | null
          expected_salary_value?: number | null
          experience?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          post_id?: string
          profile_image_url?: string | null
          skills?: string | null
          status?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      job_images: {
        Row: {
          created_at: string | null
          id: string
          job_id: string
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id: string
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_images_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          budget: string | null
          category: string
          category_normalized: string | null
          city: string
          completed_at: string | null
          completion_reminder_sent_at: string | null
          completion_request_dismissed_at: string | null
          completion_requested: boolean | null
          completion_requested_at: string | null
          created_at: string | null
          customer_id: string
          description: string
          id: string
          job_type: string | null
          payment_placeholder_message_sent: boolean | null
          payment_status: string | null
          preferred_date: string | null
          status: string | null
          title: string
        }
        Insert: {
          budget?: string | null
          category: string
          category_normalized?: string | null
          city: string
          completed_at?: string | null
          completion_reminder_sent_at?: string | null
          completion_request_dismissed_at?: string | null
          completion_requested?: boolean | null
          completion_requested_at?: string | null
          created_at?: string | null
          customer_id: string
          description: string
          id?: string
          job_type?: string | null
          payment_placeholder_message_sent?: boolean | null
          payment_status?: string | null
          preferred_date?: string | null
          status?: string | null
          title: string
        }
        Update: {
          budget?: string | null
          category?: string
          category_normalized?: string | null
          city?: string
          completed_at?: string | null
          completion_reminder_sent_at?: string | null
          completion_request_dismissed_at?: string | null
          completion_requested?: boolean | null
          completion_requested_at?: string | null
          created_at?: string | null
          customer_id?: string
          description?: string
          id?: string
          job_type?: string | null
          payment_placeholder_message_sent?: boolean | null
          payment_status?: string | null
          preferred_date?: string | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matchmaking_boosts: {
        Row: {
          boost_score: number
          created_at: string
          credits_spent: number
          id: string
          profile_id: string
          valid_until: string
        }
        Insert: {
          boost_score?: number
          created_at?: string
          credits_spent?: number
          id?: string
          profile_id: string
          valid_until?: string
        }
        Update: {
          boost_score?: number
          created_at?: string
          credits_spent?: number
          id?: string
          profile_id?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchmaking_boosts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matchmaking_feedback_log: {
        Row: {
          candidate_profile_id: string
          created_at: string
          feedback: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          candidate_profile_id: string
          created_at?: string
          feedback?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          candidate_profile_id?: string
          created_at?: string
          feedback?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchmaking_feedback_log_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchmaking_feedback_log_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchmaking_feedback_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matchmaking_notification_log: {
        Row: {
          credits_charged: number
          id: string
          notification_type: string
          post_id: string
          post_owner_id: string
          professional_id: string
          score: number | null
          sent_at: string
        }
        Insert: {
          credits_charged?: number
          id?: string
          notification_type?: string
          post_id: string
          post_owner_id: string
          professional_id: string
          score?: number | null
          sent_at?: string
        }
        Update: {
          credits_charged?: number
          id?: string
          notification_type?: string
          post_id?: string
          post_owner_id?: string
          professional_id?: string
          score?: number | null
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchmaking_notification_log_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchmaking_notification_log_post_owner_id_fkey"
            columns: ["post_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchmaking_notification_log_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matchmaking_results: {
        Row: {
          candidate_count: number
          created_at: string
          expires_at: string
          extraction: Json
          id: string
          post_id: string
          ranked_profiles: Json
          user_id: string
        }
        Insert: {
          candidate_count?: number
          created_at?: string
          expires_at: string
          extraction: Json
          id?: string
          post_id: string
          ranked_profiles: Json
          user_id: string
        }
        Update: {
          candidate_count?: number
          created_at?: string
          expires_at?: string
          extraction?: Json
          id?: string
          post_id?: string
          ranked_profiles?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchmaking_results_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchmaking_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matchmaking_reverse_cache: {
        Row: {
          candidate_count: number
          cost_usd: number | null
          created_at: string
          expires_at: string
          input_tokens: number | null
          output_tokens: number | null
          ranked_posts: Json
          user_id: string
        }
        Insert: {
          candidate_count?: number
          cost_usd?: number | null
          created_at?: string
          expires_at: string
          input_tokens?: number | null
          output_tokens?: number | null
          ranked_posts?: Json
          user_id: string
        }
        Update: {
          candidate_count?: number
          cost_usd?: number | null
          created_at?: string
          expires_at?: string
          input_tokens?: number | null
          output_tokens?: number | null
          ranked_posts?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchmaking_reverse_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matchmaking_runs_log: {
        Row: {
          cache_hit: boolean
          category: string | null
          cost_usd: number | null
          created_at: string
          duration_ms: number | null
          id: string
          input_tokens: number | null
          output_tokens: number | null
          pipeline_type: string
          post_id: string | null
          post_type: string | null
          user_id: string
        }
        Insert: {
          cache_hit?: boolean
          category?: string | null
          cost_usd?: number | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          input_tokens?: number | null
          output_tokens?: number | null
          pipeline_type?: string
          post_id?: string | null
          post_type?: string | null
          user_id: string
        }
        Update: {
          cache_hit?: boolean
          category?: string | null
          cost_usd?: number | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          input_tokens?: number | null
          output_tokens?: number | null
          pipeline_type?: string
          post_id?: string | null
          post_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      matchmaking_unlock_log: {
        Row: {
          created_at: string
          credits_spent: number
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_spent?: number
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_spent?: number
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchmaking_unlock_log_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchmaking_unlock_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string | null
          file_size: number
          file_type: string
          file_url: string
          id: string
          message_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path?: string | null
          file_size: number
          file_type: string
          file_url: string
          id?: string
          message_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string | null
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          message_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          delivered_at: string | null
          id: string
          is_deleted: boolean
          is_system: boolean
          message_type: string | null
          meta: Json
          offer_id: string | null
          read_at: string | null
          receiver_id: string
          seen_at: string | null
          sender_id: string
          system_message_type: string | null
          text: string
          thread_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          id?: string
          is_deleted?: boolean
          is_system?: boolean
          message_type?: string | null
          meta?: Json
          offer_id?: string | null
          read_at?: string | null
          receiver_id: string
          seen_at?: string | null
          sender_id: string
          system_message_type?: string | null
          text: string
          thread_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          id?: string
          is_deleted?: boolean
          is_system?: boolean
          message_type?: string | null
          meta?: Json
          offer_id?: string | null
          read_at?: string | null
          receiver_id?: string
          seen_at?: string | null
          sender_id?: string
          system_message_type?: string | null
          text?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_type: string | null
          body: string
          created_at: string | null
          id: string
          meta: Json | null
          post_id: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_type?: string | null
          body: string
          created_at?: string | null
          id?: string
          meta?: Json | null
          post_id?: string | null
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          action_type?: string | null
          body?: string
          created_at?: string | null
          id?: string
          meta?: Json | null
          post_id?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          currency: string
          duration_deadline: string | null
          estimated_start: string | null
          id: string
          message_id: string | null
          note: string | null
          offer_type: string
          price: number
          price_type: string | null
          receiver_id: string | null
          related_post_id: string | null
          responded_at: string | null
          sender_id: string | null
          status: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          currency?: string
          duration_deadline?: string | null
          estimated_start?: string | null
          id?: string
          message_id?: string | null
          note?: string | null
          offer_type?: string
          price: number
          price_type?: string | null
          receiver_id?: string | null
          related_post_id?: string | null
          responded_at?: string | null
          sender_id?: string | null
          status?: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          currency?: string
          duration_deadline?: string | null
          estimated_start?: string | null
          id?: string
          message_id?: string | null
          note?: string | null
          offer_type?: string
          price?: number
          price_type?: string | null
          receiver_id?: string | null
          related_post_id?: string | null
          responded_at?: string | null
          sender_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_hours: {
        Row: {
          created_at: string
          crosses_midnight: boolean
          day_of_week: number
          end_time: string
          entity_type: string
          id: string
          is_closed: boolean
          location_id: string
          staff_member_id: string | null
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          crosses_midnight?: boolean
          day_of_week: number
          end_time: string
          entity_type: string
          id?: string
          is_closed?: boolean
          location_id: string
          staff_member_id?: string | null
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          crosses_midnight?: boolean
          day_of_week?: number
          end_time?: string
          entity_type?: string
          id?: string
          is_closed?: boolean
          location_id?: string
          staff_member_id?: string | null
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opening_hours_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_hours_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views: {
        Row: {
          created_at: string
          id: string
          page: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          page: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          page?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          created_at: string | null
          id: string
          parent_comment_id: string | null
          post_id: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          parent_comment_id?: string | null
          post_id: string
          text: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          parent_comment_id?: string | null
          post_id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_guidance_log: {
        Row: {
          analyzed_at: string
          confidence_score: number | null
          current_section: string | null
          detected_intent: string | null
          detected_language: string | null
          error: string | null
          guidance_sent: boolean
          guidance_type: string | null
          has_image_only: boolean
          id: string
          image_extracted_text: string | null
          missing_fields: string[] | null
          notification_id: string | null
          post_id: string
          post_text_hash: string | null
          raw_ai_response: Json | null
          recommended_section: string | null
          should_send: boolean
          triggered_by: string
          user_id: string
        }
        Insert: {
          analyzed_at?: string
          confidence_score?: number | null
          current_section?: string | null
          detected_intent?: string | null
          detected_language?: string | null
          error?: string | null
          guidance_sent?: boolean
          guidance_type?: string | null
          has_image_only?: boolean
          id?: string
          image_extracted_text?: string | null
          missing_fields?: string[] | null
          notification_id?: string | null
          post_id: string
          post_text_hash?: string | null
          raw_ai_response?: Json | null
          recommended_section?: string | null
          should_send?: boolean
          triggered_by?: string
          user_id: string
        }
        Update: {
          analyzed_at?: string
          confidence_score?: number | null
          current_section?: string | null
          detected_intent?: string | null
          detected_language?: string | null
          error?: string | null
          guidance_sent?: boolean
          guidance_type?: string | null
          has_image_only?: boolean
          id?: string
          image_extracted_text?: string | null
          missing_fields?: string[] | null
          notification_id?: string | null
          post_id?: string
          post_text_hash?: string | null
          raw_ai_response?: Json | null
          recommended_section?: string | null
          should_send?: boolean
          triggered_by?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_guidance_log_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_guidance_log_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_guidance_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_media: {
        Row: {
          created_at: string | null
          height: number | null
          id: string
          order: number
          overlay_align: string | null
          overlay_color: string | null
          overlay_font_size: number | null
          overlay_text: string | null
          overlay_width: number | null
          overlay_x: number | null
          overlay_y: number | null
          post_id: string
          thumbnail_url: string | null
          type: string
          url: string
          width: number | null
        }
        Insert: {
          created_at?: string | null
          height?: number | null
          id?: string
          order?: number
          overlay_align?: string | null
          overlay_color?: string | null
          overlay_font_size?: number | null
          overlay_text?: string | null
          overlay_width?: number | null
          overlay_x?: number | null
          overlay_y?: number | null
          post_id: string
          thumbnail_url?: string | null
          type: string
          url: string
          width?: number | null
        }
        Update: {
          created_at?: string | null
          height?: number | null
          id?: string
          order?: number
          overlay_align?: string | null
          overlay_color?: string | null
          overlay_font_size?: number | null
          overlay_text?: string | null
          overlay_width?: number | null
          overlay_x?: number | null
          overlay_y?: number | null
          post_id?: string
          thumbnail_url?: string | null
          type?: string
          url?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          post_id: string
          reaction_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          post_id: string
          reaction_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          post_id?: string
          reaction_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          availability: string | null
          booking_enabled: boolean
          business_id: string | null
          caps_ratio: number | null
          category: string | null
          category_normalized: string | null
          city: string | null
          country: string | null
          created_at: string | null
          currency: string
          duplicate_hash: string | null
          embedding: string | null
          experience_level: string | null
          hashtag_count: number | null
          hashtags: string[] | null
          id: string
          is_active: boolean | null
          is_pinned: boolean | null
          is_promoted: boolean | null
          job_title: string | null
          link_count: number | null
          location: string | null
          max_price: number | null
          min_price: number | null
          moderation_reasons: string[] | null
          phone_count: number | null
          pinned: boolean | null
          pinned_at: string | null
          post_type: string
          price_type: string | null
          price_value: number | null
          profession: string | null
          promoted_until: string | null
          rank_penalty: number | null
          search_vector: unknown
          spam_score: number | null
          status: string | null
          text: string | null
          updated_at: string | null
          user_id: string
          views_count: number | null
        }
        Insert: {
          availability?: string | null
          booking_enabled?: boolean
          business_id?: string | null
          caps_ratio?: number | null
          category?: string | null
          category_normalized?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string
          duplicate_hash?: string | null
          embedding?: string | null
          experience_level?: string | null
          hashtag_count?: number | null
          hashtags?: string[] | null
          id?: string
          is_active?: boolean | null
          is_pinned?: boolean | null
          is_promoted?: boolean | null
          job_title?: string | null
          link_count?: number | null
          location?: string | null
          max_price?: number | null
          min_price?: number | null
          moderation_reasons?: string[] | null
          phone_count?: number | null
          pinned?: boolean | null
          pinned_at?: string | null
          post_type: string
          price_type?: string | null
          price_value?: number | null
          profession?: string | null
          promoted_until?: string | null
          rank_penalty?: number | null
          search_vector?: unknown
          spam_score?: number | null
          status?: string | null
          text?: string | null
          updated_at?: string | null
          user_id: string
          views_count?: number | null
        }
        Update: {
          availability?: string | null
          booking_enabled?: boolean
          business_id?: string | null
          caps_ratio?: number | null
          category?: string | null
          category_normalized?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string
          duplicate_hash?: string | null
          embedding?: string | null
          experience_level?: string | null
          hashtag_count?: number | null
          hashtags?: string[] | null
          id?: string
          is_active?: boolean | null
          is_pinned?: boolean | null
          is_promoted?: boolean | null
          job_title?: string | null
          link_count?: number | null
          location?: string | null
          max_price?: number | null
          min_price?: number | null
          moderation_reasons?: string[] | null
          phone_count?: number | null
          pinned?: boolean | null
          pinned_at?: string | null
          post_type?: string
          price_type?: string | null
          price_value?: number | null
          profession?: string | null
          promoted_until?: string | null
          rank_penalty?: number | null
          search_vector?: unknown
          spam_score?: number | null
          status?: string | null
          text?: string | null
          updated_at?: string | null
          user_id?: string
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_subscriptions: {
        Row: {
          created_at: string
          currency: string
          ends_at: string | null
          id: string
          plan: string
          price: number
          starts_at: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          ends_at?: string | null
          id?: string
          plan?: string
          price: number
          starts_at?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          ends_at?: string | null
          id?: string
          plan?: string
          price?: number
          starts_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "premium_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          categories: string[] | null
          city: string | null
          created_at: string | null
          id: string
          phone: string | null
          starting_price: string | null
          user_id: string
          verified: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          categories?: string[] | null
          city?: string | null
          created_at?: string | null
          id?: string
          phone?: string | null
          starting_price?: string | null
          user_id: string
          verified?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          categories?: string[] | null
          city?: string | null
          created_at?: string | null
          id?: string
          phone?: string | null
          starting_price?: string | null
          user_id?: string
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "pro_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_views: {
        Row: {
          id: string
          profile_id: string
          viewed_at: string
          viewer_id: string | null
        }
        Insert: {
          id?: string
          profile_id: string
          viewed_at?: string
          viewer_id?: string | null
        }
        Update: {
          id?: string
          profile_id?: string
          viewed_at?: string
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_views_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string
          availability: string | null
          avatar_url: string | null
          average_rating: number | null
          bio: string | null
          business_type: string | null
          category: string | null
          city: string | null
          country: string | null
          cover_url: string | null
          created_at: string | null
          email: string
          embedding: string | null
          experience_level: string | null
          feed_interests: string[]
          hourly_rate_max: number | null
          hourly_rate_min: number | null
          id: string
          is_admin: boolean | null
          is_banned: boolean | null
          is_business: boolean
          is_creator_premium: boolean
          is_premium: boolean
          last_seen: string | null
          latitude: number | null
          live_status: string
          longitude: number | null
          match_notifications_enabled: boolean
          name: string
          onboarding_completed: boolean | null
          phone: string | null
          preferred_language: string | null
          recent_emojis: Json | null
          reengagement_sent_at: string | null
          referral_code: string | null
          referred_by: string | null
          review_count: number | null
          role: string
          search_vector: unknown
          show_email: boolean
          show_phone: boolean
          signup_source: string | null
          skills: Json | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          website_url: string | null
          work_categories: string[] | null
        }
        Insert: {
          account_type?: string
          availability?: string | null
          avatar_url?: string | null
          average_rating?: number | null
          bio?: string | null
          business_type?: string | null
          category?: string | null
          city?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string | null
          email?: string
          embedding?: string | null
          experience_level?: string | null
          feed_interests?: string[]
          hourly_rate_max?: number | null
          hourly_rate_min?: number | null
          id: string
          is_admin?: boolean | null
          is_banned?: boolean | null
          is_business?: boolean
          is_creator_premium?: boolean
          is_premium?: boolean
          last_seen?: string | null
          latitude?: number | null
          live_status?: string
          longitude?: number | null
          match_notifications_enabled?: boolean
          name: string
          onboarding_completed?: boolean | null
          phone?: string | null
          preferred_language?: string | null
          recent_emojis?: Json | null
          reengagement_sent_at?: string | null
          referral_code?: string | null
          referred_by?: string | null
          review_count?: number | null
          role?: string
          search_vector?: unknown
          show_email?: boolean
          show_phone?: boolean
          signup_source?: string | null
          skills?: Json | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          website_url?: string | null
          work_categories?: string[] | null
        }
        Update: {
          account_type?: string
          availability?: string | null
          avatar_url?: string | null
          average_rating?: number | null
          bio?: string | null
          business_type?: string | null
          category?: string | null
          city?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string | null
          email?: string
          embedding?: string | null
          experience_level?: string | null
          feed_interests?: string[]
          hourly_rate_max?: number | null
          hourly_rate_min?: number | null
          id?: string
          is_admin?: boolean | null
          is_banned?: boolean | null
          is_business?: boolean
          is_creator_premium?: boolean
          is_premium?: boolean
          last_seen?: string | null
          latitude?: number | null
          live_status?: string
          longitude?: number | null
          match_notifications_enabled?: boolean
          name?: string
          onboarding_completed?: boolean | null
          phone?: string | null
          preferred_language?: string | null
          recent_emojis?: Json | null
          reengagement_sent_at?: string | null
          referral_code?: string | null
          referred_by?: string | null
          review_count?: number | null
          role?: string
          search_vector?: unknown
          show_email?: boolean
          show_phone?: boolean
          signup_source?: string | null
          skills?: Json | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          website_url?: string | null
          work_categories?: string[] | null
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          reward_given: boolean
          rewarded_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          reward_given?: boolean
          rewarded_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          reward_given?: boolean
          rewarded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string | null
          details: string | null
          id: string
          reason: string
          reporter_user_id: string
          status: string
          target_id: string
          target_owner_user_id: string
          target_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          details?: string | null
          id?: string
          reason: string
          reporter_user_id: string
          status?: string
          target_id: string
          target_owner_user_id: string
          target_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          details?: string | null
          id?: string
          reason?: string
          reporter_user_id?: string
          status?: string
          target_id?: string
          target_owner_user_id?: string
          target_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_user_id_fkey"
            columns: ["reporter_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_target_owner_user_id_fkey"
            columns: ["target_owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          business_id: string
          capacity: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          location_id: string | null
          meta: Json
          name: string
          resource_type: string
          updated_at: string
        }
        Insert: {
          business_id: string
          capacity?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          location_id?: string | null
          meta?: Json
          name: string
          resource_type: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          capacity?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          location_id?: string | null
          meta?: Json
          name?: string
          resource_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          booking_id: string | null
          comment: string | null
          created_at: string | null
          customer_id: string
          id: string
          job_id: string | null
          pro_id: string
          rating: number
        }
        Insert: {
          booking_id?: string | null
          comment?: string | null
          created_at?: string | null
          customer_id: string
          id?: string
          job_id?: string | null
          pro_id: string
          rating: number
        }
        Update: {
          booking_id?: string | null
          comment?: string | null
          created_at?: string | null
          customer_id?: string
          id?: string
          job_id?: string | null
          pro_id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_pro_id_fkey"
            columns: ["pro_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_history: {
        Row: {
          amount: number
          claimed: boolean
          created_at: string
          id: string
          reward_type: string
          user_id: string
        }
        Insert: {
          amount: number
          claimed?: boolean
          created_at?: string
          id?: string
          reward_type: string
          user_id: string
        }
        Update: {
          amount?: number
          claimed?: boolean
          created_at?: string
          id?: string
          reward_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_investment_projects: {
        Row: {
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_investment_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "investment_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_posts: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      search_subscriptions: {
        Row: {
          category: string | null
          city: string | null
          created_at: string | null
          email: string
          id: string
          language: string | null
          last_notified_at: string | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          city?: string | null
          created_at?: string | null
          email: string
          id?: string
          language?: string | null
          last_notified_at?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          city?: string | null
          created_at?: string | null
          email?: string
          id?: string
          language?: string | null
          last_notified_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      service_catalog: {
        Row: {
          booking_type: string
          buffer_minutes: number
          business_id: string
          capacity: number
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          meta: Json
          name: string
          price: number | null
          price_type: string
          updated_at: string
        }
        Insert: {
          booking_type?: string
          buffer_minutes?: number
          business_id: string
          capacity?: number
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          is_active?: boolean
          meta?: Json
          name: string
          price?: number | null
          price_type?: string
          updated_at?: string
        }
        Update: {
          booking_type?: string
          buffer_minutes?: number
          business_id?: string
          capacity?: number
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          meta?: Json
          name?: string
          price?: number | null
          price_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_catalog_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invitations: {
        Row: {
          accepted_at: string | null
          business_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          inviter_id: string | null
          location_id: string | null
          role: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          business_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          inviter_id?: string | null
          location_id?: string | null
          role?: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          business_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          inviter_id?: string | null
          location_id?: string | null
          role?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_invitations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invitations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          business_id: string
          created_at: string
          id: string
          is_active: boolean
          joined_at: string
          primary_location_id: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          joined_at?: string
          primary_location_id?: string | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          joined_at?: string
          primary_location_id?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_primary_location_id_fkey"
            columns: ["primary_location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          admin_notes: string | null
          attachment_name: string | null
          attachment_url: string | null
          category: string | null
          created_at: string | null
          id: string
          message: string
          status: string | null
          subject: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          message: string
          status?: string | null
          subject: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          message?: string
          status?: string | null
          subject?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_participants: {
        Row: {
          created_at: string
          deleted_at: string | null
          hidden_before: string | null
          id: string
          last_read_at: string | null
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          hidden_before?: string | null
          id?: string
          last_read_at?: string | null
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          hidden_before?: string | null
          id?: string
          last_read_at?: string | null
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          created_at: string | null
          id: string
          job_id: string | null
          post_id: string | null
          thread_type: string
          user1_id: string
          user2_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id?: string | null
          post_id?: string | null
          thread_type?: string
          user1_id: string
          user2_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string | null
          post_id?: string | null
          thread_type?: string
          user1_id?: string
          user2_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "threads_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      time_blocks: {
        Row: {
          created_at: string
          ends_at: string
          entity_type: string
          id: string
          is_recurring: boolean
          location_id: string | null
          note: string | null
          reason: string
          resource_id: string | null
          staff_member_id: string | null
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          entity_type: string
          id?: string
          is_recurring?: boolean
          location_id?: string | null
          note?: string | null
          reason?: string
          resource_id?: string | null
          staff_member_id?: string | null
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          entity_type?: string
          id?: string
          is_recurring?: boolean
          location_id?: string | null
          note?: string | null
          reason?: string
          resource_id?: string | null
          staff_member_id?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_blocks_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_blocks_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_blocks_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_ai_cost_daily: {
        Row: {
          avg_cost_per_run: number | null
          cache_hits: number | null
          day: string | null
          fresh_runs: number | null
          pipeline_type: string | null
          total_cost_usd: number | null
          unique_users: number | null
        }
        Relationships: []
      }
      v_ai_cost_per_user: {
        Row: {
          forward_runs: number | null
          fresh_runs: number | null
          is_premium: boolean | null
          reverse_runs: number | null
          total_cost_usd: number | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: []
      }
      v_translation_cost_daily: {
        Row: {
          cache_hits: number | null
          day: string | null
          fresh_translations: number | null
          total_cost_usd: number | null
          unique_users: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_delete_user_account: {
        Args: { target_user_id: string }
        Returns: Json
      }
      admin_grant_credits: {
        Args: { p_amount: number; p_note?: string; p_user_id: string }
        Returns: Json
      }
      apply_referral: {
        Args: { p_referral_code: string; p_referred_id: string }
        Returns: Json
      }
      become_creator_premium: { Args: { p_user_id: string }; Returns: Json }
      boost_post:
        | { Args: { p_post_id: string; p_user_id: string }; Returns: Json }
        | {
            Args: { p_days?: number; p_post_id: string; p_user_id: string }
            Returns: Json
          }
      create_ai_match_boost: { Args: { p_profile_id: string }; Returns: Json }
      create_direct_thread_safe: {
        Args: { p_target_user_id: string }
        Returns: Json
      }
      deduct_credits_atomic: {
        Args: {
          p_amount: number
          p_description: string
          p_reference_id?: string
          p_type: string
          p_user_id: string
        }
        Returns: number
      }
      delete_user_account: {
        Args: { p_comment?: string; p_reason?: string }
        Returns: Json
      }
      earn_post_reward: {
        Args: { p_media_type: string; p_user_id: string }
        Returns: number
      }
      earn_reward: {
        Args: { p_reward_type: string; p_user_id: string }
        Returns: number
      }
      ensure_credits_balance: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      find_matching_posts_for_profile: {
        Args: {
          p_exclude_ids?: string[]
          p_limit?: number
          p_profile_id: string
        }
        Returns: {
          category: string
          city: string
          country: string
          created_at: string
          currency: string
          experience_level: string
          id: string
          job_title: string
          max_price: number
          min_price: number
          owner_id: string
          owner_name: string
          post_type: string
          pre_score: number
          price_type: string
          profession: string
          text_snippet: string
        }[]
      }
      find_matching_profiles: {
        Args: {
          p_category?: string
          p_city?: string
          p_country?: string
          p_exclude_ids?: string[]
          p_limit?: number
          p_location_strict?: boolean
          p_skills?: string[]
        }
        Returns: {
          average_rating: number
          bio: string
          category: string
          city: string
          country: string
          feed_interests: string[]
          id: string
          is_premium: boolean
          last_seen: string
          name: string
          portfolio_count: number
          pre_score: number
          preferred_language: string
          review_count: number
          skills: Json
        }[]
      }
      get_active_user_counts: {
        Args: {
          month_start: string
          today_start: string
          week_start: string
          year_end: string
          year_start: string
        }
        Returns: {
          dau: number
          mau: number
          wau: number
          yau: number
        }[]
      }
      get_city_distribution: {
        Args: never
        Returns: {
          city: string
          cnt: number
        }[]
      }
      get_country_distribution: {
        Args: never
        Returns: {
          cnt: number
          country: string
        }[]
      }
      get_daily_active_users: {
        Args: { week_start: string }
        Returns: {
          count: number
          date: string
        }[]
      }
      get_daily_new_users: {
        Args: { range_from: string; range_to: string }
        Returns: {
          count: number
          date: string
        }[]
      }
      get_feed_with_engagement_score: {
        Args: {
          p_as_of?: string
          p_category?: string
          p_city?: string
          p_hashtag?: string
          p_limit?: number
          p_offset?: number
          p_post_type?: string
          p_user_city?: string
          p_user_country?: string
          p_user_id?: string
        }
        Returns: {
          category: string
          city: string
          comments_count: number
          created_at: string
          feed_score: number
          hashtag_count: number
          hashtags: string[]
          id: string
          is_pinned: boolean
          is_promoted: boolean
          link_count: number
          moderation_reasons: string[]
          phone_count: number
          pinned_at: string
          post_type: string
          rank_penalty: number
          reactions_count: number
          spam_score: number
          status: string
          text: string
          updated_at: string
          user_account_type: string
          user_avatar_url: string
          user_country: string
          user_email: string
          user_id: string
          user_name: string
          views_count: number
        }[]
      }
      get_matchmaking_stats: { Args: never; Returns: Json }
      get_monthly_active_users: {
        Args: { year_end: string; year_start: string }
        Returns: {
          count: number
          month: string
        }[]
      }
      get_monthly_match_notification_count: {
        Args: { p_professional_id: string }
        Returns: number
      }
      get_monthly_new_users: {
        Args: { year_end: string; year_start: string }
        Returns: {
          count: number
          month: string
        }[]
      }
      get_my_business_ids: { Args: never; Returns: string[] }
      get_page_view_counts: {
        Args: never
        Returns: {
          count: number
          page: string
        }[]
      }
      get_profile_view_stats: {
        Args: never
        Returns: {
          this_week: number
          today: number
          total: number
        }[]
      }
      get_recent_matchmaking_runs: {
        Args: { p_limit?: number }
        Returns: {
          cache_hit: boolean
          category: string
          cost_usd: number
          created_at: string
          duration_ms: number
          id: string
          pipeline_type: string
          post_id: string
          post_type: string
          user_id: string
        }[]
      }
      get_returning_user_count: {
        Args: { month_ago_start: string }
        Returns: number
      }
      get_thread_list: {
        Args: never
        Returns: {
          last_message: string
          last_message_at: string
          other_avatar: string
          other_last_seen: string
          other_name: string
          other_user_id: string
          thread_id: string
          thread_type: string
          unread_count: number
        }[]
      }
      get_unique_poster_count: { Args: never; Returns: number }
      get_unread_count: { Args: never; Returns: number }
      grant_referral_reward_if_eligible: {
        Args: { p_referred_id: string }
        Returns: undefined
      }
      increment_post_views: { Args: { post_id: string }; Returns: undefined }
      mark_messages_read: {
        Args: { p_message_ids: string[] }
        Returns: undefined
      }
      purchase_ai_match_unlock: {
        Args: { p_post_id: string; p_user_id: string }
        Returns: Json
      }
      search_feed_posts: {
        Args: { p_limit?: number; p_search: string; p_user_id?: string }
        Returns: {
          category: string
          city: string
          comments_count: number
          created_at: string
          feed_score: number
          hashtag_count: number
          hashtags: string[]
          id: string
          is_pinned: boolean
          is_promoted: boolean
          link_count: number
          moderation_reasons: string[]
          phone_count: number
          pinned_at: string
          post_type: string
          rank_penalty: number
          reactions_count: number
          spam_score: number
          status: string
          text: string
          updated_at: string
          user_account_type: string
          user_avatar_url: string
          user_country: string
          user_email: string
          user_id: string
          user_name: string
          views_count: number
        }[]
      }
      search_posts: {
        Args: {
          p_category?: string
          p_city?: string
          p_country?: string
          p_limit?: number
          p_offset?: number
          p_post_types: string[]
          p_search?: string
          p_sort_order?: string
        }
        Returns: {
          availability: string
          category: string
          city: string
          country: string
          created_at: string
          currency: string
          experience_level: string
          id: string
          is_promoted: boolean
          job_title: string
          location: string
          post_type: string
          price_type: string
          price_value: number
          profession: string
          promoted_until: string
          score: number
          text: string
          total_count: number
          user_data: Json
          user_id: string
        }[]
      }
      search_profiles: {
        Args: { p_limit?: number; p_search: string }
        Returns: {
          account_type: string
          avatar_url: string
          average_rating: number
          category: string
          city: string
          country: string
          id: string
          is_premium: boolean
          name: string
          review_count: number
        }[]
      }
      send_credits: {
        Args: {
          p_amount: number
          p_anonymous?: boolean
          p_receiver_id: string
          p_sender_id: string
        }
        Returns: Json
      }
      update_pro_rating: { Args: { target_pro_id: string }; Returns: undefined }
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
    Enums: {},
  },
} as const

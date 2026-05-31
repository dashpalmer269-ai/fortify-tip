/**
 * Generated Database types for Fortify's Supabase schema.
 *
 * Source of truth: supabase/migrations/001_*.sql … 013_*.sql
 *
 * Regenerate with `npm run db:types` once you have a Supabase Personal Access
 * Token set as `SUPABASE_ACCESS_TOKEN` (create one at
 * https://supabase.com/dashboard/account/tokens). The CLI command behind the
 * script is:
 *
 *   npx supabase gen types typescript --project-id cqxvzsbyoeporgyjmrcp \
 *     > lib/supabase/database.types.ts
 *
 * Until the CLI is wired up, this file is hand-maintained. If you add or
 * change a migration, update this file in the same PR or `npm run db:types`
 * after the migration lands.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      // ── 002: compliance core ────────────────────────────────────────────
      practices: {
        Row: {
          id: string;
          name: string;
          size_tier: "solo" | "small" | "medium" | "large" | null;
          practice_type: string | null;
          hipaa_covered_entity: boolean | null;
          frameworks_enabled: string[] | null;
          created_at: string | null;
          updated_at: string | null;
          // Added by 007_onboarding_v2
          description: string | null;
          employee_range: "1-20" | "21-50" | "51+" | null;
          location_count_range: "1-2" | "3-5" | "5+" | null;
          current_status:
            | "starting_brand_new"
            | "maintenance_needed"
            | "transfer_from_other"
            | null;
          upcoming_audit_window:
            | "within_30_days"
            | "within_60_days"
            | "within_90_days"
            | "beyond_90_days"
            | null;
          selected_plan: "solo" | "practice" | "multisite" | null;
          onboarding_step:
            | "information"
            | "fortification"
            | "safeguards"
            | "payment"
            | "completed"
            | null;
          onboarding_completed_at: string | null;
          // Added by 014_billing_columns
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          billing_status: "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "incomplete";
          subscription_current_period_end: string | null;
          // Added by 023_dashboard_cache_columns
          dashboard_narrative: string | null;
          dashboard_narrative_state_hash: string | null;
          dashboard_narrative_at: string | null;
          tasks_last_generated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          size_tier?: Database["public"]["Tables"]["practices"]["Row"]["size_tier"];
          practice_type?: string | null;
          hipaa_covered_entity?: boolean | null;
          frameworks_enabled?: string[] | null;
          created_at?: string | null;
          updated_at?: string | null;
          description?: string | null;
          employee_range?: Database["public"]["Tables"]["practices"]["Row"]["employee_range"];
          location_count_range?: Database["public"]["Tables"]["practices"]["Row"]["location_count_range"];
          current_status?: Database["public"]["Tables"]["practices"]["Row"]["current_status"];
          upcoming_audit_window?: Database["public"]["Tables"]["practices"]["Row"]["upcoming_audit_window"];
          selected_plan?: Database["public"]["Tables"]["practices"]["Row"]["selected_plan"];
          onboarding_step?: Database["public"]["Tables"]["practices"]["Row"]["onboarding_step"];
          onboarding_completed_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          billing_status?: Database["public"]["Tables"]["practices"]["Row"]["billing_status"];
          subscription_current_period_end?: string | null;
          dashboard_narrative?: string | null;
          dashboard_narrative_state_hash?: string | null;
          dashboard_narrative_at?: string | null;
          tasks_last_generated_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["practices"]["Insert"]>;
        Relationships: [];
      };

      practice_users: {
        Row: {
          id: string;
          practice_id: string;
          user_id: string;
          role: "owner" | "admin" | "compliance_officer" | "staff" | "auditor_readonly";
          created_at: string | null;
        };
        Insert: {
          id?: string;
          practice_id: string;
          user_id: string;
          role: Database["public"]["Tables"]["practice_users"]["Row"]["role"];
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["practice_users"]["Insert"]>;
        Relationships: [];
      };

      frameworks: {
        Row: {
          id: string;
          code: string;
          name: string;
          authority: string | null;
          current_version: string | null;
          description: string | null;
          active: boolean | null;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          authority?: string | null;
          current_version?: string | null;
          description?: string | null;
          active?: boolean | null;
        };
        Update: Partial<Database["public"]["Tables"]["frameworks"]["Insert"]>;
        Relationships: [];
      };

      framework_requirements: {
        Row: {
          id: string;
          framework_id: string;
          citation: string;
          parent_citation: string | null;
          title: string;
          description: string;
          category: string | null;
          obligation_type: "required" | "addressable" | "recommended" | null;
          weight: number | null;
          source_url: string | null;
        };
        Insert: {
          id?: string;
          framework_id: string;
          citation: string;
          parent_citation?: string | null;
          title: string;
          description: string;
          category?: string | null;
          obligation_type?: Database["public"]["Tables"]["framework_requirements"]["Row"]["obligation_type"];
          weight?: number | null;
          source_url?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["framework_requirements"]["Insert"]>;
        Relationships: [];
      };

      controls: {
        Row: {
          id: string;
          control_key: string;
          title: string;
          description: string;
          category: string;
          implementation_type: "technical" | "administrative" | "physical" | null;
          default_priority: "critical" | "high" | "medium" | "low" | null;
          healthcare_baseline: boolean | null;
          active: boolean | null;
          // Added by 024_operational_controls_schema
          healthcare_category:
            | "employee_access"
            | "mfa_identity"
            | "hipaa_training"
            | "policy_acknowledgments"
            | "vendor_baa_management"
            | "backup_disaster_recovery"
            | "audit_logs"
            | "device_security"
            | "exclusion_screening"
            | "risk_assessments"
            | "incident_response"
            | "physical_safeguards"
            | "data_protection"
            | "change_management"
            | "breach_notification"
            | "integration_credentials"
            | null;
          audience: "customer" | "fortify_internal";
          automation_status:
            | "fully_automated"
            | "semi_automated"
            | "document_upload"
            | "manual_attestation"
            | null;
          evidence_summary: string | null;
          remediation_guide: string | null;
          report_output_text: string | null;
        };
        Insert: {
          id?: string;
          control_key: string;
          title: string;
          description: string;
          category: string;
          implementation_type?: Database["public"]["Tables"]["controls"]["Row"]["implementation_type"];
          default_priority?: Database["public"]["Tables"]["controls"]["Row"]["default_priority"];
          healthcare_baseline?: boolean | null;
          active?: boolean | null;
          healthcare_category?: Database["public"]["Tables"]["controls"]["Row"]["healthcare_category"];
          audience?: Database["public"]["Tables"]["controls"]["Row"]["audience"];
          automation_status?: Database["public"]["Tables"]["controls"]["Row"]["automation_status"];
          evidence_summary?: string | null;
          remediation_guide?: string | null;
          report_output_text?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["controls"]["Insert"]>;
        Relationships: [];
      };

      framework_mappings: {
        Row: {
          id: string;
          control_id: string;
          framework_requirement_id: string;
          mapping_strength:
            | "fully_satisfies"
            | "partially_satisfies"
            | "contributes_to"
            | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          control_id: string;
          framework_requirement_id: string;
          mapping_strength?: Database["public"]["Tables"]["framework_mappings"]["Row"]["mapping_strength"];
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["framework_mappings"]["Insert"]>;
        Relationships: [];
      };

      evidence_checks: {
        Row: {
          id: string;
          control_id: string;
          check_key: string;
          title: string;
          description: string | null;
          collection_method:
            | "automated_api"
            | "automated_db_query"
            | "automated_scan"
            | "document_upload"
            | "manual_attestation"
            | "screenshot";
          source_integration: string | null;
          frequency_hours: number | null;
          check_config: Json | null;
          pass_criteria: Json | null;
          evidence_retention_days: number | null;
        };
        Insert: {
          id?: string;
          control_id: string;
          check_key: string;
          title: string;
          description?: string | null;
          collection_method: Database["public"]["Tables"]["evidence_checks"]["Row"]["collection_method"];
          source_integration?: string | null;
          frequency_hours?: number | null;
          check_config?: Json | null;
          pass_criteria?: Json | null;
          evidence_retention_days?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["evidence_checks"]["Insert"]>;
        Relationships: [];
      };

      practice_evidence: {
        Row: {
          id: string;
          practice_id: string;
          evidence_check_id: string;
          status: "pass" | "fail" | "partial" | "not_collected" | "error" | null;
          collected_at: string | null;
          collected_by: string | null;
          raw_result: Json | null;
          observed_value: Json | null;
          state_hash: string | null;
          evidence_file_url: string | null;
          notes: string | null;
          is_current: boolean | null;
        };
        Insert: {
          id?: string;
          practice_id: string;
          evidence_check_id: string;
          status?: Database["public"]["Tables"]["practice_evidence"]["Row"]["status"];
          collected_at?: string | null;
          collected_by?: string | null;
          raw_result?: Json | null;
          observed_value?: Json | null;
          state_hash?: string | null;
          evidence_file_url?: string | null;
          notes?: string | null;
          is_current?: boolean | null;
        };
        Update: Partial<Database["public"]["Tables"]["practice_evidence"]["Insert"]>;
        Relationships: [];
      };

      practice_controls: {
        Row: {
          id: string;
          practice_id: string;
          control_id: string;
          status:
            | "compliant"
            | "partial"
            | "non_compliant"
            | "not_applicable"
            | "not_started";
          not_applicable_reason: string | null;
          owner_user_id: string | null;
          last_verified_at: string | null;
          next_review_due: string | null;
          implementation_notes: string | null;
        };
        Insert: {
          id?: string;
          practice_id: string;
          control_id: string;
          status?: Database["public"]["Tables"]["practice_controls"]["Row"]["status"];
          not_applicable_reason?: string | null;
          owner_user_id?: string | null;
          last_verified_at?: string | null;
          next_review_due?: string | null;
          implementation_notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["practice_controls"]["Insert"]>;
        Relationships: [];
      };

      remediation_guidance: {
        Row: {
          id: string;
          control_id: string;
          severity: "critical" | "high" | "medium" | "low" | null;
          title: string;
          step_by_step_markdown: string;
          estimated_effort_minutes: number | null;
          required_systems: string[] | null;
          ai_generated: boolean | null;
          source_url: string | null;
        };
        Insert: {
          id?: string;
          control_id: string;
          severity?: Database["public"]["Tables"]["remediation_guidance"]["Row"]["severity"];
          title: string;
          step_by_step_markdown: string;
          estimated_effort_minutes?: number | null;
          required_systems?: string[] | null;
          ai_generated?: boolean | null;
          source_url?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["remediation_guidance"]["Insert"]>;
        Relationships: [];
      };

      remediation_tasks: {
        Row: {
          id: string;
          practice_id: string;
          practice_control_id: string | null;
          guidance_id: string | null;
          assigned_to: string | null;
          status: "open" | "in_progress" | "blocked" | "done" | "dismissed" | null;
          due_date: string | null;
          completed_at: string | null;
          notes: string | null;
          created_at: string | null;
          control_id: string | null;
          title: string | null;
          source: "auto_control" | "policy_ack" | "training" | "baa" | "screening" | "manual";
          completed_by: string | null;
          severity: "critical" | "high" | "medium" | "low" | null;
          subject_ref: string | null;
        };
        Insert: {
          id?: string;
          practice_id: string;
          practice_control_id?: string | null;
          guidance_id?: string | null;
          assigned_to?: string | null;
          status?: Database["public"]["Tables"]["remediation_tasks"]["Row"]["status"];
          due_date?: string | null;
          completed_at?: string | null;
          notes?: string | null;
          created_at?: string | null;
          control_id?: string | null;
          title?: string | null;
          source?: Database["public"]["Tables"]["remediation_tasks"]["Row"]["source"];
          completed_by?: string | null;
          severity?: Database["public"]["Tables"]["remediation_tasks"]["Row"]["severity"];
          subject_ref?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["remediation_tasks"]["Insert"]>;
        Relationships: [];
      };

      evidence_snapshots: {
        Row: {
          id: string;
          practice_id: string;
          evidence_check_id: string;
          state_hash: string;
          observed_value: Json | null;
          captured_at: string | null;
        };
        Insert: {
          id?: string;
          practice_id: string;
          evidence_check_id: string;
          state_hash: string;
          observed_value?: Json | null;
          captured_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["evidence_snapshots"]["Insert"]>;
        Relationships: [];
      };

      drift_alerts: {
        Row: {
          id: string;
          practice_id: string;
          evidence_check_id: string;
          previous_state: Json | null;
          current_state: Json | null;
          severity: "critical" | "high" | "medium" | "low" | null;
          detected_at: string | null;
          acknowledged_at: string | null;
          acknowledged_by: string | null;
        };
        Insert: {
          id?: string;
          practice_id: string;
          evidence_check_id: string;
          previous_state?: Json | null;
          current_state?: Json | null;
          severity?: Database["public"]["Tables"]["drift_alerts"]["Row"]["severity"];
          detected_at?: string | null;
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["drift_alerts"]["Insert"]>;
        Relationships: [];
      };

      audit_logs: {
        Row: {
          id: string;
          practice_id: string;
          actor_user_id: string | null;
          actor_service: string | null;
          action: string;
          resource_type: string;
          resource_id: string | null;
          metadata: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          occurred_at: string | null;
        };
        Insert: {
          id?: string;
          practice_id: string;
          actor_user_id?: string | null;
          actor_service?: string | null;
          action: string;
          resource_type: string;
          resource_id?: string | null;
          metadata?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          occurred_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
        Relationships: [];
      };

      // ── 003: vendors + BAAs ─────────────────────────────────────────────
      vendors: {
        Row: {
          id: string;
          practice_id: string;
          vendor_name: string;
          vendor_type: string | null;
          phi_access: boolean | null;
          contact_email: string | null;
          contact_name: string | null;
          website_url: string | null;
          notes: string | null;
          created_at: string | null;
          updated_at: string | null;
          contact_first_name: string | null;
          contact_last_name: string | null;
          contact_date_of_birth: string | null;
        };
        Insert: {
          id?: string;
          practice_id: string;
          vendor_name: string;
          vendor_type?: string | null;
          phi_access?: boolean | null;
          contact_email?: string | null;
          contact_name?: string | null;
          website_url?: string | null;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          contact_first_name?: string | null;
          contact_last_name?: string | null;
          contact_date_of_birth?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["vendors"]["Insert"]>;
        Relationships: [];
      };

      baas: {
        Row: {
          id: string;
          practice_id: string;
          vendor_id: string;
          status: "active" | "pending" | "expired" | "terminated";
          signed_date: string | null;
          expiration_date: string | null;
          document_url: string | null;
          signed_by: string | null;
          notes: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          practice_id: string;
          vendor_id: string;
          status?: Database["public"]["Tables"]["baas"]["Row"]["status"];
          signed_date?: string | null;
          expiration_date?: string | null;
          document_url?: string | null;
          signed_by?: string | null;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["baas"]["Insert"]>;
        Relationships: [];
      };

      // ── 004: risk / policies / training / reports ───────────────────────
      risk_assessments: {
        Row: {
          id: string;
          practice_id: string;
          framework: string;
          assessment_date: string;
          assessor_user_id: string | null;
          status: "draft" | "submitted" | "approved" | null;
          answers: Json | null;
          risk_score: number | null;
          risk_level: "low" | "medium" | "high" | "critical" | null;
          ai_executive_summary: string | null;
          ai_remediation_plan: string | null;
          report_url: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          practice_id: string;
          framework?: string;
          assessment_date?: string;
          assessor_user_id?: string | null;
          status?: Database["public"]["Tables"]["risk_assessments"]["Row"]["status"];
          answers?: Json | null;
          risk_score?: number | null;
          risk_level?: Database["public"]["Tables"]["risk_assessments"]["Row"]["risk_level"];
          ai_executive_summary?: string | null;
          ai_remediation_plan?: string | null;
          report_url?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["risk_assessments"]["Insert"]>;
        Relationships: [];
      };

      policies: {
        Row: {
          id: string;
          practice_id: string;
          framework: string | null;
          policy_type: string;
          title: string;
          content_markdown: string;
          version: number | null;
          status: "draft" | "active" | "archived" | null;
          ai_generated: boolean | null;
          effective_date: string | null;
          next_review_date: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          practice_id: string;
          framework?: string | null;
          policy_type: string;
          title: string;
          content_markdown: string;
          version?: number | null;
          status?: Database["public"]["Tables"]["policies"]["Row"]["status"];
          ai_generated?: boolean | null;
          effective_date?: string | null;
          next_review_date?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["policies"]["Insert"]>;
        Relationships: [];
      };

      policy_acknowledgments: {
        Row: {
          id: string;
          policy_id: string;
          practice_id: string;
          user_id: string;
          acknowledged_at: string | null;
          policy_version: number;
        };
        Insert: {
          id?: string;
          policy_id: string;
          practice_id: string;
          user_id: string;
          acknowledged_at?: string | null;
          policy_version: number;
        };
        Update: Partial<Database["public"]["Tables"]["policy_acknowledgments"]["Insert"]>;
        Relationships: [];
      };

      training_modules: {
        Row: {
          id: string;
          framework: string | null;
          module_type: string;
          title: string;
          description: string | null;
          content_markdown: string;
          duration_minutes: number | null;
          passing_score: number | null;
          active: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          framework?: string | null;
          module_type: string;
          title: string;
          description?: string | null;
          content_markdown: string;
          duration_minutes?: number | null;
          passing_score?: number | null;
          active?: boolean | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["training_modules"]["Insert"]>;
        Relationships: [];
      };

      training_completions: {
        Row: {
          id: string;
          module_id: string;
          practice_id: string;
          user_id: string;
          completed_at: string | null;
          score: number | null;
          expires_on: string | null;
        };
        Insert: {
          id?: string;
          module_id: string;
          practice_id: string;
          user_id: string;
          completed_at?: string | null;
          score?: number | null;
          expires_on?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["training_completions"]["Insert"]>;
        Relationships: [];
      };

      reports: {
        Row: {
          id: string;
          practice_id: string;
          report_type: string;
          framework: string | null;
          generated_at: string | null;
          generated_by: string | null;
          snapshot: Json | null;
          ai_executive_summary: string | null;
          file_url: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          practice_id: string;
          report_type: string;
          framework?: string | null;
          generated_at?: string | null;
          generated_by?: string | null;
          snapshot?: Json | null;
          ai_executive_summary?: string | null;
          file_url?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["reports"]["Insert"]>;
        Relationships: [];
      };

      // ── 005: integrations ───────────────────────────────────────────────
      integrations: {
        Row: {
          id: string;
          practice_id: string;
          integration_type:
            // Identity
            | "microsoft_365" | "google_workspace" | "okta" | "azure_ad"
            // Cloud infrastructure
            | "aws" | "gcp" | "azure"
            // Backup / DR
            | "datto" | "acronis" | "cove_nable" | "veeam" | "azure_backup"
            // EHR / PMS (NO PHI — metadata only)
            | "athenahealth" | "advancedmd" | "dentrix" | "kareo_tebra" | "drchrono" | "ehr_other"
            // RMM / MSP
            | "ninjaone" | "connectwise" | "connectwise_rmm" | "connectwise_automate"
            | "datto_rmm" | "atera" | "syncro" | "nable_rmm"
            // E-signature
            | "docusign" | "dropbox_sign"
            // Task / project tracker
            | "jira" | "linear" | "asana" | "trello";
          // Set automatically by trigger from integration_type (migration 031)
          category:
            | "identity" | "cloud_infra" | "backup" | "ehr_pms"
            | "rmm_msp" | "signing" | "task_tracker" | null;
          status: "connected" | "disconnected" | "error";
          external_account_id: string | null;
          display_name: string | null;
          scopes: string[] | null;
          // Sole credential storage — sealed via writeCredentials(). The legacy
          // `encrypted_credentials` jsonb column was dropped in migration 028.
          encrypted_credentials_bytes: string | null;
          last_synced_at: string | null;
          last_error: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          practice_id: string;
          integration_type: Database["public"]["Tables"]["integrations"]["Row"]["integration_type"];
          status?: Database["public"]["Tables"]["integrations"]["Row"]["status"];
          external_account_id?: string | null;
          display_name?: string | null;
          scopes?: string[] | null;
          encrypted_credentials_bytes?: string | null;
          last_synced_at?: string | null;
          last_error?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["integrations"]["Insert"]>;
        Relationships: [];
      };

      // ── 007: onboarding v2 ──────────────────────────────────────────────
      practice_locations: {
        Row: {
          id: string;
          practice_id: string;
          label: string | null;
          street_1: string;
          street_2: string | null;
          city: string;
          region: string;
          postal_code: string;
          country: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          practice_id: string;
          label?: string | null;
          street_1: string;
          street_2?: string | null;
          city: string;
          region: string;
          postal_code: string;
          country?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["practice_locations"]["Insert"]>;
        Relationships: [];
      };

      onboarding_integration_choices: {
        Row: {
          id: string;
          practice_id: string;
          integration_type: string;
          notes: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          practice_id: string;
          integration_type: string;
          notes?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["onboarding_integration_choices"]["Insert"]>;
        Relationships: [];
      };

      assistance_requests: {
        Row: {
          id: string;
          practice_id: string;
          preferred_date: string | null;
          preferred_time_window: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          notes: string | null;
          status: "pending" | "scheduled" | "completed" | "cancelled" | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          practice_id: string;
          preferred_date?: string | null;
          preferred_time_window?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          notes?: string | null;
          status?: Database["public"]["Tables"]["assistance_requests"]["Row"]["status"];
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["assistance_requests"]["Insert"]>;
        Relationships: [];
      };

      // ── 008 + 012: user profiles + approval workflow ────────────────────
      user_profiles: {
        Row: {
          user_id: string;
          account_type: "admin" | "employee";
          full_name: string | null;
          job_title: string | null;
          phone: string | null;
          primary_address: Json | null;
          pending_practice_name: string | null;
          onboarded_at: string | null;
          updated_at: string | null;
          // Added by 012_approval_workflow
          status: "pending" | "approved" | "denied";
          claimed_admin_name: string | null;
          matched_practice_id: string | null;
          decided_by: string | null;
          decided_at: string | null;
          denial_reason: string | null;
          // Added by 017_exclusion_screening
          first_name: string | null;
          last_name: string | null;
          date_of_birth: string | null;
        };
        Insert: {
          user_id: string;
          account_type?: Database["public"]["Tables"]["user_profiles"]["Row"]["account_type"];
          full_name?: string | null;
          job_title?: string | null;
          phone?: string | null;
          primary_address?: Json | null;
          pending_practice_name?: string | null;
          onboarded_at?: string | null;
          updated_at?: string | null;
          status?: Database["public"]["Tables"]["user_profiles"]["Row"]["status"];
          claimed_admin_name?: string | null;
          matched_practice_id?: string | null;
          decided_by?: string | null;
          decided_at?: string | null;
          denial_reason?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          date_of_birth?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["user_profiles"]["Insert"]>;
        Relationships: [];
      };

      notifications: {
        Row: {
          id: string;
          user_id: string;
          practice_id: string | null;
          kind: string;
          title: string;
          body: string | null;
          link: string | null;
          read_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          practice_id?: string | null;
          kind: string;
          title: string;
          body?: string | null;
          link?: string | null;
          read_at?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };

      // ── 017: exclusion screening ────────────────────────────────────────
      exclusion_list_records: {
        Row: {
          id: string;
          source: "OIG_LEIE" | "SAM_GOV";
          source_record_id: string;
          source_snapshot_date: string;
          first_name: string | null;
          middle_name: string | null;
          last_name: string | null;
          business_name: string | null;
          date_of_birth: string | null;
          address_line: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          exclusion_type: string | null;
          exclusion_date: string | null;
          reinstatement_date: string | null;
          first_name_normalized: string | null;
          last_name_normalized: string | null;
          business_name_normalized: string | null;
          raw_payload: Json | null;
          imported_at: string | null;
        };
        Insert: {
          id?: string;
          source: "OIG_LEIE" | "SAM_GOV";
          source_record_id: string;
          source_snapshot_date: string;
          first_name?: string | null;
          middle_name?: string | null;
          last_name?: string | null;
          business_name?: string | null;
          date_of_birth?: string | null;
          address_line?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          exclusion_type?: string | null;
          exclusion_date?: string | null;
          reinstatement_date?: string | null;
          first_name_normalized?: string | null;
          last_name_normalized?: string | null;
          business_name_normalized?: string | null;
          raw_payload?: Json | null;
          imported_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["exclusion_list_records"]["Insert"]>;
        Relationships: [];
      };

      exclusion_list_snapshots: {
        Row: {
          id: string;
          source: string;
          snapshot_date: string;
          source_etag: string | null;
          records_total: number | null;
          records_added: number | null;
          records_removed: number | null;
          imported_at: string | null;
        };
        Insert: {
          id?: string;
          source: string;
          snapshot_date: string;
          source_etag?: string | null;
          records_total?: number | null;
          records_added?: number | null;
          records_removed?: number | null;
          imported_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["exclusion_list_snapshots"]["Insert"]>;
        Relationships: [];
      };

      exclusion_screenings: {
        Row: {
          id: string;
          subject_type: "workforce_member" | "vendor_contact";
          subject_user_id: string | null;
          subject_vendor_id: string | null;
          practice_id: string | null;
          first_name: string;
          middle_name: string | null;
          last_name: string;
          date_of_birth: string;
          address_line: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          status: "pending" | "cleared" | "review_required" | "blocked" | "overridden_clear";
          tier1_match_count: number | null;
          tier2_match_count: number | null;
          matched_record_ids: string[] | null;
          screened_at: string;
          expires_at: string | null;
          decided_by: string | null;
          decision_reason: string | null;
          notification_sent_at: string | null;
          user_message_shown: string | null;
        };
        Insert: {
          id?: string;
          subject_type: "workforce_member" | "vendor_contact";
          subject_user_id?: string | null;
          subject_vendor_id?: string | null;
          practice_id?: string | null;
          first_name: string;
          middle_name?: string | null;
          last_name: string;
          date_of_birth: string;
          address_line?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          status?: "pending" | "cleared" | "review_required" | "blocked" | "overridden_clear";
          tier1_match_count?: number | null;
          tier2_match_count?: number | null;
          matched_record_ids?: string[] | null;
          screened_at?: string;
          expires_at?: string | null;
          decided_by?: string | null;
          decision_reason?: string | null;
          notification_sent_at?: string | null;
          user_message_shown?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["exclusion_screenings"]["Insert"]>;
        Relationships: [];
      };

      // ── 022: attestations ───────────────────────────────────────────────
      attestations: {
        Row: {
          id: string;
          practice_id: string;
          type: "hipaa_sra" | "soc2_readiness";
          status: "draft" | "signed" | "superseded";
          title: string;
          snapshot: Json;
          executive_summary: string | null;
          document_hash: string;
          period_start: string | null;
          period_end: string | null;
          generated_by: string | null;
          generated_at: string;
          signed_by: string | null;
          signer_name: string | null;
          signer_title: string | null;
          signed_at: string | null;
          signature_method: "e_signature" | "print_and_sign" | null;
          signature_ip: string | null;
          signature_statement: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          practice_id: string;
          type: "hipaa_sra" | "soc2_readiness";
          status?: "draft" | "signed" | "superseded";
          title: string;
          snapshot: Json;
          executive_summary?: string | null;
          document_hash: string;
          period_start?: string | null;
          period_end?: string | null;
          generated_by?: string | null;
          generated_at?: string;
          signed_by?: string | null;
          signer_name?: string | null;
          signer_title?: string | null;
          signed_at?: string | null;
          signature_method?: "e_signature" | "print_and_sign" | null;
          signature_ip?: string | null;
          signature_statement?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["attestations"]["Insert"]>;
        Relationships: [];
      };

      // ── 001: legacy threat-intel core ───────────────────────────────────
      threats: {
        Row: {
          id: string;
          cve_id: string | null;
          title: string;
          summary: string | null;
          affected_products: string[] | null;
          exploit_status: "active" | "poc" | "theoretical" | "none" | null;
          reference_url: string | null;
          fix_status: "patched" | "workaround" | "fixing" | null;
          severity: "critical" | "high" | "medium" | "low" | null;
          source_name: string | null;
          source_tab: "registry" | "community" | "forums" | null;
          raw_content: string | null;
          credibility_score: number | null;
          is_critical: boolean | null;
          tags: string[] | null;
          published_at: string | null;
          ingested_at: string | null;
        };
        Insert: {
          id?: string;
          cve_id?: string | null;
          title: string;
          summary?: string | null;
          affected_products?: string[] | null;
          exploit_status?: Database["public"]["Tables"]["threats"]["Row"]["exploit_status"];
          reference_url?: string | null;
          fix_status?: Database["public"]["Tables"]["threats"]["Row"]["fix_status"];
          severity?: Database["public"]["Tables"]["threats"]["Row"]["severity"];
          source_name?: string | null;
          source_tab?: Database["public"]["Tables"]["threats"]["Row"]["source_tab"];
          raw_content?: string | null;
          credibility_score?: number | null;
          is_critical?: boolean | null;
          tags?: string[] | null;
          published_at?: string | null;
          ingested_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["threats"]["Insert"]>;
        Relationships: [];
      };

      ingestion_logs: {
        Row: {
          id: string;
          source: string | null;
          items_fetched: number | null;
          items_new: number | null;
          status: string | null;
          error_message: string | null;
          ran_at: string | null;
        };
        Insert: {
          id?: string;
          source?: string | null;
          items_fetched?: number | null;
          items_new?: number | null;
          status?: string | null;
          error_message?: string | null;
          ran_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["ingestion_logs"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      audit_readiness: {
        Args: { p_practice_id: string; p_framework_code: string };
        Returns: Array<{
          framework: string;
          satisfied_requirements: number;
          total_requirements: number;
          weighted_pct: number;
          category_breakdown: Json;
        }>;
      };
      audit_readiness_summary: {
        Args: { p_practice_id: string };
        Returns: Array<{
          framework_code: string;
          weighted_pct: number;
          satisfied: number;
          total: number;
        }>;
      };
      search_threats: {
        Args: { query: string };
        Returns: Array<Database["public"]["Tables"]["threats"]["Row"]>;
      };
      user_is_practice_member: {
        Args: { p_practice_id: string };
        Returns: boolean;
      };
      user_is_practice_admin: {
        Args: { p_practice_id: string };
        Returns: boolean;
      };
      touch_user_profiles_updated_at: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      _no_phi_check: {
        Args: { s: string };
        Returns: boolean;
      };
      encrypt_credentials_v1: {
        Args: { plaintext: string; key: string };
        Returns: string;
      };
      decrypt_credentials_v1: {
        Args: { cipher: string; key: string };
        Returns: string;
      };
      match_exclusion_fuzzy: {
        Args: {
          p_first_normalized: string;
          p_last_normalized: string;
          p_dob: string;
          p_threshold?: number;
        };
        Returns: Array<{
          id: string;
          source: "OIG_LEIE" | "SAM_GOV";
          first_name: string | null;
          middle_name: string | null;
          last_name: string | null;
          business_name: string | null;
          date_of_birth: string | null;
          address_line: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          exclusion_type: string | null;
          exclusion_date: string | null;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

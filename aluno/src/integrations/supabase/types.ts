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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      alunos_avulsos_cronograma: {
        Row: {
          created_at: string | null
          email: string | null
          foto_filename: string | null
          id: string
          matricula: string
          nome: string
          turma: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          foto_filename?: string | null
          id?: string
          matricula: string
          nome: string
          turma?: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          foto_filename?: string | null
          id?: string
          matricula?: string
          nome?: string
          turma?: string
        }
        Relationships: []
      }
      alunos_xtris: {
        Row: {
          created_at: string
          email: string | null
          foto_filename: string | null
          id: string
          matricula: string
          nome: string
          turma: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          foto_filename?: string | null
          id?: string
          matricula: string
          nome: string
          turma?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          foto_filename?: string | null
          id?: string
          matricula?: string
          nome?: string
          turma?: string
        }
        Relationships: []
      }
      api_usage: {
        Row: {
          created_at: string
          duration_ms: number | null
          endpoint: string
          error: string | null
          id: string
          model: string | null
          school_id: string | null
          status: number | null
          tokens_in: number | null
          tokens_out: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          endpoint: string
          error?: string | null
          id?: string
          model?: string | null
          school_id?: string | null
          status?: number | null
          tokens_in?: number | null
          tokens_out?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          endpoint?: string
          error?: string | null
          id?: string
          model?: string | null
          school_id?: string | null
          status?: number | null
          tokens_in?: number | null
          tokens_out?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          school_id: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          school_id?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          school_id?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      blocos_cronograma: {
        Row: {
          concluido: boolean | null
          cor: string | null
          created_at: string | null
          cronograma_id: string
          descricao: string | null
          dia_semana: string
          disciplina_codigo: string | null
          horario_fim: string
          horario_inicio: string
          id: string
          prioridade: number | null
          tipo: string
          titulo: string
          turno: string
        }
        Insert: {
          concluido?: boolean | null
          cor?: string | null
          created_at?: string | null
          cronograma_id: string
          descricao?: string | null
          dia_semana: string
          disciplina_codigo?: string | null
          horario_fim: string
          horario_inicio: string
          id?: string
          prioridade?: number | null
          tipo: string
          titulo: string
          turno: string
        }
        Update: {
          concluido?: boolean | null
          cor?: string | null
          created_at?: string | null
          cronograma_id?: string
          descricao?: string | null
          dia_semana?: string
          disciplina_codigo?: string | null
          horario_fim?: string
          horario_inicio?: string
          id?: string
          prioridade?: number | null
          tipo?: string
          titulo?: string
          turno?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocos_cronograma_cronograma_id_fkey"
            columns: ["cronograma_id"]
            isOneToOne: false
            referencedRelation: "cronogramas"
            referencedColumns: ["id"]
          },
        ]
      }
      content_topics: {
        Row: {
          area_sigla: string
          canonical_label: string
          created_at: string
          id: string
          is_active: boolean
          origin_source_context: string
          origin_source_reference: string | null
          subject_label: string
          topic_label: string
        }
        Insert: {
          area_sigla: string
          canonical_label: string
          created_at?: string
          id?: string
          is_active?: boolean
          origin_source_context?: string
          origin_source_reference?: string | null
          subject_label: string
          topic_label: string
        }
        Update: {
          area_sigla?: string
          canonical_label?: string
          created_at?: string
          id?: string
          is_active?: boolean
          origin_source_context?: string
          origin_source_reference?: string | null
          subject_label?: string
          topic_label?: string
        }
        Relationships: []
      }
      coordinator_invites: {
        Row: {
          allowed_series: string[] | null
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invited_by: string | null
          name: string | null
          school_id: string
          status: string | null
        }
        Insert: {
          allowed_series?: string[] | null
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          name?: string | null
          school_id: string
          status?: string | null
        }
        Update: {
          allowed_series?: string[] | null
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          name?: string | null
          school_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coordinator_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coordinator_invites_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      cronogramas: {
        Row: {
          aluno_id: string
          created_at: string | null
          id: string
          observacoes: string | null
          semana_fim: string
          semana_inicio: string
          status: string
          updated_at: string | null
        }
        Insert: {
          aluno_id: string
          created_at?: string | null
          id?: string
          observacoes?: string | null
          semana_fim: string
          semana_inicio: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          aluno_id?: string
          created_at?: string | null
          id?: string
          observacoes?: string | null
          semana_fim?: string
          semana_inicio?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      exam_question_topics: {
        Row: {
          confidence: number | null
          created_at: string
          exam_id: string
          id: string
          is_active: boolean
          mapping_source: string
          question_number: number
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_context: string
          source_reference: string | null
          topic_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          exam_id: string
          id?: string
          is_active?: boolean
          mapping_source: string
          question_number: number
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_context?: string
          source_reference?: string | null
          topic_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          exam_id?: string
          id?: string
          is_active?: boolean
          mapping_source?: string
          question_number?: number
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_context?: string
          source_reference?: string | null
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_question_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "content_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      horarios_oficiais: {
        Row: {
          created_at: string
          dia_semana: string
          disciplina: string
          horario_fim: string
          horario_inicio: string
          id: string
          professor: string | null
          turma: string
          turno: string
        }
        Insert: {
          created_at?: string
          dia_semana: string
          disciplina: string
          horario_fim: string
          horario_inicio: string
          id?: string
          professor?: string | null
          turma: string
          turno: string
        }
        Update: {
          created_at?: string
          dia_semana?: string
          disciplina?: string
          horario_fim?: string
          horario_inicio?: string
          id?: string
          professor?: string | null
          turma?: string
          turno?: string
        }
        Relationships: []
      }
      mentor_alert_feedback: {
        Row: {
          created_at: string
          decision: string
          id: string
          mentor_alert_id: string
          mentor_user_id: string
          note: string | null
        }
        Insert: {
          created_at?: string
          decision: string
          id?: string
          mentor_alert_id: string
          mentor_user_id: string
          note?: string | null
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          mentor_alert_id?: string
          mentor_user_id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mentor_alert_feedback_mentor_alert_id_fkey"
            columns: ["mentor_alert_id"]
            isOneToOne: false
            referencedRelation: "mentor_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_alerts: {
        Row: {
          alert_type: string
          analysis_run_id: string
          created_at: string
          evidence: Json
          id: string
          message: string
          school_id: string
          severity: string
          status: string
          student_key: string
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          alert_type: string
          analysis_run_id: string
          created_at?: string
          evidence?: Json
          id?: string
          message: string
          school_id: string
          severity: string
          status?: string
          student_key: string
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          alert_type?: string
          analysis_run_id?: string
          created_at?: string
          evidence?: Json
          id?: string
          message?: string
          school_id?: string
          severity?: string
          status?: string
          student_key?: string
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_alerts_analysis_run_id_fkey"
            columns: ["analysis_run_id"]
            isOneToOne: false
            referencedRelation: "mentor_analysis_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_alerts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_alerts_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "content_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_analysis_runs: {
        Row: {
          analyzed_at: string
          avg_mastery_critical: number
          avg_mastery_planned: number
          briefing: string
          id: string
          mentor_plan_id: string
          overall_status: string
          school_id: string
          student_key: string
          unmapped_questions_count: number
        }
        Insert: {
          analyzed_at?: string
          avg_mastery_critical?: number
          avg_mastery_planned?: number
          briefing: string
          id?: string
          mentor_plan_id: string
          overall_status: string
          school_id: string
          student_key: string
          unmapped_questions_count?: number
        }
        Update: {
          analyzed_at?: string
          avg_mastery_critical?: number
          avg_mastery_planned?: number
          briefing?: string
          id?: string
          mentor_plan_id?: string
          overall_status?: string
          school_id?: string
          student_key?: string
          unmapped_questions_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "mentor_analysis_runs_mentor_plan_id_fkey"
            columns: ["mentor_plan_id"]
            isOneToOne: false
            referencedRelation: "mentor_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_analysis_runs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_plan_items: {
        Row: {
          created_at: string
          expected_level: string
          fallback_area_sigla: string | null
          fallback_habilidade: number | null
          fallback_label: string | null
          id: string
          mentor_plan_id: string
          notes: string | null
          planned_order: number
          source: string
          topic_id: string | null
        }
        Insert: {
          created_at?: string
          expected_level: string
          fallback_area_sigla?: string | null
          fallback_habilidade?: number | null
          fallback_label?: string | null
          id?: string
          mentor_plan_id: string
          notes?: string | null
          planned_order?: number
          source: string
          topic_id?: string | null
        }
        Update: {
          created_at?: string
          expected_level?: string
          fallback_area_sigla?: string | null
          fallback_habilidade?: number | null
          fallback_label?: string | null
          id?: string
          mentor_plan_id?: string
          notes?: string | null
          planned_order?: number
          source?: string
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mentor_plan_items_mentor_plan_id_fkey"
            columns: ["mentor_plan_id"]
            isOneToOne: false
            referencedRelation: "mentor_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_plan_items_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "content_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_plans: {
        Row: {
          capability_state: string
          coverage_percent: number
          created_at: string
          distinct_topics: number
          generation_mode: string
          id: string
          mapped_pairs: number
          mentor_user_id: string
          notes: string | null
          pdf_history_id: string | null
          school_id: string
          source: string
          status: string
          student_key: string | null
          target_type: string
          taxonomy_source_kind: string
          total_pairs: number
          turma: string | null
          updated_at: string
          week_end: string
          week_start: string
        }
        Insert: {
          capability_state?: string
          coverage_percent?: number
          created_at?: string
          distinct_topics?: number
          generation_mode?: string
          id?: string
          mapped_pairs?: number
          mentor_user_id: string
          notes?: string | null
          pdf_history_id?: string | null
          school_id: string
          source: string
          status?: string
          student_key?: string | null
          target_type: string
          taxonomy_source_kind?: string
          total_pairs?: number
          turma?: string | null
          updated_at?: string
          week_end: string
          week_start: string
        }
        Update: {
          capability_state?: string
          coverage_percent?: number
          created_at?: string
          distinct_topics?: number
          generation_mode?: string
          id?: string
          mapped_pairs?: number
          mentor_user_id?: string
          notes?: string | null
          pdf_history_id?: string | null
          school_id?: string
          source?: string
          status?: string
          student_key?: string | null
          target_type?: string
          taxonomy_source_kind?: string
          total_pairs?: number
          turma?: string | null
          updated_at?: string
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_history: {
        Row: {
          aluno_id: string
          aluno_nome: string
          created_at: string | null
          created_by: string | null
          file_size: number | null
          filename: string
          id: string
          matricula: string | null
          school_id: string | null
          storage_path: string
          tipo: string
          turma: string | null
        }
        Insert: {
          aluno_id: string
          aluno_nome: string
          created_at?: string | null
          created_by?: string | null
          file_size?: number | null
          filename: string
          id?: string
          matricula?: string | null
          school_id?: string | null
          storage_path: string
          tipo?: string
          turma?: string | null
        }
        Update: {
          aluno_id?: string
          aluno_nome?: string
          created_at?: string | null
          created_by?: string | null
          file_size?: number | null
          filename?: string
          id?: string
          matricula?: string | null
          school_id?: string | null
          storage_path?: string
          tipo?: string
          turma?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdf_history_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          allowed_series: string[] | null
          created_at: string | null
          email: string
          id: string
          must_change_password: boolean | null
          name: string
          role: string
          school_id: string | null
          student_number: string | null
          turma: string | null
        }
        Insert: {
          allowed_series?: string[] | null
          created_at?: string | null
          email: string
          id: string
          must_change_password?: boolean | null
          name: string
          role: string
          school_id?: string | null
          student_number?: string | null
          turma?: string | null
        }
        Update: {
          allowed_series?: string[] | null
          created_at?: string | null
          email?: string
          id?: string
          must_change_password?: boolean | null
          name?: string
          role?: string
          school_id?: string | null
          student_number?: string | null
          turma?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      project_users: {
        Row: {
          allowed_series: string[] | null
          auth_uid: string | null
          created_at: string | null
          email: string
          id: string
          invited_by: string | null
          is_active: boolean | null
          must_change_password: boolean
          name: string | null
          notes: string | null
          role: string
          school_id: string | null
          updated_at: string | null
        }
        Insert: {
          allowed_series?: string[] | null
          auth_uid?: string | null
          created_at?: string | null
          email: string
          id?: string
          invited_by?: string | null
          is_active?: boolean | null
          must_change_password?: boolean
          name?: string | null
          notes?: string | null
          role?: string
          school_id?: string | null
          updated_at?: string | null
        }
        Update: {
          allowed_series?: string[] | null
          auth_uid?: string | null
          created_at?: string | null
          email?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean | null
          must_change_password?: boolean
          name?: string | null
          notes?: string | null
          role?: string
          school_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_users_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      question_bank_audit_findings: {
        Row: {
          audit_run_id: string
          defect_type: string
          detected_at: string
          evidence: Json
          id: string
          question_id: string | null
          severity: string
          source_exam: string | null
          source_question: number
          source_year: number
        }
        Insert: {
          audit_run_id: string
          defect_type: string
          detected_at?: string
          evidence?: Json
          id?: string
          question_id?: string | null
          severity: string
          source_exam?: string | null
          source_question: number
          source_year: number
        }
        Update: {
          audit_run_id?: string
          defect_type?: string
          detected_at?: string
          evidence?: Json
          id?: string
          question_id?: string | null
          severity?: string
          source_exam?: string | null
          source_question?: number
          source_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_audit_findings_audit_run_id_fkey"
            columns: ["audit_run_id"]
            isOneToOne: false
            referencedRelation: "question_bank_audit_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      question_bank_audit_runs: {
        Row: {
          created_at: string
          created_by: string | null
          findings_count: number
          id: string
          sample_size: number
          source_project_ref: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          findings_count?: number
          id?: string
          sample_size?: number
          source_project_ref: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          findings_count?: number
          id?: string
          sample_size?: number
          source_project_ref?: string
        }
        Relationships: []
      }
      question_enrichment_audits: {
        Row: {
          audit_type: string
          created_at: string
          evidence: Json
          id: string
          question_enrichment_id: string | null
          run_id: string | null
          severity: string
          status: string
        }
        Insert: {
          audit_type: string
          created_at?: string
          evidence?: Json
          id?: string
          question_enrichment_id?: string | null
          run_id?: string | null
          severity: string
          status?: string
        }
        Update: {
          audit_type?: string
          created_at?: string
          evidence?: Json
          id?: string
          question_enrichment_id?: string | null
          run_id?: string | null
          severity?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_enrichment_audits_question_enrichment_id_fkey"
            columns: ["question_enrichment_id"]
            isOneToOne: false
            referencedRelation: "question_enrichments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_enrichment_audits_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "question_enrichment_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      question_enrichment_overrides: {
        Row: {
          created_at: string
          created_by: string
          id: string
          override_label: string | null
          override_topic_id: string | null
          question_enrichment_id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          override_label?: string | null
          override_topic_id?: string | null
          question_enrichment_id: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          override_label?: string | null
          override_topic_id?: string | null
          question_enrichment_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_enrichment_overrides_override_topic_id_fkey"
            columns: ["override_topic_id"]
            isOneToOne: false
            referencedRelation: "content_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_enrichment_overrides_question_enrichment_id_fkey"
            columns: ["question_enrichment_id"]
            isOneToOne: false
            referencedRelation: "question_enrichments"
            referencedColumns: ["id"]
          },
        ]
      }
      question_enrichment_runs: {
        Row: {
          created_at: string
          created_by: string | null
          error_summary: string | null
          finished_at: string | null
          id: string
          items_flagged: number
          items_processed: number
          items_written: number
          model_name: string
          source_reference: string | null
          source_system: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_summary?: string | null
          finished_at?: string | null
          id?: string
          items_flagged?: number
          items_processed?: number
          items_written?: number
          model_name: string
          source_reference?: string | null
          source_system: string
          status: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_summary?: string | null
          finished_at?: string | null
          id?: string
          items_flagged?: number
          items_processed?: number
          items_written?: number
          model_name?: string
          source_reference?: string | null
          source_system?: string
          status?: string
        }
        Relationships: []
      }
      question_enrichment_sources: {
        Row: {
          created_at: string
          evidence_json: Json
          id: string
          question_enrichment_id: string
          source_excerpt: string | null
          source_position: Json | null
          source_text: string
        }
        Insert: {
          created_at?: string
          evidence_json?: Json
          id?: string
          question_enrichment_id: string
          source_excerpt?: string | null
          source_position?: Json | null
          source_text: string
        }
        Update: {
          created_at?: string
          evidence_json?: Json
          id?: string
          question_enrichment_id?: string
          source_excerpt?: string | null
          source_position?: Json | null
          source_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_enrichment_sources_question_enrichment_id_fkey"
            columns: ["question_enrichment_id"]
            isOneToOne: false
            referencedRelation: "question_enrichments"
            referencedColumns: ["id"]
          },
        ]
      }
      question_enrichments: {
        Row: {
          canonical_label: string | null
          confidence_score: number | null
          created_at: string
          enrichment_type: string
          exam_id: string
          id: string
          metadata: Json
          question_number: number
          source_context: string
          source_model: string
          source_run_id: string | null
          status: string
          topic_id: string | null
        }
        Insert: {
          canonical_label?: string | null
          confidence_score?: number | null
          created_at?: string
          enrichment_type: string
          exam_id: string
          id?: string
          metadata?: Json
          question_number: number
          source_context?: string
          source_model: string
          source_run_id?: string | null
          status?: string
          topic_id?: string | null
        }
        Update: {
          canonical_label?: string | null
          confidence_score?: number | null
          created_at?: string
          enrichment_type?: string
          exam_id?: string
          id?: string
          metadata?: Json
          question_number?: number
          source_context?: string
          source_model?: string
          source_run_id?: string | null
          status?: string
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_enrichments_source_run_id_fkey"
            columns: ["source_run_id"]
            isOneToOne: false
            referencedRelation: "question_enrichment_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_enrichments_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "content_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      school_schedules: {
        Row: {
          ano_letivo: number
          created_at: string | null
          created_by: string | null
          dia_semana: string
          disciplina: string
          horario_fim: string
          horario_inicio: string
          id: string
          professor: string | null
          school_id: string
          turma: string
          turno: string
          updated_at: string | null
        }
        Insert: {
          ano_letivo?: number
          created_at?: string | null
          created_by?: string | null
          dia_semana: string
          disciplina: string
          horario_fim: string
          horario_inicio: string
          id?: string
          professor?: string | null
          school_id: string
          turma: string
          turno: string
          updated_at?: string | null
        }
        Update: {
          ano_letivo?: number
          created_at?: string | null
          created_by?: string | null
          dia_semana?: string
          disciplina?: string
          horario_fim?: string
          horario_inicio?: string
          id?: string
          professor?: string | null
          school_id?: string
          turma?: string
          turno?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_schedules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          created_at: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      student_reports: {
        Row: {
          created_at: string
          created_by: string | null
          curso_nome: string | null
          curso_universidade: string | null
          exam_id: string
          exam_title: string | null
          id: string
          pdf_history_id: string | null
          report_data: Json
          report_type: string
          school_id: string | null
          student_key: string
          student_name: string
          turma: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          curso_nome?: string | null
          curso_universidade?: string | null
          exam_id: string
          exam_title?: string | null
          id?: string
          pdf_history_id?: string | null
          report_data: Json
          report_type?: string
          school_id?: string | null
          student_key: string
          student_name: string
          turma?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          curso_nome?: string | null
          curso_universidade?: string | null
          exam_id?: string
          exam_title?: string | null
          id?: string
          pdf_history_id?: string | null
          report_data?: Json
          report_type?: string
          school_id?: string | null
          student_key?: string
          student_name?: string
          turma?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_reports_pdf_history_id_fkey"
            columns: ["pdf_history_id"]
            isOneToOne: false
            referencedRelation: "pdf_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string | null
          id: string
          matricula: string | null
          name: string | null
          profile_id: string | null
          school_id: string | null
          sheet_code: string | null
          turma: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          matricula?: string | null
          name?: string | null
          profile_id?: string | null
          school_id?: string | null
          sheet_code?: string | null
          turma?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          matricula?: string | null
          name?: string | null
          profile_id?: string | null
          school_id?: string | null
          sheet_code?: string | null
          turma?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_edges: {
        Row: {
          confidence_score: number | null
          created_at: string
          edge_type: string
          id: string
          is_active: boolean
          source_context: string
          source_run_id: string | null
          source_topic_id: string
          target_topic_id: string
          weight: number
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          edge_type: string
          id?: string
          is_active?: boolean
          source_context?: string
          source_run_id?: string | null
          source_topic_id: string
          target_topic_id: string
          weight?: number
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          edge_type?: string
          id?: string
          is_active?: boolean
          source_context?: string
          source_run_id?: string | null
          source_topic_id?: string
          target_topic_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "topic_edges_source_topic_id_fkey"
            columns: ["source_topic_id"]
            isOneToOne: false
            referencedRelation: "content_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_edges_target_topic_id_fkey"
            columns: ["target_topic_id"]
            isOneToOne: false
            referencedRelation: "content_topics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_project_user:
        | {
            Args: {
              p_allowed_series?: string[]
              p_email: string
              p_name?: string
              p_password?: string
              p_role?: string
              p_school_id?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_allowed_series?: string[]
              p_email: string
              p_name?: string
              p_role?: string
              p_school_id: string
            }
            Returns: Json
          }
      aluno_belongs_to_my_school: {
        Args: { p_aluno_id: string }
        Returns: boolean
      }
      apply_homologation_taxonomy_seed: {
        Args: { mappings: Json; seed_reference: string }
        Returns: {
          inserted_mappings: number
          inserted_topics: number
          reused_topics: number
          skipped_due_to_production: number
          updated_mappings: number
        }[]
      }
      can_access_school: {
        Args: { target_school_id: string }
        Returns: boolean
      }
      can_manage_mentor_content: { Args: never; Returns: boolean }
      cleanup_homologation_taxonomy_seed: {
        Args: { seed_reference: string }
        Returns: {
          archived_mappings: number
          archived_topics: number
        }[]
      }
      count_cronogramas_by_school: {
        Args: { p_school_id: string; p_since: string }
        Returns: number
      }
      create_coordinator_invite: {
        Args: {
          p_allowed_series?: string[]
          p_email: string
          p_name?: string
          p_school_id: string
        }
        Returns: Json
      }
      current_project_role: { Args: never; Returns: string }
      current_school_id: { Args: never; Returns: string }
      dblink: { Args: { "": string }; Returns: Record<string, unknown>[] }
      dblink_cancel_query: { Args: { "": string }; Returns: string }
      dblink_close: { Args: { "": string }; Returns: string }
      dblink_connect: { Args: { "": string }; Returns: string }
      dblink_connect_u: { Args: { "": string }; Returns: string }
      dblink_current_query: { Args: never; Returns: string }
      dblink_disconnect:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      dblink_error_message: { Args: { "": string }; Returns: string }
      dblink_exec: { Args: { "": string }; Returns: string }
      dblink_fdw_validator: {
        Args: { catalog: unknown; options: string[] }
        Returns: undefined
      }
      dblink_get_connections: { Args: never; Returns: string[] }
      dblink_get_notify:
        | { Args: { conname: string }; Returns: Record<string, unknown>[] }
        | { Args: never; Returns: Record<string, unknown>[] }
      dblink_get_pkey: {
        Args: { "": string }
        Returns: Database["public"]["CompositeTypes"]["dblink_pkey_results"][]
        SetofOptions: {
          from: "*"
          to: "dblink_pkey_results"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      dblink_get_result: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      dblink_is_busy: { Args: { "": string }; Returns: number }
      get_admin_dashboard_stats: { Args: never; Returns: Json }
      get_my_student_id: { Args: never; Returns: string }
      get_project_role: { Args: never; Returns: string }
      get_project_school_id: { Args: never; Returns: string }
      get_school_names: {
        Args: { school_ids: string[] }
        Returns: {
          id: string
          name: string
        }[]
      }
      get_user_role: { Args: never; Returns: string }
      get_user_school_id: { Args: never; Returns: string }
      is_my_aluno_id: { Args: { p_aluno_id: string }; Returns: boolean }
      is_my_cronograma: { Args: { p_cronograma_id: string }; Returns: boolean }
      is_project_super_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      link_my_auth_uid: { Args: never; Returns: Json }
      mark_password_changed: { Args: never; Returns: undefined }
      remove_coordinator: { Args: { p_email: string }; Returns: string }
      remove_project_user: { Args: { p_email: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      dblink_pkey_results: {
        position: number | null
        colname: string | null
      }
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

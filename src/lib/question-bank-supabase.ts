import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const QUESTION_BANK_SUPABASE_URL = 'https://uhqdkaftqjxenobdfqkd.supabase.co'
const QUESTION_BANK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVocWRrYWZ0cWp4ZW5vYmRmcWtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5Njg0NzYsImV4cCI6MjA4MjU0NDQ3Nn0.Ou2h8u9lbRUAAkJtdTtBknKfchqcYXlxWIyGizk5bns'

const AUXILIARY_AUTH_CONFIG = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
}

let questionBankSupabaseInstance: SupabaseClient | null = null

export function getQuestionBankSupabaseClient(): SupabaseClient {
  if (!questionBankSupabaseInstance) {
    questionBankSupabaseInstance = createClient(
      QUESTION_BANK_SUPABASE_URL,
      QUESTION_BANK_SUPABASE_ANON_KEY,
      {
        auth: AUXILIARY_AUTH_CONFIG,
      },
    )
  }

  return questionBankSupabaseInstance
}

export const QUESTION_BANK_PROJECT_REF = 'uhqdkaftqjxenobdfqkd'


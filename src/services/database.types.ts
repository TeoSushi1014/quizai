export interface Database {
  public: {
    Tables: {
      api_keys: {
        Row: {
          id: string
          key_name: string
          key_value: string
          owner_email: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key_name: string
          key_value: string
          owner_email: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key_name?: string
          key_value?: string
          owner_email?: string
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          bio: string | null
          image_url: string | null
          quiz_count: number
          completion_count: number
          average_score: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          bio?: string | null
          image_url?: string | null
          quiz_count?: number
          completion_count?: number
          average_score?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          bio?: string | null
          image_url?: string | null
          quiz_count?: number
          completion_count?: number
          average_score?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      quizzes: {
        Row: {
          id: string
          user_id: string
          title: string
          questions: any
          source_content: string | null
          source_file_name: string | null
          config: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          questions: any
          source_content?: string | null
          source_file_name?: string | null
          config?: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          questions?: any
          source_content?: string | null
          source_file_name?: string | null
          config?: any
          created_at?: string
          updated_at?: string
        }
      }
      quiz_results: {
        Row: {
          id: string
          user_id: string
          quiz_id: string
          score: number
          total_questions: number
          answers: any
          time_taken: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          quiz_id: string
          score: number
          total_questions: number
          answers: any
          time_taken?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          quiz_id?: string
          score?: number
          total_questions?: number
          answers?: any
          time_taken?: number | null
          created_at?: string
        }
      }
      shared_quizzes: {
        Row: {
          id: string
          quiz_id: string
          share_token: string
          is_public: boolean
          created_at: string
          expires_at: string | null
        }
        Insert: {
          id?: string
          quiz_id: string
          share_token: string
          is_public?: boolean
          created_at?: string
          expires_at?: string | null
        }
        Update: {
          id?: string
          quiz_id?: string
          share_token?: string
          is_public?: boolean
          created_at?: string
          expires_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

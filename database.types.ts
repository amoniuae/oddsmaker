export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      strategies: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_archived: boolean
          is_promoted: boolean
          losses: number
          name: string
          pnl: number
          user_id: string
          wins: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          is_promoted?: boolean
          losses?: number
          name: string
          pnl?: number
          user_id: string
          wins?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          is_promoted?: boolean
          losses?: number
          name?: string
          pnl?: number
          user_id?: string
          wins?: number
        }
      }
      strategy_versions: {
        Row: {
          author: string | null
          changelog: string | null
          content: Json
          created_at: string
          deployed: boolean
          id: string
          strategy_id: string
          version_number: number
        }
        Insert: {
          author?: string | null
          changelog?: string | null
          content: Json
          created_at?: string
          deployed?: boolean
          id?: string
          strategy_id: string
          version_number?: number
        }
        Update: {
          author?: string | null
          changelog?: string | null
          content?: Json
          created_at?: string
          deployed?: boolean
          id?: string
          strategy_id?: string
          version_number?: number
        }
      }
      tracked_accumulators: {
        Row: {
          accumulator_data: Json
          accumulator_id: string
          created_at: string
          id: number
          user_id: string
          virtual_stake: number
        }
        Insert: {
          accumulator_data: Json
          accumulator_id: string
          created_at?: string
          id?: number
          user_id: string
          virtual_stake: number
        }
        Update: {
          accumulator_data?: Json
          accumulator_id?: string
          created_at?: string
          id?: number
          user_id?: string
          virtual_stake?: number
        }
      }
      tracked_predictions: {
        Row: {
          created_at: string
          id: number
          prediction_data: Json
          prediction_id: string
          user_id: string
          virtual_stake: number
        }
        Insert: {
          created_at?: string
          id?: number
          prediction_data: Json
          prediction_id: string
          user_id: string
          virtual_stake: number
        }
        Update: {
          created_at?: string
          id?: number
          prediction_data?: Json
          prediction_id?: string
          user_id?: string
          virtual_stake?: number
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
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Auth configuration for better session handling
const supabaseOptions = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
};

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
      profiles: {
        Row: {
          id: string;
          user_id: string;
          name: string | null;
          avatar_url: string | null;
          theme: string;
          currency: string;
          locale: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name?: string | null;
          avatar_url?: string | null;
          theme?: string;
          currency?: string;
          locale?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string | null;
          avatar_url?: string | null;
          theme?: string;
          currency?: string;
          locale?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      income_sources: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          color: string;
          icon: string;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          description?: string | null;
          color?: string;
          icon?: string;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          color?: string;
          icon?: string;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      expense_sectors: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          color: string;
          icon: string;
          is_emergency_fund: boolean;
          is_investment: boolean;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          description?: string | null;
          color?: string;
          icon?: string;
          is_emergency_fund?: boolean;
          is_investment?: boolean;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          color?: string;
          icon?: string;
          is_emergency_fund?: boolean;
          is_investment?: boolean;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          type: 'income' | 'expense' | 'transfer_source' | 'transfer_dest' | 'sector_transfer_source' | 'sector_transfer_dest';
          amount: number;
          description: string;
          notes: string | null;
          transaction_date: string;
          income_source_id: string | null;
          expense_sector_id: string | null;
          transfer_to_income_source_id: string | null;
          transfer_to_expense_sector_id: string | null;
          recurring_bill_id: string | null;
          goal_contribution_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          type: 'income' | 'expense' | 'transfer_source' | 'transfer_dest' | 'sector_transfer_source' | 'sector_transfer_dest';
          amount: number;
          description: string;
          notes?: string | null;
          transaction_date?: string;
          income_source_id?: string | null;
          expense_sector_id?: string | null;
          transfer_to_income_source_id?: string | null;
          transfer_to_expense_sector_id?: string | null;
          recurring_bill_id?: string | null;
          goal_contribution_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: 'income' | 'expense' | 'transfer_source' | 'transfer_dest' | 'sector_transfer_source' | 'sector_transfer_dest';
          amount?: number;
          description?: string;
          notes?: string | null;
          transaction_date?: string;
          income_source_id?: string | null;
          expense_sector_id?: string | null;
          transfer_to_income_source_id?: string | null;
          transfer_to_expense_sector_id?: string | null;
          recurring_bill_id?: string | null;
          goal_contribution_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      recurring_bills: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          amount: number;
          due_day: number;
          expense_sector_id: string | null;
          is_active: boolean;
          last_paid_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          description?: string | null;
          amount: number;
          due_day: number;
          expense_sector_id?: string | null;
          is_active?: boolean;
          last_paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          amount?: number;
          due_day?: number;
          expense_sector_id?: string | null;
          is_active?: boolean;
          last_paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      financial_goals: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          target_amount: number;
          target_date: string | null;
          color: string;
          icon: string;
          completed_at: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          description?: string | null;
          target_amount: number;
          target_date?: string | null;
          color?: string;
          icon?: string;
          completed_at?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          target_amount?: number;
          target_date?: string | null;
          color?: string;
          icon?: string;
          completed_at?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      attachments: {
        Row: {
          id: string;
          user_id: string;
          transaction_id: string | null;
          file_name: string;
          file_path: string;
          file_size: number | null;
          mime_type: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          transaction_id?: string | null;
          file_name: string;
          file_path: string;
          file_size?: number | null;
          mime_type?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          transaction_id?: string | null;
          file_name?: string;
          file_path?:string;
          file_size?: number | null;
          mime_type?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {
      transaction_type: 'income' | 'expense' | 'transfer_source' | 'transfer_dest' | 'sector_transfer_source' | 'sector_transfer_dest';
    };
    CompositeTypes: {};
  };
}

// Create typed Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, supabaseOptions);

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type IncomeSource = Database['public']['Tables']['income_sources']['Row'];
export type ExpenseSector = Database['public']['Tables']['expense_sectors']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type RecurringBill = Database['public']['Tables']['recurring_bills']['Row'];
export type FinancialGoal = Database['public']['Tables']['financial_goals']['Row'];
export type Attachment = Database['public']['Tables']['attachments']['Row'];

export type TransactionType = Database['public']['Enums']['transaction_type'];

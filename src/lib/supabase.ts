import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

/* =========================
   SIMPLIFIED + STABLE CONFIG
========================= */
const supabaseOptions = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // 🔥 FIX PRINCIPAL
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseOptions);

/* =========================
   TYPES (UNCHANGED)
========================= */

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
      income_sources: Database['public']['Tables']['profiles'] extends any ? any : never;
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
}

/* =========================
   TYPE EXPORTS
========================= */
export type Profile = Database['public']['Tables']['profiles']['Row'];

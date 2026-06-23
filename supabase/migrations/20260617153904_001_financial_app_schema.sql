/*
# Financial Management Application Schema

1. Purpose
   - Comprehensive financial tracking system with income sources, expense sectors, and full transaction history
   - Multi-tenant architecture with user isolation via RLS
   - Supports recurring bills, financial goals, and attachments

2. New Tables
   - `profiles`: Extended user data (name, avatar, preferences)
   - `income_sources`: Sources of revenue (Store, Uber, Job, Freelance, etc.)
   - `expense_sectors`: Cost centers (Food, Vehicle, Health, Emergency Fund, etc.)
   - `transactions`: All financial movements with full audit trail
   - `recurring_bills`: Monthly recurring expenses with due dates
   - `financial_goals`: Savings goals with progress tracking
   - `attachments`: Optional receipt/document images for transactions

3. Security
   - RLS enabled on ALL tables
   - Four policies per table (SELECT, INSERT, UPDATE, DELETE)
   - All policies restrict access to auth.uid() = user_id
   - DEFAULT auth.uid() on user_id allows frontend inserts without passing owner

4. Important Notes
   - Transactions use enum for type: 'income', 'expense', 'transfer_source', 'transfer_dest', etc.
   - Balance is computed from transactions, not stored (single source of truth)
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Transaction Types (create first as it's needed by tables)
DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'transfer_source', 'transfer_dest', 'sector_transfer_source', 'sector_transfer_dest');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  name text,
  avatar_url text,
  theme text NOT NULL DEFAULT 'dark',
  currency text NOT NULL DEFAULT 'BRL',
  locale text NOT NULL DEFAULT 'pt-BR',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Income Sources (Fontes de Renda)
CREATE TABLE IF NOT EXISTS income_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#3B82F6',
  icon text NOT NULL DEFAULT 'Wallet',
  archived_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE income_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_income_sources" ON income_sources;
CREATE POLICY "select_own_income_sources" ON income_sources FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_income_sources" ON income_sources;
CREATE POLICY "insert_own_income_sources" ON income_sources FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_income_sources" ON income_sources;
CREATE POLICY "update_own_income_sources" ON income_sources FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_income_sources" ON income_sources;
CREATE POLICY "delete_own_income_sources" ON income_sources FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Expense Sectors (Centros de Custo)
CREATE TABLE IF NOT EXISTS expense_sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#10B981',
  icon text NOT NULL DEFAULT 'ShoppingBag',
  is_emergency_fund boolean DEFAULT false,
  is_investment boolean DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE expense_sectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_expense_sectors" ON expense_sectors;
CREATE POLICY "select_own_expense_sectors" ON expense_sectors FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_expense_sectors" ON expense_sectors;
CREATE POLICY "insert_own_expense_sectors" ON expense_sectors FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_expense_sectors" ON expense_sectors;
CREATE POLICY "update_own_expense_sectors" ON expense_sectors FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_expense_sectors" ON expense_sectors;
CREATE POLICY "delete_own_expense_sectors" ON expense_sectors FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Recurring Bills (Contas Recorrentes)
CREATE TABLE IF NOT EXISTS recurring_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  amount decimal(15,2) NOT NULL CHECK (amount > 0),
  due_day integer NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
  expense_sector_id uuid REFERENCES expense_sectors(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  last_paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE recurring_bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_recurring_bills" ON recurring_bills;
CREATE POLICY "select_own_recurring_bills" ON recurring_bills FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_recurring_bills" ON recurring_bills;
CREATE POLICY "insert_own_recurring_bills" ON recurring_bills FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_recurring_bills" ON recurring_bills;
CREATE POLICY "update_own_recurring_bills" ON recurring_bills FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_recurring_bills" ON recurring_bills;
CREATE POLICY "delete_own_recurring_bills" ON recurring_bills FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Financial Goals (Metas Financeiras)
CREATE TABLE IF NOT EXISTS financial_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  target_amount decimal(15,2) NOT NULL CHECK (target_amount > 0),
  target_date date,
  color text NOT NULL DEFAULT '#F59E0B',
  icon text NOT NULL DEFAULT 'Target',
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE financial_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_financial_goals" ON financial_goals;
CREATE POLICY "select_own_financial_goals" ON financial_goals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_financial_goals" ON financial_goals;
CREATE POLICY "insert_own_financial_goals" ON financial_goals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_financial_goals" ON financial_goals;
CREATE POLICY "update_own_financial_goals" ON financial_goals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_financial_goals" ON financial_goals;
CREATE POLICY "delete_own_financial_goals" ON financial_goals FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Attachments (Comprovantes)
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id uuid,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer,
  mime_type text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_attachments" ON attachments;
CREATE POLICY "select_own_attachments" ON attachments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_attachments" ON attachments;
CREATE POLICY "insert_own_attachments" ON attachments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_attachments" ON attachments;
CREATE POLICY "delete_own_attachments" ON attachments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Transactions (create last to reference all other tables)
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  amount decimal(15,2) NOT NULL CHECK (amount > 0),
  description text NOT NULL,
  notes text,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  income_source_id uuid REFERENCES income_sources(id) ON DELETE SET NULL,
  expense_sector_id uuid REFERENCES expense_sectors(id) ON DELETE SET NULL,
  transfer_to_income_source_id uuid REFERENCES income_sources(id) ON DELETE SET NULL,
  transfer_to_expense_sector_id uuid REFERENCES expense_sectors(id) ON DELETE SET NULL,
  recurring_bill_id uuid REFERENCES recurring_bills(id) ON DELETE SET NULL,
  goal_contribution_id uuid REFERENCES financial_goals(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_transactions" ON transactions;
CREATE POLICY "select_own_transactions" ON transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_transactions" ON transactions;
CREATE POLICY "insert_own_transactions" ON transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_transactions" ON transactions;
CREATE POLICY "update_own_transactions" ON transactions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_transactions" ON transactions;
CREATE POLICY "delete_own_transactions" ON transactions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Add transaction_id foreign key to attachments now that transactions exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attachments') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'attachments_transaction_id_fkey' AND table_name = 'attachments'
    ) THEN
      ALTER TABLE attachments ADD CONSTRAINT attachments_transaction_id_fkey 
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_income_source ON transactions(income_source_id);
CREATE INDEX IF NOT EXISTS idx_transactions_expense_sector ON transactions(expense_sector_id);
CREATE INDEX IF NOT EXISTS idx_income_sources_user_id ON income_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_expense_sectors_user_id ON expense_sectors(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_bills_user_id ON recurring_bills(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_goals_user_id ON financial_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_attachments_user_id ON attachments(user_id);

-- Storage bucket for attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for attachments bucket
DROP POLICY IF EXISTS "attachments_select_own" ON storage.objects;
CREATE POLICY "attachments_select_own" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "attachments_insert_own" ON storage.objects;
CREATE POLICY "attachments_insert_own" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "attachments_delete_own" ON storage.objects;
CREATE POLICY "attachments_delete_own" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_income_sources_updated_at ON income_sources;
CREATE TRIGGER update_income_sources_updated_at BEFORE UPDATE ON income_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expense_sectors_updated_at ON expense_sectors;
CREATE TRIGGER update_expense_sectors_updated_at BEFORE UPDATE ON expense_sectors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_recurring_bills_updated_at ON recurring_bills;
CREATE TRIGGER update_recurring_bills_updated_at BEFORE UPDATE ON recurring_bills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_financial_goals_updated_at ON financial_goals;
CREATE TRIGGER update_financial_goals_updated_at BEFORE UPDATE ON financial_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

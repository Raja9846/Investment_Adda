-- Supabase Backend Schema for Investment Adda

-- 1. App State (Singleton table for Dashboard Totals)
CREATE TABLE IF NOT EXISTS public.app_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total_investment numeric DEFAULT 0,
  total_interest numeric DEFAULT 0,
  total_balance numeric DEFAULT 0,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Ensure THE initial row exists
INSERT INTO public.app_state (total_investment, total_interest, total_balance) 
SELECT 0, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM public.app_state LIMIT 1);

-- Enable Realtime for app_state (Wrap in a block to handle if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'app_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_state;
  END IF;
END $$;


-- 2. Transactions History
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  initials text NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL CHECK (status IN ('Completed', 'Pending')),
  txn_type text CHECK (txn_type IN ('Investment', 'Interest', 'Settlement')),
  investor_id uuid, -- Link to investor for syncing edits
  month_num integer, -- Link to month for interest syncing
  bg_color text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Ensure sync columns exist
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS investor_id uuid;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS month_num integer;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS txn_type text CHECK (txn_type IN ('Investment', 'Interest', 'Settlement'));

-- Enable Realtime for transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  END IF;
END $$;


CREATE OR REPLACE FUNCTION public.sync_investor_to_transactions()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.category = 'investment' THEN
    INSERT INTO public.transactions (name, initials, amount, status, txn_type, investor_id, bg_color)
    VALUES (NEW.name || ' (Investment)', UPPER(LEFT(NEW.name, 1)), NEW.amount, 'Completed', 'Investment', NEW.id, '#5c7cfa')
    ON CONFLICT (investor_id) WHERE (month_num IS NULL)
    DO UPDATE SET amount = EXCLUDED.amount, name = EXCLUDED.name, txn_type = EXCLUDED.txn_type, bg_color = EXCLUDED.bg_color;
  ELSE
    -- For 'investor' category, we treat the principal as a 'Settlement' (Deduction from balance)
    INSERT INTO public.transactions (name, initials, amount, status, txn_type, investor_id, bg_color)
    VALUES (NEW.name || ' (Principal)', UPPER(LEFT(NEW.name, 1)), NEW.amount, 'Completed', 'Settlement', NEW.id, '#f06595')
    ON CONFLICT (investor_id) WHERE (month_num IS NULL)
    DO UPDATE SET amount = EXCLUDED.amount, name = EXCLUDED.name, txn_type = EXCLUDED.txn_type, bg_color = EXCLUDED.bg_color;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the index is robust for both categories
DROP INDEX IF EXISTS idx_txn_sync_investor;
CREATE UNIQUE INDEX idx_txn_sync_investor ON public.transactions (investor_id) WHERE (month_num IS NULL);

-- Ensure the index is robust for both categories
DROP INDEX IF EXISTS idx_txn_sync_investor;
CREATE UNIQUE INDEX idx_txn_sync_investor ON public.transactions (investor_id) WHERE (month_num IS NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_txn_sync_interest ON public.transactions (investor_id, month_num) WHERE (txn_type = 'Interest');

-- Trigger for sync
CREATE OR REPLACE TRIGGER tr_sync_investor_txn
AFTER INSERT OR UPDATE OF amount, name ON public.investors
FOR EACH ROW EXECUTE FUNCTION public.sync_investor_to_transactions();


-- 3. Investors (Members)
CREATE TABLE IF NOT EXISTS public.investors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text DEFAULT 'investor' CHECK (category IN ('investor', 'investment')),
  amount numeric DEFAULT 0,
  phone text,
  aadhaar text,
  interest_percent numeric DEFAULT 0,
  months integer DEFAULT 0,
  investment numeric DEFAULT 0,
  interest numeric DEFAULT 0,
  total_balance numeric DEFAULT 0,
  is_done boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Ensure columns exist if table was already created
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS category text DEFAULT 'investor';
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS investment numeric DEFAULT 0;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS interest numeric DEFAULT 0;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS total_balance numeric DEFAULT 0;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS months integer DEFAULT 0;
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS interest_percent numeric DEFAULT 0;

-- 4. Interest Payments (To track monthly interest ticks persistently)
CREATE TABLE IF NOT EXISTS public.interest_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id uuid REFERENCES public.investors(id),
  month_number integer NOT NULL,
  amount numeric NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  UNIQUE(investor_id, month_number)
);

-- Enable Realtime for interest_payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'interest_payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.interest_payments;
  END IF;
END $$;

-- NEW: Sync function for interest payments
CREATE OR REPLACE FUNCTION public.sync_interest_to_transactions()
RETURNS TRIGGER AS $$
DECLARE
  v_inv_name text;
BEGIN
  SELECT name INTO v_inv_name FROM public.investors WHERE id = NEW.investor_id;
  
  INSERT INTO public.transactions (name, initials, amount, status, txn_type, investor_id, month_num, bg_color)
  VALUES (v_inv_name || ' (Month ' || NEW.month_number || ')', UPPER(LEFT(v_inv_name, 1)), NEW.amount, 'Completed', 'Interest', NEW.investor_id, NEW.month_number, '#20c997')
  ON CONFLICT (investor_id, month_num) WHERE (txn_type = 'Interest')
  DO UPDATE SET amount = EXCLUDED.amount;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tr_sync_interest_txn
AFTER INSERT OR UPDATE OF amount ON public.interest_payments
FOR EACH ROW EXECUTE FUNCTION public.sync_interest_to_transactions();

-- 5. Dashboard Totals Logic (Regular function that can be called manually)
CREATE OR REPLACE FUNCTION public.recalculate_dashboard()
RETURNS void AS $$
DECLARE
  v_total_inv numeric;
  v_total_int numeric;
  v_total_set numeric;
BEGIN
  -- Sum of all COMPLETED investment transactions
  SELECT COALESCE(SUM(amount), 0) INTO v_total_inv 
  FROM public.transactions 
  WHERE txn_type = 'Investment' AND status = 'Completed';
  
  -- Sum of all COMPLETED interest transactions
  SELECT COALESCE(SUM(amount), 0) INTO v_total_int 
  FROM public.transactions 
  WHERE txn_type = 'Interest' AND status = 'Completed';

  -- Sum of all COMPLETED settlement transactions
  SELECT COALESCE(SUM(amount), 0) INTO v_total_set 
  FROM public.transactions 
  WHERE txn_type = 'Settlement' AND status = 'Completed';
  
  -- Update the singleton app_state row
  UPDATE public.app_state 
  SET 
    total_investment = v_total_inv,
    total_interest = v_total_int,
    total_balance = v_total_inv + v_total_int - v_total_set,
    updated_at = now()
  WHERE id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger wrapper function
CREATE OR REPLACE FUNCTION public.update_app_state_totals()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.recalculate_dashboard();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Remove old triggers if they exist
DROP TRIGGER IF EXISTS tr_update_totals_investors ON public.investors;
DROP TRIGGER IF EXISTS tr_update_totals_interest ON public.interest_payments;

-- New Trigger for transactions table (Updates dashboard whenever a txn is added or status changes)
CREATE OR REPLACE TRIGGER tr_update_totals_from_transactions
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH STATEMENT EXECUTE FUNCTION public.update_app_state_totals();


-- Enable Row Level Security (RLS)
ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interest_payments ENABLE ROW LEVEL SECURITY;

-- 9. Setup Policies (SAFE: Drop if exists then create)
DROP POLICY IF EXISTS "Allow public read/write to app_state" ON public.app_state;
DROP POLICY IF EXISTS "Allow public read/write to transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow public read/write to investors" ON public.investors;
DROP POLICY IF EXISTS "Allow public read/write to interest_payments" ON public.interest_payments;

CREATE POLICY "Allow public read/write to app_state" ON public.app_state FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write to transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write to investors" ON public.investors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write to interest_payments" ON public.interest_payments FOR ALL USING (true) WITH CHECK (true);

-- 10. CLEANUP & BACKFILL: Mark existing Pending transactions as Completed
-- This ensures that older data is immediately reflected on the Dashboard
UPDATE public.transactions 
SET status = 'Completed' 
WHERE status = 'Pending' AND txn_type IS NOT NULL;

-- 11. FORCE DASHBOARD RECALCULATION NOW
DO $$
BEGIN
  PERFORM public.recalculate_dashboard();
END $$;

-- 11. FORCE CACHE RELOAD
NOTIFY pgrst, 'reload schema';

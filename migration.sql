-- Migration SQL for User Isolation and User Profiles

-- 1. Create User Profiles table (as requested, but passwords should be handled by Supabase Auth)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text UNIQUE NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 2. Add user_id column to existing tables
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id);
ALTER TABLE public.interest_payments ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id);
ALTER TABLE public.app_state ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id);

ALTER TABLE public.app_state DROP CONSTRAINT IF EXISTS app_state_user_id_key;
ALTER TABLE public.app_state ADD CONSTRAINT app_state_user_id_key UNIQUE (user_id);

-- 2. Update Check Constraint for Transactions
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_txn_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_txn_type_check CHECK (txn_type IN ('Investment', 'Interest', 'Settlement', 'Repayment'));

-- 3. Update Existing Data (Associate with "raja" user if they are identified)
-- Note: Replace 'RAJA_USER_ID' with the actual UUID of the raja user after they sign up.
-- UPDATE public.investors SET user_id = 'RAJA_USER_ID' WHERE user_id IS NULL;
-- UPDATE public.transactions SET user_id = 'RAJA_USER_ID' WHERE user_id IS NULL;
-- UPDATE public.interest_payments SET user_id = 'RAJA_USER_ID' WHERE user_id IS NULL;
-- UPDATE public.app_state SET user_id = 'RAJA_USER_ID' WHERE user_id IS NULL;

-- 4. Enable Row Level Security (RLS) and update policies
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interest_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;

-- Drop old public policies
DROP POLICY IF EXISTS "Allow public read/write to app_state" ON public.app_state;
DROP POLICY IF EXISTS "Allow public read/write to transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow public read/write to investors" ON public.investors;
DROP POLICY IF EXISTS "Allow public read/write to interest_payments" ON public.interest_payments;

-- Create new user-specific policies
DROP POLICY IF EXISTS "Users can only access their own profiles" ON public.user_profiles;
CREATE POLICY "Users can only access their own profiles" ON public.user_profiles
    FOR ALL USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can only access their own investors" ON public.investors;
CREATE POLICY "Users can only access their own investors" ON public.investors
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only access their own transactions" ON public.transactions;
CREATE POLICY "Users can only access their own transactions" ON public.transactions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only access their own interest_payments" ON public.interest_payments;
CREATE POLICY "Users can only access their own interest_payments" ON public.interest_payments
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only access their own app_state" ON public.app_state;
CREATE POLICY "Users can only access their own app_state" ON public.app_state
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Trigger to create app_state and profile for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create user profile
    INSERT INTO public.user_profiles (id, email)
    VALUES (NEW.id, NEW.email);

    -- Initialize app_state for the new user
    INSERT INTO public.app_state (user_id, total_investment, total_interest, total_balance)
    VALUES (NEW.id, 0, 0, 0);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Update recalculate_dashboard to be user-aware
CREATE OR REPLACE FUNCTION public.recalculate_dashboard_for_user(target_user_id uuid)
RETURNS void AS $$
DECLARE
  v_total_inv numeric;
  v_total_int numeric;
  v_total_set numeric;
  v_total_rep numeric;
BEGIN
  -- Ensure the user has an app_state row to update
  INSERT INTO public.app_state (user_id, total_investment, total_interest, total_balance)
  VALUES (target_user_id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Sum of all COMPLETED investment transactions for this user
  SELECT COALESCE(SUM(amount), 0) INTO v_total_inv 
  FROM public.transactions 
  WHERE user_id = target_user_id AND txn_type = 'Investment' AND status = 'Completed';
  
  -- Sum of all COMPLETED interest transactions for this user
  SELECT COALESCE(SUM(amount), 0) INTO v_total_int 
  FROM public.transactions 
  WHERE user_id = target_user_id AND txn_type = 'Interest' AND status = 'Completed';

  -- Sum of all COMPLETED settlement transactions for this user
  SELECT COALESCE(SUM(amount), 0) INTO v_total_set 
  FROM public.transactions 
  WHERE user_id = target_user_id AND txn_type = 'Settlement' AND status = 'Completed';

  -- Sum of all COMPLETED repayment transactions for this user
  SELECT COALESCE(SUM(amount), 0) INTO v_total_rep 
  FROM public.transactions 
  WHERE user_id = target_user_id AND txn_type = 'Repayment' AND status = 'Completed';
  
  -- Update the user's app_state row
  UPDATE public.app_state 
  SET 
    total_investment = v_total_inv,
    total_interest = v_total_int,
    total_balance = v_total_inv + v_total_int + v_total_rep - v_total_set,
    updated_at = now()
  WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql;

-- 7. Update triggers to use the user-aware recalculation
CREATE OR REPLACE FUNCTION public.update_app_state_totals_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- NEW or OLD will have the user_id
  IF (TG_OP = 'DELETE') THEN
    PERFORM public.recalculate_dashboard_for_user(OLD.user_id);
  ELSE
    PERFORM public.recalculate_dashboard_for_user(NEW.user_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 8. Replace old sync triggers with user-aware versions
CREATE OR REPLACE FUNCTION public.sync_investor_to_transactions_user_aware()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.category = 'investment' THEN
    INSERT INTO public.transactions (name, initials, amount, status, txn_type, investor_id, bg_color, user_id)
    VALUES (NEW.name || ' (Investment)', UPPER(LEFT(NEW.name, 1)), NEW.amount, 'Completed', 'Investment', NEW.id, '#5c7cfa', NEW.user_id)
    ON CONFLICT (investor_id) WHERE (month_num IS NULL)
    DO UPDATE SET amount = EXCLUDED.amount, name = EXCLUDED.name, txn_type = EXCLUDED.txn_type, bg_color = EXCLUDED.bg_color, user_id = EXCLUDED.user_id;
  ELSE
    -- For 'investor' category, we treat the principal as a 'Settlement' (Deduction from balance)
    INSERT INTO public.transactions (name, initials, amount, status, txn_type, investor_id, bg_color, user_id)
    VALUES (NEW.name || ' (Principal)', UPPER(LEFT(NEW.name, 1)), NEW.amount, 'Completed', 'Settlement', NEW.id, '#f06595', NEW.user_id)
    ON CONFLICT (investor_id) WHERE (month_num IS NULL)
    DO UPDATE SET amount = EXCLUDED.amount, name = EXCLUDED.name, txn_type = EXCLUDED.txn_type, bg_color = EXCLUDED.bg_color, user_id = EXCLUDED.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_investor_txn ON public.investors;
CREATE TRIGGER tr_sync_investor_txn
AFTER INSERT OR UPDATE OF amount, name ON public.investors
FOR EACH ROW EXECUTE FUNCTION public.sync_investor_to_transactions_user_aware();

CREATE OR REPLACE FUNCTION public.sync_interest_to_transactions_user_aware()
RETURNS TRIGGER AS $$
DECLARE
  v_inv_name text;
BEGIN
  SELECT name INTO v_inv_name FROM public.investors WHERE id = NEW.investor_id;
  
  INSERT INTO public.transactions (name, initials, amount, status, txn_type, investor_id, month_num, bg_color, user_id)
  VALUES (v_inv_name || ' (Month ' || NEW.month_number || ')', UPPER(LEFT(v_inv_name, 1)), NEW.amount, 'Completed', 'Interest', NEW.investor_id, NEW.month_number, '#20c997', NEW.user_id)
  ON CONFLICT (investor_id, month_num) WHERE (txn_type = 'Interest')
  DO UPDATE SET amount = EXCLUDED.amount, user_id = EXCLUDED.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_interest_txn ON public.interest_payments;
CREATE TRIGGER tr_sync_interest_txn
AFTER INSERT OR UPDATE OF amount ON public.interest_payments
FOR EACH ROW EXECUTE FUNCTION public.sync_interest_to_transactions_user_aware();

-- 9. Restore dashboard update trigger
DROP TRIGGER IF EXISTS tr_update_totals_from_transactions ON public.transactions;
CREATE TRIGGER tr_update_totals_from_transactions
    AFTER INSERT OR UPDATE OR DELETE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.update_app_state_totals_trigger();

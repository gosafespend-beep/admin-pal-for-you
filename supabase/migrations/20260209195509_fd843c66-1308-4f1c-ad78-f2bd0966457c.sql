
-- Admin stats aggregation functions using service role (no RLS bypass needed since edge function uses service role)

-- Function to get monthly transaction aggregates for the last 12 months
CREATE OR REPLACE FUNCTION public.admin_monthly_transaction_stats()
RETURNS TABLE(
  month_key text,
  month_label text,
  expense_total numeric,
  income_total numeric,
  expense_count bigint,
  income_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', now()) - interval '11 months',
      date_trunc('month', now()),
      interval '1 month'
    )::date AS month_start
  )
  SELECT
    to_char(m.month_start, 'YYYY-MM') AS month_key,
    to_char(m.month_start, 'Mon ''YY') AS month_label,
    COALESCE(SUM(e.amount), 0) AS expense_total,
    COALESCE(SUM(i.amount), 0) AS income_total,
    COUNT(DISTINCT e.id) AS expense_count,
    COUNT(DISTINCT i.id) AS income_count
  FROM months m
  LEFT JOIN expenses e ON to_char(e.date::date, 'YYYY-MM') = to_char(m.month_start, 'YYYY-MM')
  LEFT JOIN incomes i ON to_char(i.date::date, 'YYYY-MM') = to_char(m.month_start, 'YYYY-MM')
  GROUP BY m.month_start
  ORDER BY m.month_start;
$$;

-- Function to get top expense categories by amount
CREATE OR REPLACE FUNCTION public.admin_top_categories(p_limit int DEFAULT 10)
RETURNS TABLE(category text, total_amount numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT category, SUM(amount) AS total_amount
  FROM expenses
  WHERE category IS NOT NULL
  GROUP BY category
  ORDER BY total_amount DESC
  LIMIT p_limit;
$$;

-- Function to get aggregated overview stats using COUNT/SUM
CREATE OR REPLACE FUNCTION public.admin_overview_stats()
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
  v_expense_count bigint;
  v_expense_sum numeric;
  v_income_count bigint;
  v_income_sum numeric;
  v_transfer_count bigint;
  v_account_count bigint;
  v_bill_count bigint;
  v_active_bill_count bigint;
  v_debt_count bigint;
  v_active_debt_count bigint;
  v_debt_balance numeric;
  v_goal_count bigint;
  v_completed_goals bigint;
  v_savings_progress numeric;
  v_savings_target numeric;
  v_category_count bigint;
  v_profile_count bigint;
  v_waitlist_count bigint;
  v_budget_count bigint;
  v_recurring_count bigint;
  v_active_recurring bigint;
  v_recurring_monthly numeric;
  v_subscription_count bigint;
  v_active_trials bigint;
  v_active_subscriptions bigint;
  v_asset_total numeric;
  v_liability_total numeric;
  v_debt_payment_count bigint;
  v_debt_payment_total numeric;
  v_goal_contribution_count bigint;
  v_goal_contribution_total numeric;
  -- Trend calculations
  v_current_month_expenses numeric;
  v_prev_month_expenses numeric;
  v_current_month_incomes numeric;
  v_prev_month_incomes numeric;
BEGIN
  -- Core counts using COUNT/SUM (no row loading)
  SELECT COUNT(*), COALESCE(SUM(amount), 0) INTO v_expense_count, v_expense_sum FROM expenses;
  SELECT COUNT(*), COALESCE(SUM(amount), 0) INTO v_income_count, v_income_sum FROM incomes;
  SELECT COUNT(*) INTO v_transfer_count FROM transfers;
  SELECT COUNT(*) INTO v_account_count FROM accounts;
  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_active) INTO v_bill_count, v_active_bill_count FROM bills;
  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_active), COALESCE(SUM(current_balance) FILTER (WHERE is_active), 0) INTO v_debt_count, v_active_debt_count, v_debt_balance FROM debts;
  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_completed), COALESCE(SUM(current_amount), 0), COALESCE(SUM(target_amount), 0) INTO v_goal_count, v_completed_goals, v_savings_progress, v_savings_target FROM savings_goals;
  SELECT COUNT(*) INTO v_category_count FROM categories;
  SELECT COUNT(*) INTO v_profile_count FROM profiles;
  SELECT COUNT(*) INTO v_waitlist_count FROM waitlist;
  
  -- Additional metrics
  SELECT COUNT(*) INTO v_budget_count FROM budgets;
  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_active), COALESCE(SUM(amount) FILTER (WHERE is_active AND frequency = 'monthly'), 0) INTO v_recurring_count, v_active_recurring, v_recurring_monthly FROM recurring_transactions;
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'trialing'), COUNT(*) FILTER (WHERE status = 'active') INTO v_subscription_count, v_active_trials, v_active_subscriptions FROM subscriptions;
  SELECT COALESCE(SUM(value), 0) INTO v_asset_total FROM assets;
  SELECT COALESCE(SUM(value), 0) INTO v_liability_total FROM liabilities;
  SELECT COUNT(*), COALESCE(SUM(amount), 0) INTO v_debt_payment_count, v_debt_payment_total FROM debt_payments;
  SELECT COUNT(*), COALESCE(SUM(amount), 0) INTO v_goal_contribution_count, v_goal_contribution_total FROM goal_contributions;
  
  -- Trend: current vs previous month
  SELECT COALESCE(SUM(amount), 0) INTO v_current_month_expenses FROM expenses WHERE date >= date_trunc('month', now())::date;
  SELECT COALESCE(SUM(amount), 0) INTO v_prev_month_expenses FROM expenses WHERE date >= (date_trunc('month', now()) - interval '1 month')::date AND date < date_trunc('month', now())::date;
  SELECT COALESCE(SUM(amount), 0) INTO v_current_month_incomes FROM incomes WHERE date >= date_trunc('month', now())::date;
  SELECT COALESCE(SUM(amount), 0) INTO v_prev_month_incomes FROM incomes WHERE date >= (date_trunc('month', now()) - interval '1 month')::date AND date < date_trunc('month', now())::date;

  result := json_build_object(
    'totalExpenses', v_expense_count,
    'totalExpenseAmount', v_expense_sum,
    'totalIncomes', v_income_count,
    'totalIncomeAmount', v_income_sum,
    'totalTransfers', v_transfer_count,
    'totalAccounts', v_account_count,
    'totalBills', v_bill_count,
    'activeBills', v_active_bill_count,
    'totalDebts', v_debt_count,
    'activeDebts', v_active_debt_count,
    'totalDebtBalance', v_debt_balance,
    'totalSavingsGoals', v_goal_count,
    'completedGoals', v_completed_goals,
    'totalSavingsProgress', v_savings_progress,
    'totalSavingsTarget', v_savings_target,
    'totalCategories', v_category_count,
    'totalProfiles', v_profile_count,
    'waitlistCount', v_waitlist_count,
    'totalBudgets', v_budget_count,
    'totalRecurring', v_recurring_count,
    'activeRecurring', v_active_recurring,
    'recurringMonthlyAmount', v_recurring_monthly,
    'totalSubscriptions', v_subscription_count,
    'activeTrials', v_active_trials,
    'activeSubscriptions', v_active_subscriptions,
    'totalAssets', v_asset_total,
    'totalLiabilities', v_liability_total,
    'netWorth', v_asset_total - v_liability_total,
    'totalDebtPayments', v_debt_payment_count,
    'totalDebtPaymentAmount', v_debt_payment_total,
    'totalGoalContributions', v_goal_contribution_count,
    'totalGoalContributionAmount', v_goal_contribution_total,
    'currentMonthExpenses', v_current_month_expenses,
    'prevMonthExpenses', v_prev_month_expenses,
    'currentMonthIncomes', v_current_month_incomes,
    'prevMonthIncomes', v_prev_month_incomes
  );
  
  RETURN result;
END;
$$;

-- Function to get recent transactions across all users (for activity feed)
CREATE OR REPLACE FUNCTION public.admin_recent_activity(p_limit int DEFAULT 15)
RETURNS TABLE(
  id text,
  type text,
  amount numeric,
  description text,
  date text,
  user_id uuid,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  (SELECT id::text, 'expense'::text, amount, category AS description, date::text, user_id, created_at FROM expenses ORDER BY created_at DESC LIMIT p_limit)
  UNION ALL
  (SELECT id::text, 'income'::text, amount, source AS description, date::text, user_id, created_at FROM incomes ORDER BY created_at DESC LIMIT p_limit)
  UNION ALL
  (SELECT id::text, 'transfer'::text, amount, COALESCE(note, 'Transfer') AS description, date::text, user_id, created_at FROM transfers ORDER BY created_at DESC LIMIT p_limit)
  ORDER BY created_at DESC
  LIMIT p_limit;
$$;

-- Function for account type distribution
CREATE OR REPLACE FUNCTION public.admin_account_types()
RETURNS TABLE(account_type text, count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT type AS account_type, COUNT(*) AS count
  FROM accounts
  GROUP BY type
  ORDER BY count DESC;
$$;

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: isAdmin, error: adminError } = await userClient.rpc('is_admin')
    
    if (adminError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Access denied. Admin privileges required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch comprehensive stats
    const [
      usersResult,
      profilesResult,
      expensesResult,
      incomesResult,
      transfersResult,
      accountsResult,
      billsResult,
      debtsResult,
      goalsResult,
      categoriesResult,
      waitlistResult,
    ] = await Promise.all([
      adminClient.auth.admin.listUsers(),
      adminClient.from('profiles').select('*'),
      adminClient.from('expenses').select('id, amount, date, category, user_id'),
      adminClient.from('incomes').select('id, amount, date, source, user_id'),
      adminClient.from('transfers').select('id, amount, date, user_id'),
      adminClient.from('accounts').select('id, type, initial_balance, user_id'),
      adminClient.from('bills').select('id, amount, is_active, user_id'),
      adminClient.from('debts').select('id, current_balance, is_active, user_id'),
      adminClient.from('savings_goals').select('id, target_amount, current_amount, is_completed, user_id'),
      adminClient.from('categories').select('id, name, user_id'),
      adminClient.rpc('get_waitlist_count'),
    ])

    const users = usersResult.data?.users || []
    const expenses = expensesResult.data || []
    const incomes = incomesResult.data || []
    const transfers = transfersResult.data || []
    const accounts = accountsResult.data || []
    const bills = billsResult.data || []
    const debts = debtsResult.data || []
    const goals = goalsResult.data || []
    const categories = categoriesResult.data || []

    // Calculate totals
    const totalExpenseAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
    const totalIncomeAmount = incomes.reduce((sum, i) => sum + Number(i.amount), 0)
    const totalDebtBalance = debts.filter(d => d.is_active).reduce((sum, d) => sum + Number(d.current_balance), 0)
    const totalSavingsProgress = goals.reduce((sum, g) => sum + Number(g.current_amount), 0)
    const totalSavingsTarget = goals.reduce((sum, g) => sum + Number(g.target_amount), 0)

    // Monthly transaction data for charts (last 12 months)
    const now = new Date()
    const monthlyData = []
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthStr = date.toISOString().slice(0, 7) // YYYY-MM format
      
      const monthExpenses = expenses.filter(e => e.date?.startsWith(monthStr))
      const monthIncomes = incomes.filter(i => i.date?.startsWith(monthStr))
      
      monthlyData.push({
        month: monthStr,
        label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        expenses: monthExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
        income: monthIncomes.reduce((sum, i) => sum + Number(i.amount), 0),
        expenseCount: monthExpenses.length,
        incomeCount: monthIncomes.length,
      })
    }

    // User signups over time (last 12 months)
    const userSignups = []
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      
      const count = users.filter(u => {
        const createdAt = new Date(u.created_at)
        return createdAt >= date && createdAt < nextMonth
      }).length

      userSignups.push({
        month: date.toISOString().slice(0, 7),
        label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        count,
      })
    }

    // Category distribution (top 10)
    const categorySpending: Record<string, number> = {}
    expenses.forEach(e => {
      if (e.category) {
        categorySpending[e.category] = (categorySpending[e.category] || 0) + Number(e.amount)
      }
    })
    const topCategories = Object.entries(categorySpending)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([category, amount]) => ({ category, amount }))

    // Account type distribution
    const accountTypes: Record<string, number> = {}
    accounts.forEach(a => {
      accountTypes[a.type] = (accountTypes[a.type] || 0) + 1
    })

    // Users with most transactions
    const userTransactionCounts: Record<string, { expenses: number; incomes: number }> = {}
    expenses.forEach(e => {
      if (!userTransactionCounts[e.user_id]) {
        userTransactionCounts[e.user_id] = { expenses: 0, incomes: 0 }
      }
      userTransactionCounts[e.user_id].expenses++
    })
    incomes.forEach(i => {
      if (!userTransactionCounts[i.user_id]) {
        userTransactionCounts[i.user_id] = { expenses: 0, incomes: 0 }
      }
      userTransactionCounts[i.user_id].incomes++
    })

    const stats = {
      overview: {
        totalUsers: users.length,
        activeProfiles: profilesResult.data?.length || 0,
        totalTransactions: expenses.length + incomes.length + transfers.length,
        totalExpenses: expenses.length,
        totalIncomes: incomes.length,
        totalTransfers: transfers.length,
        totalExpenseAmount,
        totalIncomeAmount,
        platformVolume: totalExpenseAmount + totalIncomeAmount,
        waitlistCount: waitlistResult.data || 0,
      },
      features: {
        totalAccounts: accounts.length,
        totalBills: bills.length,
        activeBills: bills.filter(b => b.is_active).length,
        totalDebts: debts.length,
        activeDebts: debts.filter(d => d.is_active).length,
        totalDebtBalance,
        totalSavingsGoals: goals.length,
        completedGoals: goals.filter(g => g.is_completed).length,
        totalSavingsProgress,
        totalSavingsTarget,
        totalCategories: categories.length,
      },
      charts: {
        monthlyData,
        userSignups,
        topCategories,
        accountTypes: Object.entries(accountTypes).map(([type, count]) => ({ type, count })),
      },
      userActivity: userTransactionCounts,
    }

    return new Response(
      JSON.stringify(stats),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Error in admin-stats function:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

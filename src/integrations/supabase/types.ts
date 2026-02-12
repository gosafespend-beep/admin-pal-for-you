export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_code: number | null
          color: string
          created_at: string
          id: string
          initial_balance: number
          is_active: boolean
          name: string
          reference_number: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_code?: number | null
          color?: string
          created_at?: string
          id?: string
          initial_balance?: number
          is_active?: boolean
          name: string
          reference_number?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_code?: number | null
          color?: string
          created_at?: string
          id?: string
          initial_balance?: number
          is_active?: boolean
          name?: string
          reference_number?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      admin_user_notes: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          note: string
          tag: string | null
          user_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          note: string
          tag?: string | null
          user_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          note?: string
          tag?: string | null
          user_id?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
          value?: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      bill_statuses: {
        Row: {
          bill_id: string
          created_at: string
          expense_id: string | null
          id: string
          is_paid: boolean
          month: number
          paid_amount: number | null
          paid_date: string | null
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          bill_id: string
          created_at?: string
          expense_id?: string | null
          id?: string
          is_paid?: boolean
          month: number
          paid_amount?: number | null
          paid_date?: string | null
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          bill_id?: string
          created_at?: string
          expense_id?: string | null
          id?: string
          is_paid?: boolean
          month?: number
          paid_amount?: number | null
          paid_date?: string | null
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "bill_statuses_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_statuses_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          due_day: number
          frequency: string
          id: string
          is_active: boolean
          is_need: boolean
          monthly_due_dates: Json
          name: string
          reference_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          due_day: number
          frequency?: string
          id?: string
          is_active?: boolean
          is_need?: boolean
          monthly_due_dates?: Json
          name: string
          reference_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          due_day?: number
          frequency?: string
          id?: string
          is_active?: boolean
          is_need?: boolean
          monthly_due_dates?: Json
          name?: string
          reference_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_name: string
          category: string | null
          content: string | null
          created_at: string
          excerpt: string | null
          featured_image: string | null
          id: string
          is_published: boolean
          meta_description: string | null
          meta_title: string | null
          published_at: string | null
          reading_time_minutes: number
          slug: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string
          category?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          is_published?: boolean
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          reading_time_minutes?: number
          slug: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string
          category?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          is_published?: boolean
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          reading_time_minutes?: number
          slug?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      budget_rollovers: {
        Row: {
          category: string
          created_at: string
          id: string
          month: number
          rollover_amount: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          month: number
          rollover_amount?: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          month?: number
          rollover_amount?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      budgets: {
        Row: {
          category_id: string
          created_at: string
          id: string
          monthly_limit: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          monthly_limit?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          monthly_limit?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          is_need: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_need?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_need?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      debt_payments: {
        Row: {
          amount: number
          created_at: string
          date: string
          debt_id: string
          expense_id: string | null
          id: string
          note: string | null
          reference_number: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          date: string
          debt_id: string
          expense_id?: string | null
          id?: string
          note?: string | null
          reference_number?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          debt_id?: string
          expense_id?: string | null
          id?: string
          note?: string | null
          reference_number?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_payments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          color: string
          created_at: string
          current_balance: number
          due_day: number | null
          id: string
          interest_rate: number
          is_active: boolean
          linked_credit_account_id: string | null
          minimum_payment: number
          name: string
          reference_number: string | null
          starting_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          current_balance: number
          due_day?: number | null
          id?: string
          interest_rate?: number
          is_active?: boolean
          linked_credit_account_id?: string | null
          minimum_payment?: number
          name: string
          reference_number?: string | null
          starting_balance: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          current_balance?: number
          due_day?: number | null
          id?: string
          interest_rate?: number
          is_active?: boolean
          linked_credit_account_id?: string | null
          minimum_payment?: number
          name?: string
          reference_number?: string | null
          starting_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debts_linked_credit_account_id_fkey"
            columns: ["linked_credit_account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          account_id: string | null
          amount: number
          category: string
          created_at: string
          date: string
          id: string
          is_recurring: boolean
          note: string | null
          reference_number: string | null
          source_id: string | null
          source_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category: string
          created_at?: string
          date: string
          id?: string
          is_recurring?: boolean
          note?: string | null
          reference_number?: string | null
          source_id?: string | null
          source_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string
          created_at?: string
          date?: string
          id?: string
          is_recurring?: boolean
          note?: string | null
          reference_number?: string | null
          source_id?: string | null
          source_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_contributions: {
        Row: {
          amount: number
          created_at: string
          date: string
          goal_id: string
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          date: string
          goal_id: string
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          goal_id?: string
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_contributions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      income_categories: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          is_passive: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_passive?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_passive?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      incomes: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          created_at: string
          date: string
          id: string
          is_recurring: boolean
          note: string | null
          reference_number: string | null
          source: string
          source_id: string | null
          source_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category?: string | null
          created_at?: string
          date: string
          id?: string
          is_recurring?: boolean
          note?: string | null
          reference_number?: string | null
          source: string
          source_id?: string | null
          source_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          created_at?: string
          date?: string
          id?: string
          is_recurring?: boolean
          note?: string | null
          reference_number?: string | null
          source?: string
          source_id?: string | null
          source_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incomes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      liabilities: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
          value?: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      networth_goals: {
        Row: {
          created_at: string | null
          id: string
          target_amount: number
          target_date: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          target_amount: number
          target_date: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          target_amount?: number
          target_date?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      networth_snapshots: {
        Row: {
          created_at: string
          date: string
          id: string
          net_worth: number
          total_assets: number
          total_liabilities: number
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          net_worth?: number
          total_assets?: number
          total_liabilities?: number
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          net_worth?: number
          total_assets?: number
          total_liabilities?: number
          user_id?: string
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          id: string
          notification_type: string
          reference_id: string
          reference_period: string
          sent_at: string
          user_id: string
        }
        Insert: {
          id?: string
          notification_type: string
          reference_id: string
          reference_period: string
          sent_at?: string
          user_id: string
        }
        Update: {
          id?: string
          notification_type?: string
          reference_id?: string
          reference_period?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          bill_reminders: boolean
          budget_alerts: boolean
          created_at: string
          id: string
          marketing_emails: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          bill_reminders?: boolean
          budget_alerts?: boolean
          created_at?: string
          id?: string
          marketing_emails?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          bill_reminders?: boolean
          budget_alerts?: boolean
          created_at?: string
          id?: string
          marketing_emails?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_transactions: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          created_at: string
          description: string
          frequency: string
          id: string
          is_active: boolean
          last_processed: string | null
          next_due: string
          source_id: string | null
          source_type: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category?: string | null
          created_at?: string
          description: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_processed?: string | null
          next_due: string
          source_id?: string | null
          source_type?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_processed?: string | null
          next_due?: string
          source_id?: string | null
          source_type?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_goals: {
        Row: {
          color: string
          created_at: string
          current_amount: number
          deadline: string | null
          icon: string
          id: string
          initial_amount: number
          is_completed: boolean
          linked_account_id: string | null
          name: string
          reference_number: string | null
          start_date: string | null
          target_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          current_amount?: number
          deadline?: string | null
          icon?: string
          id?: string
          initial_amount?: number
          is_completed?: boolean
          linked_account_id?: string | null
          name: string
          reference_number?: string | null
          start_date?: string | null
          target_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          current_amount?: number
          deadline?: string | null
          icon?: string
          id?: string
          initial_amount?: number
          is_completed?: boolean
          linked_account_id?: string | null
          name?: string
          reference_number?: string | null
          start_date?: string | null
          target_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_goals_linked_account_id_fkey"
            columns: ["linked_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          paystack_customer_code: string | null
          paystack_email_token: string | null
          paystack_subscription_code: string | null
          plan_type: string | null
          status: string
          trial_end: string
          trial_start: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          paystack_customer_code?: string | null
          paystack_email_token?: string | null
          paystack_subscription_code?: string | null
          plan_type?: string | null
          status?: string
          trial_end?: string
          trial_start?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          paystack_customer_code?: string | null
          paystack_email_token?: string | null
          paystack_subscription_code?: string | null
          plan_type?: string | null
          status?: string
          trial_end?: string
          trial_start?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transfers: {
        Row: {
          amount: number
          created_at: string
          date: string
          from_account_id: string
          id: string
          note: string | null
          reference_number: string | null
          to_account_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          date: string
          from_account_id: string
          id?: string
          note?: string | null
          reference_number?: string | null
          to_account_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          from_account_id?: string
          id?: string
          note?: string | null
          reference_number?: string | null
          to_account_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          budget_start_month: number
          budget_start_year: number
          created_at: string
          currency: string
          date_format: string
          id: string
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          budget_start_month?: number
          budget_start_year?: number
          created_at?: string
          currency?: string
          date_format?: string
          id?: string
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          budget_start_month?: number
          budget_start_year?: number
          created_at?: string
          currency?: string
          date_format?: string
          id?: string
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_account_types: {
        Args: never
        Returns: {
          account_type: string
          count: number
        }[]
      }
      admin_monthly_transaction_stats: {
        Args: never
        Returns: {
          expense_count: number
          expense_total: number
          income_count: number
          income_total: number
          month_key: string
          month_label: string
        }[]
      }
      admin_overview_stats: { Args: never; Returns: Json }
      admin_recent_activity: {
        Args: { p_limit?: number }
        Returns: {
          amount: number
          created_at: string
          date: string
          description: string
          id: string
          type: string
          user_id: string
        }[]
      }
      admin_top_categories: {
        Args: { p_limit?: number }
        Returns: {
          category: string
          total_amount: number
        }[]
      }
      get_next_ref_number: {
        Args: { p_prefix: string; p_table_name: string; p_user_id: string }
        Returns: string
      }
      get_next_txn_ref_number: {
        Args: {
          p_date: string
          p_prefix: string
          p_table_name: string
          p_user_id: string
        }
        Returns: string
      }
      get_waitlist_count: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      list_user_sessions: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string
          ip: unknown
          session_id: string
          updated_at: string
          user_agent: string
        }[]
      }
      revoke_user_session: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const

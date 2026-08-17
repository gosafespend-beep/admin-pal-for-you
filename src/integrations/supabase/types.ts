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
          currency: string
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
          currency?: string
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
          currency?: string
          id?: string
          initial_balance?: number
          is_active?: boolean
          name?: string
          reference_number?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_account_data"
            referencedColumns: ["user_id"]
          },
        ]
      }
      activation_events: {
        Row: {
          created_at: string
          event: string
          id: number
          occurred_at: string
          props: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: never
          occurred_at?: string
          props?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: never
          occurred_at?: string
          props?: Json
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
      analytics_events: {
        Row: {
          created_at: string
          event: string
          id: number
          platform: string | null
          props: Json
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: never
          platform?: string | null
          props?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: never
          platform?: string | null
          props?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_account_data"
            referencedColumns: ["user_id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      assets: {
        Row: {
          category: string
          created_at: string
          currency: string
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
          currency?: string
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
          currency?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "assets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_account_data"
            referencedColumns: ["user_id"]
          },
        ]
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
          {
            foreignKeyName: "bill_statuses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_account_data"
            referencedColumns: ["user_id"]
          },
        ]
      }
      bills: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          currency: string
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
          currency?: string
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
          currency?: string
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
        Relationships: [
          {
            foreignKeyName: "bills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_account_data"
            referencedColumns: ["user_id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          article_schema_enabled: boolean | null
          author_name: string
          canonical_url: string | null
          category: string | null
          content: string | null
          created_at: string
          cta_button_text: string | null
          cta_description: string | null
          cta_headline: string | null
          cta_url: string | null
          excerpt: string | null
          faq_schema_enabled: boolean | null
          featured_image: string | null
          focus_keyword: string | null
          id: string
          is_featured: boolean | null
          is_published: boolean
          meta_description: string | null
          meta_title: string | null
          og_image: string | null
          published_at: string | null
          reading_time_minutes: number
          scheduled_publish_at: string | null
          secondary_keywords: string[] | null
          slug: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          article_schema_enabled?: boolean | null
          author_name?: string
          canonical_url?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          cta_button_text?: string | null
          cta_description?: string | null
          cta_headline?: string | null
          cta_url?: string | null
          excerpt?: string | null
          faq_schema_enabled?: boolean | null
          featured_image?: string | null
          focus_keyword?: string | null
          id?: string
          is_featured?: boolean | null
          is_published?: boolean
          meta_description?: string | null
          meta_title?: string | null
          og_image?: string | null
          published_at?: string | null
          reading_time_minutes?: number
          scheduled_publish_at?: string | null
          secondary_keywords?: string[] | null
          slug: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          article_schema_enabled?: boolean | null
          author_name?: string
          canonical_url?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          cta_button_text?: string | null
          cta_description?: string | null
          cta_headline?: string | null
          cta_url?: string | null
          excerpt?: string | null
          faq_schema_enabled?: boolean | null
          featured_image?: string | null
          focus_keyword?: string | null
          id?: string
          is_featured?: boolean | null
          is_published?: boolean
          meta_description?: string | null
          meta_title?: string | null
          og_image?: string | null
          published_at?: string | null
          reading_time_minutes?: number
          scheduled_publish_at?: string | null
          secondary_keywords?: string[] | null
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
        Relationships: [
          {
            foreignKeyName: "budget_rollovers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_account_data"
            referencedColumns: ["user_id"]
          },
        ]
      }
      budgets: {
        Row: {
          category_id: string
          created_at: string
          currency: string
          id: string
          monthly_limit: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          currency?: string
          id?: string
          monthly_limit?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          currency?: string
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
          {
            foreignKeyName: "budgets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_account_data"
            referencedColumns: ["user_id"]
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
        Relationships: [
          {
            foreignKeyName: "categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_account_data"
            referencedColumns: ["user_id"]
          },
        ]
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
          {
            foreignKeyName: "debt_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_account_data"
            referencedColumns: ["user_id"]
          },
        ]
      }
      debts: {
        Row: {
          color: string
          created_at: string
          currency: string
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
          currency?: string
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
          currency?: string
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
          {
            foreignKeyName: "debts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_account_data"
            referencedColumns: ["user_id"]
          },
        ]
      }
      expenses: {
        Row: {
          account_id: string | null
          amount: number
          amount_usd: number | null
          category: string
          created_at: string
          date: string
          id: string
          is_recurring: boolean
          note: string | null
          receipt_url: string | null
          reference_number: string | null
          source_id: string | null
          source_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          amount_usd?: number | null
          category: string
          created_at?: string
          date: string
          id?: string
          is_recurring?: boolean
          note?: string | null
          receipt_url?: string | null
          reference_number?: string | null
          source_id?: string | null
          source_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          amount_usd?: number | null
          category?: string
          created_at?: string
          date?: string
          id?: string
          is_recurring?: boolean
          note?: string | null
          receipt_url?: string | null
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
          {
            foreignKeyName: "expenses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_account_data"
            referencedColumns: ["user_id"]
          },
        ]
      }
      fx_rates: {
        Row: {
          code: string
          fetched_at: string
          rate: number
        }
        Insert: {
          code: string
          fetched_at?: string
          rate: number
        }
        Update: {
          code?: string
          fetched_at?: string
          rate?: number
        }
        Relationships: []
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
          {
            foreignKeyName: "goal_contributions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_account_data"
            referencedColumns: ["user_id"]
          },
        ]
      }
      gsc_performance: {
        Row: {
          clicks: number
          country: string
          ctr: number
          date: string
          device: string
          dimension_type: string
          fetched_at: string
          impressions: number
          is_fresh: boolean
          page: string
          position: number | null
          query: string
          site_url: string
        }
        Insert: {
          clicks?: number
          country?: string
          ctr?: number
          date: string
          device?: string
          dimension_type: string
          fetched_at?: string
          impressions?: number
          is_fresh?: boolean
          page?: string
          position?: number | null
          query?: string
          site_url: string
        }
        Update: {
          clicks?: number
          country?: string
          ctr?: number
          date?: string
          device?: string
          dimension_type?: string
          fetched_at?: string
          impressions?: number
          is_fresh?: boolean
          page?: string
          position?: number | null
          query?: string
          site_url?: string
        }
        Relationships: []
      }
      gsc_sync_log: {
        Row: {
          dimension_type: string | null
          duration_ms: number | null
          error: string | null
          id: number
          pages_fetched: number | null
          ran_at: string
          rows_fetched: number | null
          rows_written: number | null
          site_url: string | null
          status: string | null
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          dimension_type?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: never
          pages_fetched?: number | null
          ran_at?: string
          rows_fetched?: number | null
          rows_written?: number | null
          site_url?: string | null
          status?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          dimension_type?: string | null
          duration_ms?: number | null
          error?: string | null
          id?: never
          pages_fetched?: number | null
          ran_at?: string
          rows_fetched?: number | null
          rows_written?: number | null
          site_url?: string | null
          status?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: "income_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_account_data"
            referencedColumns: ["user_id"]
          },
        ]
      }
      incomes: {
        Row: {
          account_id: string | null
          amount: number
          amount_usd: number | null
          category: string | null
          created_at: string
          date: string
          id: string
          is_recurring: boolean
          note: string | null
          receipt_url: string | null
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
          amount_usd?: number | null
          category?: string | null
          created_at?: string
          date: string
          id?: string
          is_recurring?: boolean
          note?: string | null
          receipt_url?: string | null
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
          amount_usd?: number | null
          category?: string | null
          created_at?: string
          date?: string
          id?: string
          is_recurring?: boolean
          note?: string | null
          receipt_url?: string | null
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
          {
            foreignKeyName: "incomes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_account_data"
            referencedColumns: ["user_id"]
          },
        ]
      }
      liabilities: {
        Row: {
          category: string
          created_at: string
          currency: string
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
          currency?: string
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
          currency?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "liabilities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_account_data"
            referencedColumns: ["user_id"]
          },
        ]
      }
      monthly_reports: {
        Row: {
          created_at: string
          emailed_at: string | null
          id: string
          month: number
          report_content: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          emailed_at?: string | null
          id?: string
          month: number
          report_content: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          emailed_at?: string | null
          id?: string
          month?: number
          report_content?: string
          user_id?: string
          year?: number
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
        Relationships: [
          {
            foreignKeyName: "networth_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_account_data"
            referencedColumns: ["user_id"]
          },
        ]
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
          weekly_summary: boolean
        }
        Insert: {
          bill_reminders?: boolean
          budget_alerts?: boolean
          created_at?: string
          id?: string
          marketing_emails?: boolean
          updated_at?: string
          user_id: string
          weekly_summary?: boolean
        }
        Update: {
          bill_reminders?: boolean
          budget_alerts?: boolean
          created_at?: string
          id?: string
          marketing_emails?: boolean
          updated_at?: string
          user_id?: string
          weekly_summary?: boolean
        }
        Relationships: []
      }
      plan_pricing: {
        Row: {
          currency: string
          monthly_price: number
          plan_type: string
          updated_at: string
        }
        Insert: {
          currency?: string
          monthly_price?: number
          plan_type: string
          updated_at?: string
        }
        Update: {
          currency?: string
          monthly_price?: number
          plan_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          acquired_at: string | null
          acquisition_campaign: string | null
          acquisition_content: string | null
          acquisition_country: string | null
          acquisition_landing_path: string | null
          acquisition_medium: string | null
          acquisition_referrer: string | null
          acquisition_source: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string
          user_id: string
          write_access_until: string | null
        }
        Insert: {
          acquired_at?: string | null
          acquisition_campaign?: string | null
          acquisition_content?: string | null
          acquisition_country?: string | null
          acquisition_landing_path?: string | null
          acquisition_medium?: string | null
          acquisition_referrer?: string | null
          acquisition_source?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
          user_id: string
          write_access_until?: string | null
        }
        Update: {
          acquired_at?: string | null
          acquisition_campaign?: string | null
          acquisition_content?: string | null
          acquisition_country?: string | null
          acquisition_landing_path?: string | null
          acquisition_medium?: string | null
          acquisition_referrer?: string | null
          acquisition_source?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
          user_id?: string
          write_access_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "orphaned_account_data"
            referencedColumns: ["user_id"]
          },
        ]
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
          {
            foreignKeyName: "recurring_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_account_data"
            referencedColumns: ["user_id"]
          },
        ]
      }
      revenuecat_entitlements: {
        Row: {
          created_at: string
          entitlement: string
          environment: string | null
          event_id: string | null
          event_timestamp_ms: number | null
          event_type: string | null
          expires_at: string | null
          is_active: boolean
          period_type: string | null
          product_id: string | null
          purchased_at: string | null
          status: string
          store: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entitlement?: string
          environment?: string | null
          event_id?: string | null
          event_timestamp_ms?: number | null
          event_type?: string | null
          expires_at?: string | null
          is_active?: boolean
          period_type?: string | null
          product_id?: string | null
          purchased_at?: string | null
          status: string
          store?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entitlement?: string
          environment?: string | null
          event_id?: string | null
          event_timestamp_ms?: number | null
          event_type?: string | null
          expires_at?: string | null
          is_active?: boolean
          period_type?: string | null
          product_id?: string | null
          purchased_at?: string | null
          status?: string
          store?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenuecat_entitlements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "orphaned_account_data"
            referencedColumns: ["user_id"]
          },
        ]
      }
      savings_goals: {
        Row: {
          color: string
          created_at: string
          currency: string
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
          currency?: string
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
          currency?: string
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
          {
            foreignKeyName: "savings_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_account_data"
            referencedColumns: ["user_id"]
          },
        ]
      }
      sgs_action_log: {
        Row: {
          action: string
          agent_id: string
          approver: string | null
          cost_usd: number
          created_at: string
          error: string | null
          id: number
          idempotency_key: string
          input: Json | null
          latency_ms: number | null
          model: string | null
          ok: boolean | null
          output: Json | null
          prompt_version: string | null
          target: string | null
          tokens_in: number
          tokens_out: number
        }
        Insert: {
          action: string
          agent_id: string
          approver?: string | null
          cost_usd?: number
          created_at?: string
          error?: string | null
          id?: number
          idempotency_key: string
          input?: Json | null
          latency_ms?: number | null
          model?: string | null
          ok?: boolean | null
          output?: Json | null
          prompt_version?: string | null
          target?: string | null
          tokens_in?: number
          tokens_out?: number
        }
        Update: {
          action?: string
          agent_id?: string
          approver?: string | null
          cost_usd?: number
          created_at?: string
          error?: string | null
          id?: number
          idempotency_key?: string
          input?: Json | null
          latency_ms?: number | null
          model?: string | null
          ok?: boolean | null
          output?: Json | null
          prompt_version?: string | null
          target?: string | null
          tokens_in?: number
          tokens_out?: number
        }
        Relationships: [
          {
            foreignKeyName: "sgs_action_log_agent_fk"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "sgs_agent_spend_today"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgs_action_log_agent_fk"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "sgs_agents_rt"
            referencedColumns: ["id"]
          },
        ]
      }
      sgs_agents_rt: {
        Row: {
          autonomous: string[]
          build_order: number | null
          codename: string
          contract: string
          daily_token_budget: number
          enrichment_required: boolean
          forbidden: string[]
          hard_cap_usd_day: number
          id: string
          max_tokens: number
          mission: string
          model: string
          needs_approval: string[]
          reports_to: string | null
          status: string
          system_prompt: string | null
          temperature: number
          tier: number
          trust_level: number
          updated_at: string
          version: string
        }
        Insert: {
          autonomous?: string[]
          build_order?: number | null
          codename: string
          contract: string
          daily_token_budget?: number
          enrichment_required?: boolean
          forbidden?: string[]
          hard_cap_usd_day?: number
          id: string
          max_tokens?: number
          mission: string
          model: string
          needs_approval?: string[]
          reports_to?: string | null
          status?: string
          system_prompt?: string | null
          temperature?: number
          tier: number
          trust_level?: number
          updated_at?: string
          version: string
        }
        Update: {
          autonomous?: string[]
          build_order?: number | null
          codename?: string
          contract?: string
          daily_token_budget?: number
          enrichment_required?: boolean
          forbidden?: string[]
          hard_cap_usd_day?: number
          id?: string
          max_tokens?: number
          mission?: string
          model?: string
          needs_approval?: string[]
          reports_to?: string | null
          status?: string
          system_prompt?: string | null
          temperature?: number
          tier?: number
          trust_level?: number
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      sgs_brand_kit: {
        Row: {
          category: string
          key: string
          notes: string | null
          source: string | null
          updated_at: string
          value: Json
        }
        Insert: {
          category: string
          key: string
          notes?: string | null
          source?: string | null
          updated_at?: string
          value: Json
        }
        Update: {
          category?: string
          key?: string
          notes?: string | null
          source?: string | null
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      sgs_channel_health: {
        Row: {
          checked_at: string
          detail: string | null
          expires_at: string | null
          ok: boolean
          platform: string
        }
        Insert: {
          checked_at?: string
          detail?: string | null
          expires_at?: string | null
          ok: boolean
          platform: string
        }
        Update: {
          checked_at?: string
          detail?: string | null
          expires_at?: string | null
          ok?: boolean
          platform?: string
        }
        Relationships: []
      }
      sgs_channels: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          external_id: string | null
          handle: string | null
          id: number
          notes: string | null
          platform: string
          token_secret: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          external_id?: string | null
          handle?: string | null
          id?: never
          notes?: string | null
          platform: string
          token_secret?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          external_id?: string | null
          handle?: string | null
          id?: never
          notes?: string | null
          platform?: string
          token_secret?: string | null
        }
        Relationships: []
      }
      sgs_config: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      sgs_content_pipeline: {
        Row: {
          attempts: number
          carousel: Json | null
          compliance: Json | null
          cost_usd: number
          created_at: string
          id: number
          last_error: string | null
          photo_paths: string[] | null
          queue_id: number | null
          render_warnings: string[] | null
          run_date: string
          set_id: string | null
          slide_alts: string[] | null
          slide_urls: string[] | null
          stage: string
          topic: string
          updated_at: string
          variant: string
        }
        Insert: {
          attempts?: number
          carousel?: Json | null
          compliance?: Json | null
          cost_usd?: number
          created_at?: string
          id?: number
          last_error?: string | null
          photo_paths?: string[] | null
          queue_id?: number | null
          render_warnings?: string[] | null
          run_date?: string
          set_id?: string | null
          slide_alts?: string[] | null
          slide_urls?: string[] | null
          stage?: string
          topic: string
          updated_at?: string
          variant: string
        }
        Update: {
          attempts?: number
          carousel?: Json | null
          compliance?: Json | null
          cost_usd?: number
          created_at?: string
          id?: number
          last_error?: string | null
          photo_paths?: string[] | null
          queue_id?: number | null
          render_warnings?: string[] | null
          run_date?: string
          set_id?: string | null
          slide_alts?: string[] | null
          slide_urls?: string[] | null
          stage?: string
          topic?: string
          updated_at?: string
          variant?: string
        }
        Relationships: []
      }
      sgs_fb_token: {
        Row: {
          access_token: string
          expires_at: string | null
          id: number
          updated_at: string
        }
        Insert: {
          access_token: string
          expires_at?: string | null
          id?: number
          updated_at?: string
        }
        Update: {
          access_token?: string
          expires_at?: string | null
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      sgs_generated_assets: {
        Row: {
          agent_id: string | null
          approved: boolean | null
          aspect_ratio: string | null
          bytes: number | null
          cost_usd: number
          created_at: string
          id: number
          kind: string
          model: string
          negative: string | null
          prompt: string
          provider: string
          public_url: string | null
          storage_path: string | null
          used_in: string | null
        }
        Insert: {
          agent_id?: string | null
          approved?: boolean | null
          aspect_ratio?: string | null
          bytes?: number | null
          cost_usd?: number
          created_at?: string
          id?: number
          kind: string
          model: string
          negative?: string | null
          prompt: string
          provider: string
          public_url?: string | null
          storage_path?: string | null
          used_in?: string | null
        }
        Update: {
          agent_id?: string | null
          approved?: boolean | null
          aspect_ratio?: string | null
          bytes?: number | null
          cost_usd?: number
          created_at?: string
          id?: number
          kind?: string
          model?: string
          negative?: string | null
          prompt?: string
          provider?: string
          public_url?: string | null
          storage_path?: string | null
          used_in?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgs_generated_assets_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "sgs_agent_spend_today"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgs_generated_assets_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "sgs_agents_rt"
            referencedColumns: ["id"]
          },
        ]
      }
      sgs_goals: {
        Row: {
          created_at: string
          focus: string | null
          id: number
          north_star_metric: string | null
          north_star_target: number | null
          north_star_why: string | null
          rationale: string | null
          targets: Json | null
          week_start: string
        }
        Insert: {
          created_at?: string
          focus?: string | null
          id?: never
          north_star_metric?: string | null
          north_star_target?: number | null
          north_star_why?: string | null
          rationale?: string | null
          targets?: Json | null
          week_start: string
        }
        Update: {
          created_at?: string
          focus?: string | null
          id?: never
          north_star_metric?: string | null
          north_star_target?: number | null
          north_star_why?: string | null
          rationale?: string | null
          targets?: Json | null
          week_start?: string
        }
        Relationships: []
      }
      sgs_ig_token: {
        Row: {
          access_token: string
          expires_at: string | null
          id: number
          updated_at: string
        }
        Insert: {
          access_token: string
          expires_at?: string | null
          id?: number
          updated_at?: string
        }
        Update: {
          access_token?: string
          expires_at?: string | null
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      sgs_image_pipeline: {
        Row: {
          attempts: number
          compliance: Json | null
          compliance_verdict: string | null
          cost_usd: number
          created_at: string
          id: number
          image_alt: string | null
          image_url: string | null
          last_error: string | null
          photo_path: string | null
          post: Json | null
          queue_id: number | null
          render_warnings: string[]
          run_date: string
          set_id: string | null
          stage: string
          topic: string
          updated_at: string
          variant: string
        }
        Insert: {
          attempts?: number
          compliance?: Json | null
          compliance_verdict?: string | null
          cost_usd?: number
          created_at?: string
          id?: never
          image_alt?: string | null
          image_url?: string | null
          last_error?: string | null
          photo_path?: string | null
          post?: Json | null
          queue_id?: number | null
          render_warnings?: string[]
          run_date: string
          set_id?: string | null
          stage?: string
          topic: string
          updated_at?: string
          variant: string
        }
        Update: {
          attempts?: number
          compliance?: Json | null
          compliance_verdict?: string | null
          cost_usd?: number
          created_at?: string
          id?: never
          image_alt?: string | null
          image_url?: string | null
          last_error?: string | null
          photo_path?: string | null
          post?: Json | null
          queue_id?: number | null
          render_warnings?: string[]
          run_date?: string
          set_id?: string | null
          stage?: string
          topic?: string
          updated_at?: string
          variant?: string
        }
        Relationships: []
      }
      sgs_incidents: {
        Row: {
          agent_id: string | null
          closed_at: string | null
          created_at: string
          id: number
          kind: string
          severity: number
          summary: string
        }
        Insert: {
          agent_id?: string | null
          closed_at?: string | null
          created_at?: string
          id?: number
          kind: string
          severity: number
          summary: string
        }
        Update: {
          agent_id?: string | null
          closed_at?: string | null
          created_at?: string
          id?: number
          kind?: string
          severity?: number
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgs_incidents_agent_fk"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "sgs_agent_spend_today"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgs_incidents_agent_fk"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "sgs_agents_rt"
            referencedColumns: ["id"]
          },
        ]
      }
      sgs_learnings: {
        Row: {
          analysis: Json | null
          applied: Json | null
          created_at: string
          digest: string | null
          id: number
          sample_size: number
          window_days: number
        }
        Insert: {
          analysis?: Json | null
          applied?: Json | null
          created_at?: string
          digest?: string | null
          id?: never
          sample_size?: number
          window_days?: number
        }
        Update: {
          analysis?: Json | null
          applied?: Json | null
          created_at?: string
          digest?: string | null
          id?: never
          sample_size?: number
          window_days?: number
        }
        Relationships: []
      }
      sgs_output_contracts: {
        Row: {
          name: string
          schema: Json
        }
        Insert: {
          name: string
          schema: Json
        }
        Update: {
          name?: string
          schema?: Json
        }
        Relationships: []
      }
      sgs_post_metrics: {
        Row: {
          buffer_post_id: string
          caption: string | null
          channel: string | null
          comments: number | null
          engagement_rate: number | null
          format: string | null
          id: number
          metrics_updated_at: string | null
          posted_at: string | null
          pulled_at: string
          queue_id: number | null
          reach: number | null
          reactions: number | null
          service: string | null
          shares: number | null
          views: number | null
        }
        Insert: {
          buffer_post_id: string
          caption?: string | null
          channel?: string | null
          comments?: number | null
          engagement_rate?: number | null
          format?: string | null
          id?: number
          metrics_updated_at?: string | null
          posted_at?: string | null
          pulled_at?: string
          queue_id?: number | null
          reach?: number | null
          reactions?: number | null
          service?: string | null
          shares?: number | null
          views?: number | null
        }
        Update: {
          buffer_post_id?: string
          caption?: string | null
          channel?: string | null
          comments?: number | null
          engagement_rate?: number | null
          format?: string | null
          id?: number
          metrics_updated_at?: string | null
          posted_at?: string | null
          pulled_at?: string
          queue_id?: number | null
          reach?: number | null
          reactions?: number | null
          service?: string | null
          shares?: number | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sgs_post_metrics_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "sgs_awaiting_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgs_post_metrics_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "sgs_publish_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgs_post_metrics_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "sgs_ready_for_draft"
            referencedColumns: ["id"]
          },
        ]
      }
      sgs_publish_queue: {
        Row: {
          agent_id: string | null
          asset_alt: string[] | null
          asset_set_id: string | null
          asset_urls: string[] | null
          buffer_post_id: string | null
          caption: string | null
          channel: string
          channel_id: string | null
          compliance: Json | null
          compliance_verdict: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          direct_fanout_at: string | null
          direct_release_at: string | null
          error: string | null
          format: string
          hashtags: string[] | null
          hypothesis: string | null
          id: number
          is_ai_generated: boolean
          kill_threshold: string | null
          notes: string | null
          published_at: string | null
          render_warnings: string[] | null
          scheduled_for: string | null
          share_mode: string
          status: string
          tier: string
        }
        Insert: {
          agent_id?: string | null
          asset_alt?: string[] | null
          asset_set_id?: string | null
          asset_urls?: string[] | null
          buffer_post_id?: string | null
          caption?: string | null
          channel: string
          channel_id?: string | null
          compliance?: Json | null
          compliance_verdict?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          direct_fanout_at?: string | null
          direct_release_at?: string | null
          error?: string | null
          format: string
          hashtags?: string[] | null
          hypothesis?: string | null
          id?: number
          is_ai_generated?: boolean
          kill_threshold?: string | null
          notes?: string | null
          published_at?: string | null
          render_warnings?: string[] | null
          scheduled_for?: string | null
          share_mode?: string
          status?: string
          tier?: string
        }
        Update: {
          agent_id?: string | null
          asset_alt?: string[] | null
          asset_set_id?: string | null
          asset_urls?: string[] | null
          buffer_post_id?: string | null
          caption?: string | null
          channel?: string
          channel_id?: string | null
          compliance?: Json | null
          compliance_verdict?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          direct_fanout_at?: string | null
          direct_release_at?: string | null
          error?: string | null
          format?: string
          hashtags?: string[] | null
          hypothesis?: string | null
          id?: number
          is_ai_generated?: boolean
          kill_threshold?: string | null
          notes?: string | null
          published_at?: string | null
          render_warnings?: string[] | null
          scheduled_for?: string | null
          share_mode?: string
          status?: string
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "sgs_publish_queue_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "sgs_agent_spend_today"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgs_publish_queue_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "sgs_agents_rt"
            referencedColumns: ["id"]
          },
        ]
      }
      sgs_review_queue: {
        Row: {
          agent_id: string
          artifact: Json
          compliance: Json | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          default_action: string
          id: number
          notes: string | null
          subject: string
          tier: string
          timeout_at: string | null
        }
        Insert: {
          agent_id: string
          artifact: Json
          compliance?: Json | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          default_action?: string
          id?: number
          notes?: string | null
          subject: string
          tier: string
          timeout_at?: string | null
        }
        Update: {
          agent_id?: string
          artifact?: Json
          compliance?: Json | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          default_action?: string
          id?: number
          notes?: string | null
          subject?: string
          tier?: string
          timeout_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sgs_review_queue_agent_fk"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "sgs_agent_spend_today"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sgs_review_queue_agent_fk"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "sgs_agents_rt"
            referencedColumns: ["id"]
          },
        ]
      }
      sgs_threads_token: {
        Row: {
          access_token: string
          expires_at: string | null
          id: number
          updated_at: string
        }
        Insert: {
          access_token: string
          expires_at?: string | null
          id?: number
          updated_at?: string
        }
        Update: {
          access_token?: string
          expires_at?: string | null
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      sgs_topic_backlog: {
        Row: {
          angle: string | null
          created_at: string
          created_by: string
          id: number
          priority: number
          season: string | null
          topic: string
          used_at: string | null
        }
        Insert: {
          angle?: string | null
          created_at?: string
          created_by?: string
          id?: number
          priority?: number
          season?: string | null
          topic: string
          used_at?: string | null
        }
        Update: {
          angle?: string | null
          created_at?: string
          created_by?: string
          id?: number
          priority?: number
          season?: string | null
          topic?: string
          used_at?: string | null
        }
        Relationships: []
      }
      sgs_tumblr_token: {
        Row: {
          access_token: string
          expires_at: string | null
          id: number
          refresh_token: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          expires_at?: string | null
          id?: number
          refresh_token?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          expires_at?: string | null
          id?: number
          refresh_token?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sgs_video_pipeline: {
        Row: {
          asset_urls: string[]
          caption: string | null
          created_at: string
          error: string | null
          format: string | null
          hashtags: string[] | null
          hook: string | null
          id: number
          render_id: string | null
          source_kind: string
          source_ref: string | null
          status: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          asset_urls: string[]
          caption?: string | null
          created_at?: string
          error?: string | null
          format?: string | null
          hashtags?: string[] | null
          hook?: string | null
          id?: never
          render_id?: string | null
          source_kind?: string
          source_ref?: string | null
          status?: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          asset_urls?: string[]
          caption?: string | null
          created_at?: string
          error?: string | null
          format?: string | null
          hashtags?: string[] | null
          hook?: string | null
          id?: never
          render_id?: string | null
          source_kind?: string
          source_ref?: string | null
          status?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
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
          to_amount: number | null
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
          to_amount?: number | null
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
          to_amount?: number | null
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
          {
            foreignKeyName: "transfers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_account_data"
            referencedColumns: ["user_id"]
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_account_data"
            referencedColumns: ["user_id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "orphaned_account_data"
            referencedColumns: ["user_id"]
          },
        ]
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          launched_email_sent: boolean
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          launched_email_sent?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          launched_email_sent?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      acquisition_performance: {
        Row: {
          campaign: string | null
          conversion_pct: number | null
          converted: number | null
          country: string | null
          medium: string | null
          signups: number | null
          source: string | null
        }
        Relationships: []
      }
      entitlement_divergence: {
        Row: {
          paystack_active: boolean | null
          store_active: boolean | null
          user_id: string | null
        }
        Relationships: []
      }
      orphaned_account_data: {
        Row: {
          accounts: number | null
          budgets: number | null
          created_at: string | null
          email: string | null
          expenses: number | null
          has_profile: boolean | null
          last_sign_in_at: string | null
          user_id: string | null
        }
        Insert: {
          accounts?: never
          budgets?: never
          created_at?: string | null
          email?: string | null
          expenses?: never
          has_profile?: never
          last_sign_in_at?: string | null
          user_id?: string | null
        }
        Update: {
          accounts?: never
          budgets?: never
          created_at?: string | null
          email?: string | null
          expenses?: never
          has_profile?: never
          last_sign_in_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sgs_agent_spend_today: {
        Row: {
          codename: string | null
          hard_cap_usd_day: number | null
          id: string | null
          remaining_usd: number | null
          spent_usd: number | null
        }
        Relationships: []
      }
      sgs_awaiting_review: {
        Row: {
          assets: number | null
          caption_preview: string | null
          channel: string | null
          compliance_verdict: string | null
          created_at: string | null
          format: string | null
          hypothesis: string | null
          id: number | null
          tier: string | null
        }
        Insert: {
          assets?: never
          caption_preview?: never
          channel?: string | null
          compliance_verdict?: string | null
          created_at?: string | null
          format?: string | null
          hypothesis?: string | null
          id?: number | null
          tier?: string | null
        }
        Update: {
          assets?: never
          caption_preview?: never
          channel?: string | null
          compliance_verdict?: string | null
          created_at?: string | null
          format?: string | null
          hypothesis?: string | null
          id?: number | null
          tier?: string | null
        }
        Relationships: []
      }
      sgs_performance: {
        Row: {
          buffer_post_id: string | null
          caption_preview: string | null
          comments: number | null
          engagement_rate: number | null
          format: string | null
          metrics_updated_at: string | null
          posted_at: string | null
          reactions: number | null
          service: string | null
          shares: number | null
          views: number | null
        }
        Relationships: []
      }
      sgs_ready_for_draft: {
        Row: {
          asset_set_id: string | null
          caption_preview: string | null
          compliance_verdict: string | null
          created_at: string | null
          id: number | null
          slides: number | null
        }
        Insert: {
          asset_set_id?: string | null
          caption_preview?: never
          compliance_verdict?: string | null
          created_at?: string | null
          id?: number | null
          slides?: never
        }
        Update: {
          asset_set_id?: string | null
          caption_preview?: never
          compliance_verdict?: string | null
          created_at?: string | null
          id?: number | null
          slides?: never
        }
        Relationships: []
      }
      v_gsc_queries_28d: {
        Row: {
          avg_position: number | null
          clicks: number | null
          ctr: number | null
          impressions: number | null
          query: string | null
        }
        Relationships: []
      }
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
      admin_revenue_stats: { Args: never; Returns: Json }
      admin_top_categories: {
        Args: { p_limit?: number }
        Returns: {
          category: string
          total_amount: number
        }[]
      }
      admin_user_engagement_stats: { Args: never; Returns: Json }
      admin_user_signups_chart: {
        Args: never
        Returns: {
          month_key: string
          month_label: string
          signup_count: number
        }[]
      }
      atomic_decrement_debt_balance: {
        Args: { p_amount: number; p_debt_id: string }
        Returns: number
      }
      atomic_increment_debt_balance: {
        Args: { p_amount: number; p_debt_id: string }
        Returns: number
      }
      atomic_increment_goal_amount: {
        Args: { p_amount: number; p_goal_id: string }
        Returns: number
      }
      can_write: { Args: { _uid: string }; Returns: boolean }
      delete_account_cascade: {
        Args: { p_account_id: string }
        Returns: undefined
      }
      delete_user_data: {
        Args: { _dry_run?: boolean; _uid: string }
        Returns: {
          action: string
          rows_affected: number
          table_name: string
        }[]
      }
      entitlement_health: {
        Args: never
        Returns: {
          affected: number
          check_name: string
          detail: string
          severity: string
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
      monitor_secret_matches: { Args: { candidate: string }; Returns: boolean }
      my_entitlement: {
        Args: never
        Returns: {
          can_write: boolean
          is_premium: boolean
          is_trialing: boolean
          period_end: string
          plan_type: string
          provider: string
          status: string
          trial_end: string
        }[]
      }
      my_is_premium: { Args: never; Returns: boolean }
      publish_due_blog_posts: { Args: never; Returns: number }
      revoke_user_session: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: boolean
      }
      sgs_assign_direct_slots: { Args: never; Returns: number }
      sgs_goals_scorecard: { Args: never; Returns: Json }
      sgs_health_check: { Args: never; Returns: Json }
      sgs_weekly_snapshot: { Args: never; Returns: Json }
      user_entitlement: {
        Args: { _uid: string }
        Returns: {
          can_write: boolean
          is_premium: boolean
          is_trialing: boolean
          period_end: string
          plan_type: string
          provider: string
          status: string
          trial_end: string
        }[]
      }
      user_is_premium: { Args: { _uid: string }; Returns: boolean }
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

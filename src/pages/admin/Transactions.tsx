import { useState } from "react";
import { 
  Search, 
  Filter, 
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type TransactionType = "expenses" | "incomes" | "transfers";

interface Expense {
  id: string;
  amount: number;
  category: string;
  date: string;
  note: string | null;
  reference_number: string | null;
  user_id: string;
}

interface Income {
  id: string;
  amount: number;
  source: string;
  date: string;
  note: string | null;
  reference_number: string | null;
  user_id: string;
}

interface Transfer {
  id: string;
  amount: number;
  date: string;
  note: string | null;
  reference_number: string | null;
  user_id: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(amount);
}

function TransactionRowSkeleton() {
  return (
    <TableRow className="border-border/30">
      <TableCell><div className="h-4 w-24 shimmer rounded" /></TableCell>
      <TableCell><div className="h-4 w-20 shimmer rounded" /></TableCell>
      <TableCell><div className="h-5 w-16 shimmer rounded-full" /></TableCell>
      <TableCell><div className="h-4 w-32 shimmer rounded" /></TableCell>
      <TableCell><div className="h-4 w-24 shimmer rounded" /></TableCell>
    </TableRow>
  );
}

export default function Transactions() {
  const [activeTab, setActiveTab] = useState<TransactionType>("expenses");
  const [searchQuery, setSearchQuery] = useState("");
  const [limit, setLimit] = useState("100");

  // Fetch expenses
  const { data: expenses, isLoading: loadingExpenses } = useQuery({
    queryKey: ["admin", "expenses", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, amount, category, date, note, reference_number, user_id")
        .order("date", { ascending: false })
        .limit(parseInt(limit));
      if (error) throw error;
      return data as Expense[];
    },
  });

  // Fetch incomes
  const { data: incomes, isLoading: loadingIncomes } = useQuery({
    queryKey: ["admin", "incomes", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incomes")
        .select("id, amount, source, date, note, reference_number, user_id")
        .order("date", { ascending: false })
        .limit(parseInt(limit));
      if (error) throw error;
      return data as Income[];
    },
  });

  // Fetch transfers
  const { data: transfers, isLoading: loadingTransfers } = useQuery({
    queryKey: ["admin", "transfers", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transfers")
        .select("id, amount, date, note, reference_number, user_id")
        .order("date", { ascending: false })
        .limit(parseInt(limit));
      if (error) throw error;
      return data as Transfer[];
    },
  });

  const isLoading = loadingExpenses || loadingIncomes || loadingTransfers;

  // Calculate totals
  const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
  const totalIncomes = incomes?.reduce((sum, i) => sum + Number(i.amount), 0) || 0;
  const totalTransfers = transfers?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  // Filter transactions by search
  const filteredExpenses = expenses?.filter(e => 
    e.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.note?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.reference_number?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const filteredIncomes = incomes?.filter(i => 
    i.source?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.note?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.reference_number?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const filteredTransfers = transfers?.filter(t => 
    t.note?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.reference_number?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Transactions</h1>
        <p className="text-muted-foreground">
          Browse and filter all platform transactions
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card border-l-4 border-l-pink hover:scale-[1.02] transition-transform cursor-pointer" onClick={() => setActiveTab("expenses")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-pink">
                  <TrendingDown className="h-6 w-6 text-pink-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(totalExpenses)}</p>
                  <p className="text-sm text-muted-foreground">{expenses?.length || 0} Expenses</p>
                </div>
              </div>
              <ArrowUpRight className="h-5 w-5 text-pink" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-l-4 border-l-primary hover:scale-[1.02] transition-transform cursor-pointer" onClick={() => setActiveTab("incomes")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary">
                  <TrendingUp className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(totalIncomes)}</p>
                  <p className="text-sm text-muted-foreground">{incomes?.length || 0} Incomes</p>
                </div>
              </div>
              <ArrowDownLeft className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-l-4 border-l-purple hover:scale-[1.02] transition-transform cursor-pointer" onClick={() => setActiveTab("transfers")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-purple">
                  <RefreshCw className="h-6 w-6 text-purple-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(totalTransfers)}</p>
                  <p className="text-sm text-muted-foreground">{transfers?.length || 0} Transfers</p>
                </div>
              </div>
              <RefreshCw className="h-5 w-5 text-purple" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="glass-card">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5 text-muted-foreground" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by category, source, note, or reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background/50 border-border/50 focus:border-primary/50"
              />
            </div>
            <Select value={limit} onValueChange={setLimit}>
              <SelectTrigger className="w-full md:w-[180px] bg-background/50 border-border/50">
                <SelectValue placeholder="Limit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">Last 50</SelectItem>
                <SelectItem value="100">Last 100</SelectItem>
                <SelectItem value="500">Last 500</SelectItem>
                <SelectItem value="1000">Last 1000</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Tabs */}
      <Card className="glass-card overflow-hidden">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TransactionType)}>
          <CardHeader className="pb-0">
            <TabsList className="grid w-full grid-cols-3 bg-muted/30 p-1">
              <TabsTrigger 
                value="expenses" 
                className={cn(
                  "gap-2 data-[state=active]:bg-pink/10 data-[state=active]:text-pink",
                  "data-[state=active]:shadow-sm"
                )}
              >
                <ArrowUpRight className="h-4 w-4" />
                Expenses
              </TabsTrigger>
              <TabsTrigger 
                value="incomes" 
                className={cn(
                  "gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary",
                  "data-[state=active]:shadow-sm"
                )}
              >
                <ArrowDownLeft className="h-4 w-4" />
                Incomes
              </TabsTrigger>
              <TabsTrigger 
                value="transfers" 
                className={cn(
                  "gap-2 data-[state=active]:bg-purple/10 data-[state=active]:text-purple",
                  "data-[state=active]:shadow-sm"
                )}
              >
                <RefreshCw className="h-4 w-4" />
                Transfers
              </TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent className="pt-6">
            <TabsContent value="expenses" className="mt-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30 hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Date</TableHead>
                    <TableHead className="text-muted-foreground">Amount</TableHead>
                    <TableHead className="text-muted-foreground">Category</TableHead>
                    <TableHead className="text-muted-foreground">Note</TableHead>
                    <TableHead className="text-muted-foreground">Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <>
                      <TransactionRowSkeleton />
                      <TransactionRowSkeleton />
                      <TransactionRowSkeleton />
                      <TransactionRowSkeleton />
                    </>
                  ) : filteredExpenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Receipt className="h-8 w-8 text-muted-foreground/50" />
                          <p className="text-muted-foreground">No expenses found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredExpenses.map((expense) => (
                      <TableRow key={expense.id} className="border-border/30 hover:bg-card/50">
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(expense.date), 'MMM d, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-pink">
                            -{formatCurrency(expense.amount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-pink/10 text-pink border border-pink/20">
                            {expense.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {expense.note || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {expense.reference_number || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="incomes" className="mt-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30 hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Date</TableHead>
                    <TableHead className="text-muted-foreground">Amount</TableHead>
                    <TableHead className="text-muted-foreground">Source</TableHead>
                    <TableHead className="text-muted-foreground">Note</TableHead>
                    <TableHead className="text-muted-foreground">Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <>
                      <TransactionRowSkeleton />
                      <TransactionRowSkeleton />
                      <TransactionRowSkeleton />
                      <TransactionRowSkeleton />
                    </>
                  ) : filteredIncomes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <DollarSign className="h-8 w-8 text-muted-foreground/50" />
                          <p className="text-muted-foreground">No incomes found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredIncomes.map((income) => (
                      <TableRow key={income.id} className="border-border/30 hover:bg-card/50">
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(income.date), 'MMM d, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-primary">
                            +{formatCurrency(income.amount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-primary/10 text-primary border border-primary/20">
                            {income.source}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {income.note || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {income.reference_number || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="transfers" className="mt-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30 hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Date</TableHead>
                    <TableHead className="text-muted-foreground">Amount</TableHead>
                    <TableHead className="text-muted-foreground">Note</TableHead>
                    <TableHead className="text-muted-foreground">Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <>
                      <TransactionRowSkeleton />
                      <TransactionRowSkeleton />
                      <TransactionRowSkeleton />
                      <TransactionRowSkeleton />
                    </>
                  ) : filteredTransfers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <RefreshCw className="h-8 w-8 text-muted-foreground/50" />
                          <p className="text-muted-foreground">No transfers found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransfers.map((transfer) => (
                      <TableRow key={transfer.id} className="border-border/30 hover:bg-card/50">
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(transfer.date), 'MMM d, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-purple">
                            {formatCurrency(transfer.amount)}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {transfer.note || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {transfer.reference_number || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
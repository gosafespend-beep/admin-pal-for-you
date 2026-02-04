import { useState } from "react";
import { 
  Search, 
  Filter, 
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Calendar,
  DollarSign
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
    <TableRow>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Transactions</h1>
        <p className="text-muted-foreground">
          Browse and filter all platform transactions
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <ArrowUpRight className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-lg font-bold">{formatCurrency(totalExpenses)}</p>
                <p className="text-xs text-muted-foreground">{expenses?.length || 0} Expenses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <ArrowDownLeft className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold">{formatCurrency(totalIncomes)}</p>
                <p className="text-xs text-muted-foreground">{incomes?.length || 0} Incomes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <RefreshCw className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-bold">{formatCurrency(totalTransfers)}</p>
                <p className="text-xs text-muted-foreground">{transfers?.length || 0} Transfers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="glass-card">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5" />
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
                className="pl-9 bg-background/50"
              />
            </div>
            <Select value={limit} onValueChange={setLimit}>
              <SelectTrigger className="w-full md:w-[180px] bg-background/50">
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
      <Card className="glass-card">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TransactionType)}>
          <CardHeader>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="expenses" className="gap-2">
                <ArrowUpRight className="h-4 w-4" />
                Expenses
              </TabsTrigger>
              <TabsTrigger value="incomes" className="gap-2">
                <ArrowDownLeft className="h-4 w-4" />
                Incomes
              </TabsTrigger>
              <TabsTrigger value="transfers" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Transfers
              </TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent>
            <TabsContent value="expenses" className="mt-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <>
                      <TransactionRowSkeleton />
                      <TransactionRowSkeleton />
                      <TransactionRowSkeleton />
                    </>
                  ) : filteredExpenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        <p className="text-muted-foreground">No expenses found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredExpenses.map((expense) => (
                      <TableRow key={expense.id} className="border-border/50">
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(expense.date), 'MMM d, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-destructive">
                            -{formatCurrency(expense.amount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-muted">
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
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <>
                      <TransactionRowSkeleton />
                      <TransactionRowSkeleton />
                      <TransactionRowSkeleton />
                    </>
                  ) : filteredIncomes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        <p className="text-muted-foreground">No incomes found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredIncomes.map((income) => (
                      <TableRow key={income.id} className="border-border/50">
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(income.date), 'MMM d, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-primary">
                            +{formatCurrency(income.amount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
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
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <>
                      <TransactionRowSkeleton />
                      <TransactionRowSkeleton />
                      <TransactionRowSkeleton />
                    </>
                  ) : filteredTransfers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        <p className="text-muted-foreground">No transfers found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransfers.map((transfer) => (
                      <TableRow key={transfer.id} className="border-border/50">
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(transfer.date), 'MMM d, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
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

import { useState, useCallback } from "react";
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
  ChevronLeft,
  ChevronRight,
  Download,
  X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useAdminTransactions, TransactionFilters } from "@/hooks/admin/useAdminTransactions";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(amount);
}

function TransactionRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <TableRow className="border-border/30">
      {Array.from({ length: cols }).map((_, i) => (
        <TableCell key={i}><div className="h-4 w-24 shimmer rounded" /></TableCell>
      ))}
    </TableRow>
  );
}

function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(h => `"${String(row[h] ?? '')}"`).join(','))
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Transactions() {
  const [filters, setFilters] = useState<TransactionFilters>({
    type: "expenses",
    search: "",
    startDate: "",
    endDate: "",
    userId: "",
    page: 1,
    pageSize: 20,
  });

  const [searchInput, setSearchInput] = useState("");

  const { data, isLoading, refetch } = useAdminTransactions(filters);

  const handleSearch = useCallback(() => {
    setFilters(f => ({ ...f, search: searchInput, page: 1 }));
  }, [searchInput]);

  const activeData = filters.type === "expenses"
    ? data?.expenses
    : filters.type === "incomes"
    ? data?.incomes
    : data?.transfers;

  const items = activeData?.data || [];
  const total = activeData?.total || 0;
  const totalPages = Math.ceil(total / filters.pageSize);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Transactions</h1>
          <p className="text-muted-foreground">
            All platform transactions across all users • {total} results
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => exportToCSV(items as Record<string, unknown>[], `${filters.type}-export`)}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
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
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search category, source, note, reference..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 bg-background/50 border-border/50 focus:border-primary/50"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Input
                type="date"
                placeholder="Start date"
                value={filters.startDate}
                onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value, page: 1 }))}
                className="w-[150px] bg-background/50 border-border/50"
              />
              <Input
                type="date"
                placeholder="End date"
                value={filters.endDate}
                onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value, page: 1 }))}
                className="w-[150px] bg-background/50 border-border/50"
              />
              <Select value={String(filters.pageSize)} onValueChange={(v) => setFilters(f => ({ ...f, pageSize: parseInt(v), page: 1 }))}>
                <SelectTrigger className="w-[100px] bg-background/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20/page</SelectItem>
                  <SelectItem value="50">50/page</SelectItem>
                  <SelectItem value="100">100/page</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleSearch}>Search</Button>
              {(filters.search || filters.startDate || filters.endDate) && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setSearchInput("");
                  setFilters(f => ({ ...f, search: "", startDate: "", endDate: "", page: 1 }));
                }}>
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Tabs */}
      <Card className="glass-card overflow-hidden">
        <Tabs value={filters.type} onValueChange={(v) => setFilters(f => ({ ...f, type: v as TransactionFilters["type"], page: 1 }))}>
          <CardHeader className="pb-0">
            <TabsList className="grid w-full grid-cols-3 bg-muted/30 p-1">
              <TabsTrigger value="expenses" className={cn("gap-2 data-[state=active]:bg-pink/10 data-[state=active]:text-pink data-[state=active]:shadow-sm")}>
                <ArrowUpRight className="h-4 w-4" />
                Expenses
              </TabsTrigger>
              <TabsTrigger value="incomes" className={cn("gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm")}>
                <ArrowDownLeft className="h-4 w-4" />
                Incomes
              </TabsTrigger>
              <TabsTrigger value="transfers" className={cn("gap-2 data-[state=active]:bg-purple/10 data-[state=active]:text-purple data-[state=active]:shadow-sm")}>
                <RefreshCw className="h-4 w-4" />
                Transfers
              </TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground">Amount</TableHead>
                  <TableHead className="text-muted-foreground">{filters.type === "incomes" ? "Source" : filters.type === "expenses" ? "Category" : "Note"}</TableHead>
                  <TableHead className="text-muted-foreground">Note</TableHead>
                  <TableHead className="text-muted-foreground">Reference</TableHead>
                  <TableHead className="text-muted-foreground">User ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <TransactionRowSkeleton key={i} cols={6} />)
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Receipt className="h-8 w-8 text-muted-foreground/50" />
                        <p className="text-muted-foreground">No transactions found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item: Record<string, unknown>) => (
                    <TableRow key={item.id as string} className="border-border/30 hover:bg-card/50">
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(item.date as string), 'MMM d, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={cn("font-semibold", filters.type === "expenses" ? "text-pink" : filters.type === "incomes" ? "text-primary" : "text-purple")}>
                          {filters.type === "expenses" ? "-" : filters.type === "incomes" ? "+" : ""}{formatCurrency(Number(item.amount))}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(
                          "border",
                          filters.type === "expenses" ? "bg-pink/10 text-pink border-pink/20" :
                          filters.type === "incomes" ? "bg-primary/10 text-primary border-primary/20" :
                          "bg-purple/10 text-purple border-purple/20"
                        )}>
                          {(item.category || item.source || item.note || '-') as string}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {(item.note as string) || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {(item.reference_number as string) || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground max-w-[120px] truncate">
                        {(item.user_id as string)?.slice(0, 8)}...
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/30">
                <p className="text-sm text-muted-foreground">
                  Page {filters.page} of {totalPages} ({total} total)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={filters.page <= 1}
                    onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={filters.page >= totalPages}
                    onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}

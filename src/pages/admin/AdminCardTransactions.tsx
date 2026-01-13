import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CreditCard,
  RefreshCw,
  Search,
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  Building2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Ban,
  Eye,
  Filter,
} from "lucide-react";

interface Transaction {
  id: string;
  order_id: string;
  company_id: string;
  company_name: string;
  amount: number;
  status: string;
  payment_method: string;
  installments: number;
  card_brand: string;
  card_last_four: string;
  customer_name: string;
  customer_email: string;
  error_message: string | null;
  mercadopago_payment_id: string | null;
  created_at: string;
  refunded_at: string | null;
  refund_amount: number | null;
}

interface TransactionStats {
  total_transactions: number;
  total_approved: number;
  total_rejected: number;
  total_pending: number;
  total_refunded: number;
  total_amount: number;
  total_refund_amount: number;
  approval_rate: number;
}

export default function AdminCardTransactions() {
  const navigate = useNavigate();
  const { user, loading: authLoading, hasRole } = useAuth();
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [errorTransactions, setErrorTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    if (!authLoading && !hasRole("super_admin")) {
      navigate("/dashboard");
    }
  }, [authLoading, hasRole, navigate]);

  useEffect(() => {
    if (hasRole("super_admin")) {
      loadData();
    }
  }, [authLoading]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadTransactions(),
        loadErrorTransactions(),
        loadCompanies(),
        loadStats(),
      ]);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    // Use raw query to bypass type restrictions
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id,
        company_id,
        total,
        status,
        payment_method,
        payment_status,
        mercadopago_payment_id,
        card_brand,
        card_last_four,
        installments,
        customer_name,
        customer_email,
        payment_error,
        created_at,
        companies!inner(name)
      `)
      .or("payment_method.eq.online,payment_method.ilike.%card%")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    const formatted: Transaction[] = (data || []).map((order: any) => ({
      id: order.id,
      order_id: order.id,
      company_id: order.company_id,
      company_name: order.companies?.name || "Empresa desconhecida",
      amount: order.total || 0,
      status: order.payment_status || order.status,
      payment_method: order.payment_method,
      installments: order.installments || 1,
      card_brand: order.card_brand || "",
      card_last_four: order.card_last_four || "",
      customer_name: order.customer_name || "",
      customer_email: order.customer_email || "",
      error_message: order.payment_error,
      mercadopago_payment_id: order.mercadopago_payment_id,
      created_at: order.created_at,
      refunded_at: null,
      refund_amount: null,
    }));

    setTransactions(formatted);
  };

  const loadErrorTransactions = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id,
        company_id,
        total,
        status,
        payment_method,
        payment_status,
        mercadopago_payment_id,
        card_brand,
        card_last_four,
        installments,
        customer_name,
        customer_email,
        payment_error,
        created_at,
        companies!inner(name)
      `)
      .or("payment_method.eq.online,payment_method.ilike.%card%")
      .not("payment_error", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    const formatted: Transaction[] = (data || []).map((order: any) => ({
      id: order.id,
      order_id: order.id,
      company_id: order.company_id,
      company_name: order.companies?.name || "Empresa desconhecida",
      amount: order.total || 0,
      status: order.payment_status || order.status,
      payment_method: order.payment_method,
      installments: order.installments || 1,
      card_brand: order.card_brand || "",
      card_last_four: order.card_last_four || "",
      customer_name: order.customer_name || "",
      customer_email: order.customer_email || "",
      error_message: order.payment_error,
      mercadopago_payment_id: order.mercadopago_payment_id,
      created_at: order.created_at,
      refunded_at: null,
      refund_amount: null,
    }));

    setErrorTransactions(formatted);
  };

  const loadCompanies = async () => {
    const { data, error } = await supabase
      .from("companies")
      .select("id, name")
      .order("name");

    if (error) throw error;
    setCompanies(data || []);
  };

  const loadStats = async () => {
    // Get paid transactions (approved)
    const { count: approvedCount } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .or("payment_method.eq.online,payment_method.ilike.%card%")
      .eq("payment_status", "paid");

    // Get failed transactions (rejected)
    const { count: rejectedCount } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .or("payment_method.eq.online,payment_method.ilike.%card%")
      .eq("payment_status", "failed");

    // Get pending transactions
    const { count: pendingCount } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .or("payment_method.eq.online,payment_method.ilike.%card%")
      .eq("payment_status", "pending");

    // Get refunded transactions
    const { count: refundedCount } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .or("payment_method.eq.online,payment_method.ilike.%card%")
      .eq("payment_status", "refunded");

    // Get totals
    const { data: totalsData } = await supabase
      .from("orders")
      .select("total")
      .or("payment_method.eq.online,payment_method.ilike.%card%")
      .eq("payment_status", "paid");

    const totalAmount = (totalsData || []).reduce((sum, o) => sum + (o.total || 0), 0);

    const totalCount = (approvedCount || 0) + (rejectedCount || 0) + (pendingCount || 0);
    const approvalRate = totalCount > 0 ? ((approvedCount || 0) / totalCount) * 100 : 0;

    setStats({
      total_transactions: totalCount,
      total_approved: approvedCount || 0,
      total_rejected: rejectedCount || 0,
      total_pending: pendingCount || 0,
      total_refunded: refundedCount || 0,
      total_amount: totalAmount,
      total_refund_amount: 0,
      approval_rate: approvalRate,
    });
  };

  const handleRefund = async () => {
    if (!selectedTransaction || !refundAmount) return;

    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0 || amount > selectedTransaction.amount) {
      toast.error("Valor de estorno inválido");
      return;
    }

    setRefunding(true);
    try {
      // Call the refund edge function
      const { data, error } = await supabase.functions.invoke("cancel-mercadopago-payment", {
        body: {
          payment_id: selectedTransaction.mercadopago_payment_id,
          amount: amount,
          order_id: selectedTransaction.order_id,
        },
      });

      if (error) throw error;

      // Update local state
      await loadData();
      toast.success(`Estorno de R$ ${amount.toFixed(2)} realizado com sucesso`);
      setShowRefundDialog(false);
      setSelectedTransaction(null);
      setRefundAmount("");
    } catch (error: any) {
      console.error("Refund error:", error);
      toast.error(error.message || "Erro ao processar estorno");
    } finally {
      setRefunding(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
      case "paid":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case "rejected":
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejeitado</Badge>;
      case "pending":
      case "in_process":
        return <Badge variant="outline" className="text-yellow-600 border-yellow-500"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case "refunded":
        return <Badge variant="secondary"><RotateCcw className="h-3 w-3 mr-1" />Estornado</Badge>;
      case "cancelled":
        return <Badge variant="outline"><Ban className="h-3 w-3 mr-1" />Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCardBrand = (brand: string) => {
    const brands: Record<string, string> = {
      visa: "Visa",
      mastercard: "Mastercard",
      amex: "Amex",
      elo: "Elo",
      hipercard: "Hipercard",
    };
    return brands[brand?.toLowerCase()] || brand || "—";
  };

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch =
      t.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.order_id?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const matchesCompany = companyFilter === "all" || t.company_id === companyFilter;

    return matchesSearch && matchesStatus && matchesCompany;
  });

  const exportToCSV = () => {
    const headers = [
      "Data",
      "Pedido",
      "Empresa",
      "Cliente",
      "Email",
      "Valor",
      "Parcelas",
      "Bandeira",
      "Status",
      "Erro",
    ];

    const rows = filteredTransactions.map((t) => [
      format(new Date(t.created_at), "dd/MM/yyyy HH:mm"),
      t.order_id,
      t.company_name,
      t.customer_name,
      t.customer_email,
      t.amount.toFixed(2),
      t.installments.toString(),
      formatCardBrand(t.card_brand),
      t.status,
      t.error_message || "",
    ]);

    const csvContent = [
      headers.join(";"),
      ...rows.map((row) => row.join(";")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transacoes-cartao-admin-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CreditCard className="h-6 w-6" />
              Transações de Cartão (Admin)
            </h1>
            <p className="text-muted-foreground">
              Visualize e gerencie todas as transações de cartão do sistema
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <CreditCard className="h-4 w-4" />
                  Total
                </div>
                <p className="text-2xl font-bold">{stats.total_transactions}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  Aprovados
                </div>
                <p className="text-2xl font-bold text-green-600">{stats.total_approved}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <XCircle className="h-4 w-4" />
                  Rejeitados
                </div>
                <p className="text-2xl font-bold text-red-600">{stats.total_rejected}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-yellow-600 text-sm">
                  <Clock className="h-4 w-4" />
                  Pendentes
                </div>
                <p className="text-2xl font-bold text-yellow-600">{stats.total_pending}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <RotateCcw className="h-4 w-4" />
                  Estornados
                </div>
                <p className="text-2xl font-bold">{stats.total_refunded}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <TrendingUp className="h-4 w-4" />
                  Volume Total
                </div>
                <p className="text-xl font-bold text-green-600">
                  R$ {stats.total_amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <TrendingDown className="h-4 w-4" />
                  Taxa Aprovação
                </div>
                <p className="text-2xl font-bold">{stats.approval_rate.toFixed(1)}%</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">Todas Transações</TabsTrigger>
            <TabsTrigger value="errors" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Erros ({errorTransactions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por cliente, email, empresa ou pedido..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="approved">Aprovados</SelectItem>
                      <SelectItem value="rejected">Rejeitados</SelectItem>
                      <SelectItem value="pending">Pendentes</SelectItem>
                      <SelectItem value="refunded">Estornados</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={companyFilter} onValueChange={setCompanyFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as empresas</SelectItem>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Transactions Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Parcelas</TableHead>
                      <TableHead>Bandeira</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Nenhuma transação encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTransactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(transaction.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="max-w-[150px] truncate">{transaction.company_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium truncate max-w-[150px]">{transaction.customer_name || "—"}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                                {transaction.customer_email || "—"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            R$ {transaction.amount.toFixed(2)}
                            {transaction.refund_amount && (
                              <p className="text-xs text-red-500">
                                -R$ {transaction.refund_amount.toFixed(2)}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>{transaction.installments}x</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span>{formatCardBrand(transaction.card_brand)}</span>
                              {transaction.card_last_four && (
                                <span className="text-xs text-muted-foreground">
                                  •••• {transaction.card_last_four}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedTransaction(transaction);
                                  setShowDetailsModal(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {transaction.status === "approved" && transaction.mercadopago_payment_id && !transaction.refunded_at && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => {
                                    setSelectedTransaction(transaction);
                                    setRefundAmount(transaction.amount.toFixed(2));
                                    setShowRefundDialog(true);
                                  }}
                                >
                                  <RotateCcw className="h-4 w-4 mr-1" />
                                  Estornar
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="errors" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Histórico de Erros
                </CardTitle>
                <CardDescription>
                  Transações que falharam ou foram rejeitadas
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Erro</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {errorTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum erro registrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      errorTransactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(transaction.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <span className="max-w-[150px] truncate block">{transaction.company_name}</span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium truncate max-w-[150px]">{transaction.customer_name || "—"}</p>
                              <p className="text-xs text-muted-foreground">{transaction.customer_email || "—"}</p>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            R$ {transaction.amount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-red-600 max-w-[300px] truncate">
                              {transaction.error_message || "Erro desconhecido"}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedTransaction(transaction);
                                setShowDetailsModal(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Refund Dialog */}
        <AlertDialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-red-600" />
                Confirmar Estorno
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-4">
                <p>
                  Você está prestes a estornar uma transação para{" "}
                  <strong>{selectedTransaction?.company_name}</strong>.
                </p>
                <div className="space-y-2">
                  <p className="text-sm">Valor original: R$ {selectedTransaction?.amount.toFixed(2)}</p>
                  <div>
                    <label className="text-sm font-medium">Valor do estorno:</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={selectedTransaction?.amount}
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Esta ação não pode ser desfeita. O valor será devolvido ao cliente final.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={refunding}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRefund}
                disabled={refunding}
                className="bg-red-600 hover:bg-red-700"
              >
                {refunding ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Confirmar Estorno
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Details Modal */}
        <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Detalhes da Transação</DialogTitle>
            </DialogHeader>
            {selectedTransaction && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">ID do Pedido</p>
                    <p className="font-mono text-xs">{selectedTransaction.order_id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Data</p>
                    <p>{format(new Date(selectedTransaction.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Empresa</p>
                    <p className="font-medium">{selectedTransaction.company_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    {getStatusBadge(selectedTransaction.status)}
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cliente</p>
                    <p>{selectedTransaction.customer_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="text-xs">{selectedTransaction.customer_email || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Valor</p>
                    <p className="font-bold text-lg">R$ {selectedTransaction.amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Parcelas</p>
                    <p>{selectedTransaction.installments}x</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Bandeira</p>
                    <p>{formatCardBrand(selectedTransaction.card_brand)} •••• {selectedTransaction.card_last_four}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">ID Mercado Pago</p>
                    <p className="font-mono text-xs">{selectedTransaction.mercadopago_payment_id || "—"}</p>
                  </div>
                </div>
                {selectedTransaction.error_message && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                    <p className="text-sm font-medium text-red-600 mb-1">Mensagem de Erro:</p>
                    <p className="text-sm text-red-700 dark:text-red-400">{selectedTransaction.error_message}</p>
                  </div>
                )}
                {selectedTransaction.refunded_at && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-900">
                    <p className="text-sm font-medium text-yellow-700 mb-1">Estorno Realizado:</p>
                    <p className="text-sm">
                      R$ {selectedTransaction.refund_amount?.toFixed(2)} em{" "}
                      {format(new Date(selectedTransaction.refunded_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

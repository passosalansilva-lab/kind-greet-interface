import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Wallet, 
  Search, 
  Filter, 
  Download, 
  RefreshCw,
  Check,
  X,
  Clock,
  AlertCircle,
  Calendar,
  DollarSign,
  Eye,
  Copy,
  CreditCard,
  QrCode,
  TrendingUp,
  Crown,
} from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface SubscriptionPayment {
  id: string;
  plan_key: string;
  amount: number;
  payment_method: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_reference: string | null;
  paid_at: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
}

interface PaymentStats {
  totalAmount: number;
  totalCount: number;
  approvedAmount: number;
  approvedCount: number;
  pendingCount: number;
  failedCount: number;
  pixAmount: number;
  pixCount: number;
  cardAmount: number;
  cardCount: number;
}

const planLabels: Record<string, string> = {
  free: 'Grátis',
  basic: 'Básico',
  pro: 'Profissional',
  enterprise: 'Empresarial',
};

export default function PaymentTransactions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [stats, setStats] = useState<PaymentStats>({
    totalAmount: 0,
    totalCount: 0,
    approvedAmount: 0,
    approvedCount: 0,
    pendingCount: 0,
    failedCount: 0,
    pixAmount: 0,
    pixCount: 0,
    cardAmount: 0,
    cardCount: 0,
  });
  const [companyId, setCompanyId] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('90');
  
  // Details modal
  const [selectedPayment, setSelectedPayment] = useState<SubscriptionPayment | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadCompany();
    }
  }, [user?.id]);

  useEffect(() => {
    if (companyId) {
      loadPayments();
    }
  }, [companyId, dateRange, statusFilter, paymentTypeFilter]);

  const loadCompany = async () => {
    const { data, error } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_id', user?.id)
      .single();

    if (data) {
      setCompanyId(data.id);
    } else if (error) {
      console.error('Error loading company:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados da empresa.',
        variant: 'destructive',
      });
    }
  };

  const loadPayments = async () => {
    if (!companyId) return;
    
    setLoading(true);
    try {
      const days = parseInt(dateRange);
      const startDate = startOfDay(subDays(new Date(), days)).toISOString();
      
      // Build query manually since table isn't in generated types yet
      let queryBuilder = (supabase as any)
        .from('subscription_payments')
        .select('*')
        .eq('company_id', companyId)
        .gte('created_at', startDate)
        .order('created_at', { ascending: false });

      // Filter by payment type
      if (paymentTypeFilter === 'pix') {
        queryBuilder = queryBuilder.eq('payment_method', 'pix');
      } else if (paymentTypeFilter === 'card') {
        queryBuilder = queryBuilder.eq('payment_method', 'card');
      }

      if (statusFilter !== 'all') {
        queryBuilder = queryBuilder.eq('payment_status', statusFilter);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      
      const txns = (data || []) as SubscriptionPayment[];
      setPayments(txns);
      
      // Calculate stats
      const pixTxns = txns.filter(t => t.payment_method === 'pix');
      const cardTxns = txns.filter(t => t.payment_method === 'card');
      
      setStats({
        totalAmount: txns.reduce((sum, t) => sum + (t.amount || 0), 0),
        totalCount: txns.length,
        approvedAmount: txns.filter(t => t.payment_status === 'paid').reduce((sum, t) => sum + (t.amount || 0), 0),
        approvedCount: txns.filter(t => t.payment_status === 'paid').length,
        pendingCount: txns.filter(t => t.payment_status === 'pending').length,
        failedCount: txns.filter(t => t.payment_status === 'failed').length,
        pixAmount: pixTxns.filter(t => t.payment_status === 'paid').reduce((sum, t) => sum + (t.amount || 0), 0),
        pixCount: pixTxns.length,
        cardAmount: cardTxns.filter(t => t.payment_status === 'paid').reduce((sum, t) => sum + (t.amount || 0), 0),
        cardCount: cardTxns.length,
      });
    } catch (error: any) {
      console.error('Error loading payments:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os pagamentos.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <Check className="w-3 h-3 mr-1" />
            Pago
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            <Clock className="w-3 h-3 mr-1" />
            Pendente
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <X className="w-3 h-3 mr-1" />
            Falhou
          </Badge>
        );
      case 'refunded':
        return (
          <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
            <AlertCircle className="w-3 h-3 mr-1" />
            Estornado
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <AlertCircle className="w-3 h-3 mr-1" />
            {status}
          </Badge>
        );
    }
  };

  const getPaymentMethodBadge = (method: string) => {
    if (method === 'pix') {
      return (
        <Badge variant="outline" className="gap-1">
          <QrCode className="w-3 h-3" />
          PIX
        </Badge>
      );
    }
    if (method === 'card') {
      return (
        <Badge variant="outline" className="gap-1">
          <CreditCard className="w-3 h-3" />
          Cartão
        </Badge>
      );
    }
    return (
      <Badge variant="outline">
        {method || 'Outro'}
      </Badge>
    );
  };

  const getPlanLabel = (planKey: string) => {
    return planLabels[planKey] || planKey;
  };

  const filteredPayments = payments.filter(payment => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      payment.plan_key?.toLowerCase().includes(search) ||
      payment.payment_reference?.toLowerCase().includes(search) ||
      payment.id.toLowerCase().includes(search)
    );
  });

  const exportPayments = () => {
    if (filteredPayments.length === 0) {
      toast({
        title: 'Sem dados',
        description: 'Não há pagamentos para exportar.',
        variant: 'destructive',
      });
      return;
    }

    const csv = [
      ['ID', 'Plano', 'Valor', 'Método', 'Status', 'Referência', 'Data Pagamento', 'Período'].join(','),
      ...filteredPayments.map(p => [
        p.id,
        `"${getPlanLabel(p.plan_key)}"`,
        (p.amount || 0).toFixed(2),
        p.payment_method === 'pix' ? 'PIX' : 'Cartão',
        p.payment_status,
        p.payment_reference || '',
        p.paid_at ? format(new Date(p.paid_at), 'dd/MM/yyyy HH:mm') : '',
        p.period_start && p.period_end 
          ? `${format(new Date(p.period_start), 'dd/MM/yy')} - ${format(new Date(p.period_end), 'dd/MM/yy')}`
          : '',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pagamentos-assinatura-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Exportado!',
      description: 'O arquivo CSV foi baixado com sucesso.',
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado!',
      description: 'ID copiado para a área de transferência.',
    });
  };


  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              <Crown className="h-6 w-6 text-primary" />
              Pagamentos da Assinatura
            </h1>
            <p className="text-muted-foreground">
              Histórico de pagamentos da sua assinatura Cardpon
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadPayments}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={exportPayments}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Pago</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.approvedAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-green-500/10">
                  <TrendingUp className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pagamentos</p>
                  <p className="text-2xl font-bold">{stats.approvedCount}</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.pendingCount} pendentes • {stats.failedCount} falhos
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-500/10">
                  <QrCode className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">PIX</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.pixAmount)}</p>
                  <p className="text-xs text-muted-foreground">{stats.pixCount} pagamentos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-purple-500/10">
                  <CreditCard className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cartão</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.cardAmount)}</p>
                  <p className="text-xs text-muted-foreground">{stats.cardCount} pagamentos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por plano, referência ou ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={paymentTypeFilter} onValueChange={setPaymentTypeFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <Wallet className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pix">
                    <span className="flex items-center gap-2">
                      <QrCode className="h-3 w-3" /> PIX
                    </span>
                  </SelectItem>
                  <SelectItem value="card">
                    <span className="flex items-center gap-2">
                      <CreditCard className="h-3 w-3" /> Cartão
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="paid">Pagos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="failed">Falhos</SelectItem>
                  <SelectItem value="refunded">Estornados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                  <SelectItem value="180">Últimos 6 meses</SelectItem>
                  <SelectItem value="365">Último ano</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Payments Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Pagamentos</CardTitle>
            <CardDescription>
              {filteredPayments.length} pagamento(s) encontrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/4" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                ))}
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-12">
                <Crown className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhum pagamento encontrado</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Os pagamentos da sua assinatura aparecerão aqui
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((payment) => (
                      <TableRow key={payment.id} className="group">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {payment.paid_at 
                                ? format(new Date(payment.paid_at), 'dd/MM/yyyy', { locale: ptBR })
                                : format(new Date(payment.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {payment.paid_at 
                                ? format(new Date(payment.paid_at), 'HH:mm', { locale: ptBR })
                                : format(new Date(payment.created_at), 'HH:mm', { locale: ptBR })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Crown className="h-4 w-4 text-primary" />
                            <span className="font-medium">{getPlanLabel(payment.plan_key)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {payment.period_start && payment.period_end ? (
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(payment.period_start), 'dd/MM/yy')} - {format(new Date(payment.period_end), 'dd/MM/yy')}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{getPaymentMethodBadge(payment.payment_method)}</TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(payment.amount || 0)}
                        </TableCell>
                        <TableCell>{getStatusBadge(payment.payment_status)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedPayment(payment);
                              setShowDetails(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Detalhes do Pagamento
            </DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">ID</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm truncate">{selectedPayment.id.slice(0, 8)}...</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard(selectedPayment.id)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Plano</p>
                  <p className="font-medium">{getPlanLabel(selectedPayment.plan_key)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Valor</p>
                  <p className="text-xl font-bold text-primary">
                    {formatCurrency(selectedPayment.amount || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedPayment.payment_status)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Método</p>
                  <div className="mt-1">{getPaymentMethodBadge(selectedPayment.payment_method)}</div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data do Pagamento</p>
                  <p className="font-medium">
                    {selectedPayment.paid_at 
                      ? format(new Date(selectedPayment.paid_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : '-'}
                  </p>
                </div>
              </div>

              {selectedPayment.period_start && selectedPayment.period_end && (
                <div>
                  <p className="text-sm text-muted-foreground">Período da Assinatura</p>
                  <p className="font-medium">
                    {format(new Date(selectedPayment.period_start), 'dd/MM/yyyy', { locale: ptBR })} - {format(new Date(selectedPayment.period_end), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                </div>
              )}

              {selectedPayment.payment_reference && (
                <div>
                  <p className="text-sm text-muted-foreground">Referência do Pagamento</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm truncate">{selectedPayment.payment_reference}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard(selectedPayment.payment_reference || '')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground text-center">
                  Pagamento processado pela Cardpon
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useUserCompany } from "@/hooks/useUserCompany";
import { useToast } from "@/hooks/use-toast";
import { 
  Clock, 
  ChefHat, 
  CheckCircle, 
  Maximize2, 
  Minimize2,
  RefreshCw,
  Timer,
  Link2,
  Copy,
  Check,
  ExternalLink,
  User,
  FileText,
  Package,
  ArrowRight
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  notes: string | null;
  options: any;
  requires_preparation: boolean;
}

interface KDSOrder {
  id: string;
  created_at: string;
  customer_name: string;
  status: string;
  source: string;
  notes: string | null;
  order_items: OrderItem[];
  table_session_id: string | null;
}

const statusConfig = {
  pending: { label: "Pendente", color: "bg-yellow-500", textColor: "text-yellow-500", bgLight: "bg-yellow-500/10" },
  confirmed: { label: "Confirmado", color: "bg-blue-500", textColor: "text-blue-500", bgLight: "bg-blue-500/10" },
  preparing: { label: "Preparando", color: "bg-orange-500", textColor: "text-orange-500", bgLight: "bg-orange-500/10" },
  ready: { label: "Pronto", color: "bg-green-500", textColor: "text-green-500", bgLight: "bg-green-500/10" },
};

export default function KitchenDisplay() {
  const { company, loading: companyLoading, refetch: refetchCompany } = useUserCompany();
  const { toast } = useToast();
  const [orders, setOrders] = useState<KDSOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Get the KDS link
  const kdsLink = company?.kds_token 
    ? `${window.location.origin}/kds/${company.kds_token}` 
    : null;

  // Update clock every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch orders for kitchen display
  const fetchOrders = async () => {
    if (!company?.id) return;

    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          customer_name,
          status,
          source,
          notes,
          table_session_id,
          order_items (
            id,
            product_name,
            quantity,
            notes,
            options,
            requires_preparation
          )
        `)
        .eq("company_id", company.id)
        .in("status", ["confirmed", "preparing"])
        .order("created_at", { ascending: true });

      if (error) throw error;
      setOrders(data || []);
      
      // Auto-select first order if none selected
      if (data && data.length > 0 && !selectedOrderId) {
        setSelectedOrderId(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching KDS orders:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (company?.id) {
      fetchOrders();
    }
  }, [company?.id]);

  // Real-time subscription
  useEffect(() => {
    if (!company?.id) return;

    const channel = supabase
      .channel("kds-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `company_id=eq.${company.id}`,
        },
        (payload) => {
          console.log("KDS order change:", payload);
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id]);

  // Generate KDS link token
  const generateKdsLink = async () => {
    if (!company?.id) return;
    
    setGeneratingLink(true);
    try {
      const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      
      const { error } = await supabase
        .from("companies")
        .update({ kds_token: token })
        .eq("id", company.id);

      if (error) throw error;

      await refetchCompany();
      
      toast({
        title: "Link gerado!",
        description: "O link do KDS foi gerado com sucesso",
      });
    } catch (error) {
      console.error("Error generating KDS link:", error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar o link",
        variant: "destructive",
      });
    } finally {
      setGeneratingLink(false);
    }
  };

  // Copy link to clipboard
  const copyLink = async () => {
    if (!kdsLink) return;
    
    try {
      await navigator.clipboard.writeText(kdsLink);
      setCopied(true);
      toast({
        title: "Copiado!",
        description: "Link copiado para a área de transferência",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Error copying link:", error);
    }
  };

  // Update order status
  const updateOrderStatus = async (orderId: string, newStatus: "pending" | "confirmed" | "preparing" | "ready" | "awaiting_driver" | "out_for_delivery" | "delivered" | "cancelled") => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: `Pedido marcado como ${statusConfig[newStatus as keyof typeof statusConfig]?.label || newStatus}`,
      });

      // If order is no longer in KDS view, select next order
      if (newStatus === "ready") {
        const remainingOrders = orders.filter(o => o.id !== orderId);
        if (remainingOrders.length > 0) {
          setSelectedOrderId(remainingOrders[0].id);
        } else {
          setSelectedOrderId(null);
        }
      }

      fetchOrders();
    } catch (error) {
      console.error("Error updating order status:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do pedido",
        variant: "destructive",
      });
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Calculate time since order
  const getTimeSince = (createdAt: string) => {
    return formatDistanceToNow(new Date(createdAt), { 
      locale: ptBR, 
      addSuffix: false 
    });
  };

  // Check if order is taking too long (> 15 min)
  const isOrderLate = (createdAt: string) => {
    const orderTime = new Date(createdAt).getTime();
    const now = Date.now();
    const diffMinutes = (now - orderTime) / 1000 / 60;
    return diffMinutes > 15;
  };

  // Format options for display - with grouping
  const formatOptions = (options: any): { groupName: string; items: string[] }[] => {
    if (!options) return [];
    const grouped: Record<string, string[]> = {};
    let hasAnyGroupName = false;

    if (Array.isArray(options)) {
      options.forEach((opt: any) => {
        if (opt.groupName && opt.selectedOptions) {
          hasAnyGroupName = true;
          if (!grouped[opt.groupName]) grouped[opt.groupName] = [];
          opt.selectedOptions.forEach((sel: any) => {
            grouped[opt.groupName].push(sel.name);
          });
        }
        else if (opt.name) {
          const group = opt.groupName || 'Itens';
          if (opt.groupName) hasAnyGroupName = true;
          if (!grouped[group]) grouped[group] = [];
          grouped[group].push(opt.name);
        }
        if (opt.half_half_flavors) {
          hasAnyGroupName = true;
          if (!grouped['Pizza']) grouped['Pizza'] = [];
          grouped['Pizza'].push(`½ ${opt.half_half_flavors.join(" + ½ ")}`);
        }
      });
    }

    const entries = Object.entries(grouped);
    if (!hasAnyGroupName && entries.length === 1 && entries[0][0] === 'Itens') {
      return entries.map(([groupName, items]) => ({ groupName: '', items }));
    }

    return entries.map(([groupName, items]) => ({ groupName, items }));
  };

  const confirmedOrders = orders.filter((o) => o.status === "confirmed");
  const preparingOrders = orders.filter((o) => o.status === "preparing");
  const allQueueOrders = [...confirmedOrders, ...preparingOrders];
  
  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  if (companyLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-120px)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Cozinha (KDS)</h1>
            <p className="text-muted-foreground text-sm">Gerencie os pedidos da cozinha em tempo real</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-5 w-5" />
              <span className="text-lg font-medium">
                {currentTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            
            {/* Link Dialog */}
            <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Link2 className="h-4 w-4 mr-2" />
                  Link para Tablet
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Link do KDS para Tablet</DialogTitle>
                  <DialogDescription>
                    Gere um link único para acessar o KDS em um tablet na cozinha, sem precisar de login.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  {kdsLink ? (
                    <>
                      <div className="flex gap-2">
                        <Input 
                          value={kdsLink} 
                          readOnly 
                          className="font-mono text-sm"
                        />
                        <Button size="icon" variant="outline" onClick={copyLink}>
                          {copied ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => window.open(kdsLink, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Abrir em nova aba
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={generateKdsLink}
                          disabled={generatingLink}
                        >
                          {generatingLink ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            "Gerar novo"
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ⚠️ Ao gerar um novo link, o anterior será invalidado.
                      </p>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground mb-4">
                        Nenhum link gerado ainda. Clique abaixo para criar um.
                      </p>
                      <Button onClick={generateKdsLink} disabled={generatingLink}>
                        {generatingLink ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Link2 className="h-4 w-4 mr-2" />
                        )}
                        Gerar Link
                      </Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="outline" size="sm" onClick={fetchOrders}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={toggleFullscreen}>
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Stats Cards - Compact */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <Card className="py-2">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10">
                  <Clock className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{confirmedOrders.length}</p>
                  <p className="text-xs text-muted-foreground">Aguardando</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="py-2">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-orange-500/10">
                  <ChefHat className="h-4 w-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{preparingOrders.length}</p>
                  <p className="text-xs text-muted-foreground">Preparando</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="py-2">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-green-500/10">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{orders.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="py-2">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-red-500/10">
                  <Timer className="h-4 w-4 text-red-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">
                    {orders.filter((o) => isOrderLate(o.created_at)).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Atrasados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Queue + Details */}
        <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
          {/* Left Side - Order Queue */}
          <div className="col-span-4 flex flex-col min-h-0">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Fila de Pedidos</h2>
              <Badge variant="secondary" className="ml-auto">
                {allQueueOrders.length}
              </Badge>
            </div>
            
            <ScrollArea className="flex-1 pr-2">
              <div className="space-y-2">
                <AnimatePresence>
                  {allQueueOrders.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">Nenhum pedido na fila</p>
                    </div>
                  ) : (
                    allQueueOrders.map((order, index) => (
                      <motion.div
                        key={order.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                      >
                        <Card
                          className={cn(
                            "cursor-pointer transition-all hover:shadow-md border-l-4",
                            selectedOrderId === order.id 
                              ? "ring-2 ring-primary shadow-md" 
                              : "hover:border-primary/50",
                            order.status === "confirmed" 
                              ? "border-l-blue-500" 
                              : "border-l-orange-500",
                            isOrderLate(order.created_at) && "border-l-red-500 bg-red-500/5"
                          )}
                          onClick={() => setSelectedOrderId(order.id)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-sm">
                                    #{order.id.slice(0, 6).toUpperCase()}
                                  </span>
                                  {order.table_session_id && (
                                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                                      Mesa
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground truncate">
                                  {order.customer_name}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge 
                                    variant="secondary"
                                    className={cn(
                                      "text-xs px-1.5 py-0",
                                      statusConfig[order.status as keyof typeof statusConfig]?.bgLight,
                                      statusConfig[order.status as keyof typeof statusConfig]?.textColor
                                    )}
                                  >
                                    {statusConfig[order.status as keyof typeof statusConfig]?.label}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {order.order_items.filter(i => i.requires_preparation).length} itens
                                  </span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs",
                                    isOrderLate(order.created_at)
                                      ? "border-red-500 text-red-500"
                                      : "border-muted-foreground/30"
                                  )}
                                >
                                  <Timer className="h-3 w-3 mr-1" />
                                  {getTimeSince(order.created_at)}
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </div>

          {/* Right Side - Order Details */}
          <div className="col-span-8 flex flex-col min-h-0">
            {selectedOrder ? (
              <motion.div
                key={selectedOrder.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col h-full"
              >
                <Card className="flex-1 flex flex-col">
                  {/* Order Header */}
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-xl">
                            Pedido #{selectedOrder.id.slice(0, 8).toUpperCase()}
                          </CardTitle>
                          <Badge 
                            className={cn(
                              "text-sm",
                              statusConfig[selectedOrder.status as keyof typeof statusConfig]?.bgLight,
                              statusConfig[selectedOrder.status as keyof typeof statusConfig]?.textColor
                            )}
                          >
                            {statusConfig[selectedOrder.status as keyof typeof statusConfig]?.label}
                          </Badge>
                          {selectedOrder.table_session_id && (
                            <Badge variant="outline">Mesa</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {selectedOrder.customer_name}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {getTimeSince(selectedOrder.created_at)} atrás
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-lg px-3 py-1",
                          isOrderLate(selectedOrder.created_at)
                            ? "border-red-500 text-red-500 bg-red-500/10"
                            : "border-muted-foreground/30"
                        )}
                      >
                        <Timer className="h-4 w-4 mr-2" />
                        {getTimeSince(selectedOrder.created_at)}
                      </Badge>
                    </div>
                  </CardHeader>

                  <Separator />

                  {/* Order Items */}
                  <CardContent className="flex-1 overflow-auto py-4">
                    <div className="space-y-4">
                      {selectedOrder.order_items
                        .filter((item) => item.requires_preparation)
                        .map((item, idx) => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="flex gap-4 p-4 rounded-lg bg-muted/50 border"
                          >
                            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary font-bold text-xl shrink-0">
                              {item.quantity}x
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-lg">{item.product_name}</h4>
                              {formatOptions(item.options).map((group, i) => (
                                <div key={i} className="text-sm text-muted-foreground mt-1">
                                  {group.groupName ? (
                                    <>
                                      <span className="font-medium">{group.groupName}:</span>{" "}
                                      {group.items.join(', ')}
                                    </>
                                  ) : (
                                    group.items.map((itemName, idx) => (
                                      <span key={idx} className="inline-block mr-2">
                                        • {itemName}
                                      </span>
                                    ))
                                  )}
                                </div>
                              ))}
                              {item.notes && (
                                <div className="mt-2 p-2 rounded bg-orange-500/10 text-orange-700 dark:text-orange-400 text-sm flex items-start gap-2">
                                  <FileText className="h-4 w-4 shrink-0 mt-0.5" />
                                  {item.notes}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ))}

                      {selectedOrder.order_items.filter(i => i.requires_preparation).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
                          <p>Nenhum item requer preparo</p>
                        </div>
                      )}
                    </div>

                    {selectedOrder.notes && (
                      <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                        <div className="flex items-start gap-2 text-yellow-700 dark:text-yellow-400">
                          <FileText className="h-5 w-5 shrink-0" />
                          <div>
                            <p className="font-medium">Observações do pedido:</p>
                            <p className="text-sm">{selectedOrder.notes}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>

                  <Separator />

                  {/* Action Buttons */}
                  <div className="p-4">
                    {selectedOrder.status === "confirmed" ? (
                      <Button
                        className="w-full h-14 text-lg"
                        onClick={() => updateOrderStatus(selectedOrder.id, "preparing")}
                      >
                        <ChefHat className="h-6 w-6 mr-3" />
                        Iniciar Preparo
                        <ArrowRight className="h-5 w-5 ml-3" />
                      </Button>
                    ) : (
                      <Button
                        className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
                        onClick={() => updateOrderStatus(selectedOrder.id, "ready")}
                      >
                        <CheckCircle className="h-6 w-6 mr-3" />
                        Marcar como Pronto
                        <ArrowRight className="h-5 w-5 ml-3" />
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            ) : (
              <Card className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Package className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg">Selecione um pedido na fila</p>
                  <p className="text-sm">para ver os detalhes e gerenciar</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

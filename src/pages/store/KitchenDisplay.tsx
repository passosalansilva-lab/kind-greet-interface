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
  ExternalLink
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
  pending: { label: "Pendente", color: "bg-yellow-500", textColor: "text-yellow-500" },
  confirmed: { label: "Confirmado", color: "bg-blue-500", textColor: "text-blue-500" },
  preparing: { label: "Preparando", color: "bg-orange-500", textColor: "text-orange-500" },
  ready: { label: "Pronto", color: "bg-green-500", textColor: "text-green-500" },
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
      // Generate a random token
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
        // Formato antigo: { groupName, selectedOptions }
        if (opt.groupName && opt.selectedOptions) {
          hasAnyGroupName = true;
          if (!grouped[opt.groupName]) grouped[opt.groupName] = [];
          opt.selectedOptions.forEach((sel: any) => {
            grouped[opt.groupName].push(sel.name);
          });
        }
        // Formato novo: { name, priceModifier, groupName? }
        else if (opt.name) {
          const group = opt.groupName || 'Itens';
          if (opt.groupName) hasAnyGroupName = true;
          if (!grouped[group]) grouped[group] = [];
          grouped[group].push(opt.name);
        }
        // Pizza meio a meio
        if (opt.half_half_flavors) {
          hasAnyGroupName = true;
          if (!grouped['Pizza']) grouped['Pizza'] = [];
          grouped['Pizza'].push(`½ ${opt.half_half_flavors.join(" + ½ ")}`);
        }
      });
    }

    // Se nenhum item tem groupName, retorna tudo como "Itens"
    const entries = Object.entries(grouped);
    if (!hasAnyGroupName && entries.length === 1 && entries[0][0] === 'Itens') {
      return entries.map(([groupName, items]) => ({ groupName: '', items }));
    }

    return entries.map(([groupName, items]) => ({ groupName, items }));
  };

  const confirmedOrders = orders.filter((o) => o.status === "confirmed");
  const preparingOrders = orders.filter((o) => o.status === "preparing");

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
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Cozinha (KDS)</h1>
            <p className="text-muted-foreground">Visualize e gerencie os pedidos da cozinha em tempo real</p>
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

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{confirmedOrders.length}</p>
                  <p className="text-xs text-muted-foreground">Aguardando</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <ChefHat className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{preparingOrders.length}</p>
                  <p className="text-xs text-muted-foreground">Preparando</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{orders.length}</p>
                  <p className="text-xs text-muted-foreground">Total Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <Timer className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {orders.filter((o) => isOrderLate(o.created_at)).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Atrasados (+15min)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Orders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Confirmed / Waiting */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Aguardando Preparo ({confirmedOrders.length})
            </h2>
            <ScrollArea className="h-[calc(100vh-380px)]">
              <div className="space-y-4 pr-4">
                <AnimatePresence>
                  {confirmedOrders.map((order) => (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card
                        className={cn(
                          "border-l-4 border-l-blue-500",
                          isOrderLate(order.created_at) && "border-l-red-500 bg-red-500/5"
                        )}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base flex items-center gap-2">
                                #{order.id.slice(0, 8).toUpperCase()}
                                {order.table_session_id && (
                                  <Badge variant="outline">Mesa</Badge>
                                )}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground">
                                {order.customer_name}
                              </p>
                            </div>
                            <div className="text-right">
                              <Badge
                                variant="outline"
                                className={cn(
                                  isOrderLate(order.created_at)
                                    ? "border-red-500 text-red-500"
                                    : "border-blue-500 text-blue-500"
                                )}
                              >
                                <Timer className="h-3 w-3 mr-1" />
                                {getTimeSince(order.created_at)}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {/* Items */}
                          <div className="space-y-2">
                            {order.order_items
                              .filter((item) => item.requires_preparation)
                              .map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-start gap-2 text-sm"
                                >
                                  <span className="font-bold text-primary">
                                    {item.quantity}x
                                  </span>
                                  <div className="flex-1">
                                    <p className="font-medium">{item.product_name}</p>
                                    {formatOptions(item.options).map((group, i) => (
                                      <div key={i} className="text-xs text-muted-foreground">
                                        {group.groupName ? (
                                          <><span className="font-medium">{group.groupName}:</span> {group.items.join(', ')}</>
                                        ) : (
                                          group.items.map((itemName, idx) => (
                                            <span key={idx}>• {itemName}{idx < group.items.length - 1 ? ' ' : ''}</span>
                                          ))
                                        )}
                                      </div>
                                    ))}
                                    {item.notes && (
                                      <p className="text-xs text-orange-600 font-medium">
                                        📝 {item.notes}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>

                          {order.notes && (
                            <div className="p-2 bg-yellow-500/10 rounded-lg">
                              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                                📝 Obs: {order.notes}
                              </p>
                            </div>
                          )}

                          <Button
                            className="w-full"
                            onClick={() => updateOrderStatus(order.id, "preparing")}
                          >
                            <ChefHat className="h-4 w-4 mr-2" />
                            Iniciar Preparo
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {confirmedOrders.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>Nenhum pedido aguardando</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Preparing */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-orange-500" />
              Em Preparo ({preparingOrders.length})
            </h2>
            <ScrollArea className="h-[calc(100vh-380px)]">
              <div className="space-y-4 pr-4">
                <AnimatePresence>
                  {preparingOrders.map((order) => (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 100 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card
                        className={cn(
                          "border-l-4 border-l-orange-500",
                          isOrderLate(order.created_at) && "border-l-red-500 bg-red-500/5"
                        )}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base flex items-center gap-2">
                                #{order.id.slice(0, 8).toUpperCase()}
                                {order.table_session_id && (
                                  <Badge variant="outline">Mesa</Badge>
                                )}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground">
                                {order.customer_name}
                              </p>
                            </div>
                            <div className="text-right">
                              <Badge
                                variant="outline"
                                className={cn(
                                  isOrderLate(order.created_at)
                                    ? "border-red-500 text-red-500"
                                    : "border-orange-500 text-orange-500"
                                )}
                              >
                                <Timer className="h-3 w-3 mr-1" />
                                {getTimeSince(order.created_at)}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {/* Items */}
                          <div className="space-y-2">
                            {order.order_items
                              .filter((item) => item.requires_preparation)
                              .map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-start gap-2 text-sm"
                                >
                                  <span className="font-bold text-primary">
                                    {item.quantity}x
                                  </span>
                                  <div className="flex-1">
                                    <p className="font-medium">{item.product_name}</p>
                                    {formatOptions(item.options).map((group, i) => (
                                      <div key={i} className="text-xs text-muted-foreground">
                                        {group.groupName ? (
                                          <><span className="font-medium">{group.groupName}:</span> {group.items.join(', ')}</>
                                        ) : (
                                          group.items.map((itemName, idx) => (
                                            <span key={idx}>• {itemName}{idx < group.items.length - 1 ? ' ' : ''}</span>
                                          ))
                                        )}
                                      </div>
                                    ))}
                                    {item.notes && (
                                      <p className="text-xs text-orange-600 font-medium">
                                        📝 {item.notes}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>

                          {order.notes && (
                            <div className="p-2 bg-yellow-500/10 rounded-lg">
                              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                                📝 Obs: {order.notes}
                              </p>
                            </div>
                          )}

                          <Button
                            className="w-full bg-green-600 hover:bg-green-700"
                            onClick={() => updateOrderStatus(order.id, "ready")}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Marcar como Pronto
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {preparingOrders.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <ChefHat className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>Nenhum pedido em preparo</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

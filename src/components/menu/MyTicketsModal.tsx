import { useState, useEffect } from 'react';
import { Ticket, Trophy, Loader2, Gift, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MyTicketsModalProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  companyId: string;
}

interface LotterySettings {
  is_enabled: boolean;
  prize_description: string | null;
  draw_frequency: string;
  tickets_per_order: number;
  tickets_per_amount: number;
}

interface LastDraw {
  winner_name: string | null;
  prize_description: string;
  drawn_at: string;
}

interface TicketHistory {
  id: string;
  quantity: number;
  created_at: string;
  is_used: boolean;
}

export function MyTicketsModal({ open, onClose, customerId, companyId }: MyTicketsModalProps) {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<LotterySettings | null>(null);
  const [ticketCount, setTicketCount] = useState(0);
  const [lastDraw, setLastDraw] = useState<LastDraw | null>(null);
  const [ticketHistory, setTicketHistory] = useState<TicketHistory[]>([]);

  useEffect(() => {
    if (open && customerId && companyId) {
      loadData();
    }
  }, [open, customerId, companyId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // First check if the lottery FEATURE is enabled for this company (super admin control)
      const { data: featureData } = await supabase
        .from('company_features' as any)
        .select('is_active')
        .eq('company_id', companyId)
        .eq('feature_key', 'lottery')
        .maybeSingle() as { data: { is_active: boolean } | null };

      // If feature is explicitly disabled by super admin, don't show anything
      if (featureData && !featureData.is_active) {
        setLoading(false);
        return;
      }

      // Then check lottery settings (store-level control)
      const { data: settingsData, error: settingsError } = await supabase
        .from('lottery_settings')
        .select('is_enabled, prize_description, draw_frequency, tickets_per_order, tickets_per_amount')
        .eq('company_id', companyId)
        .eq('is_enabled', true)
        .maybeSingle();

      if (settingsError) throw settingsError;
      if (!settingsData) {
        setLoading(false);
        return;
      }

      setSettings(settingsData);

      // Get customer's tickets
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('lottery_tickets')
        .select('id, quantity, created_at, is_used')
        .eq('company_id', companyId)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (ticketsError) throw ticketsError;

      setTicketHistory(ticketsData || []);
      const total = (ticketsData || [])
        .filter(t => !t.is_used)
        .reduce((sum, t) => sum + t.quantity, 0);
      setTicketCount(total);

      // Get last draw
      const { data: drawData, error: drawError } = await supabase
        .from('lottery_draws')
        .select('winner_name, prize_description, drawn_at')
        .eq('company_id', companyId)
        .order('drawn_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!drawError && drawData) {
        setLastDraw(drawData);
      }

    } catch (error) {
      console.error('Error loading lottery data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'weekly': return 'semanal';
      case 'biweekly': return 'quinzenal';
      case 'monthly': return 'mensal';
      default: return freq;
    }
  };

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Ticket className="h-5 w-5 text-amber-600" />
              </div>
              <DrawerTitle className="text-lg">Meus Tickets de Sorteio</DrawerTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DrawerHeader>

        <div className="p-4 space-y-4 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            </div>
          ) : !settings?.is_enabled ? (
            <div className="text-center py-8 text-muted-foreground">
              <Gift className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum sorteio ativo no momento</p>
            </div>
          ) : (
            <>
              {/* Total Tickets */}
              <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl p-5 border border-amber-500/20 text-center">
                <div className="text-4xl font-bold text-amber-600 mb-1">{ticketCount}</div>
                <div className="text-sm text-muted-foreground">
                  {ticketCount === 1 ? 'ticket disponível' : 'tickets disponíveis'}
                </div>
                <Badge variant="secondary" className="mt-3 bg-amber-500/20 text-amber-700 dark:text-amber-400">
                  Sorteio {getFrequencyLabel(settings.draw_frequency)}
                </Badge>
              </div>

              {/* Prize */}
              {settings.prize_description && (
                <div className="bg-card rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Gift className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Prêmio atual</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{settings.prize_description}</p>
                </div>
              )}

              {/* How it works */}
              <div className="bg-secondary/50 rounded-xl p-4 border border-border">
                <h4 className="font-medium text-sm mb-2">Como funciona?</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {settings.tickets_per_order > 0 && (
                    <li>• Cada pedido entregue = {settings.tickets_per_order} {settings.tickets_per_order === 1 ? 'ticket' : 'tickets'}</li>
                  )}
                  {settings.tickets_per_amount > 0 && (
                    <li>• +1 ticket a cada R$ {settings.tickets_per_amount.toFixed(0)} em pedidos</li>
                  )}
                  <li>• Seus tickets são acumulados até o próximo sorteio</li>
                </ul>
              </div>

              {/* Last Draw */}
              {lastDraw && (
                <div className="bg-card rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    <span className="font-medium text-sm">Último ganhador</span>
                  </div>
                  <p className="text-sm">
                    <span className="font-medium">{lastDraw.winner_name}</span>
                    <span className="text-muted-foreground"> em {format(new Date(lastDraw.drawn_at), "dd 'de' MMMM", { locale: ptBR })}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Prêmio: {lastDraw.prize_description}
                  </p>
                </div>
              )}

              {/* Recent Tickets */}
              {ticketHistory.length > 0 && (
                <div className="bg-card rounded-xl p-4 border border-border">
                  <h4 className="font-medium text-sm mb-3">Histórico de tickets</h4>
                  <div className="space-y-2">
                    {ticketHistory.slice(0, 5).map((ticket) => (
                      <div key={ticket.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {format(new Date(ticket.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={ticket.is_used ? 'outline' : 'secondary'}
                            className={ticket.is_used ? 'opacity-50' : 'bg-amber-500/20 text-amber-700 dark:text-amber-400'}
                          >
                            +{ticket.quantity} {ticket.quantity === 1 ? 'ticket' : 'tickets'}
                          </Badge>
                          {ticket.is_used && (
                            <span className="text-xs text-muted-foreground">(usado)</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

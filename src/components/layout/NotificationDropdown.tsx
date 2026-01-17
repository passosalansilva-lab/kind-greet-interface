import { useState, useEffect } from 'react';
import { Bell, Check, Loader2, Package, Trash2, ExternalLink } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  data: any;
}

// Helper to determine navigation route based on notification type and data
function getNotificationRoute(notification: Notification): string | null {
  const { type, data } = notification;
  
  // Check for explicit link in data first (used by portal posts, etc.)
  if (data?.link && typeof data.link === 'string') {
    return data.link;
  }
  
  // Check for specific data fields
  if (data?.order_id) {
    return '/dashboard/orders';
  }
  if (data?.review_id) {
    return '/dashboard/reviews';
  }
  if (data?.driver_id) {
    return '/dashboard/drivers';
  }
  if (data?.product_id) {
    return '/dashboard/menu';
  }
  if (data?.coupon_id) {
    return '/dashboard/coupons';
  }
  if (data?.table_id) {
    return '/dashboard/tables';
  }
  
  // Fallback to type-based routing
  switch (type) {
    case 'order':
    case 'new_order':
      return '/dashboard/orders';
    case 'review':
      return '/dashboard/reviews';
    case 'payment':
    case 'subscription':
      return '/dashboard/plans';
    case 'driver':
      return '/dashboard/drivers';
    case 'inventory':
      return '/dashboard/inventory';
    case 'promotion':
      return '/dashboard/promotions';
    default:
      return null;
  }
}

export function NotificationDropdown() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const { playSound: playNewOrderSound } = useNotificationSound('new_order');

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    await markAsRead(notification.id);
    
    // Navigate to the appropriate route
    const route = getNotificationRoute(notification);
    if (route) {
      setOpen(false);
      navigate(route);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    if (user) {
      loadNotifications();
      loadPendingOrdersCount();
      
      // Subscribe to realtime notifications
      const notificationsChannel = supabase
        .channel('notifications-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setNotifications(prev => [payload.new as Notification, ...prev]);
          }
        )
        .subscribe();

      // Subscribe to orders for pending count (for store owners)
      const ordersChannel = supabase
        .channel('orders-pending-count')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
          },
          () => {
            // Apenas atualiza o contador, sem tocar som adicional
            loadPendingOrdersCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(notificationsChannel);
        supabase.removeChannel(ordersChannel);
      };
    }
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingOrdersCount = async () => {
    if (!user) return;
    
    try {
      // Get user's company
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();
      
      if (!company) return;

      // Count pending orders
      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id)
        .eq('status', 'pending');

      if (!error && count !== null) {
        setPendingOrdersCount(count);
      }
    } catch (error) {
      console.error('Error loading pending orders count:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const clearAllNotifications = async () => {
    if (!user) return;

    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id);

      // Esconde da lista atual, mas mantém histórico no banco
      setNotifications([]);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'warning':
        return 'bg-warning text-warning-foreground';
      case 'error':
        return 'bg-destructive text-destructive-foreground';
      case 'success':
        return 'bg-success text-success-foreground';
      default:
        return 'bg-primary text-primary-foreground';
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2">
          <h4 className="font-semibold text-sm">Notificações</h4>
          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto py-1 px-2 text-xs"
                onClick={clearAllNotifications}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            )}
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto py-1 px-2 text-xs"
                onClick={markAllAsRead}
              >
                <Check className="h-3 w-3 mr-1" />
                Marcar todas como lidas
              </Button>
            )}
          </div>
        </div>
        <DropdownMenuSeparator />
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma notificação
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`flex flex-col items-start gap-1 p-3 cursor-pointer ${
                  !notification.is_read ? 'bg-accent/50' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-2 w-full">
                  <Badge className={`${getTypeColor(notification.type)} text-[10px] px-1.5 py-0 shrink-0`}>
                    {notification.type === 'warning' ? 'Aviso' : 
                     notification.type === 'error' ? 'Erro' :
                     notification.type === 'success' ? 'Sucesso' : 'Info'}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{notification.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <span className="w-2 h-2 bg-primary rounded-full shrink-0 mt-1" />
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </ScrollArea>
        )}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="justify-center">
          <Link to="/dashboard/notifications" className="w-full text-center text-sm text-primary hover:text-primary">
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Ver todas as notificações
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
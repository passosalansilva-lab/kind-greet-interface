import React, { useState, useCallback, useMemo } from 'react';
import {
  Package,
  MapPin,
  Navigation,
  Check,
  X,
  Route,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Play,
  CheckCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import MultiDeliveryRouteMap from './MultiDeliveryRouteMap';

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  total: number;
  delivery_fee: number;
  payment_method: string;
  queue_position: number | null;
  delivery_address: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    complement: string | null;
    reference: string | null;
    zip_code: string;
  } | null;
  company: {
    name: string;
    address: string | null;
  };
}

interface MultiDeliveryModeProps {
  orders: Order[];
  driverId: string;
  onStartMultiDelivery: (orderIds: string[]) => void;
  onCompleteDelivery: (orderId: string) => void;
  updatingOrder: string | null;
}

export default function MultiDeliveryMode({
  orders,
  driverId,
  onStartMultiDelivery,
  onCompleteDelivery,
  updatingOrder,
}: MultiDeliveryModeProps) {
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isMultiMode, setIsMultiMode] = useState(false);
  const [showRouteMap, setShowRouteMap] = useState(false);
  const [routeOrders, setRouteOrders] = useState<Order[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [routeExpanded, setRouteExpanded] = useState(false);
  const [currentDeliveryIndex, setCurrentDeliveryIndex] = useState(0);

  // Filter orders that can be selected (ready or awaiting_driver, not yet in delivery)
  const selectableOrders = useMemo(
    () => orders.filter((o) => ['ready', 'awaiting_driver'].includes(o.status)),
    [orders]
  );

  // Orders that are currently out for delivery
  const inDeliveryOrders = useMemo(
    () => orders.filter((o) => o.status === 'out_for_delivery'),
    [orders]
  );

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const selectAll = () => {
    setSelectedOrders(selectableOrders.map((o) => o.id));
  };

  const clearSelection = () => {
    setSelectedOrders([]);
  };

  // Optimize route using nearest neighbor algorithm
  const optimizeRoute = useCallback(
    async (orderIds: string[]) => {
      setIsOptimizing(true);
      try {
        // Get current driver location
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
        });

        const driverLat = position.coords.latitude;
        const driverLng = position.coords.longitude;

        // Get selected orders
        const selectedOrdersList = orders.filter((o) => orderIds.includes(o.id));

        // Geocode all addresses
        const { data: tokenData } = await supabase.functions.invoke('get-mapbox-token');
        const token = tokenData?.token;

        if (!token) {
          throw new Error('Token do mapa não disponível');
        }

        const geocodedOrders = await Promise.all(
          selectedOrdersList.map(async (order) => {
            if (!order.delivery_address) return { order, coords: null };

            const addr = order.delivery_address;
            const addressStr = `${addr.street}, ${addr.number}, ${addr.neighborhood}, ${addr.city}, ${addr.state || ''}, Brazil`;
            const encodedAddress = encodeURIComponent(addressStr);

            const response = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${token}&country=BR&limit=1`
            );
            const data = await response.json();

            if (data.features && data.features.length > 0) {
              const [lng, lat] = data.features[0].center;
              return { order, coords: { lat, lng } };
            }
            return { order, coords: null };
          })
        );

        // Filter orders with valid coordinates
        const validOrders = geocodedOrders.filter((o) => o.coords !== null);

        // Nearest neighbor algorithm starting from driver location
        const optimizedRoute: typeof validOrders = [];
        const remaining = [...validOrders];
        let currentLat = driverLat;
        let currentLng = driverLng;

        while (remaining.length > 0) {
          let nearestIndex = 0;
          let nearestDistance = Infinity;

          remaining.forEach((item, index) => {
            if (item.coords) {
              const distance = Math.sqrt(
                Math.pow(item.coords.lat - currentLat, 2) + Math.pow(item.coords.lng - currentLng, 2)
              );
              if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = index;
              }
            }
          });

          const nearest = remaining.splice(nearestIndex, 1)[0];
          optimizedRoute.push(nearest);
          if (nearest.coords) {
            currentLat = nearest.coords.lat;
            currentLng = nearest.coords.lng;
          }
        }

        setRouteOrders(optimizedRoute.map((o) => o.order));
        setShowRouteMap(true);
        setCurrentDeliveryIndex(0);
        toast.success(`Rota otimizada com ${optimizedRoute.length} entregas!`);
      } catch (error: any) {
        console.error('Error optimizing route:', error);
        // Fallback: just use the selected order without optimization
        const selectedOrdersList = orders.filter((o) => orderIds.includes(o.id));
        setRouteOrders(selectedOrdersList);
        setShowRouteMap(true);
        setCurrentDeliveryIndex(0);
        toast.warning('Rota criada sem otimização de distância');
      } finally {
        setIsOptimizing(false);
      }
    },
    [orders]
  );

  const handleStartMultiDelivery = async () => {
    if (selectedOrders.length === 0) {
      toast.error('Selecione pelo menos uma entrega');
      return;
    }

    await optimizeRoute(selectedOrders);
    onStartMultiDelivery(selectedOrders);
    setIsMultiMode(false);
    setSelectedOrders([]);
  };

  const moveOrderUp = (index: number) => {
    if (index === 0) return;
    const newRoute = [...routeOrders];
    [newRoute[index - 1], newRoute[index]] = [newRoute[index], newRoute[index - 1]];
    setRouteOrders(newRoute);
  };

  const moveOrderDown = (index: number) => {
    if (index === routeOrders.length - 1) return;
    const newRoute = [...routeOrders];
    [newRoute[index], newRoute[index + 1]] = [newRoute[index + 1], newRoute[index]];
    setRouteOrders(newRoute);
  };

  const handleCompleteCurrentDelivery = async () => {
    if (routeOrders.length === 0) return;
    
    const currentOrder = routeOrders[currentDeliveryIndex];
    await onCompleteDelivery(currentOrder.id);
    
    if (currentDeliveryIndex < routeOrders.length - 1) {
      setCurrentDeliveryIndex((prev) => prev + 1);
      toast.success('Entrega concluída! Próximo destino carregado.');
    } else {
      toast.success('Todas as entregas concluídas!');
      setShowRouteMap(false);
      setRouteOrders([]);
      setCurrentDeliveryIndex(0);
    }
  };

  // If multi-delivery route is active
  if (showRouteMap && routeOrders.length > 0) {
    const currentOrder = routeOrders[currentDeliveryIndex];
    
    return (
      <div className="space-y-4">
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Route className="h-5 w-5 text-primary" />
              Rota Multi-Entregas
              <Badge variant="secondary" className="ml-auto">
                {currentDeliveryIndex + 1} de {routeOrders.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current delivery highlight */}
            <div className="p-4 bg-primary/10 rounded-lg border-2 border-primary">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="default" className="text-xs">
                  Entrega Atual
                </Badge>
                <span className="font-bold text-primary">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    currentOrder.total
                  )}
                </span>
              </div>
              <p className="font-semibold text-lg">{currentOrder.customer_name}</p>
              {currentOrder.delivery_address && (
                <div className="flex items-start gap-2 mt-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    {currentOrder.delivery_address.street}, {currentOrder.delivery_address.number} -{' '}
                    {currentOrder.delivery_address.neighborhood}
                  </span>
                </div>
              )}
            </div>

            {/* Route map */}
            {currentOrder.delivery_address && (
              <MultiDeliveryRouteMap
                orders={routeOrders}
                currentIndex={currentDeliveryIndex}
              />
            )}

            {/* Route list */}
            <Collapsible open={routeExpanded} onOpenChange={setRouteExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Ver todas as entregas na rota
                  </span>
                  {routeExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {routeOrders.map((order, index) => (
                  <div
                    key={order.id}
                    className={`p-3 rounded-lg border flex items-center gap-3 ${
                      index === currentDeliveryIndex
                        ? 'bg-primary/10 border-primary'
                        : index < currentDeliveryIndex
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-muted/50'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-sm">
                      {index < currentDeliveryIndex ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{order.customer_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {order.delivery_address?.neighborhood}
                      </p>
                    </div>
                    {index === currentDeliveryIndex && (
                      <Badge variant="default" className="flex-shrink-0">
                        Atual
                      </Badge>
                    )}
                    {index < currentDeliveryIndex && (
                      <Badge variant="outline" className="flex-shrink-0 text-green-600 border-green-500">
                        <Check className="h-3 w-3 mr-1" />
                        Entregue
                      </Badge>
                    )}
                    {index > currentDeliveryIndex && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveOrderUp(index)}
                          disabled={index === currentDeliveryIndex + 1}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveOrderDown(index)}
                          disabled={index === routeOrders.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                className="flex-1"
                size="lg"
                onClick={handleCompleteCurrentDelivery}
                disabled={updatingOrder === currentOrder.id}
              >
                {updatingOrder === currentOrder.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Concluir Entrega {currentDeliveryIndex + 1}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  const addr = currentOrder.delivery_address!;
                  const address = `${addr.street}, ${addr.number}, ${addr.neighborhood}, ${addr.city}, ${addr.state}`;
                  window.open(
                    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`,
                    '_blank'
                  );
                }}
              >
                <Navigation className="h-4 w-4" />
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => {
                setShowRouteMap(false);
                setRouteOrders([]);
                setCurrentDeliveryIndex(0);
              }}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar Modo Multi-Entregas
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Selection mode
  if (isMultiMode) {
    return (
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Route className="h-5 w-5 text-primary" />
              Selecione as Entregas
            </span>
            <Button variant="ghost" size="sm" onClick={() => setIsMultiMode(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              Selecionar Todas
            </Button>
            <Button variant="outline" size="sm" onClick={clearSelection}>
              Limpar
            </Button>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {selectableOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma entrega disponível para seleção
              </p>
            ) : (
              selectableOrders.map((order) => (
                <div
                  key={order.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedOrders.includes(order.id)
                      ? 'bg-primary/10 border-primary'
                      : 'bg-muted/50 hover:bg-muted'
                  }`}
                  onClick={() => toggleOrderSelection(order.id)}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedOrders.includes(order.id)}
                      onCheckedChange={() => toggleOrderSelection(order.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{order.customer_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {order.delivery_address?.neighborhood} - {order.delivery_address?.city}
                      </p>
                    </div>
                    <span className="font-semibold text-primary">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        order.total
                      )}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedOrders.length > 0 && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">
                  {selectedOrders.length} entrega(s) selecionada(s)
                </span>
                <span className="font-bold text-primary">
                  Total:{' '}
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    orders
                      .filter((o) => selectedOrders.includes(o.id))
                      .reduce((sum, o) => sum + o.total, 0)
                  )}
                </span>
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={handleStartMultiDelivery}
                disabled={isOptimizing}
              >
                {isOptimizing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Otimizando rota...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Iniciar com Rota Otimizada
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Default: Button to enter multi-delivery mode
  if (selectableOrders.length >= 2) {
    return (
      <Button
        variant="outline"
        className="w-full border-primary/30 text-primary hover:bg-primary/10"
        onClick={() => setIsMultiMode(true)}
      >
        <Route className="h-4 w-4 mr-2" />
        Modo Multi-Entregas ({selectableOrders.length} disponíveis)
      </Button>
    );
  }

  return null;
}

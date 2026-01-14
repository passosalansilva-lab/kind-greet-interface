import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, MapPin, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Order {
  id: string;
  customer_name: string;
  delivery_address: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
  } | null;
}

interface MultiDeliveryRouteMapProps {
  orders: Order[];
  currentIndex: number;
}

const MultiDeliveryRouteMap: React.FC<MultiDeliveryRouteMapProps> = ({
  orders,
  currentIndex,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const mapInitialized = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [destinations, setDestinations] = useState<{ order: Order; coords: { lat: number; lng: number } }[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        if (data?.token) {
          setMapboxToken(data.token);
        } else {
          setError('Token do mapa não disponível');
        }
      } catch (err) {
        console.error('Error fetching Mapbox token:', err);
        setError('Erro ao carregar mapa');
      }
    };
    fetchToken();
  }, []);

  // Get driver location
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDriverLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (err) => {
        console.error('Geolocation error:', err);
        setError('Não foi possível obter sua localização');
      },
      { enableHighAccuracy: true }
    );
  }, []);

  // Geocode all addresses
  useEffect(() => {
    if (!mapboxToken || !orders.length) return;

    const geocodeAddresses = async () => {
      const results = await Promise.all(
        orders.map(async (order) => {
          if (!order.delivery_address) return null;

          const addr = order.delivery_address;
          const addressStr = `${addr.street}, ${addr.number}, ${addr.neighborhood}, ${addr.city}, ${addr.state || ''}, Brazil`;
          const encodedAddress = encodeURIComponent(addressStr);

          try {
            const response = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&country=BR&limit=1`
            );
            const data = await response.json();

            if (data.features && data.features.length > 0) {
              const [lng, lat] = data.features[0].center;
              return { order, coords: { lat, lng } };
            }
          } catch (err) {
            console.error('Geocoding error:', err);
          }
          return null;
        })
      );

      setDestinations(results.filter((r): r is NonNullable<typeof r> => r !== null));
    };

    geocodeAddresses();
  }, [mapboxToken, orders]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || !driverLocation || destinations.length === 0 || mapInitialized.current) return;

    mapboxgl.accessToken = mapboxToken;
    mapInitialized.current = true;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/navigation-night-v1',
      zoom: 12,
      center: [driverLocation.lng, driverLocation.lat],
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      setLoading(false);

      // Add driver marker
      const driverEl = document.createElement('div');
      driverEl.innerHTML = `
        <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
          </svg>
        </div>
      `;
      new mapboxgl.Marker(driverEl)
        .setLngLat([driverLocation.lng, driverLocation.lat])
        .addTo(map.current!);

      // Add destination markers
      destinations.forEach((dest, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;

        const markerEl = document.createElement('div');
        markerEl.innerHTML = `
          <div class="relative">
            <div class="w-8 h-8 ${
              isCompleted
                ? 'bg-green-500'
                : isCurrent
                ? 'bg-red-500 animate-pulse'
                : 'bg-gray-500'
            } rounded-full flex items-center justify-center shadow-lg border-2 border-white">
              <span class="text-white font-bold text-sm">${index + 1}</span>
            </div>
            ${isCurrent ? '<div class="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-ping"></div>' : ''}
          </div>
        `;
        const marker = new mapboxgl.Marker(markerEl)
          .setLngLat([dest.coords.lng, dest.coords.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(
              `<div class="p-2">
                <p class="font-bold text-sm">${index + 1}. ${dest.order.customer_name}</p>
                <p class="text-xs text-gray-600">${dest.order.delivery_address?.neighborhood || ''}</p>
              </div>`
            )
          )
          .addTo(map.current!);
        
        markersRef.current.push(marker);
      });

      // Draw route line through all points
      const coordinates: [number, number][] = [
        [driverLocation.lng, driverLocation.lat],
        ...destinations.map((d) => [d.coords.lng, d.coords.lat] as [number, number]),
      ];

      fetchFullRoute(coordinates);

      // Fit bounds to show all points
      const bounds = new mapboxgl.LngLatBounds();
      coordinates.forEach((coord) => bounds.extend(coord as mapboxgl.LngLatLike));
      map.current!.fitBounds(bounds, { padding: 50, duration: 1000 });
    });

    return () => {
      map.current?.remove();
      mapInitialized.current = false;
      markersRef.current = [];
    };
  }, [mapboxToken, driverLocation, destinations]);

  // Update markers when currentIndex changes
  useEffect(() => {
    if (!map.current || !mapInitialized.current) return;

    markersRef.current.forEach((marker, index) => {
      const isCompleted = index < currentIndex;
      const isCurrent = index === currentIndex;

      const el = marker.getElement();
      el.innerHTML = `
        <div class="relative">
          <div class="w-8 h-8 ${
            isCompleted
              ? 'bg-green-500'
              : isCurrent
              ? 'bg-red-500 animate-pulse'
              : 'bg-gray-500'
          } rounded-full flex items-center justify-center shadow-lg border-2 border-white">
            <span class="text-white font-bold text-sm">${index + 1}</span>
          </div>
          ${isCurrent ? '<div class="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-ping"></div>' : ''}
        </div>
      `;
    });

    // Center on current destination
    if (destinations[currentIndex]) {
      map.current.flyTo({
        center: [destinations[currentIndex].coords.lng, destinations[currentIndex].coords.lat],
        zoom: 14,
        duration: 1000,
      });
    }
  }, [currentIndex, destinations]);

  const fetchFullRoute = async (coordinates: [number, number][]) => {
    if (!mapboxToken || !map.current) return;

    try {
      // Build waypoints string for routing API
      const waypointsStr = coordinates.map((c) => `${c[0]},${c[1]}`).join(';');

      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${waypointsStr}?geometries=geojson&access_token=${mapboxToken}`
      );
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const routeGeometry = data.routes[0].geometry;

        map.current!.addLayer({
          id: 'route',
          type: 'line',
          source: {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: routeGeometry,
            },
          },
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#3b82f6',
            'line-width': 5,
            'line-opacity': 0.8,
          },
        });
      }
    } catch (err) {
      console.error('Error fetching route:', err);
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    setTimeout(() => {
      map.current?.resize();
    }, 100);
  };

  if (error) {
    return (
      <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <MapPin className="h-6 w-6 mx-auto mb-2" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-lg overflow-hidden border border-border transition-all duration-300 ${
        isExpanded ? 'fixed inset-4 z-50 h-auto' : 'w-full h-48'
      }`}
    >
      {isExpanded && <div className="fixed inset-0 bg-black/50 -z-10" onClick={toggleExpanded} />}

      {(loading || !driverLocation || destinations.length === 0) && (
        <div className="absolute inset-0 bg-muted flex items-center justify-center z-10">
          <div className="text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
            <p className="text-xs text-muted-foreground mt-2">Carregando mapa...</p>
          </div>
        </div>
      )}

      <div ref={mapContainer} className="absolute inset-0" />

      {/* Route info overlay */}
      <div className="absolute top-2 left-2 bg-background/95 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-lg">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{destinations.length} paradas</span>
          <span className="text-muted-foreground">•</span>
          <span className="text-primary font-medium">
            {currentIndex + 1}ª atual
          </span>
        </div>
      </div>

      {/* Expand button */}
      <Button
        size="icon"
        variant="secondary"
        className="absolute top-2 right-2 h-8 w-8 shadow-lg"
        onClick={toggleExpanded}
      >
        {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </Button>
    </div>
  );
};

export default MultiDeliveryRouteMap;

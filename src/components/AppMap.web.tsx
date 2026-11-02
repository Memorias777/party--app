import React, { useEffect, useId, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { C } from '../constants/design';

const createPortal: (children: React.ReactNode, container: Element) => React.ReactPortal | null =
  typeof window !== 'undefined' ? require('react-dom').createPortal : () => null;

// -----------------------------------------------------------------------
// Mapa Web Interactivo Real (Leaflet + CartoDB Dark Matter).
// Renderiza los componentes <Marker> de React Native (con sus logos, colores
// y badges) directamente sobre sus coordenadas reales en el mapa.
// -----------------------------------------------------------------------

let leafletPromise: Promise<any> | null = null;

function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve) => {
    if (!document.getElementById('leaflet-css-cdn')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css-cdn';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!document.getElementById('leaflet-custom-dark-css')) {
      const style = document.createElement('style');
      style.id = 'leaflet-custom-dark-css';
      style.innerHTML = `
        .leaflet-container {
          background: #0B0B10 !important;
          font-family: system-ui, -apple-system, sans-serif;
        }
        /* Modo oscuro nativo sobre las calles del mapa (sin afectar los pines ni logos) */
        .leaflet-tile-pane {
          filter: invert(100%) hue-rotate(180deg) brightness(88%) contrast(92%) saturate(75%);
        }
        .party-web-marker {
          background: transparent !important;
          border: none !important;
        }
        .leaflet-control-attribution {
          font-size: 9px !important;
          background: rgba(11,11,16,0.6) !important;
          color: #6B6B76 !important;
        }
        .leaflet-control-attribution a {
          color: #A1A1AA !important;
        }
      `;
      document.head.appendChild(style);
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => resolve((window as any).L);
    script.onerror = () => resolve(null);
    document.body.appendChild(script);
  });

  return leafletPromise;
}

const MapInstanceContext = React.createContext<any>(null);

export function Marker({
  children,
  onPress,
  coordinate,
}: {
  children?: React.ReactNode;
  onPress?: (e: any) => void;
  coordinate: { latitude: number; longitude: number };
  hitSlop?: any;
  anchor?: any;
}) {
  const map = React.useContext(MapInstanceContext);
  const markerRef = useRef<any>(null);
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);

  const lat = Number(coordinate?.latitude) || 22.7709;
  const lng = Number(coordinate?.longitude) || -102.5832;

  useEffect(() => {
    if (!map || typeof window === 'undefined') return;
    const L = (window as any).L;
    if (!L) return;

    const el = document.createElement('div');
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'flex-end';
    el.style.width = '52px';
    el.style.height = '56px';
    el.style.cursor = 'pointer';

    const icon = L.divIcon({
      className: 'party-web-marker',
      html: el,
      iconSize: [52, 56],
      iconAnchor: [26, 54],
    });

    const marker = L.marker([lat, lng], { icon }).addTo(map);
    marker.on('click', (ev: any) => {
      if (ev?.originalEvent) {
        ev.originalEvent.stopPropagation();
      }
      onPressRef.current?.({
        stopPropagation: () => {},
        nativeEvent: { coordinate: { latitude: lat, longitude: lng } },
      });
    });

    markerRef.current = marker;
    setPortalEl(el);

    return () => {
      marker.remove();
      markerRef.current = null;
      setPortalEl(null);
    };
  }, [map]);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    }
  }, [lat, lng]);

  if (!portalEl) return null;

  return createPortal(
    children || (
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: '#FF3D7F',
          border: '2.5px solid #fff',
          boxShadow: '0 3px 8px rgba(0,0,0,0.45)',
        }}
      />
    ),
    portalEl
  );
}

export default function MapView({
  children,
  style,
  initialRegion,
  region,
  onPress,
}: {
  children?: React.ReactNode;
  style?: any;
  customMapStyle?: any;
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta?: number;
    longitudeDelta?: number;
  };
  region?: {
    latitude: number;
    longitude: number;
    latitudeDelta?: number;
    longitudeDelta?: number;
  };
  onPress?: (e: any) => void;
}) {
  const rawId = useId();
  const containerId = `party-leaflet-map-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [mapInstance, setMapInstance] = useState<any>(null);
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  const activeRegion = region || initialRegion || { latitude: 22.7709, longitude: -102.5832 };
  const lat = Number(activeRegion.latitude) || 22.7709;
  const lng = Number(activeRegion.longitude) || -102.5832;

  useEffect(() => {
    let cancelado = false;
    let map: any = null;

    loadLeaflet().then((L) => {
      if (cancelado || !L) return;
      const domNode = document.getElementById(containerId);
      if (!domNode) return;

      map = L.map(domNode, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: false,
      });

      // Tiles oficiales de OpenStreetMap (100% libres y sin API key) estilizados en modo oscuro
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

      map.on('click', (e: any) => {
        onPressRef.current?.({
          nativeEvent: {
            coordinate: {
              latitude: e.latlng.lat,
              longitude: e.latlng.lng,
            },
          },
        });
      });

      setMapInstance(map);
      setTimeout(() => map.invalidateSize(), 150);
    });

    return () => {
      cancelado = true;
      if (map) {
        map.remove();
      }
    };
  }, [containerId]);

  useEffect(() => {
    if (mapInstance && region) {
      mapInstance.setView([lat, lng], mapInstance.getZoom(), { animate: true });
    }
  }, [mapInstance, region?.latitude, region?.longitude]);

  return (
    <View style={[styles.container, style]}>
      {typeof window !== 'undefined' &&
        React.createElement('div', {
          id: containerId,
          style: {
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1,
          },
        })}
      <MapInstanceContext.Provider value={mapInstance}>
        {mapInstance ? children : null}
      </MapInstanceContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    position: 'relative',
    overflow: 'hidden',
  },
});

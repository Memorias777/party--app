import React, { useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, S, T } from '../constants/design';
import { alpha } from '../utils/colors';

// -----------------------------------------------------------------------
// Implementación Web de MapView y Marker.
// Renderiza un mapa interactivo oscuro de Zacatecas en un iframe de Google Maps
// y una barra/retícula interactiva con los marcadores para que en Web nunca
// falle la compilación por módulos nativos de react-native-maps.
// -----------------------------------------------------------------------

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
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() =>
        onPress?.({
          stopPropagation: () => {},
          nativeEvent: { coordinate },
        })
      }
      style={styles.webMarkerItem}
    >
      {children || (
        <View style={styles.defaultPin}>
          <Ionicons name="location" size={20} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
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
  initialRegion?: { latitude: number; longitude: number; latitudeDelta?: number; longitudeDelta?: number };
  region?: { latitude: number; longitude: number; latitudeDelta?: number; longitudeDelta?: number };
  onPress?: (e: any) => void;
}) {
  const activeRegion = region || initialRegion || { latitude: 22.7709, longitude: -102.5832 };
  const lat = Number(activeRegion.latitude) || 22.7709;
  const lng = Number(activeRegion.longitude) || -102.5832;

  const mapEmbedUrl = useMemo(() => {
    return `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
  }, [lat, lng]);

  const childArray = React.Children.toArray(children);

  return (
    <View style={[styles.container, style]}>
      {/* Mapa embebido compatible con cualquier navegador web */}
      {React.createElement('iframe', {
        src: mapEmbedUrl,
        style: {
          border: 0,
          width: '100%',
          height: '100%',
          filter: 'invert(90%) hue-rotate(180deg) brightness(95%) contrast(90%)',
        },
        loading: 'lazy',
        referrerPolicy: 'no-referrer-when-downgrade',
      })}

      {/* Selector de ubicaciones / marcadores flotante en versión Web */}
      {childArray.length > 0 && (
        <View style={styles.markersOverlay} pointerEvents="box-none">
          <View style={styles.markersDock}>
            <View style={styles.dockHeader}>
              <Ionicons name="compass-outline" size={16} color={C.brand} />
              <Text style={T.micro}>UBICACIONES EN EL MAPA (TOCA UN PIN PARA VER LAS FIESTAS)</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.markersScroll}
            >
              {children}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Si es un mini-mapa de edición (con onPress para coordenadas), botón rápido para centrar */}
      {onPress && childArray.length <= 1 && (
        <TouchableOpacity
          style={styles.coordHelperBadge}
          activeOpacity={0.85}
          onPress={() =>
            onPress({
              nativeEvent: {
                coordinate: { latitude: lat, longitude: lng },
              },
            })
          }
        >
          <Ionicons name="location-outline" size={14} color={C.brand} />
          <Text style={T.caption}>
            Coordenadas: {lat.toFixed(4)}, {lng.toFixed(4)}
          </Text>
        </TouchableOpacity>
      )}
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
  markersOverlay: {
    position: 'absolute',
    bottom: 24,
    left: S.lg,
    right: S.lg,
    alignItems: 'center',
  },
  markersDock: {
    width: '100%',
    maxWidth: 680,
    backgroundColor: alpha(C.surface, 0.94),
    borderRadius: R.xl,
    padding: S.md,
    borderWidth: 1,
    borderColor: C.borderStrong,
    gap: S.sm,
  },
  dockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  markersScroll: {
    gap: S.md,
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  webMarkerItem: {
    padding: 4,
  },
  defaultPin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coordHelperBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: alpha(C.surface, 0.92),
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.borderStrong,
  },
});

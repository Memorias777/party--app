import React, { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, Animated, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../supabase';
import { paletaParaFiesta } from '../../utils/colors';

const PALETAS = [
  ['#0FC2C0', '#F4D35E', '#EDEEC9'],
  ['#2EC4B6', '#FFFFFF', '#FF9F1C'],
  ['#7B9E43', '#F4D35E', '#3D2B1F'],
  ['#118AB2', '#06D6A0', '#FFD166'],
  ['#3A86FF', '#8AC926', '#FFCA3A'],
  ['#5EC6C0', '#2D3142', '#F4D35E'],
];

const paletaParaId = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETAS[hash % PALETAS.length];
};

// -----------------------------------------------------------------------
// Banner animado tipo "pintura líquida en movimiento infinito": el
// gradiente interno es más ancho que la card, se desplaza en loop y
// nunca muestra bordes/cortes (mismo patrón que usamos en la tab bar).
// -----------------------------------------------------------------------
function BannerVivo({ colores, apagado }: { colores: string[]; apagado: boolean }) {
  const shift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shift, { toValue: 1, duration: 4200, useNativeDriver: true }),
        Animated.timing(shift, { toValue: 0, duration: 4200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shift]);

  const translateX = shift.interpolate({ inputRange: [0, 1], outputRange: [-30, 30] });

  return (
    <View style={[styles.banner, apagado && styles.bannerApagado]}>
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: -50,
          right: -50,
          transform: [{ translateX }],
        }}
      >
        <LinearGradient
          colors={[colores[0], colores[1], colores[2], colores[1], colores[0]] as any}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <LinearGradient
        colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 0.8 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)']}
        start={{ x: 0.3, y: 0.2 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export default function ChatsScreen() {
  const router = useRouter();
  const [misFiestas, setMisFiestas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargarMisFiestas = useCallback(async () => {
    setCargando(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCargando(false);
      setMisFiestas([]);
      return;
    }

    const { data, error } = await supabase
      .from('participantes')
      .select(`
        evento_id,
        eventos (
          *,
          participantes (count)
        )
      `)
      .eq('perfil_id', user.id);

    if (data) {
      const fiestasFormateadas = data
        .map((participacion: any) => participacion.eventos || participacion.evento)
        .filter(Boolean)
        .sort((a: any, b: any) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime());

      setMisFiestas(fiestasFormateadas);
    }
    setCargando(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarMisFiestas();
    }, [cargarMisFiestas])
  );

  const renderChat = ({ item }: { item: any }) => {
    if (!item) return null;

    const fecha = new Date(item.fecha_hora).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    const asistentes = item.participantes?.[0]?.count || 1;
    const yaPaso = new Date(item.fecha_hora).getTime() < Date.now();
    const colores = paletaParaFiesta(item);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => router.push(`../fiesta/${item.id}`)}
      >
        <View style={{ overflow: 'hidden', borderTopLeftRadius: 22, borderTopRightRadius: 22 }}>
          <BannerVivo colores={colores} apagado={yaPaso} />
          <View style={styles.bannerContentOverlay} pointerEvents="box-none">
            <View style={styles.bannerTopRow}>
              {yaPaso && (
                <View style={styles.badgeFinalizada}>
                  <Text style={styles.badgeFinalizadaText}>Finalizada</Text>
                </View>
              )}
              <View style={styles.asistentesBadge}>
                <Text style={styles.asistentesBadgeText}>👤 {asistentes}</Text>
              </View>
            </View>

            {item.link_logo ? (
              <View style={styles.bannerLogoWrap}>
                <Image source={{ uri: item.link_logo }} style={styles.bannerLogoImage} />
              </View>
            ) : (
              <Text style={styles.bannerEmoji}>{item.emoji || '🥳'}</Text>
            )}
          </View>
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.titulo}</Text>
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {yaPaso ? '✔️ Fiesta finalizada' : '💬 Toca para entrar al chat'} · {fecha}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (cargando) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#ff3b30" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Tus Fiestas 🎉</Text>
      <Text style={styles.subheader}>Eventos a los que asistes</Text>

      {misFiestas.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>👀</Text>
          <Text style={styles.emptyText}>Aún no te has unido a ninguna fiesta</Text>
        </View>
      ) : (
        <FlatList
          data={misFiestas}
          keyExtractor={(item, index) => item?.id || index.toString()}
          renderItem={renderChat}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 70 },
  header: { color: '#fff', fontSize: 28, fontWeight: 'bold', paddingHorizontal: 24 },
  subheader: { color: '#8e8e93', fontSize: 14, paddingHorizontal: 24, marginBottom: 20 },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },

  card: {
    borderRadius: 22,
    marginBottom: 18,
    backgroundColor: '#1c1c1e',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  banner: {
    height: 150,
  },
  bannerApagado: {
    opacity: 0.55,
  },
  bannerContentOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: 14,
  },
  bannerTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  badgeFinalizada: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeFinalizadaText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  asistentesBadge: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  asistentesBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  bannerEmoji: {
    fontSize: 56,
    alignSelf: 'center',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
  },
  bannerLogoWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignSelf: 'center',
    backgroundColor: '#1c1c2e',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.7)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  bannerLogoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
  },

  cardInfo: { padding: 16 },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  cardSubtitle: { color: '#a1a1a6', fontSize: 13 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 100 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#8e8e93', fontSize: 15 },
});
import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../supabase';

// -----------------------------------------------------------------------
// Paletas inspiradas en pintura líquida / marmoleado (turquesa, verdes,
// amarillos, blancos, cafés) — cada fiesta usa una consistentemente según
// su id, así se ve "viva" y distinta sin depender de un flyer real todavía.
// -----------------------------------------------------------------------
const PALETAS = [
  ['#0FC2C0', '#F4D35E', '#EDEEC9'],   // turquesa + amarillo + crema
  ['#2EC4B6', '#FFFFFF', '#FF9F1C'],   // turquesa + blanco + naranja
  ['#7B9E43', '#F4D35E', '#3D2B1F'],   // verde oliva + amarillo + café
  ['#118AB2', '#06D6A0', '#FFD166'],   // azul + verde menta + amarillo
  ['#3A86FF', '#8AC926', '#FFCA3A'],   // azul + verde + amarillo vivo
  ['#5EC6C0', '#2D3142', '#F4D35E'],   // turquesa + carbón + amarillo
];

const paletaParaId = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETAS[hash % PALETAS.length];
};

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
    const [colorA, colorB, colorC] = paletaParaId(String(item.id));

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => router.push(`../fiesta/${item.id}`)}
      >
        <LinearGradient
          colors={[colorA, colorB, colorC]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.banner, yaPaso && styles.bannerApagado]}
        >
          {/* Capa de manchas suaves para dar textura tipo "pintura" */}
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

          <Text style={styles.bannerEmoji}>{item.emoji || '🥳'}</Text>
        </LinearGradient>

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
    justifyContent: 'space-between',
    padding: 14,
  },
  bannerApagado: {
    opacity: 0.55,
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

  cardInfo: { padding: 16 },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  cardSubtitle: { color: '#a1a1a6', fontSize: 13 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 100 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#8e8e93', fontSize: 15 },
});
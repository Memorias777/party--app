import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../supabase';
import { useFocusEffect, router } from 'expo-router';
import { useToast } from '../../components/Toast';

export interface HistorialItem {
  id: string; // evento_id
  emoji: string;
  nombreEvento: string;
  fecha: string;
  lugar: string;
  link_fotos?: string;
}

// -----------------------------------------------------------------------
// Mismas paletas tipo pintura líquida que en chats.tsx, para que ambas
// pantallas se sientan parte de la misma identidad visual.
// -----------------------------------------------------------------------
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

export default function HistorialScreen() {
  const { showToast } = useToast();
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const formatearFecha = (fechaISO?: string) => {
    if (!fechaISO) return 'Fecha desconocida';
    try {
      const fecha = new Date(fechaISO);
      return fecha.toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return fechaISO;
    }
  };

  const cargarHistorial = useCallback(async (perfil_id: string) => {
    setCargando(true);
    try {
      const { data: participaciones, error: errParticipantes } = await supabase
        .from('participantes')
        .select('evento_id, eventos(id, titulo, lugar, fecha_hora, emoji, link_fotos)')
        .eq('perfil_id', perfil_id);

      if (errParticipantes) {
        console.error('Error cargando participaciones:', errParticipantes);
        showToast('No se pudo cargar tu historial', 'error');
        setHistorial([]);
        return;
      }

      const ahora = Date.now();
      const pasadas = (participaciones || [])
        .map((p: any) => p.eventos)
        .filter((ev: any) => ev && new Date(ev.fecha_hora).getTime() < ahora);

      const formateado: HistorialItem[] = pasadas
        .sort((a: any, b: any) => new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime())
        .map((ev: any) => ({
          id: ev.id,
          emoji: ev.emoji || '🎉',
          nombreEvento: ev.titulo || 'Evento',
          fecha: formatearFecha(ev.fecha_hora),
          lugar: ev.lugar || 'Lugar desconocido',
          link_fotos: ev.link_fotos,
        }));

      setHistorial(formateado);
    } catch (err) {
      console.error('Error:', err);
      showToast('Ocurrió un error al cargar tu historial', 'error');
      setHistorial([]);
    } finally {
      setCargando(false);
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      const inicializar = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setCargando(false);
          setHistorial([]);
          return;
        }
        setUserId(user.id);
        cargarHistorial(user.id);
      };
      inicializar();
    }, [cargarHistorial])
  );

  const abrirFotos = async (link_fotos?: string) => {
    if (!link_fotos) {
      showToast('El administrador aún no ha subido fotos', 'info');
      return;
    }
    try {
      await Linking.openURL(link_fotos);
    } catch (error) {
      showToast('No se pudo abrir el enlace de fotos', 'error');
    }
  };

  const renderItem = ({ item }: { item: HistorialItem }) => {
    const [colorA, colorB, colorC] = paletaParaId(String(item.id));

    return (
      <View style={styles.card}>
        <LinearGradient
          colors={[colorA, colorB, colorC]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.banner}
        >
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
            <View style={styles.badgeVivida}>
              <Text style={styles.badgeVividaText}>✔️ Ya la viviste</Text>
            </View>
          </View>

          <Text style={styles.bannerEmoji}>{item.emoji}</Text>
        </LinearGradient>

        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.nombreEvento}</Text>
          <Text style={styles.cardSubtitle}>📍 {item.lugar} · {item.fecha}</Text>

          <TouchableOpacity style={styles.photosButton} activeOpacity={0.75} onPress={() => abrirFotos(item.link_fotos)}>
            <Text style={styles.photosButtonText}>📸 Ver fotos del evento</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (!userId && !cargando) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Historial 🕓</Text>
        <Text style={styles.subheader}>Fiestas a las que ya fuiste</Text>
        <View style={styles.centerContent}>
          <Text style={styles.emptyText}>Inicia sesión para ver tu historial</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/login')} activeOpacity={0.85}>
            <Text style={styles.loginBtnText}>Ir a Iniciar Sesión</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Historial 🕓</Text>
      <Text style={styles.subheader}>Fiestas a las que ya fuiste</Text>

      {cargando ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#ff3b30" />
        </View>
      ) : (
        <FlatList
          data={historial}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.centerContent}>
              <Text style={styles.emptyEmoji}>🕓</Text>
              <Text style={styles.emptyText}>Aún no tienes fiestas en tu historial</Text>
              <Text style={styles.emptySubtext}>Cuando termine una fiesta a la que asististe, aparecerá aquí.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 70 },
  header: { color: '#fff', fontSize: 28, fontWeight: 'bold', paddingHorizontal: 24 },
  subheader: { color: '#8e8e93', fontSize: 14, paddingHorizontal: 24, marginBottom: 20 },
  listContent: { paddingHorizontal: 16, paddingBottom: 40, flexGrow: 1 },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, paddingTop: 60 },
  emptyEmoji: { fontSize: 44, marginBottom: 10 },
  emptyText: { color: '#8e8e93', fontSize: 14, textAlign: 'center' },
  emptySubtext: { color: '#636366', fontSize: 12, textAlign: 'center', marginTop: 6 },
  loginBtn: { backgroundColor: '#ff3b30', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14, marginTop: 20 },
  loginBtnText: { color: '#fff', fontWeight: 'bold' },

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
  bannerTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  badgeVivida: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeVividaText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bannerEmoji: {
    fontSize: 56,
    alignSelf: 'center',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
  },

  cardInfo: { padding: 16 },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  cardSubtitle: { color: '#a1a1a6', fontSize: 13, marginBottom: 14 },
  photosButton: { backgroundColor: '#2c2c2e', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  photosButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
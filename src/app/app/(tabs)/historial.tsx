import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { supabase } from '../../../../supabase';
import { useFocusEffect, router } from 'expo-router';
import { useToast } from '../../../components/Toast';

export interface HistorialItem {
  id: string; // evento_id
  emoji: string;
  nombreEvento: string;
  fecha: string;
  lugar: string;
  calificacion: number;
  link_fotos?: string;
}

function StarRating({ calificacion, onRate }: { calificacion: number; onRate: (n: number) => void }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((estrella) => (
        <TouchableOpacity key={estrella} onPress={() => onRate(estrella)} activeOpacity={0.6}>
          <Text style={styles.star}>{estrella <= calificacion ? '⭐' : '☆'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

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
      // 1. Traemos todas las fiestas a las que el usuario asistió (participantes) que ya pasaron
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

      if (pasadas.length === 0) {
        setHistorial([]);
        return;
      }

      // 2. Traemos las calificaciones ya guardadas para esas fiestas (si existen)
      const idsEventos = pasadas.map((ev: any) => ev.id);
      const { data: calificaciones } = await supabase
        .from('historial_ia')
        .select('evento_id, calificacion')
        .eq('perfil_id', perfil_id)
        .in('evento_id', idsEventos);

      const mapaCalificaciones: Record<string, number> = {};
      (calificaciones || []).forEach((c: any) => {
        mapaCalificaciones[c.evento_id] = c.calificacion || 0;
      });

      const formateado: HistorialItem[] = pasadas
        .sort((a: any, b: any) => new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime())
        .map((ev: any) => ({
          id: ev.id,
          emoji: ev.emoji || '🎉',
          nombreEvento: ev.titulo || 'Evento',
          fecha: formatearFecha(ev.fecha_hora),
          lugar: ev.lugar || 'Lugar desconocido',
          calificacion: mapaCalificaciones[ev.id] || 0,
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

  const actualizarCalificacion = async (evento_id: string, nuevaCalificacion: number) => {
    setHistorial((prev) => prev.map((item) => (item.id === evento_id ? { ...item, calificacion: nuevaCalificacion } : item)));

    if (!userId) return;

    // 🔥 upsert: crea el registro en historial_ia si no existía, o lo actualiza si ya estaba
    const { error } = await supabase
      .from('historial_ia')
      .upsert(
        { perfil_id: userId, evento_id, calificacion: nuevaCalificacion },
        { onConflict: 'perfil_id,evento_id' }
      );

    if (error) {
      console.error('Error al guardar calificación:', error);
      showToast('No se pudo guardar la calificación', 'error');
    }
  };

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

  const renderItem = ({ item }: { item: HistorialItem }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarEmoji}>{item.emoji}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.nombreEvento}</Text>
          <Text style={styles.cardSubtitle}>📍 {item.lugar} · {item.fecha}</Text>
        </View>
      </View>

      <View style={styles.ratingSection}>
        <Text style={styles.ratingLabel}>¿Cómo estuvo? 🎉</Text>
        <StarRating calificacion={item.calificacion} onRate={(nueva) => actualizarCalificacion(item.id, nueva)} />
      </View>

      <TouchableOpacity style={styles.photosButton} activeOpacity={0.7} onPress={() => abrirFotos(item.link_fotos)}>
        <Text style={styles.photosButtonText}>📸 Ver fotos del evento</Text>
      </TouchableOpacity>
    </View>
  );

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
  card: { backgroundColor: '#1c1c1e', borderRadius: 18, padding: 16, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatarContainer: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#2c2c2e', borderWidth: 2, borderColor: '#ff3b30', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarEmoji: { fontSize: 24 },
  cardInfo: { flex: 1 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardSubtitle: { color: '#8e8e93', fontSize: 13 },
  ratingSection: { marginBottom: 14 },
  ratingLabel: { color: '#fff', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  starsRow: { flexDirection: 'row', marginBottom: 0, gap: 4 },
  star: { fontSize: 22 },
  photosButton: { backgroundColor: '#2c2c2e', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  photosButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

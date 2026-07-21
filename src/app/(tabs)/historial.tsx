import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator, Linking } from 'react-native';
import { supabase } from '../../../supabase.js';
import { useFocusEffect } from 'expo-router';

export interface HistorialItem {
  id: string;
  evento_id: string;
  emoji: string;
  nombreEvento: string;
  fecha: string;
  lugar: string;
  // 🔥 CAMBIAMOS gusto_cover POR calificacion PARA LAS ESTRELLAS
  calificacion: number;
  gusto_byob: boolean;
  gusto_mayores: boolean;
  creado_en: string;
  link_fotos?: string;
}

const HISTORIAL_MOCK: HistorialItem[] = [
  {
    id: '1',
    evento_id: '1',
    emoji: '🍾',
    nombreEvento: 'Año Nuevo en el Cerro de la Bufa',
    fecha: '1 Ene 2026',
    lugar: 'Cerro de la Bufa',
    calificacion: 4,
    gusto_byob: false,
    gusto_mayores: false,
    creado_en: '2026-01-01',
    link_fotos: 'https://example.com/photos',
  },
];

// Componente de estrellas interactivo
function StarRating({
  calificacion,
  onRate,
}: {
  calificacion: number;
  onRate: (nuevaCalificacion: number) => void;
}) {
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
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const inicializar = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        cargarHistorial(user.id);
      } else {
        setHistorial(HISTORIAL_MOCK);
        setCargando(false);
      }
    };
    inicializar();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (userId) {
        cargarHistorial(userId);
      }
    }, [userId])
  );

  const cargarHistorial = async (perfil_id: string) => {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from('historial_ia')
        .select(`
          evento_id,
          calificacion, 
          gusto_byob,
          gusto_mayores,
          creado_en,
          eventos(titulo, lugar, fecha_hora, emoji, link_fotos)
        `) // 🔥 Quitamos el 'id' de aquí
        .eq('perfil_id', perfil_id)
        .order('creado_en', { ascending: false });

      if (error) {
        console.error('Error cargando historial:', error);
        setHistorial(HISTORIAL_MOCK);
      } else if (data) {
        const formateado = data.map((item: any) => ({
          id: item.evento_id, // 🔥 Usamos el evento_id como identificador para la lista
          evento_id: item.evento_id,
          emoji: item.eventos?.emoji || '🎉',
          nombreEvento: item.eventos?.titulo || 'Evento',
          fecha: formatearFecha(item.eventos?.fecha_hora),
          lugar: item.eventos?.lugar || 'Lugar desconocido',
          calificacion: item.calificacion || 0,
          gusto_byob: item.gusto_byob,
          gusto_mayores: item.gusto_mayores,
          creado_en: item.creado_en,
          link_fotos: item.eventos?.link_fotos,
        }));
        setHistorial(formateado);
      }
    } catch (err) {
      console.error('Error:', err);
      setHistorial(HISTORIAL_MOCK);
    } finally {
      setCargando(false);
    }
  };

  const formatearFecha = (fechaISO?: string) => {
    if (!fechaISO) return 'Fecha desconocida';
    try {
      const fecha = new Date(fechaISO);
      return fecha.toLocaleString('es-MX', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return fechaISO;
    }
  };

  const actualizarCalificacion = async (id_del_evento: string, nuevaCalificacion: number) => {
    setHistorial((prev) =>
      prev.map((item) =>
        item.id === id_del_evento ? { ...item, calificacion: nuevaCalificacion } : item
      )
    );

    if (userId) {
      // 🔥 Ahora actualizamos buscando por perfil y evento, no por 'id'
      const { error } = await supabase
        .from('historial_ia')
        .update({ calificacion: nuevaCalificacion })
        .eq('perfil_id', userId)
        .eq('evento_id', id_del_evento);

      if (error) {
        console.error('Error al guardar calificación:', error);
        Alert.alert('Error', 'No se pudo guardar la calificación');
      }
    }
  };

  const abrirFotos = async (link_fotos?: string) => {
    if (!link_fotos) {
      Alert.alert('Sin fotos', 'El administrador aún no ha subido fotos de este evento.');
      return;
    }
    
    try {
      await Linking.openURL(link_fotos);
    } catch (error) {
      Alert.alert('Error', 'No se pudo abrir el enlace de fotos.');
    }
  };

  const renderItem = ({ item }: { item: HistorialItem }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarEmoji}>{item.emoji}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.nombreEvento}
          </Text>
          <Text style={styles.cardSubtitle}>
            📍 {item.lugar} · {item.fecha}
          </Text>
        </View>
      </View>

      <View style={styles.ratingSection}>
        <Text style={styles.ratingLabel}>¿Cómo estuvo? 🎉</Text>
        <StarRating
          calificacion={item.calificacion}
          onRate={(nueva) => actualizarCalificacion(item.id, nueva)}
        />
      </View>

      <TouchableOpacity
        style={styles.photosButton}
        activeOpacity={0.7}
        onPress={() => abrirFotos(item.link_fotos)}
      >
        <Text style={styles.photosButtonText}>📸 Ver fotos del evento</Text>
      </TouchableOpacity>
    </View>
  );

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
              <Text style={styles.emptyText}>No tienes fiestas en tu historial</Text>
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
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#8e8e93', fontSize: 14 },
  card: {
    backgroundColor: '#1c1c1e',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2c2c2e',
    borderWidth: 2,
    borderColor: '#ff3b30',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarEmoji: { fontSize: 24 },
  cardInfo: { flex: 1 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardSubtitle: { color: '#8e8e93', fontSize: 13 },
  ratingSection: { marginBottom: 14 },
  ratingLabel: { color: '#fff', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  starsRow: { flexDirection: 'row', marginBottom: 0, gap: 4 },
  star: { fontSize: 22 },
  photosButton: {
    backgroundColor: '#2c2c2e',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  photosButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
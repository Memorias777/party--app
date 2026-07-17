import React, { useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity } from 'react-native';

export interface HistorialItem {
  id: string;
  emoji: string;
  nombreEvento: string;
  fecha: string;
  lugar: string;
  calificacion: number; // 0 a 5
}

const HISTORIAL_MOCK: HistorialItem[] = [
  {
    id: '1',
    emoji: '🍾',
    nombreEvento: 'Año Nuevo en el Cerro de la Bufa',
    fecha: '1 Ene 2026',
    lugar: 'Cerro de la Bufa',
    calificacion: 4,
  },
  {
    id: '2',
    emoji: '🎸',
    nombreEvento: 'Noche de Rock en el Centro',
    fecha: '14 Dic 2025',
    lugar: 'Plaza Bicentenario',
    calificacion: 5,
  },
  {
    id: '3',
    emoji: '🕺',
    nombreEvento: 'Fiesta Universitaria UAZ',
    fecha: '2 Nov 2025',
    lugar: 'Explanada UAZ',
    calificacion: 3,
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
  const [historial, setHistorial] = useState<HistorialItem[]>(HISTORIAL_MOCK);

  const actualizarCalificacion = (id: string, nuevaCalificacion: number) => {
    setHistorial((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, calificacion: nuevaCalificacion } : item
      )
    );
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

      <StarRating
        calificacion={item.calificacion}
        onRate={(nueva) => actualizarCalificacion(item.id, nueva)}
      />

      <TouchableOpacity
        style={styles.photosButton}
        activeOpacity={0.7}
        onPress={() => console.log('Ver fotos del evento:', item.id)}
      >
        <Text style={styles.photosButtonText}>📸 Ver fotos del evento</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Historial 🕓</Text>
      <Text style={styles.subheader}>Fiestas a las que ya fuiste</Text>

      <FlatList
        data={historial}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 70 },
  header: { color: '#fff', fontSize: 28, fontWeight: 'bold', paddingHorizontal: 24 },
  subheader: { color: '#8e8e93', fontSize: 14, paddingHorizontal: 24, marginBottom: 20 },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
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
  starsRow: { flexDirection: 'row', marginBottom: 14, gap: 4 },
  star: { fontSize: 22 },
  photosButton: {
    backgroundColor: '#2c2c2e',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  photosButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../../../supabase';

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
        // Fiestas más próximas primero
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

    return (
      <TouchableOpacity
        style={styles.chatItem}
        activeOpacity={0.7}
        onPress={() => router.push(`../fiesta/${item.id}`)}
      >
        <View style={[styles.avatarContainer, yaPaso && styles.avatarContainerPasada]}>
          <Text style={styles.avatarEmoji}>{item.emoji || '🥳'}</Text>
        </View>

        <View style={styles.chatInfo}>
          <Text style={styles.chatTitle} numberOfLines={1}>
            {item.titulo} ({asistentes} 👤)
          </Text>
          <Text style={styles.chatMessage} numberOfLines={1}>
            {yaPaso ? 'Fiesta finalizada' : 'Toca para entrar al chat...'}
          </Text>
        </View>

        <View style={styles.chatMeta}>
          <Text style={styles.chatHora}>{fecha}</Text>
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
  chatItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1c1c1e', borderRadius: 16, padding: 14, marginBottom: 10 },
  avatarContainer: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#2c2c2e', borderWidth: 2, borderColor: '#ff3b30', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  avatarContainerPasada: { borderColor: '#3a3a3c', opacity: 0.6 },
  avatarEmoji: { fontSize: 26 },
  chatInfo: { flex: 1 },
  chatTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  chatMessage: { color: '#8e8e93', fontSize: 14 },
  chatMeta: { alignItems: 'flex-end', marginLeft: 8 },
  chatHora: { color: '#636366', fontSize: 12, marginBottom: 6 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 100 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#8e8e93', fontSize: 15 },
});

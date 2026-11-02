import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, ActivityIndicator, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../supabase';
import { useColoresFiesta, alpha } from '../../utils/colors';
import { Card, Chip, EmptyState, FiestaGlow, ScreenHeader } from '../../components/ui/kit';
import { C, R, S, T } from '../../constants/design';

function FiestaTicketCard({ item, onPress }: { item: any; onPress: () => void }) {
  const colores = useColoresFiesta(item);
  const [colorPrincipal] = colores;
  const fecha = new Date(item.fecha_hora).toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const hora = new Date(item.fecha_hora).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const asistentes = item.participantes?.[0]?.count || 1;
  const yaPaso = new Date(item.fecha_hora).getTime() < Date.now();

  return (
    <Card
      onPress={onPress}
      style={[
        styles.card,
        { borderColor: alpha(colorPrincipal, yaPaso ? 0.16 : 0.35), opacity: yaPaso ? 0.72 : 1 },
      ]}
    >
      <FiestaGlow colores={colores} intensity={yaPaso ? 0.25 : 0.55} />

      <View style={styles.cardBody}>
        <View style={[styles.avatarWrap, { borderColor: colorPrincipal }]}>
          {item.link_logo ? (
            <Image source={{ uri: item.link_logo }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarEmoji}>{item.emoji || '🥳'}</Text>
          )}
        </View>

        <View style={styles.cardContent}>
          <View style={styles.topChipsRow}>
            {item.tipo_fiesta ? (
              <Chip label={item.tipo_fiesta} color={colorPrincipal} />
            ) : null}
            {yaPaso ? (
              <Chip label="Finalizada" color={C.textMuted} icon="checkmark-circle" />
            ) : (
              <Chip label={`${asistentes}`} color={colorPrincipal} icon="people" />
            )}
          </View>

          <Text style={[T.subtitle, styles.title]} numberOfLines={1}>
            {item.titulo}
          </Text>

          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color={C.textMuted} />
            <Text style={T.caption} numberOfLines={1}>
              {fecha} · {hora}
            </Text>
          </View>

          {item.lugar ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={14} color={C.textMuted} />
              <Text style={T.caption} numberOfLines={1}>
                {item.lugar}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.arrowWrap, { backgroundColor: alpha(colorPrincipal, 0.16) }]}>
          <Ionicons name="chevron-forward" size={18} color={colorPrincipal} />
        </View>
      </View>
    </Card>
  );
}

export default function ChatsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

    const { data } = await supabase
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

  return (
    <View style={styles.container}>
      <ScreenHeader title="Tus Fiestas" subtitle="Eventos a los que asistes y sus avisos" />

      {cargando ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={C.brand} />
        </View>
      ) : misFiestas.length === 0 ? (
        <View style={styles.centerContent}>
          <EmptyState
            icon="sparkles-outline"
            title="Aún no te has unido a ninguna fiesta"
            message="Explora el mapa y únete a un evento para ver sus avisos y chatear."
          />
        </View>
      ) : (
        <FlatList
          data={misFiestas}
          keyExtractor={(item, index) => String(item?.id || index)}
          renderItem={({ item }) =>
            item ? (
              <FiestaTicketCard
                item={item}
                onPress={() => router.push(`../fiesta/${item.id}`)}
              />
            ) : null
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: S.xl, paddingTop: S.xs },
  card: {
    marginBottom: S.md,
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: S.lg,
    gap: S.md,
  },
  avatarWrap: {
    width: 68,
    height: 68,
    borderRadius: R.lg,
    backgroundColor: C.surfaceAlt,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarEmoji: {
    fontSize: 32,
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  topChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  title: {
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  arrowWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

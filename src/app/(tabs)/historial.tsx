import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, ActivityIndicator, Linking, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../supabase';
import { useFocusEffect, router } from 'expo-router';
import { useToast } from '../../components/Toast';
import { Button, Card, Chip, EmptyState, FiestaGlow, ScreenHeader } from '../../components/ui/kit';
import { C, R, S, T } from '../../constants/design';
import { useColoresFiesta, alpha } from '../../utils/colors';

export interface HistorialItem {
  id: string; // evento_id
  emoji: string;
  nombreEvento: string;
  fecha: string;
  lugar: string;
  link_fotos?: string;
  link_logo?: string;
  tipo_fiesta?: string;
  colores?: string[] | null;
}

function HistorialTicketCard({
  item,
  onAbrirFotos,
}: {
  item: HistorialItem;
  onAbrirFotos: (url?: string) => void;
}) {
  const colores = useColoresFiesta({
    id: item.id,
    tipo_fiesta: item.tipo_fiesta,
    link_logo: item.link_logo,
    colores: item.colores,
  });
  const [colorPrincipal] = colores;

  return (
    <Card style={[styles.card, { borderColor: alpha(colorPrincipal, 0.28) }]}>
      <FiestaGlow colores={colores} intensity={0.42} />

      <View style={styles.cardTop}>
        <View style={[styles.avatarWrap, { borderColor: colorPrincipal }]}>
          {item.link_logo ? (
            <Image source={{ uri: item.link_logo }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarEmoji}>{item.emoji}</Text>
          )}
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.chipsRow}>
            <Chip label="Ya la viviste" color={colorPrincipal} icon="checkmark-circle" />
            {item.tipo_fiesta ? <Chip label={item.tipo_fiesta} color={C.textMuted} /> : null}
          </View>
          <Text style={T.subtitle} numberOfLines={1}>
            {item.nombreEvento}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={C.textMuted} />
            <Text style={T.caption} numberOfLines={1}>
              {item.lugar} · {item.fecha}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Button
          title="Ver fotos del evento"
          icon="images-outline"
          variant={item.link_fotos ? 'primary' : 'secondary'}
          color={colorPrincipal}
          small
          onPress={() => onAbrirFotos(item.link_fotos)}
          style={{ width: '100%' }}
        />
      </View>
    </Card>
  );
}

export default function HistorialScreen() {
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
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
        .select('evento_id, eventos(*)')
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
          link_logo: ev.link_logo,
          tipo_fiesta: ev.tipo_fiesta,
          colores: ev.colores,
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
    } catch {
      showToast('No se pudo abrir el enlace de fotos', 'error');
    }
  };

  if (!userId && !cargando) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Historial" subtitle="Fiestas a las que ya fuiste" />
        <View style={styles.centerContent}>
          <EmptyState
            icon="time-outline"
            title="Inicia sesión para ver tu historial"
            message="Aquí se guardan los recuerdos y álbumes de las fiestas a las que asististe."
            action={
              <Button
                title="Ir a Iniciar Sesión"
                icon="log-in-outline"
                onPress={() => router.push('/login')}
              />
            }
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Historial" subtitle="Fiestas a las que ya fuiste" />

      {cargando ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={C.brand} />
        </View>
      ) : (
        <FlatList
          data={historial}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <HistorialTicketCard item={item} onAbrirFotos={abrirFotos} />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.centerContent}>
              <EmptyState
                icon="time-outline"
                title="Aún no tienes fiestas en tu historial"
                message="Cuando termine una fiesta a la que asististe, aparecerá aquí."
              />
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  listContent: { paddingHorizontal: S.xl, paddingTop: S.xs, flexGrow: 1 },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    marginBottom: S.md,
    padding: S.lg,
    gap: S.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
  },
  avatarWrap: {
    width: 64,
    height: 64,
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
    fontSize: 30,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardFooter: {
    paddingTop: S.xs,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
});

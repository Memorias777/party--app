import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../supabase';
import ConfirmModal from '../../components/ConfirmModal';
import { Button, Chip, FiestaGlow, IconButton, SectionLabel, tap } from '../../components/ui/kit';
import { C, R, S, T, shadow } from '../../constants/design';
import { alpha, paletaParaFiesta, useColoresFiesta } from '../../utils/colors';

export interface Evento {
  id: string | number;
  titulo: string;
  lugar: string;
  latitud: number;
  longitud: number;
  fecha_hora: string;
  tiene_cover: boolean;
  es_byob: boolean;
  solo_mayores: boolean;
  emoji?: string;
  descripcion?: string;
  tipo_fiesta?: string;
  info_cover?: string;
  link_logo?: string;
  colores?: string[] | null;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const HORAS_VISIBLE_DESPUES = 5;

type FiltroTipo = 'todos' | 'Antro' | 'Callejoneada' | 'Norteño';
type FiltroTiempo = 'hoy' | 'semana' | 'mes' | 'todos';

const MAPA_ESTILO_OSCURO = [
  { elementType: 'geometry', stylers: [{ color: '#111118' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#111118' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#71717a' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d4d4d8' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#141c24' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#52525b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1f1f29' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#111118' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#71717a' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#272733' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#111118' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#a1a1aa' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#090d16' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3f3f46' }] },
];

const FILTROS_TIEMPO: { key: FiltroTiempo; label: string }[] = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes', label: 'Este mes' },
  { key: 'todos', label: 'Todas' },
];

export default function IndexScreen() {
  const insets = useSafeAreaInsets();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [session, setSession] = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<Evento | null>(null);
  const [searchText, setSearchText] = useState('');
  const [modalFiltros, setModalFiltros] = useState(false);
  const [modalLoginRequerido, setModalLoginRequerido] = useState(false);

  const [filtroTiempo, setFiltroTiempo] = useState<FiltroTiempo>('todos');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [soloByob, setSoloByob] = useState(false);
  const [soloConCover, setSoloConCover] = useState(false);

  const cardTranslateY = useRef(new Animated.Value(300)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  const coloresSelected = useColoresFiesta(selectedEvent);
  const [colorAcento] = coloresSelected;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchEventos = async () => {
    const limiteTiempo = new Date();
    limiteTiempo.setHours(limiteTiempo.getHours() - HORAS_VISIBLE_DESPUES);

    const { data, error } = await supabase
      .from('eventos')
      .select('*')
      .gte('fecha_hora', limiteTiempo.toISOString());

    if (!error && data) {
      setEventos(data);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchEventos();
    }, [])
  );

  const openCard = (ev: Evento) => {
    tap();
    setSelectedEvent(ev);
    Animated.parallel([
      Animated.spring(cardTranslateY, { toValue: 0, useNativeDriver: true, bounciness: 6 }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const closeCard = () => {
    Animated.parallel([
      Animated.timing(cardTranslateY, { toValue: 300, duration: 200, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setSelectedEvent(null));
  };

  const formatFecha = (fechaISO: string) => {
    try {
      const fecha = new Date(fechaISO);
      return fecha.toLocaleString('es-MX', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return fechaISO;
    }
  };

  const renderCoverInfo = (info?: string) => {
    if (!info || info === 'Sin Cover') return null;
    if (info.startsWith('[')) return 'Cover por etapas';
    return `$${info}`;
  };

  const eventosFiltrados = useMemo(() => {
    let lista = eventos;

    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      lista = lista.filter(
        (ev) =>
          ev.titulo?.toLowerCase().includes(q) ||
          ev.lugar?.toLowerCase().includes(q) ||
          ev.tipo_fiesta?.toLowerCase().includes(q)
      );
    }

    if (filtroTiempo !== 'todos') {
      const ahora = new Date();
      lista = lista.filter((ev) => {
        const fechaEv = new Date(ev.fecha_hora);
        if (filtroTiempo === 'hoy') {
          return fechaEv.toDateString() === ahora.toDateString();
        }
        if (filtroTiempo === 'semana') {
          const finSemana = new Date(ahora);
          finSemana.setDate(ahora.getDate() + (7 - ahora.getDay()));
          return fechaEv <= finSemana;
        }
        if (filtroTiempo === 'mes') {
          return fechaEv.getMonth() === ahora.getMonth() && fechaEv.getFullYear() === ahora.getFullYear();
        }
        return true;
      });
    }

    if (filtroTipo !== 'todos') {
      lista = lista.filter((ev) => ev.tipo_fiesta === filtroTipo);
    }

    if (soloByob) {
      lista = lista.filter((ev) => ev.es_byob);
    }

    if (soloConCover) {
      lista = lista.filter((ev) => ev.tiene_cover);
    }

    return lista;
  }, [eventos, searchText, filtroTiempo, filtroTipo, soloByob, soloConCover]);

  const filtrosActivos = filtroTipo !== 'todos' || soloByob || soloConCover;

  const limpiarFiltros = () => {
    tap();
    setFiltroTipo('todos');
    setSoloByob(false);
    setSoloConCover(false);
  };

  const topOffset = insets.top + 10;

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        customMapStyle={MAPA_ESTILO_OSCURO}
        initialRegion={{
          latitude: 22.7709,
          longitude: -102.5832,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onPress={closeCard}
      >
        {eventosFiltrados.map((ev) => {
          const [colorPin] = paletaParaFiesta(ev);
          return (
            <Marker
              hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}
              key={ev.id}
              coordinate={{ latitude: Number(ev.latitud), longitude: Number(ev.longitud) }}
              onPress={(e) => {
                e.stopPropagation();
                openCard(ev);
              }}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.pinWrapper}>
                {ev.link_logo ? (
                  <View style={[styles.pinHeadWithLogo, { borderColor: colorPin }]}>
                    <Image source={{ uri: ev.link_logo }} style={styles.pinLogoImage} />
                  </View>
                ) : (
                  <View style={[styles.pinHead, { backgroundColor: colorPin }]}>
                    <Text style={{ fontSize: 13 }}>{ev.emoji || '🎉'}</Text>
                  </View>
                )}
                <View style={[styles.pinTail, { borderTopColor: colorPin }]} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Controles flotantes superiores */}
      <View style={[styles.topControlsRow, { top: topOffset }]}>
        <TouchableOpacity
          style={[styles.profileButton, shadow('#000', 6)]}
          activeOpacity={0.8}
          onPress={() => {
            tap();
            if (session) {
              router.push('/(tabs)/perfil');
            } else {
              router.push('/login');
            }
          }}
        >
          <Ionicons name={session ? 'person' : 'key'} size={20} color={C.text} />
        </TouchableOpacity>

        <View style={[styles.searchBar, shadow('#000', 6)]}>
          <Ionicons name="search" size={17} color={C.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar fiestas, lugares..."
            placeholderTextColor={C.textFaint}
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={18} color={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.filterButton, shadow('#000', 6), filtrosActivos && styles.filterButtonActive]}
          activeOpacity={0.7}
          onPress={() => {
            tap();
            setModalFiltros(true);
          }}
        >
          <Ionicons name="options" size={20} color={C.text} />
          {filtrosActivos && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tiempoChipsWrapper, { top: topOffset + 56 }]}
        contentContainerStyle={styles.tiempoChipsContent}
      >
        <View style={styles.counterBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.counterText}>{eventosFiltrados.length} activas</Text>
        </View>
        {FILTROS_TIEMPO.map((f) => {
          const active = filtroTiempo === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.tiempoChip, active && styles.tiempoChipActivo]}
              onPress={() => {
                tap();
                setFiltroTiempo(f.key);
              }}
              activeOpacity={0.75}
            >
              <Text style={[styles.tiempoChipText, active && styles.tiempoChipTextActivo]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Tarjeta inferior de detalle de fiesta seleccionada */}
      <Animated.View
        style={[
          styles.detailCard,
          shadow('#000', 14),
          {
            borderColor: alpha(colorAcento, 0.35),
            transform: [{ translateY: cardTranslateY }],
            opacity: cardOpacity,
          },
        ]}
      >
        {selectedEvent && (
          <View>
            <FiestaGlow colores={coloresSelected} intensity={0.55} />
            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={[
                styles.detailScrollContent,
                { paddingBottom: insets.bottom + 96 },
              ]}
            >
              <View style={styles.detailHeaderRow}>
                <View style={[styles.detailAvatarWrap, { borderColor: colorAcento }]}>
                  {selectedEvent.link_logo ? (
                    <Image source={{ uri: selectedEvent.link_logo }} style={styles.detailAvatarImage} />
                  ) : (
                    <Text style={styles.detailAvatarEmoji}>{selectedEvent.emoji || '🥳'}</Text>
                  )}
                </View>

                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.chipsRow}>
                    <Chip
                      label={selectedEvent.tipo_fiesta || 'Evento'}
                      color={colorAcento}
                      icon="flame"
                    />
                    {selectedEvent.es_byob && <Chip label="BYOB" color={C.textMuted} icon="beer" />}
                    {selectedEvent.solo_mayores && <Chip label="+18" color={C.warning} />}
                    {renderCoverInfo(selectedEvent.info_cover) && (
                      <Chip
                        label={renderCoverInfo(selectedEvent.info_cover)!}
                        color={C.success}
                        icon="cash"
                      />
                    )}
                  </View>
                  <Text style={T.title} numberOfLines={2}>
                    {selectedEvent.titulo}
                  </Text>
                </View>

                <IconButton name="close" onPress={closeCard} size={18} />
              </View>

              <View style={styles.detailMetaBox}>
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={16} color={colorAcento} />
                  <Text style={T.body}>{formatFecha(selectedEvent.fecha_hora)}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="location-outline" size={16} color={colorAcento} />
                  <Text style={T.body} numberOfLines={1}>
                    {selectedEvent.lugar}
                  </Text>
                </View>
              </View>

              <Button
                title="Ver avisos y asistir"
                icon="arrow-forward"
                color={colorAcento}
                onPress={() => {
                  if (session) {
                    router.push(`./fiesta/${selectedEvent.id}`);
                  } else {
                    setModalLoginRequerido(true);
                  }
                }}
                style={{ marginTop: S.md }}
              />
            </ScrollView>
          </View>
        )}
      </Animated.View>

      {/* Modal de filtros */}
      <Modal visible={modalFiltros} transparent animationType="slide" onRequestClose={() => setModalFiltros(false)}>
        <View style={styles.filtrosOverlay}>
          <View style={[styles.filtrosSheet, { paddingBottom: insets.bottom + S.xxl }]}>
            <View style={styles.filtrosHeader}>
              <Text style={T.title}>Filtros</Text>
              <IconButton name="close" onPress={() => setModalFiltros(false)} />
            </View>

            <SectionLabel>Tipo de fiesta</SectionLabel>
            <View style={styles.filtrosTiposRow}>
              {(['todos', 'Antro', 'Callejoneada', 'Norteño'] as FiltroTipo[]).map((tipo) => {
                const active = filtroTipo === tipo;
                return (
                  <TouchableOpacity
                    key={tipo}
                    style={[styles.filtroChip, active && styles.filtroChipActivo]}
                    onPress={() => {
                      tap();
                      setFiltroTipo(tipo);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filtroChipText, active && styles.filtroChipTextActivo]}>
                      {tipo === 'todos' ? 'Todos' : tipo}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.filtrosSwitchRow}
              onPress={() => {
                tap();
                setSoloByob(!soloByob);
              }}
              activeOpacity={0.7}
            >
              <Text style={T.bodyStrong}>🍺 Solo BYOB (Trae tu bebida)</Text>
              <Ionicons
                name={soloByob ? 'checkbox' : 'square-outline'}
                size={24}
                color={soloByob ? C.brand : C.textMuted}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.filtrosSwitchRow}
              onPress={() => {
                tap();
                setSoloConCover(!soloConCover);
              }}
              activeOpacity={0.7}
            >
              <Text style={T.bodyStrong}>💵 Solo con Cover</Text>
              <Ionicons
                name={soloConCover ? 'checkbox' : 'square-outline'}
                size={24}
                color={soloConCover ? C.brand : C.textMuted}
              />
            </TouchableOpacity>

            <View style={styles.filtrosBotonesRow}>
              <Button
                title="Limpiar"
                variant="secondary"
                onPress={limpiarFiltros}
                style={{ flex: 1 }}
              />
              <Button
                title="Aplicar"
                onPress={() => setModalFiltros(false)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={modalLoginRequerido}
        title="¡Estás a un paso! 🔑"
        message="Para unirte a la fiesta, ver los avisos y chatear, necesitas iniciar sesión."
        confirmText="Ir al Login"
        cancelText="Cancelar"
        onCancel={() => setModalLoginRequerido(false)}
        onConfirm={() => {
          setModalLoginRequerido(false);
          router.push('/login');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  map: { flex: 1 },

  topControlsRow: {
    position: 'absolute',
    left: S.lg,
    right: S.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    zIndex: 10,
  },
  profileButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: alpha(C.surface, 0.94),
    borderWidth: 1,
    borderColor: C.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: alpha(C.surface, 0.94),
    borderRadius: R.lg,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: C.borderStrong,
  },
  searchInput: { flex: 1, fontSize: 15, color: C.text },
  filterButton: {
    width: 46,
    height: 46,
    borderRadius: R.lg,
    backgroundColor: alpha(C.surface, 0.94),
    borderWidth: 1,
    borderColor: C.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: { backgroundColor: C.brand, borderColor: C.brand },
  filterDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },

  tiempoChipsWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9,
  },
  tiempoChipsContent: {
    paddingHorizontal: S.lg,
    gap: 8,
    alignItems: 'center',
  },
  counterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: alpha(C.surface, 0.94),
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.borderStrong,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.success,
  },
  counterText: { color: C.text, fontSize: 12, fontWeight: '700' },
  tiempoChip: {
    backgroundColor: alpha(C.surface, 0.92),
    borderWidth: 1,
    borderColor: C.borderStrong,
    borderRadius: R.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tiempoChipActivo: {
    backgroundColor: C.brand,
    borderColor: C.brand,
  },
  tiempoChipText: { color: C.textMuted, fontSize: 12, fontWeight: '700' },
  tiempoChipTextActivo: { color: '#fff' },

  pinWrapper: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pinHead: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinHeadWithLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  pinLogoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },

  detailCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    borderTopLeftRadius: R.xl + 4,
    borderTopRightRadius: R.xl + 4,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: SCREEN_HEIGHT * 0.62,
    zIndex: 10,
  },
  detailScrollContent: {
    padding: S.xl,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    marginBottom: S.md,
  },
  detailAvatarWrap: {
    width: 68,
    height: 68,
    borderRadius: R.lg,
    backgroundColor: C.surfaceAlt,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  detailAvatarImage: {
    width: '100%',
    height: '100%',
  },
  detailAvatarEmoji: {
    fontSize: 32,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  detailMetaBox: {
    backgroundColor: alpha(C.bg, 0.55),
    borderRadius: R.md,
    padding: S.md,
    borderWidth: 1,
    borderColor: C.border,
    gap: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  filtrosOverlay: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  filtrosSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: R.xl,
    borderTopRightRadius: R.xl,
    padding: S.xl,
    borderTopWidth: 1,
    borderColor: C.borderStrong,
  },
  filtrosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: S.lg,
  },
  filtrosTiposRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: S.lg },
  filtroChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: R.md,
    backgroundColor: C.surfaceAlt,
    borderWidth: 1,
    borderColor: C.border,
  },
  filtroChipActivo: { backgroundColor: alpha(C.brand, 0.16), borderColor: C.brand },
  filtroChipText: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
  filtroChipTextActivo: { color: C.brand, fontWeight: '700' },
  filtrosSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.surfaceAlt,
    borderRadius: R.md,
    paddingHorizontal: S.lg,
    paddingVertical: 14,
    marginBottom: S.sm,
    borderWidth: 1,
    borderColor: C.border,
  },
  filtrosBotonesRow: { flexDirection: 'row', gap: S.sm, marginTop: S.lg },
});

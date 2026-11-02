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
import MapView, { Marker } from '../../components/AppMap';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../supabase';
import { Button, Chip, FiestaGlow, IconButton, SectionLabel, tap } from '../../components/ui/kit';
import { C, R, S, T, shadow } from '../../constants/design';
import { alpha, paletaParaFiesta, useColoresFiesta } from '../../utils/colors';
import { checkIsOwner } from '../../utils/admin';

export interface Evento {
  id: string | number;
  titulo: string;
  lugar: string;
  direccion?: string | null;
  latitud: number;
  longitud: number;
  fecha_hora: string;
  hora_fin?: string | null;
  tiene_cover: boolean;
  precio_preventa?: string | null;
  es_byob: boolean;
  solo_mayores: boolean;
  emoji?: string;
  descripcion?: string;
  tipo_fiesta?: string;
  info_cover?: string;
  link_logo?: string;
  colores?: string[] | null;
  dinamicas?: string[] | null;
  generos?: string[] | null;
  vestimenta?: string | null;
}

export interface VenueGroup {
  key: string;
  lugar: string;
  latitud: number;
  longitud: number;
  eventos: Evento[];
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

// Agrupa eventos que estén en el mismo lugar (por nombre normalizado o coordenadas muy cercanas ~35m)
function agruparEventosPorLugar(eventos: Evento[]): VenueGroup[] {
  const ordenados = [...eventos].sort(
    (a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime()
  );
  const grupos: VenueGroup[] = [];

  for (const ev of ordenados) {
    const lat = Number(ev.latitud);
    const lng = Number(ev.longitud);
    const nombreNorm = (ev.lugar || '').trim().toLowerCase();

    const existente = grupos.find((g) => {
      const gNorm = g.lugar.trim().toLowerCase();
      if (nombreNorm && gNorm === nombreNorm) return true;
      const dLat = Math.abs(g.latitud - lat);
      const dLng = Math.abs(g.longitud - lng);
      return dLat < 0.00035 && dLng < 0.00035;
    });

    if (existente) {
      existente.eventos.push(ev);
    } else {
      grupos.push({
        key: `${ev.id}_${nombreNorm}`,
        lugar: ev.lugar || 'Ubicación',
        latitud: lat,
        longitud: lng,
        eventos: [ev],
      });
    }
  }

  return grupos;
}

export default function IndexScreen() {
  const insets = useSafeAreaInsets();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [session, setSession] = useState<any>(null);
  const [esPropietario, setEsPropietario] = useState(false);

  // Grupo de lugar seleccionado en el mapa + índice de la fiesta activa dentro de ese lugar
  const [selectedGroup, setSelectedGroup] = useState<VenueGroup | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const [searchText, setSearchText] = useState('');
  const [modalFiltros, setModalFiltros] = useState(false);

  const [filtroTiempo, setFiltroTiempo] = useState<FiltroTiempo>('todos');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [soloByob, setSoloByob] = useState(false);
  const [soloConCover, setSoloConCover] = useState(false);

  const cardTranslateY = useRef(new Animated.Value(300)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  const selectedEvent = selectedGroup?.eventos[selectedIdx] ?? selectedGroup?.eventos[0] ?? null;
  const coloresSelected = useColoresFiesta(selectedEvent);
  const [colorAcento] = coloresSelected;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      checkIsOwner().then(({ isOwner }) => setEsPropietario(isOwner));
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      checkIsOwner().then(({ isOwner }) => setEsPropietario(isOwner));
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
      checkIsOwner().then(({ isOwner }) => setEsPropietario(isOwner));
    }, [])
  );

  const openGroup = (group: VenueGroup) => {
    tap();
    setSelectedGroup(group);
    setSelectedIdx(0);
    Animated.parallel([
      Animated.spring(cardTranslateY, { toValue: 0, useNativeDriver: true, bounciness: 6 }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const closeCard = () => {
    Animated.parallel([
      Animated.timing(cardTranslateY, { toValue: 300, duration: 200, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setSelectedGroup(null);
      setSelectedIdx(0);
    });
  };

  const formatFecha = (fechaISO: string, horaFin?: string | null) => {
    try {
      const fecha = new Date(fechaISO);
      const base = fecha.toLocaleString('es-MX', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
      return horaFin ? `${base} – ${horaFin}` : base;
    } catch {
      return fechaISO;
    }
  };

  const formatDiaCorto = (fechaISO: string) => {
    try {
      const fecha = new Date(fechaISO);
      return fecha.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  const renderCoverInfo = (ev: Evento) => {
    if (!ev.tiene_cover || !ev.info_cover || ev.info_cover === 'Sin Cover') return 'No Cover';
    if (ev.precio_preventa) return `Preventa $${ev.precio_preventa} · Gral $${ev.info_cover}`;
    if (ev.info_cover.startsWith('[')) return 'Cover por etapas';
    return `Cover $${ev.info_cover}`;
  };

  const eventosFiltrados = useMemo(() => {
    let lista = eventos;

    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      lista = lista.filter(
        (ev) =>
          ev.titulo?.toLowerCase().includes(q) ||
          ev.lugar?.toLowerCase().includes(q) ||
          ev.tipo_fiesta?.toLowerCase().includes(q) ||
          ev.generos?.some((g) => g.toLowerCase().includes(q))
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

  const gruposLugares = useMemo(() => agruparEventosPorLugar(eventosFiltrados), [eventosFiltrados]);

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
        {gruposLugares.map((group) => {
          const evPrincipal = group.eventos[0];
          const [colorPin] = paletaParaFiesta(evPrincipal);
          const cantidad = group.eventos.length;

          return (
            <Marker
              hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}
              key={group.key}
              coordinate={{ latitude: group.latitud, longitude: group.longitud }}
              onPress={(e) => {
                e.stopPropagation();
                openGroup(group);
              }}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.pinWrapper}>
                <View>
                  {evPrincipal.link_logo ? (
                    <View style={[styles.pinHeadWithLogo, { borderColor: colorPin }]}>
                      <Image source={{ uri: evPrincipal.link_logo }} style={styles.pinLogoImage} />
                    </View>
                  ) : (
                    <View style={[styles.pinHead, { backgroundColor: colorPin }]}>
                      <Text style={{ fontSize: 13 }}>{evPrincipal.emoji || '🎉'}</Text>
                    </View>
                  )}

                  {cantidad > 1 && (
                    <View style={[styles.pinCountBadge, { backgroundColor: C.brand }]}>
                      <Text style={styles.pinCountText}>{cantidad}</Text>
                    </View>
                  )}
                </View>
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
          <Ionicons name={session ? 'person' : 'person-outline'} size={20} color={C.text} />
        </TouchableOpacity>

        <View style={[styles.searchBar, shadow('#000', 6)]}>
          <Ionicons name="search" size={17} color={C.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar fiestas, lugares, música..."
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

        {esPropietario && (
          <TouchableOpacity
            style={[styles.adminFab, shadow(C.brand, 8)]}
            activeOpacity={0.85}
            onPress={() => {
              tap();
              router.push('/(tabs)/crear');
            }}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        )}
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

      {/* Tarjeta inferior con carrusel cuando el lugar tiene varias fiestas */}
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
        {selectedGroup && selectedEvent && (
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
              {/* Si hay más de 1 fiesta en este mismo lugar, mostramos el selector/carrusel de fechas */}
              {selectedGroup.eventos.length > 1 && (
                <View style={styles.multiVenueSection}>
                  <View style={styles.multiVenueHeader}>
                    <Ionicons name="layers-outline" size={15} color={colorAcento} />
                    <Text style={[T.micro, { color: C.text }]}>
                      {selectedGroup.eventos.length} FIESTAS PROGRAMADAS EN {selectedGroup.lugar.toUpperCase()}
                    </Text>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.multiVenueCarousel}
                  >
                    {selectedGroup.eventos.map((ev, idx) => {
                      const isSelected = idx === selectedIdx;
                      const [evColor] = paletaParaFiesta(ev);
                      return (
                        <TouchableOpacity
                          key={ev.id}
                          activeOpacity={0.8}
                          onPress={() => {
                            tap();
                            setSelectedIdx(idx);
                          }}
                          style={[
                            styles.venueEventPill,
                            isSelected && {
                              borderColor: evColor,
                              backgroundColor: alpha(evColor, 0.2),
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.venueEventDay,
                              isSelected && { color: evColor },
                            ]}
                          >
                            {formatDiaCorto(ev.fecha_hora)}
                          </Text>
                          <Text style={styles.venueEventTitle} numberOfLines={1}>
                            {ev.titulo}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

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
                    <Chip
                      label={renderCoverInfo(selectedEvent)}
                      color={selectedEvent.tiene_cover ? C.success : C.brand2}
                      icon="cash-outline"
                    />
                    {selectedEvent.es_byob && <Chip label="BYOB" color={C.textMuted} icon="beer" />}
                    {selectedEvent.solo_mayores && <Chip label="+18" color={C.warning} />}
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
                  <Text style={T.body}>
                    {formatFecha(selectedEvent.fecha_hora, selectedEvent.hora_fin)}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="location-outline" size={16} color={colorAcento} />
                  <Text style={T.body} numberOfLines={1}>
                    {selectedEvent.lugar}
                    {selectedEvent.direccion ? ` · ${selectedEvent.direccion}` : ''}
                  </Text>
                </View>
                {selectedEvent.dinamicas && selectedEvent.dinamicas.length > 0 && (
                  <View style={styles.metaItem}>
                    <Ionicons name="gift-outline" size={16} color={C.warning} />
                    <Text style={[T.caption, { color: C.text }]} numberOfLines={1}>
                      {selectedEvent.dinamicas[0]}
                      {selectedEvent.dinamicas.length > 1
                        ? ` (+${selectedEvent.dinamicas.length - 1} promos)`
                        : ''}
                    </Text>
                  </View>
                )}
              </View>

              {/* Acceso libre sin obligar a pasar por Login */}
              <Button
                title="Ver ficha completa y detalles"
                icon="arrow-forward"
                color={colorAcento}
                onPress={() => {
                  router.push(`./fiesta/${selectedEvent.id}`);
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
              <Text style={T.bodyStrong}>🍺 Solo BYOB (Se permite descorche)</Text>
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
  adminFab: {
    width: 46,
    height: 46,
    borderRadius: R.lg,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinHeadWithLogo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  pinLogoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 19,
  },
  pinCountBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
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
    maxHeight: SCREEN_HEIGHT * 0.68,
    zIndex: 10,
  },
  detailScrollContent: {
    padding: S.xl,
  },
  multiVenueSection: {
    marginBottom: S.md,
    paddingBottom: S.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  multiVenueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: S.sm,
  },
  multiVenueCarousel: {
    gap: 8,
  },
  venueEventPill: {
    backgroundColor: C.surfaceAlt,
    borderRadius: R.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: C.border,
    maxWidth: 170,
  },
  venueEventDay: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  venueEventTitle: {
    color: C.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
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

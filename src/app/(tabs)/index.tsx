import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Animated,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, router } from 'expo-router';
import { supabase } from '../../../supabase';
import { Ionicons } from '@expo/vector-icons';
import ConfirmModal from '../../components/ConfirmModal';

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
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const HORAS_VISIBLE_DESPUES = 5;

type FiltroTipo = 'todos' | 'Antro' | 'Callejoneada' | 'Norteño';
type FiltroTiempo = 'hoy' | 'semana' | 'mes' | 'todos';

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

const MAPA_ESTILO_OSCURO = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a8aa3' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#c9c9e0' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#16213e' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#4a5568' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a45' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6c6c8a' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a3a5c' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#b8b8d4' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1b2a' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4a5568' }] },
];

const FILTROS_TIEMPO: { key: FiltroTiempo; label: string }[] = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes', label: 'Este mes' },
  { key: 'todos', label: 'Todas' },
];

export default function IndexScreen() {
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
        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return fechaISO;
    }
  };

  const renderCoverInfo = (info?: string) => {
    if (!info || info === 'Sin Cover') return null;
    if (info.startsWith('[')) return '💵 Cover por etapas';
    return `💵 $${info}`;
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
    setFiltroTipo('todos');
    setSoloByob(false);
    setSoloConCover(false);
  };

  const [colorBannerA, colorBannerB, colorBannerC] = selectedEvent
    ? paletaParaId(String(selectedEvent.id))
    : PALETAS[0];

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
          const [colorPin] = paletaParaId(String(ev.id));
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
                <View style={[styles.pinHead, { backgroundColor: colorPin }]} />
                <View style={[styles.pinTail, { borderTopColor: colorPin }]} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      <TouchableOpacity
        style={styles.profileButton}
        activeOpacity={0.8}
        onPress={() => {
          if (session) {
            router.push('/(tabs)/perfil');
          } else {
            router.push('/login');
          }
        }}
      >
        <Text style={{ fontSize: 22 }}>{session ? '👤' : '🔑'}</Text>
      </TouchableOpacity>

      <View style={styles.searchBarWrapper}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={17} color="#8a8aa3" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar fiestas, lugares..."
            placeholderTextColor="#6c6c8a"
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={18} color="#8a8aa3" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterButton, filtrosActivos && styles.filterButtonActive]}
          activeOpacity={0.7}
          onPress={() => setModalFiltros(true)}
        >
          <Ionicons name="options" size={20} color="#fff" />
          {filtrosActivos && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tiempoChipsWrapper}
        contentContainerStyle={styles.tiempoChipsContent}
      >
        {FILTROS_TIEMPO.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.tiempoChip, filtroTiempo === f.key && styles.tiempoChipActivo]}
            onPress={() => setFiltroTiempo(f.key)}
            activeOpacity={0.75}
          >
            <Text style={[styles.tiempoChipText, filtroTiempo === f.key && styles.tiempoChipTextActivo]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.counterBadge}>
        <Text style={styles.counterText}>🎉 {eventosFiltrados.length} activas</Text>
      </View>

      <Animated.View
        style={[
          styles.detailCard,
          { transform: [{ translateY: cardTranslateY }], opacity: cardOpacity },
        ]}
      >
        {selectedEvent && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.detailScrollContent}
          >
            <LinearGradient
              colors={[colorBannerA, colorBannerB, colorBannerC]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={styles.detailBanner}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.6, y: 0.8 }}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)']}
                start={{ x: 0.3, y: 0.1 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              <TouchableOpacity style={styles.closeButton} onPress={closeCard} activeOpacity={0.7}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>

              <Text style={styles.detailBannerEmoji}>{selectedEvent.emoji || '🥳'}</Text>
              <Text style={styles.detailBannerTitle} numberOfLines={2}>{selectedEvent.titulo}</Text>
            </LinearGradient>

            <View style={styles.detailBody}>
              <View style={styles.chipsRow}>
                <View style={styles.chip}>
                  <Ionicons name="calendar" size={13} color="#c9c9e0" />
                  <Text style={styles.chipText}>{formatFecha(selectedEvent.fecha_hora)}</Text>
                </View>
                <View style={styles.chip}>
                  <Ionicons name="location" size={13} color="#c9c9e0" />
                  <Text style={styles.chipText} numberOfLines={1}>{selectedEvent.lugar}</Text>
                </View>
              </View>

              <View style={styles.chipsRow}>
                {selectedEvent.tipo_fiesta && (
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{selectedEvent.tipo_fiesta}</Text>
                  </View>
                )}
                {selectedEvent.es_byob && (
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>🍻 BYOB</Text>
                  </View>
                )}
                {selectedEvent.solo_mayores && (
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>🔞 +18</Text>
                  </View>
                )}
                {renderCoverInfo(selectedEvent.info_cover) && (
                  <View style={[styles.chip, styles.chipCover]}>
                    <Text style={[styles.chipText, styles.chipCoverText]}>
                      {renderCoverInfo(selectedEvent.info_cover)}
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.attendButton}
                activeOpacity={0.85}
                onPress={() => {
                  if (session) {
                    router.push(`./fiesta/${selectedEvent.id}`);
                  } else {
                    setModalLoginRequerido(true);
                  }
                }}
              >
                <Text style={styles.attendButtonText}>Ver detalles / Asistir</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </Animated.View>

      <Modal visible={modalFiltros} transparent animationType="slide" onRequestClose={() => setModalFiltros(false)}>
        <View style={styles.filtrosOverlay}>
          <View style={styles.filtrosSheet}>
            <View style={styles.filtrosHeader}>
              <Text style={styles.filtrosTitle}>Filtros</Text>
              <TouchableOpacity onPress={() => setModalFiltros(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.filtrosLabel}>Tipo de fiesta</Text>
            <View style={styles.filtrosTiposRow}>
              {(['todos', 'Antro', 'Callejoneada', 'Norteño'] as FiltroTipo[]).map((tipo) => (
                <TouchableOpacity
                  key={tipo}
                  style={[styles.filtroChip, filtroTipo === tipo && styles.filtroChipActivo]}
                  onPress={() => setFiltroTipo(tipo)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filtroChipText, filtroTipo === tipo && styles.filtroChipTextActivo]}>
                    {tipo === 'todos' ? 'Todos' : tipo}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.filtrosSwitchRow} onPress={() => setSoloByob(!soloByob)} activeOpacity={0.7}>
              <Text style={styles.filtrosSwitchLabel}>🍺 Solo BYOB</Text>
              <Ionicons
                name={soloByob ? 'checkbox' : 'square-outline'}
                size={24}
                color={soloByob ? '#ff3b30' : '#8e8e93'}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.filtrosSwitchRow} onPress={() => setSoloConCover(!soloConCover)} activeOpacity={0.7}>
              <Text style={styles.filtrosSwitchLabel}>💵 Solo con Cover</Text>
              <Ionicons
                name={soloConCover ? 'checkbox' : 'square-outline'}
                size={24}
                color={soloConCover ? '#ff3b30' : '#8e8e93'}
              />
            </TouchableOpacity>

            <View style={styles.filtrosBotonesRow}>
              <TouchableOpacity style={styles.filtrosLimpiarBtn} onPress={limpiarFiltros} activeOpacity={0.8}>
                <Text style={styles.filtrosLimpiarText}>Limpiar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filtrosAplicarBtn} onPress={() => setModalFiltros(false)} activeOpacity={0.85}>
                <Text style={styles.filtrosAplicarText}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={modalLoginRequerido}
        title="¡Estás a un paso! 🔑"
        message="Para unirte a la fiesta, ver los detalles y chatear, necesitas iniciar sesión."
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
  container: { flex: 1 },
  map: { flex: 1 },

  profileButton: {
    position: 'absolute',
    top: 60,
    left: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(26, 26, 46, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 10,
  },

  searchBarWrapper: {
    position: 'absolute',
    top: 60,
    left: 74,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.9)',
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#fff' },
  filterButton: {
    marginLeft: 10,
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(26, 26, 46, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  filterButtonActive: { backgroundColor: '#ff3b30', borderColor: '#ff3b30' },
  filterDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#fff',
  },

  tiempoChipsWrapper: {
    position: 'absolute',
    top: 116,
    left: 0,
    right: 0,
  },
  tiempoChipsContent: {
    paddingLeft: 74,
    paddingRight: 16,
    gap: 8,
  },
  tiempoChip: {
    backgroundColor: 'rgba(26, 26, 46, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tiempoChipActivo: {
    backgroundColor: '#ff3b30',
    borderColor: '#ff3b30',
  },
  tiempoChipText: { color: '#c9c9e0', fontSize: 12, fontWeight: '600' },
  tiempoChipTextActivo: { color: '#fff' },

  counterBadge: {
    position: 'absolute',
    top: 164,
    left: 74,
    backgroundColor: 'rgba(26, 26, 46, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  counterText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  pinWrapper: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pinHead: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 8,
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },

  // 🔥 detailCard ahora define un maxHeight que deja espacio real para la
  // tab bar (evita que el botón final quede oculto/cortado), y su contenido
  // vive dentro de un ScrollView por si en pantallas chicas no alcanza.
  detailCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#151525',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 12,
    maxHeight: SCREEN_HEIGHT * 0.6,
    zIndex: 10,
  },
  detailScrollContent: {
    paddingBottom: Platform.OS === 'ios' ? 100 : 84, // 🔥 espacio para que no lo tape la tab bar
  },
  detailBanner: {
    height: 140,
    padding: 18,
    justifyContent: 'flex-end',
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 11,
  },
  detailBannerEmoji: {
    fontSize: 40,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  detailBannerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    paddingRight: 30,
  },
  detailBody: {
    padding: 20,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: { color: '#c9c9e0', fontSize: 12, fontWeight: '600' },
  chipCover: { backgroundColor: 'rgba(255,59,48,0.15)', borderColor: 'rgba(255,59,48,0.4)' },
  chipCoverText: { color: '#ff6b60' },
  attendButton: {
    backgroundColor: '#ff3b30',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 14,
    shadowColor: '#ff3b30',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  attendButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  filtrosOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  filtrosSheet: { backgroundColor: '#151525', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  filtrosHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  filtrosTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  filtrosLabel: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  filtrosTiposRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  filtroChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  filtroChipActivo: { backgroundColor: 'rgba(255,59,48,0.15)', borderColor: '#ff3b30' },
  filtroChipText: { color: '#8a8aa3', fontSize: 13, fontWeight: '600' },
  filtroChipTextActivo: { color: '#ff3b30' },
  filtrosSwitchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10 },
  filtrosSwitchLabel: { color: '#fff', fontSize: 15 },
  filtrosBotonesRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  filtrosLimpiarBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  filtrosLimpiarText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  filtrosAplicarBtn: { flex: 1, backgroundColor: '#ff3b30', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  filtrosAplicarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
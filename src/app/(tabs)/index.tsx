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
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
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
const EMOJIS_DEFAULT = ['🥳', '🍻', '🎶', '🔥', '🎉'];
const HORAS_VISIBLE_DESPUES = 5; // 🔥 cuánto tiempo se queda visible una fiesta ya terminada

type FiltroTipo = 'todos' | 'Antro' | 'Callejoneada' | 'Norteño';

export default function IndexScreen() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [session, setSession] = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<Evento | null>(null);
  const [searchText, setSearchText] = useState('');
  const [modalFiltros, setModalFiltros] = useState(false);
  const [modalLoginRequerido, setModalLoginRequerido] = useState(false);

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
    // 🔥 Solo traemos fiestas que empezaron hace menos de HORAS_VISIBLE_DESPUES horas
    // (o que aún no han pasado). Así el mapa se limpia solo después de un rato.
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

  const getEmoji = (ev: Evento, index: number) => {
    if (ev.emoji && ev.emoji.trim() !== '') return ev.emoji;
    return EMOJIS_DEFAULT[index % EMOJIS_DEFAULT.length];
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
    return `💵 Cover: $${info}`;
  };

  // 🔥 Búsqueda + filtros aplicados sobre la lista de eventos
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
  }, [eventos, searchText, filtroTipo, soloByob, soloConCover]);

  const filtrosActivos =
    filtroTipo !== 'todos' || soloByob || soloConCover ? true : false;

  const limpiarFiltros = () => {
    setFiltroTipo('todos');
    setSoloByob(false);
    setSoloConCover(false);
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 22.7709,
          longitude: -102.5832,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onPress={closeCard}
      >
        {eventosFiltrados.map((ev, index) => (
  <Marker
    hitSlop={{ top: 35, bottom: 35, left: 35, right: 35 }}
    key={ev.id}
    coordinate={{ latitude: Number(ev.latitud), longitude: Number(ev.longitud) }}
    onPress={(e) => {
      e.stopPropagation();
      openCard(ev);
    }}
    anchor={{ x: 0.5, y: 1 }}
  >
    <View style={styles.markerWrapper}>
      <View style={styles.markerContainer}>
        <Text style={styles.markerEmoji}>{getEmoji(ev, index)}</Text>
      </View>
      <View style={styles.markerColita} />
    </View>
  </Marker>
))}
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
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar fiestas, lugares..."
            placeholderTextColor="#8e8e93"
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={18} color="#8e8e93" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterButton, filtrosActivos && styles.filterButtonActive]}
          activeOpacity={0.7}
          onPress={() => setModalFiltros(true)}
        >
          <Text style={styles.filterIcon}>⚙️</Text>
          {filtrosActivos && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>

      <View style={styles.counterBadge}>
        <Text style={styles.counterText}>🎉 {eventosFiltrados.length} activas</Text>
      </View>

      <Animated.View
        style={[
          styles.detailCard,
          { transform: [{ translateY: cardTranslateY }], opacity: cardOpacity },
        ]}
      >
        <TouchableOpacity style={styles.closeButton} onPress={closeCard} activeOpacity={0.7}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>

        {selectedEvent && (
          <>
            <Text style={styles.cardTitle}>{selectedEvent.titulo}</Text>
            <Text style={styles.cardDate}>🗓️ {formatFecha(selectedEvent.fecha_hora)}</Text>

            <Text style={styles.cardDescription}>
              📍 {selectedEvent.lugar}
              {selectedEvent.tipo_fiesta ? ` · ${selectedEvent.tipo_fiesta}` : ''}
              {selectedEvent.es_byob ? ' · BYOB 🍻' : ''}
              {selectedEvent.solo_mayores ? ' · +18 🔞' : ''}
            </Text>

            {renderCoverInfo(selectedEvent.info_cover) && (
              <Text style={styles.cardCoverText}>{renderCoverInfo(selectedEvent.info_cover)}</Text>
            )}

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
          </>
        )}
      </Animated.View>

      {/* Modal de Filtros */}
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
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
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#1c1c1e' },
  filterButton: {
    marginLeft: 10,
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  filterButtonActive: { backgroundColor: '#ff3b30' },
  filterIcon: { fontSize: 18 },
  filterDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#ff3b30',
  },
  counterBadge: {
    position: 'absolute',
    top: 118,
    left: 74,
    backgroundColor: 'rgba(28, 28, 30, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  counterText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // 🔥 Área táctil invisible más grande alrededor del pin
  markerHitArea: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerWrapper: {
  alignItems: 'center',
  justifyContent: 'flex-end',
},
markerContainer: {
  width: 30,
  height: 30,
  borderRadius: 17,
  backgroundColor: '#fff',
  borderWidth: 3,
  borderColor: '#ff3b30',
  alignItems: 'center',
  justifyContent: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.3,
  shadowRadius: 3,
  elevation: 6,
},
markerEmoji: {
  fontSize: 16,
  textAlign: 'center',
},
markerColita: {
  width: 0,
  height: 0,
  borderLeftWidth: 5,
  borderRightWidth: 5,
  borderTopWidth: 7,
  borderLeftColor: 'transparent',
  borderRightColor: 'transparent',
  borderTopColor: '#ff3b30',
  marginTop: -1,
},

  detailCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    maxHeight: SCREEN_HEIGHT * 0.45,
    zIndex: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 11,
  },
  closeButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  cardTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 6, paddingRight: 40 },
  cardDate: { color: '#ff3b30', fontSize: 14, fontWeight: '600', marginBottom: 6 },
  cardDescription: { color: '#8e8e93', fontSize: 14, marginBottom: 8, lineHeight: 20 },
  cardCoverText: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginBottom: 16 },
  attendButton: { backgroundColor: '#ff3b30', borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  attendButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Modal de filtros
  filtrosOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  filtrosSheet: { backgroundColor: '#1c1c1e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  filtrosHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  filtrosTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  filtrosLabel: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  filtrosTiposRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  filtroChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#2c2c2e', borderWidth: 1, borderColor: '#3a3a3c' },
  filtroChipActivo: { backgroundColor: 'rgba(255,59,48,0.15)', borderColor: '#ff3b30' },
  filtroChipText: { color: '#8e8e93', fontSize: 13, fontWeight: '600' },
  filtroChipTextActivo: { color: '#ff3b30' },
  filtrosSwitchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2c2c2e', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10 },
  filtrosSwitchLabel: { color: '#fff', fontSize: 15 },
  filtrosBotonesRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  filtrosLimpiarBtn: { flex: 1, backgroundColor: '#2c2c2e', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  filtrosLimpiarText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  filtrosAplicarBtn: { flex: 1, backgroundColor: '#ff3b30', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  filtrosAplicarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

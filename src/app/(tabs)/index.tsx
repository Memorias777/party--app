import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useFocusEffect, router } from 'expo-router';
import { supabase } from '../../../supabase.js';

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

export default function IndexScreen() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [session, setSession] = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<Evento | null>(null);
  const [searchText, setSearchText] = useState('');

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
    // Regla de las 5 horas
    const limiteTiempo = new Date();
    limiteTiempo.setHours(limiteTiempo.getHours() - 5);

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
      Animated.spring(cardTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 6,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeCard = () => {
    Animated.parallel([
      Animated.timing(cardTranslateY, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
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
    if (info.startsWith('[')) return '💵 Cover por etapas';
    return `💵 Cover: $${info}`;
  };

  // 🔥 LÓGICA DEL BUSCADOR: Filtramos los eventos en tiempo real
  const eventosFiltrados = eventos.filter((ev) => {
    if (!searchText.trim()) return true;
    const textLowerCase = searchText.toLowerCase();
    return (
      ev.titulo.toLowerCase().includes(textLowerCase) || 
      ev.lugar.toLowerCase().includes(textLowerCase)
    );
  });

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
            hitSlop={{ top: 30, bottom: 30, left: 30, right: 30 }} // Ampliado para mejor experiencia táctil
            key={ev.id}
            coordinate={{ latitude: ev.latitud, longitude: ev.longitud }}
            onPress={(e) => {
              e.stopPropagation();
              openCard(ev);
            }}
          >
            <View style={styles.markerContainer}>
              <Text style={styles.markerEmoji}>{getEmoji(ev, index)}</Text>
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
          />
        </View>
        <TouchableOpacity style={styles.filterButton} activeOpacity={0.7}>
          <Text style={styles.filterIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.counterBadge}>
        {/* Contador dinámico basado en la búsqueda */}
        <Text style={styles.counterText}>🎉 {eventosFiltrados.length} activas</Text>
      </View>

      <Animated.View
        style={[
          styles.detailCard,
          {
            transform: [{ translateY: cardTranslateY }],
            opacity: cardOpacity,
          },
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
              <Text style={styles.cardCoverText}>
                {renderCoverInfo(selectedEvent.info_cover)}
              </Text>
            )}

            <TouchableOpacity 
              style={styles.attendButton} 
              activeOpacity={0.85}
              onPress={() => {
                if (session) {
                  router.push(`./fiesta/${selectedEvent.id}`);
                } else {
                  Alert.alert(
                    "¡Estás a un paso!",
                    "Para unirte a la fiesta, ver los detalles y chatear, necesitas iniciar sesión.",
                    [
                      { text: "Cancelar", style: "cancel" },
                      { text: "Ir al Login", onPress: () => router.push('/login') }
                    ]
                  );
                }
              }}
            >
              <Text style={styles.attendButtonText}>Ver detalles / Asistir</Text>
            </TouchableOpacity>
          </>
        )}
      </Animated.View>
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
  filterIcon: { fontSize: 18 },
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
  markerContainer: {
    width: 30,
    height: 30,
    borderTopLeftRadius: 18.25,
    borderTopRightRadius: 18.25,
    borderBottomLeftRadius: 18.25,
    borderBottomRightRadius: 0,
    backgroundColor: '#fff',
    borderWidth: 3.5,
    borderColor: '#ff3b30',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 6,
    marginBottom: 8, 
  },
  markerEmoji: { 
    fontSize: 16, 
    transform: [{ rotate: '-45deg' }],
    textAlign: 'center',
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
});
import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '../../../supabase.js';
import { Ionicons } from '@expo/vector-icons';

export default function FiestaDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [evento, setEvento] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  
  // 🔥 CAMBIO CLAVE: Usamos 'general' y 'aviso' para que la base de datos nos deje pasar
  const [tabActual, setTabActual] = useState<'general' | 'aviso'>('general');
  
  const [userId, setUserId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<any[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);

  // 1. Cargar datos iniciales
  useEffect(() => {
    const iniciarSala = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);

      const { data: eventoData, error: eventoError } = await supabase
        .from('eventos')
        .select('*')
        .eq('id', id)
        .single();

      if (!eventoError && eventoData) {
        setEvento(eventoData);
      }
      setCargando(false);
    };

    if (id) iniciarSala();
  }, [id]);

  // 2. Cargar historial y ESCUCHAR EN TIEMPO REAL
  useEffect(() => {
    if (!id) return;

    // Función para descargar los mensajes que ya existían
    const fetchMensajes = async () => {
      const { data } = await supabase
        .from('mensajes')
        .select('*')
        .eq('evento_id', id)
        .eq('tipo_chat', tabActual)
        .order('creado_en', { ascending: true });

      if (data) setMensajes(data);
    };

    fetchMensajes();

    // Suscripción en Tiempo Real
    const canalChat = supabase
      .channel(`sala_fiesta_${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensajes',
          filter: `evento_id=eq.${id}`, // Solo escuchamos mensajes de esta fiesta
        },
        (payload) => {
          const mensajeNuevo = payload.new;
          // Verificamos que el mensaje sea para la pestaña que estamos viendo
          if (mensajeNuevo.tipo_chat === tabActual) {
            setMensajes((prevMensajes) => {
              // Evitar duplicados por si acaso
              if (prevMensajes.some(m => m.id === mensajeNuevo.id)) return prevMensajes;
              return [...prevMensajes, mensajeNuevo];
            });
          }
        }
      )
      .subscribe();

    // Limpieza al salir de la pantalla o cambiar de pestaña
    return () => {
      supabase.removeChannel(canalChat);
    };
  }, [id, tabActual]);

  const enviarMensaje = async () => {
    if (!nuevoMensaje.trim() || !userId) return;

    if (tabActual === 'aviso' && evento?.creador_id !== userId) {
      Alert.alert("Acceso Denegado", "Solo el administrador puede publicar avisos.");
      return;
    }

    setEnviando(true);
    // Insertamos en la base de datos
    const { error } = await supabase.from('mensajes').insert([
      {
        evento_id: id,
        perfil_id: userId,
        tipo_chat: tabActual, // Ahora enviará 'general' o 'aviso'
        contenido: nuevoMensaje.trim(),
      }
    ]);

    setEnviando(false);

    if (error) {
      console.log("Detalle del error:", error);
      Alert.alert('Error de Supabase', error.message);
    } else {
      setNuevoMensaje('');
    }
  };

  // Función para darle formato bonito a tu "creado_en"
  const formatearHora = (timestamp: string) => {
    if (!timestamp) return '';
    const fecha = new Date(timestamp);
    return fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  if (cargando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff3b30" />
      </View>
    );
  }

  if (!evento) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>No se encontró la fiesta 😢</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Volver al mapa</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.closeIcon} onPress={() => router.back()}>
          <Ionicons name="chevron-down" size={32} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {evento.emoji || '🥳'} {evento.titulo}
        </Text>
        <View style={{ width: 32 }} /> 
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={styles.infoCard}>
          <Text style={styles.infoLugar}>📍 {evento.lugar}</Text>
          <Text style={styles.infoDetalles}>
            {evento.tipo_fiesta ? `${evento.tipo_fiesta} · ` : ''}
            {evento.es_byob ? 'BYOB 🍻 · ' : ''}
            {evento.solo_mayores ? '+18 🔞' : ''}
          </Text>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, tabActual === 'general' && styles.tabActive]}
            onPress={() => setTabActual('general')}
          >
            <Text style={[styles.tabText, tabActual === 'general' && styles.tabTextActive]}>💬 Chat General</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, tabActual === 'aviso' && styles.tabActive]}
            onPress={() => setTabActual('aviso')}
          >
            <Text style={[styles.tabText, tabActual === 'aviso' && styles.tabTextActive]}>📢 Avisos (Admin)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.chatArea}>
          {mensajes.length === 0 ? (
            <View style={styles.chatPlaceholder}>
              <Ionicons name={tabActual === 'general' ? "chatbubbles-outline" : "megaphone-outline"} size={50} color="#3a3a3c" />
              <Text style={styles.placeholderText}>
                {tabActual === 'general' 
                  ? 'El chat está vacío.\n¡Rompe el hielo!' 
                  : 'Aún no hay avisos del administrador.'}
              </Text>
            </View>
          ) : (
            mensajes.map((msg, index) => {
              const esMio = msg.perfil_id === userId;
              return (
                <View key={msg.id || index} style={[styles.burbujaContenedor, esMio ? styles.burbujaContenedorMia : styles.burbujaContenedorAjena]}>
                  <View style={[styles.burbuja, esMio ? styles.burbujaMia : styles.burbujaAjena]}>
                    <Text style={styles.mensajeTexto}>{msg.contenido}</Text>
                  </View>
                  <Text style={styles.horaTexto}>{formatearHora(msg.creado_en)}</Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {!(tabActual === 'aviso' && evento?.creador_id !== userId) && (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.inputBox}
            placeholder={tabActual === 'aviso' ? "Escribe un aviso oficial..." : "Escribe un mensaje..."}
            placeholderTextColor="#8e8e93"
            value={nuevoMensaje}
            onChangeText={setNuevoMensaje}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendButton, (!nuevoMensaje.trim() || enviando) && { opacity: 0.5 }]} 
            onPress={enviarMensaje}
            disabled={!nuevoMensaje.trim() || enviando}
          >
            {enviando ? (
               <ActivityIndicator size="small" color="#fff" />
            ) : (
               <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#fff', fontSize: 18, marginBottom: 20 },
  backButton: { backgroundColor: '#ff3b30', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  backButtonText: { color: '#fff', fontWeight: 'bold' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingHorizontal: 16, paddingBottom: 16, backgroundColor: '#1c1c1e', borderBottomWidth: 1, borderBottomColor: '#2c2c2e' },
  closeIcon: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  body: { flex: 1 },
  infoCard: { backgroundColor: '#1c1c1e', margin: 16, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2c2c2e' },
  infoLugar: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  infoDetalles: { color: '#8e8e93', fontSize: 14 },
  tabContainer: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#1c1c1e', borderRadius: 12, padding: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#2c2c2e' },
  tabText: { color: '#8e8e93', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  chatArea: { paddingHorizontal: 16 },
  chatPlaceholder: { alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  placeholderText: { color: '#8e8e93', textAlign: 'center', marginTop: 12, lineHeight: 22 },
  
  burbujaContenedor: { maxWidth: '80%', marginBottom: 12 },
  burbujaContenedorMia: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  burbujaContenedorAjena: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  burbuja: { padding: 12, borderRadius: 16 },
  burbujaMia: { backgroundColor: '#ff3b30', borderBottomRightRadius: 4 },
  burbujaAjena: { backgroundColor: '#2c2c2e', borderBottomLeftRadius: 4 },
  mensajeTexto: { color: '#fff', fontSize: 15 },
  horaTexto: { color: '#8e8e93', fontSize: 11, marginTop: 4, marginHorizontal: 4 },

  inputContainer: { flexDirection: 'row', padding: 16, paddingBottom: Platform.OS === 'ios' ? 30 : 16, backgroundColor: '#1c1c1e', borderTopWidth: 1, borderTopColor: '#2c2c2e', alignItems: 'flex-end' },
  inputBox: { flex: 1, backgroundColor: '#2c2c2e', color: '#fff', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, marginRight: 10, maxHeight: 100 },
  sendButton: { backgroundColor: '#ff3b30', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
});
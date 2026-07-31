import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '../../supabase.js';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';

export default function FiestaDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { showToast } = useToast();

  const scrollViewRef = useRef<ScrollView>(null);
  const isScrolledUp = useRef(false);

  const [evento, setEvento] = useState<any>(null);
  const [cargando, setCargando] = useState(true);

  const [tabActual, setTabActual] = useState<'general' | 'avisos'>('general');

  const [userId, setUserId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<any[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [linkFotoAviso, setLinkFotoAviso] = useState('');
  const [mostrarInputFoto, setMostrarInputFoto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [esParticipante, setEsParticipante] = useState(false);
  const [uniendo, setUniendo] = useState(false);
  const [asistentes, setAsistentes] = useState(1);
  const [modalUnirse, setModalUnirse] = useState(false);

  useEffect(() => {
    const iniciarSala = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let currentUserId = null;

      if (user) {
        currentUserId = user.id;
        setUserId(currentUserId);
      }

      const { data: eventoData, error: eventoError } = await supabase
        .from('eventos')
        .select('*')
        .eq('id', id)
        .single();

      if (!eventoError && eventoData) {
        setEvento(eventoData);

        if (currentUserId) {
          const { data: participacion } = await supabase
            .from('participantes')
            .select('*')
            .eq('evento_id', id)
            .eq('perfil_id', currentUserId)
            .single();

          if (participacion || eventoData.creador_id === currentUserId) {
            setEsParticipante(true);
          }
        }
      }

      const { count } = await supabase
        .from('participantes')
        .select('*', { count: 'exact', head: true })
        .eq('evento_id', id);

      setAsistentes(count || 1);
      setCargando(false);
    };

    if (id) iniciarSala();
  }, [id]);

  useEffect(() => {
    if (!id || !esParticipante) return;

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

    const nombreCanal = `sala_fiesta_${id}_${Date.now()}`;

    const canalChat = supabase
      .channel(nombreCanal)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `evento_id=eq.${id}` },
        (payload) => {
          const mensajeNuevo = payload.new;
          if (mensajeNuevo.tipo_chat === tabActual) {
            setMensajes((prevMensajes) => {
              if (prevMensajes.some((m) => m.id === mensajeNuevo.id)) return prevMensajes;
              return [...prevMensajes, mensajeNuevo];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canalChat);
    };
  }, [id, tabActual, esParticipante]);

  const unirseAFiesta = async () => {
    if (!userId) return;
    setUniendo(true);

    const { error } = await supabase.from('participantes').insert([
      { evento_id: id, perfil_id: userId, es_admin: userId === evento?.creador_id },
    ]);

    setUniendo(false);

    if (error) {
      showToast('Hubo un problema al unirte a la fiesta', 'error');
    } else {
      setEsParticipante(true);
      setAsistentes((prev) => prev + 1);
      showToast('¡Te uniste a la fiesta! 🥳', 'success');
    }
  };

  // 🔥 Ahora un mensaje puede llevar opcionalmente un link de foto (avisos)
  const enviarMensaje = async () => {
    const contenido = nuevoMensaje.trim();
    const foto = linkFotoAviso.trim();

    if (!contenido && !foto) return;
    if (!userId) return;

    if (tabActual === 'avisos' && evento?.creador_id !== userId) {
      showToast('Solo el administrador puede publicar avisos', 'error');
      return;
    }

    setEnviando(true);
    const { error } = await supabase.from('mensajes').insert([
      {
        evento_id: id,
        perfil_id: userId,
        tipo_chat: tabActual,
        contenido: contenido,
        link_foto: foto || null,
      },
    ]);

    setEnviando(false);

    if (error) {
      showToast('Error al enviar mensaje', 'error', error.message);
    } else {
      setNuevoMensaje('');
      setLinkFotoAviso('');
      setMostrarInputFoto(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const abrirFoto = async (url?: string) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      showToast('No se pudo abrir la imagen', 'error');
    }
  };

  const formatearHora = (timestamp: string) => {
    if (!timestamp) return '';
    const fecha = new Date(timestamp);
    return fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  const esAdmin = evento?.creador_id === userId;
  const puedeEscribirEnTabActual = tabActual === 'general' || esAdmin;

  if (cargando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff3b30" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.closeIcon} onPress={() => router.back()}>
          <Ionicons name="chevron-down" size={32} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {evento.emoji || '🥳'} {evento.titulo} ({asistentes} 👤)
        </Text>

        {esAdmin ? (
          <TouchableOpacity
            style={styles.closeIcon}
            onPress={() => router.push({ pathname: '/crear', params: { id: id } })}
          >
            <Ionicons name="settings-outline" size={26} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 32 }} />
        )}
      </View>

      {/* 🔥 El selector de tabs (General / Avisos) ahora vive FUERA del
          ScrollView, así siempre está visible sin importar cuánto scrolleen
          los mensajes — ya no hay que subir hasta arriba para cambiarlo. */}
      {esParticipante && (
        <View style={styles.tabWrapper}>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, tabActual === 'general' && styles.tabActive]}
              onPress={() => setTabActual('general')}
            >
              <Text style={[styles.tabText, tabActual === 'general' && styles.tabTextActive]}>💬 Chat General</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tabActual === 'avisos' && styles.tabActive]}
              onPress={() => setTabActual('avisos')}
            >
              <Text style={[styles.tabText, tabActual === 'avisos' && styles.tabTextActive]}>📢 Avisos (Admin)</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        style={styles.body}
        contentContainerStyle={{ paddingBottom: 20 }}
        scrollEventThrottle={16}
        onScroll={(event) => {
          const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
          const distanciaAlFondo = contentSize.height - layoutMeasurement.height - contentOffset.y;
          isScrolledUp.current = distanciaAlFondo > 100;
        }}
        onContentSizeChange={() => {
          if (!isScrolledUp.current) {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }
        }}
      >
        <View style={styles.infoCard}>
          <Text style={styles.infoLugar}>📍 {evento.lugar}</Text>
          <Text style={styles.infoDetalles}>
            {evento.tipo_fiesta ? `${evento.tipo_fiesta} · ` : ''}
            {evento.es_byob ? 'BYOB 🍻 · ' : ''}
            {evento.solo_mayores ? '+18 🔞' : ''}
          </Text>
        </View>

        {!esParticipante ? (
          <View style={styles.joinContainer}>
            <View style={styles.lockIconContainer}>
              <Ionicons name="lock-closed" size={40} color="#ff3b30" />
            </View>
            <Text style={styles.joinTitle}>Chat Privado</Text>
            <Text style={styles.joinText}>
              Únete a esta fiesta para confirmar tu asistencia, ver los mensajes y enterarte de los avisos.
            </Text>
            <TouchableOpacity style={styles.joinButton} onPress={() => setModalUnirse(true)} disabled={uniendo}>
              {uniendo ? <ActivityIndicator color="#fff" /> : <Text style={styles.joinButtonText}>🥳 Unirme a la Fiesta</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.chatArea}>
            {mensajes.length === 0 ? (
              <View style={styles.chatPlaceholder}>
                <Ionicons name={tabActual === 'general' ? 'chatbubbles-outline' : 'megaphone-outline'} size={50} color="#3a3a3c" />
                <Text style={styles.placeholderText}>
                  {tabActual === 'general' ? 'El chat está vacío.\n¡Rompe el hielo!' : 'Aún no hay avisos del administrador.'}
                </Text>
              </View>
            ) : (
              mensajes.map((msg, index) => {
                const esMio = msg.perfil_id === userId;
                return (
                  <View key={msg.id || index} style={[styles.burbujaContenedor, esMio ? styles.burbujaContenedorMia : styles.burbujaContenedorAjena]}>
                    <View style={[styles.burbuja, esMio ? styles.burbujaMia : styles.burbujaAjena]}>
                      {msg.link_foto ? (
                        <TouchableOpacity onPress={() => abrirFoto(msg.link_foto)} activeOpacity={0.85}>
                          <View style={styles.fotoPreview}>
                            <Ionicons name="image" size={22} color="#fff" />
                            <Text style={styles.fotoPreviewText}>Ver foto adjunta</Text>
                          </View>
                        </TouchableOpacity>
                      ) : null}
                      {msg.contenido ? <Text style={styles.mensajeTexto}>{msg.contenido}</Text> : null}
                    </View>
                    <Text style={styles.horaTexto}>{formatearHora(msg.creado_en)}</Text>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {esParticipante && puedeEscribirEnTabActual && (
        <View style={styles.inputWrapper}>
          {tabActual === 'avisos' && esAdmin && mostrarInputFoto && (
            <TextInput
              style={styles.inputFoto}
              placeholder="Pega aquí el link de la foto (Google Fotos, Drive, etc.)"
              placeholderTextColor="#8e8e93"
              value={linkFotoAviso}
              onChangeText={setLinkFotoAviso}
              autoCapitalize="none"
            />
          )}
          <View style={styles.inputContainer}>
            {tabActual === 'avisos' && esAdmin && (
              <TouchableOpacity
                style={styles.fotoButton}
                onPress={() => setMostrarInputFoto((v) => !v)}
                activeOpacity={0.7}
              >
                <Ionicons name="image-outline" size={22} color={mostrarInputFoto ? '#ff3b30' : '#8e8e93'} />
              </TouchableOpacity>
            )}
            <TextInput
              style={styles.inputBox}
              placeholder={tabActual === 'avisos' ? 'Escribe un aviso oficial...' : 'Escribe un mensaje...'}
              placeholderTextColor="#8e8e93"
              value={nuevoMensaje}
              onChangeText={setNuevoMensaje}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendButton, (!nuevoMensaje.trim() && !linkFotoAviso.trim()) || enviando ? { opacity: 0.5 } : null]}
              onPress={enviarMensaje}
              disabled={(!nuevoMensaje.trim() && !linkFotoAviso.trim()) || enviando}
            >
              {enviando ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={20} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ConfirmModal
        visible={modalUnirse}
        title="Unirte a la fiesta 🥳"
        message="Vas a confirmar tu asistencia y podrás ver el chat y los avisos del administrador."
        confirmText="Unirme"
        onCancel={() => setModalUnirse(false)}
        onConfirm={() => {
          setModalUnirse(false);
          unirseAFiesta();
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingHorizontal: 16, paddingBottom: 16, backgroundColor: '#1c1c1e', borderBottomWidth: 1, borderBottomColor: '#2c2c2e' },
  closeIcon: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  body: { flex: 1 },
  infoCard: { backgroundColor: '#1c1c1e', margin: 16, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2c2c2e' },
  infoLugar: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  infoDetalles: { color: '#8e8e93', fontSize: 14 },
  joinContainer: { alignItems: 'center', paddingHorizontal: 30, marginTop: 40 },
  lockIconContainer: { backgroundColor: '#2c2c2e', width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  joinTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  joinText: { color: '#8e8e93', fontSize: 15, textAlign: 'center', marginBottom: 30, lineHeight: 22 },
  joinButton: { backgroundColor: '#ff3b30', width: '100%', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  joinButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  // 🔥 Tab fijo (ya no scrollea con los mensajes)
  tabWrapper: { backgroundColor: '#000', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#1c1c1e' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#1c1c1e', borderRadius: 12, padding: 4 },
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
  fotoPreview: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 6 },
  fotoPreviewText: { color: '#fff', fontSize: 13, fontWeight: '600', marginLeft: 6 },
  inputWrapper: { backgroundColor: '#1c1c1e', borderTopWidth: 1, borderTopColor: '#2c2c2e' },
  inputFoto: { backgroundColor: '#2c2c2e', color: '#fff', borderRadius: 12, marginHorizontal: 16, marginTop: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13 },
  inputContainer: { flexDirection: 'row', padding: 16, paddingBottom: Platform.OS === 'ios' ? 30 : 16, alignItems: 'flex-end' },
  fotoButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  inputBox: { flex: 1, backgroundColor: '#2c2c2e', color: '#fff', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, marginRight: 10, maxHeight: 100 },
  sendButton: { backgroundColor: '#ff3b30', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
});

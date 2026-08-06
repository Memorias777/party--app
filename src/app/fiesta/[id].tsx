import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../../../supabase';
import ConfirmModal from '../../components/ConfirmModal';
import { useToast } from '../../components/Toast';
import { seleccionarYSubirImagen } from '../../utils/uploadImage';

// Misma familia de paletas "pintura líquida" del resto de la app —
// cada fiesta usa siempre la misma, coherente con el mapa y la lista.
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

// -----------------------------------------------------------------------
// Header animado: gradiente en movimiento infinito con el color propio
// de esta fiesta (mismo patrón "ola sin cortes" del resto de la app).
// -----------------------------------------------------------------------
function HeaderVivo({ colores }: { colores: string[] }) {
  const shift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shift, { toValue: 1, duration: 5000, useNativeDriver: true }),
        Animated.timing(shift, { toValue: 0, duration: 5000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shift]);

  const translateX = shift.interpolate({ inputRange: [0, 1], outputRange: [-40, 40] });

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: -60,
          right: -60,
          transform: [{ translateX }],
        }}
      >
        <LinearGradient
          colors={[colores[0], colores[1], colores[2], colores[1], colores[0]] as any}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <LinearGradient
        colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.5)']}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

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
  const [fotoAdjuntaUrl, setFotoAdjuntaUrl] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [esParticipante, setEsParticipante] = useState(false);
  const [uniendo, setUniendo] = useState(false);
  const [asistentes, setAsistentes] = useState(1);
  const [modalUnirse, setModalUnirse] = useState(false);

  // Estados para gestión de mensajes (menú contextual, editar, borrar)
  const [mensajeSeleccionado, setMensajeSeleccionado] = useState<any | null>(null);
  const [modalMenuMsg, setModalMenuMsg] = useState(false);
  const [modalEditarMsg, setModalEditarMsg] = useState(false);
  const [textoEditar, setTextoEditar] = useState('');
  const [modalConfirmBorrarMsg, setModalConfirmBorrarMsg] = useState(false);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

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
        { event: '*', schema: 'public', table: 'mensajes', filter: `evento_id=eq.${id}` },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const mensajeNuevo = payload.new;
            if (mensajeNuevo.tipo_chat === tabActual) {
              setMensajes((prevMensajes) => {
                if (prevMensajes.some((m) => m.id === mensajeNuevo.id)) return prevMensajes;
                return [...prevMensajes, mensajeNuevo];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const mensajeEditado = payload.new;
            setMensajes((prevMensajes) =>
              prevMensajes.map((m) => (m.id === mensajeEditado.id ? mensajeEditado : m))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setMensajes((prevMensajes) => prevMensajes.filter((m) => m.id !== deletedId));
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

  const handleSubirFotoAviso = async () => {
    try {
      setSubiendoFoto(true);
      const url = await seleccionarYSubirImagen('fotos-fiestas');
      if (url) {
        setFotoAdjuntaUrl(url);
        showToast('Imagen adjuntada 📷', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Error al seleccionar imagen', 'error');
    } finally {
      setSubiendoFoto(false);
    }
  };

  const enviarMensaje = async () => {
    const contenido = nuevoMensaje.trim();
    const foto = fotoAdjuntaUrl;

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
      setFotoAdjuntaUrl(null);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleLongPressMensaje = (msg: any) => {
    const esMio = msg.perfil_id === userId;
    const esAdmin = evento?.creador_id === userId;
    if (esMio || esAdmin) {
      setMensajeSeleccionado(msg);
      setModalMenuMsg(true);
    }
  };

  const abrirModalEditar = () => {
    if (!mensajeSeleccionado) return;
    setTextoEditar(mensajeSeleccionado.contenido || '');
    setModalMenuMsg(false);
    setModalEditarMsg(true);
  };

  const guardarEdicionMensaje = async () => {
    if (!mensajeSeleccionado) return;
    setGuardandoEdicion(true);

    const { error } = await supabase
      .from('mensajes')
      .update({
        contenido: textoEditar.trim(),
      })
      .eq('id', mensajeSeleccionado.id);

    setGuardandoEdicion(false);

    if (error) {
      showToast('No se pudo editar el mensaje', 'error');
    } else {
      showToast('Mensaje actualizado ✏️', 'success');
      setModalEditarMsg(false);
      setMensajeSeleccionado(null);
    }
  };

  const confirmarBorrarMensaje = () => {
    setModalMenuMsg(false);
    setModalConfirmBorrarMsg(true);
  };

  const borrarMensajeConfirmado = async () => {
    if (!mensajeSeleccionado) return;
    setModalConfirmBorrarMsg(false);

    const { error } = await supabase.from('mensajes').delete().eq('id', mensajeSeleccionado.id);

    if (error) {
      showToast('No se pudo eliminar el mensaje', 'error');
    } else {
      showToast('Mensaje eliminado 🗑️', 'success');
      setMensajeSeleccionado(null);
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

  const coloresFiesta = paletaParaId(String(id));
  const [colorAcento] = coloresFiesta;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <HeaderVivo colores={coloresFiesta} />

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
        <View style={[styles.infoCard, { borderColor: colorAcento + '55' }]}>
          <Text style={styles.infoLugar}>📍 {evento.lugar}</Text>
          <Text style={styles.infoDetalles}>
            {evento.tipo_fiesta ? `${evento.tipo_fiesta} · ` : ''}
            {evento.es_byob ? 'BYOB 🍻 · ' : ''}
            {evento.solo_mayores ? '+18 🔞' : ''}
          </Text>
        </View>

        {!esParticipante ? (
          <View style={styles.joinContainer}>
            <View style={[styles.lockIconContainer, { backgroundColor: colorAcento + '22' }]}>
              <Ionicons name="lock-closed" size={40} color={colorAcento} />
            </View>
            <Text style={styles.joinTitle}>Chat Privado</Text>
            <Text style={styles.joinText}>
              Únete a esta fiesta para confirmar tu asistencia, ver los mensajes y enterarte de los avisos.
            </Text>
            <TouchableOpacity
              style={[styles.joinButton, { backgroundColor: colorAcento }]}
              onPress={() => setModalUnirse(true)}
              disabled={uniendo}
            >
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
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onLongPress={() => handleLongPressMensaje(msg)}
                      style={[styles.burbuja, esMio ? { backgroundColor: colorAcento, borderBottomRightRadius: 4 } : styles.burbujaAjena]}
                    >
                      {msg.link_foto ? (
                        <TouchableOpacity onPress={() => abrirFoto(msg.link_foto)} activeOpacity={0.9}>
                          <Image source={{ uri: msg.link_foto }} style={styles.mensajeImagen} />
                        </TouchableOpacity>
                      ) : null}
                      {msg.contenido ? <Text style={styles.mensajeTexto}>{msg.contenido}</Text> : null}
                    </TouchableOpacity>
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
          {fotoAdjuntaUrl && (
            <View style={styles.fotoAdjuntaContainer}>
              <View style={styles.fotoAdjuntaChip}>
                <Image source={{ uri: fotoAdjuntaUrl }} style={styles.fotoAdjuntaMinia} />
                <Text style={styles.fotoAdjuntaText}>Foto adjunta</Text>
                <TouchableOpacity onPress={() => setFotoAdjuntaUrl(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={20} color="#ff3b30" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          <View style={styles.inputContainer}>
            {tabActual === 'avisos' && esAdmin && (
              <TouchableOpacity
                style={styles.fotoButton}
                onPress={handleSubirFotoAviso}
                disabled={subiendoFoto}
                activeOpacity={0.7}
              >
                {subiendoFoto ? (
                  <ActivityIndicator size="small" color={colorAcento} />
                ) : (
                  <Ionicons name="camera" size={24} color={colorAcento} />
                )}
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
              style={[styles.sendButton, { backgroundColor: colorAcento }, (!nuevoMensaje.trim() && !fotoAdjuntaUrl) || enviando ? { opacity: 0.5 } : null]}
              onPress={enviarMensaje}
              disabled={(!nuevoMensaje.trim() && !fotoAdjuntaUrl) || enviando}
            >
              {enviando ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={20} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modal Menú Contextual (onLongPress) */}
      <Modal visible={modalMenuMsg} transparent animationType="fade" onRequestClose={() => setModalMenuMsg(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalMenuMsg(false)}>
          <View style={styles.menuContainer}>
            <Text style={styles.menuTitle}>Opciones de mensaje</Text>

            <TouchableOpacity style={styles.menuOption} onPress={abrirModalEditar}>
              <Ionicons name="pencil" size={20} color="#fff" style={{ marginRight: 12 }} />
              <Text style={styles.menuOptionText}>Editar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuOption} onPress={confirmarBorrarMensaje}>
              <Ionicons name="trash-outline" size={20} color="#ff3b30" style={{ marginRight: 12 }} />
              <Text style={[styles.menuOptionText, { color: '#ff3b30' }]}>Borrar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuCancelButton} onPress={() => setModalMenuMsg(false)}>
              <Text style={styles.menuCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal Editar Mensaje */}
      <Modal visible={modalEditarMsg} transparent animationType="slide" onRequestClose={() => setModalEditarMsg(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalEditContainer}>
            <Text style={styles.modalEditTitle}>Editar mensaje</Text>

            <TextInput
              style={styles.modalEditInput}
              value={textoEditar}
              onChangeText={setTextoEditar}
              multiline
              placeholder="Escribe el nuevo texto..."
              placeholderTextColor="#8e8e93"
              autoFocus
            />

            <View style={styles.modalEditButtons}>
              <TouchableOpacity style={styles.modalEditBtnCancel} onPress={() => setModalEditarMsg(false)}>
                <Text style={styles.modalEditBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalEditBtnSave, { backgroundColor: colorAcento }]}
                onPress={guardarEdicionMensaje}
                disabled={guardandoEdicion}
              >
                {guardandoEdicion ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalEditBtnSaveText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

      <ConfirmModal
        visible={modalConfirmBorrarMsg}
        title="Borrar mensaje 🗑️"
        message="¿Estás seguro de que deseas eliminar este mensaje? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        onCancel={() => setModalConfirmBorrarMsg(false)}
        onConfirm={borrarMensajeConfirmado}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d18' },
  loadingContainer: { flex: 1, backgroundColor: '#0d0d18', justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  closeIcon: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  body: { flex: 1 },
  infoCard: { backgroundColor: '#16162a', margin: 16, borderRadius: 16, padding: 16, borderWidth: 1 },
  infoLugar: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  infoDetalles: { color: '#8a8aa3', fontSize: 14 },
  joinContainer: { alignItems: 'center', paddingHorizontal: 30, marginTop: 40 },
  lockIconContainer: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  joinTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  joinText: { color: '#8a8aa3', fontSize: 15, textAlign: 'center', marginBottom: 30, lineHeight: 22 },
  joinButton: { width: '100%', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  joinButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  tabWrapper: { backgroundColor: '#0d0d18', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#16162a' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#16162a', borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: 'rgba(255,255,255,0.08)' },
  tabText: { color: '#8a8aa3', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  chatArea: { paddingHorizontal: 16 },
  chatPlaceholder: { alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  placeholderText: { color: '#8a8aa3', textAlign: 'center', marginTop: 12, lineHeight: 22 },
  burbujaContenedor: { maxWidth: '80%', marginBottom: 12 },
  burbujaContenedorMia: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  burbujaContenedorAjena: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  burbuja: { padding: 12, borderRadius: 16 },
  burbujaAjena: { backgroundColor: '#22223a', borderBottomLeftRadius: 4 },
  mensajeTexto: { color: '#fff', fontSize: 15 },
  horaTexto: { color: '#6c6c8a', fontSize: 11, marginTop: 4, marginHorizontal: 4 },
  mensajeImagen: { width: 220, height: 140, borderRadius: 12, marginBottom: 6, resizeMode: 'cover' },
  inputWrapper: { backgroundColor: '#16162a', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  fotoAdjuntaContainer: { paddingHorizontal: 16, paddingTop: 10 },
  fotoAdjuntaChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#22223a', padding: 6, paddingRight: 10, borderRadius: 10, alignSelf: 'flex-start' },
  fotoAdjuntaMinia: { width: 32, height: 32, borderRadius: 6, marginRight: 8 },
  fotoAdjuntaText: { color: '#fff', fontSize: 13, fontWeight: '600', marginRight: 10 },
  inputContainer: { flexDirection: 'row', padding: 16, paddingBottom: Platform.OS === 'ios' ? 30 : 16, alignItems: 'flex-end' },
  fotoButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  inputBox: { flex: 1, backgroundColor: '#22223a', color: '#fff', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, marginRight: 10, maxHeight: 100 },
  sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  menuContainer: { backgroundColor: '#1c1c2e', borderRadius: 20, width: '100%', maxWidth: 320, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  menuTitle: { color: '#8a8aa3', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginBottom: 16, textAlign: 'center' },
  menuOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  menuOptionText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  menuCancelButton: { marginTop: 14, paddingTop: 10, alignItems: 'center' },
  menuCancelText: { color: '#8a8aa3', fontSize: 15, fontWeight: '600' },
  modalEditContainer: { backgroundColor: '#1c1c2e', borderRadius: 20, width: '100%', maxWidth: 340, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalEditTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  modalEditInput: { backgroundColor: '#2a2a3e', color: '#fff', borderRadius: 14, padding: 14, fontSize: 15, minHeight: 80, textAlignVertical: 'top', marginBottom: 20 },
  modalEditButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalEditBtnCancel: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  modalEditBtnCancelText: { color: '#8a8aa3', fontSize: 15, fontWeight: '600' },
  modalEditBtnSave: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, minWidth: 90, alignItems: 'center' },
  modalEditBtnSaveText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
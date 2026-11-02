import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../supabase';
import ConfirmModal from '../../components/ConfirmModal';
import ImageViewer from '../../components/ImageViewer';
import { useToast } from '../../components/Toast';
import { Button, Card, Chip, EmptyState, FiestaGlow, IconButton, tap } from '../../components/ui/kit';
import { C, R, S, T } from '../../constants/design';
import { alpha, textoSobre, useColoresFiesta } from '../../utils/colors';
import { seleccionarYSubirImagen } from '../../utils/uploadImage';

export default function FiestaDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const scrollViewRef = useRef<ScrollView>(null);
  const isScrolledUp = useRef(false);

  const [evento, setEvento] = useState<any>(null);
  const [cargando, setCargando] = useState(true);

  // Avisos primero: la info oficial de la fiesta es lo principal al entrar
  const [tabActual, setTabActual] = useState<'general' | 'avisos'>('avisos');

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

  // Foto abierta en el visor a pantalla completa (null = cerrado)
  const [fotoVisor, setFotoVisor] = useState<string | null>(null);

  const coloresFiesta = useColoresFiesta(evento || { id: String(id) });
  const [colorAcento] = coloresFiesta;
  const fgSobreAcento = textoSobre(colorAcento);

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
      tap();
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

  const abrirFoto = (url?: string) => {
    if (!url) return;
    tap();
    setFotoVisor(url);
  };

  const formatearHora = (timestamp: string) => {
    if (!timestamp) return '';
    const fecha = new Date(timestamp);
    return fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  const formatearFechaEvento = (fechaISO?: string) => {
    if (!fechaISO) return '';
    try {
      return new Date(fechaISO).toLocaleString('es-MX', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const esAdmin = evento?.creador_id === userId;
  const puedeEscribirEnTabActual = tabActual === 'general' || esAdmin;

  if (cargando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={C.brand} />
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

      {/* Header con glow de los colores del logo de la fiesta */}
      <View style={[styles.header, { paddingTop: insets.top + S.sm }]}>
        <FiestaGlow colores={coloresFiesta} intensity={0.65} />

        <IconButton name="chevron-down" onPress={() => router.back()} bg={alpha(C.bg, 0.5)} />

        <View style={styles.headerTitleContainer}>
          {evento?.link_logo ? (
            <Image
              source={{ uri: evento.link_logo }}
              style={[styles.headerLogoAvatar, { borderColor: colorAcento }]}
            />
          ) : (
            <Text style={{ fontSize: 20, marginRight: 6 }}>{evento?.emoji || '🥳'}</Text>
          )}
          <View style={{ flex: 1 }}>
            <Text style={T.subtitle} numberOfLines={1}>
              {evento?.titulo}
            </Text>
            <Text style={T.caption} numberOfLines={1}>
              {asistentes} {asistentes === 1 ? 'asistente' : 'asistentes'}
            </Text>
          </View>
        </View>

        {esAdmin ? (
          <IconButton
            name="settings-outline"
            onPress={() => router.push({ pathname: '/crear', params: { id: id } })}
            bg={alpha(C.bg, 0.5)}
          />
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {esParticipante && (
        <View style={styles.tabWrapper}>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[
                styles.tab,
                tabActual === 'avisos' && { backgroundColor: colorAcento },
              ]}
              onPress={() => {
                tap();
                setTabActual('avisos');
              }}
            >
              <Ionicons
                name="megaphone"
                size={15}
                color={tabActual === 'avisos' ? fgSobreAcento : C.textMuted}
              />
              <Text
                style={[
                  styles.tabText,
                  tabActual === 'avisos' && { color: fgSobreAcento, fontWeight: '700' },
                ]}
              >
                Avisos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tab,
                tabActual === 'general' && { backgroundColor: colorAcento },
              ]}
              onPress={() => {
                tap();
                setTabActual('general');
              }}
            >
              <Ionicons
                name="chatbubbles"
                size={15}
                color={tabActual === 'general' ? fgSobreAcento : C.textMuted}
              />
              <Text
                style={[
                  styles.tabText,
                  tabActual === 'general' && { color: fgSobreAcento, fontWeight: '700' },
                ]}
              >
                Chat General
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        style={styles.body}
        contentContainerStyle={{ paddingBottom: S.xxl }}
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
        {/* Tarjeta resumen de la fiesta siempre a la mano */}
        <Card style={[styles.infoCard, { borderColor: alpha(colorAcento, 0.35) }]}>
          <FiestaGlow colores={coloresFiesta} intensity={0.35} />
          <View style={styles.infoRow}>
            <View style={[styles.heroLogoWrap, { borderColor: colorAcento }]}>
              {evento?.link_logo ? (
                <Image source={{ uri: evento.link_logo }} style={styles.heroLogoImage} />
              ) : (
                <Text style={{ fontSize: 32 }}>{evento?.emoji || '🥳'}</Text>
              )}
            </View>

            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.chipsRow}>
                {evento?.tipo_fiesta ? (
                  <Chip label={evento.tipo_fiesta} color={colorAcento} />
                ) : null}
                {evento?.es_byob ? <Chip label="BYOB" color={C.textMuted} icon="beer" /> : null}
                {evento?.solo_mayores ? <Chip label="+18" color={C.warning} /> : null}
              </View>
              <View style={styles.metaLine}>
                <Ionicons name="location-outline" size={14} color={colorAcento} />
                <Text style={T.bodyStrong} numberOfLines={1}>
                  {evento?.lugar}
                </Text>
              </View>
              {evento?.fecha_hora ? (
                <View style={styles.metaLine}>
                  <Ionicons name="calendar-outline" size={14} color={C.textMuted} />
                  <Text style={T.caption}>{formatearFechaEvento(evento.fecha_hora)}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </Card>

        {!esParticipante ? (
          <View style={styles.joinContainer}>
            <View style={[styles.lockIconContainer, { backgroundColor: alpha(colorAcento, 0.16) }]}>
              <Ionicons name="lock-closed" size={36} color={colorAcento} />
            </View>
            <Text style={T.title}>Sala de la Fiesta</Text>
            <Text style={[T.caption, styles.joinText]}>
              Únete a esta fiesta para confirmar tu asistencia, ver los avisos oficiales y participar en el chat.
            </Text>
            <Button
              title="Unirme a la Fiesta"
              icon="sparkles"
              color={colorAcento}
              loading={uniendo}
              onPress={() => setModalUnirse(true)}
              style={{ width: '100%' }}
            />
          </View>
        ) : (
          <View style={styles.chatArea}>
            {mensajes.length === 0 ? (
              <EmptyState
                icon={tabActual === 'general' ? 'chatbubbles-outline' : 'megaphone-outline'}
                title={
                  tabActual === 'general'
                    ? 'El chat está vacío'
                    : 'Aún no hay avisos del organizador'
                }
                message={
                  tabActual === 'general'
                    ? '¡Rompe el hielo con el primer mensaje!'
                    : 'Aquí aparecerán los anuncios importantes, ubicación exacta y fotos oficiales.'
                }
              />
            ) : (
              mensajes.map((msg, index) => {
                const esMio = msg.perfil_id === userId;

                if (tabActual === 'avisos') {
                  return (
                    <Card
                      key={msg.id || index}
                      onLongPress={() => handleLongPressMensaje(msg)}
                      style={[
                        styles.avisoCard,
                        { borderLeftColor: colorAcento, borderColor: alpha(colorAcento, 0.25) },
                      ]}
                    >
                      <View style={styles.avisoHeader}>
                        <View style={[styles.avisoBadge, { backgroundColor: alpha(colorAcento, 0.16) }]}>
                          <Ionicons name="megaphone" size={13} color={colorAcento} />
                          <Text style={[styles.avisoBadgeText, { color: colorAcento }]}>
                            AVISO OFICIAL
                          </Text>
                        </View>
                        <Text style={T.micro}>{formatearHora(msg.creado_en)}</Text>
                      </View>

                      {msg.link_foto ? (
                        <TouchableOpacity onPress={() => abrirFoto(msg.link_foto)} activeOpacity={0.9}>
                          <Image source={{ uri: msg.link_foto }} style={styles.avisoImagen} />
                        </TouchableOpacity>
                      ) : null}

                      {msg.contenido ? <Text style={T.body}>{msg.contenido}</Text> : null}
                    </Card>
                  );
                }

                return (
                  <View
                    key={msg.id || index}
                    style={[
                      styles.burbujaContenedor,
                      esMio ? styles.burbujaContenedorMia : styles.burbujaContenedorAjena,
                    ]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onLongPress={() => handleLongPressMensaje(msg)}
                      style={[
                        styles.burbuja,
                        esMio
                          ? { backgroundColor: colorAcento, borderBottomRightRadius: 4 }
                          : styles.burbujaAjena,
                      ]}
                    >
                      {msg.link_foto ? (
                        <TouchableOpacity onPress={() => abrirFoto(msg.link_foto)} activeOpacity={0.9}>
                          <Image source={{ uri: msg.link_foto }} style={styles.mensajeImagen} />
                        </TouchableOpacity>
                      ) : null}
                      {msg.contenido ? (
                        <Text
                          style={[
                            styles.mensajeTexto,
                            { color: esMio ? fgSobreAcento : C.text },
                          ]}
                        >
                          {msg.contenido}
                        </Text>
                      ) : null}
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
        <View style={[styles.inputWrapper, { paddingBottom: Math.max(insets.bottom, S.md) }]}>
          {fotoAdjuntaUrl && (
            <View style={styles.fotoAdjuntaContainer}>
              <View style={styles.fotoAdjuntaChip}>
                <Image source={{ uri: fotoAdjuntaUrl }} style={styles.fotoAdjuntaMinia} />
                <Text style={T.bodyStrong}>Foto adjunta</Text>
                <TouchableOpacity
                  onPress={() => setFotoAdjuntaUrl(null)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={20} color={C.danger} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          <View style={styles.inputContainer}>
            {tabActual === 'avisos' && esAdmin && (
              <TouchableOpacity
                style={[styles.fotoButton, { backgroundColor: alpha(colorAcento, 0.14) }]}
                onPress={handleSubirFotoAviso}
                disabled={subiendoFoto}
                activeOpacity={0.7}
              >
                {subiendoFoto ? (
                  <ActivityIndicator size="small" color={colorAcento} />
                ) : (
                  <Ionicons name="camera" size={22} color={colorAcento} />
                )}
              </TouchableOpacity>
            )}
            <TextInput
              style={styles.inputBox}
              placeholder={
                tabActual === 'avisos' ? 'Escribe un aviso oficial...' : 'Escribe un mensaje...'
              }
              placeholderTextColor={C.textFaint}
              value={nuevoMensaje}
              onChangeText={setNuevoMensaje}
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: colorAcento },
                (!nuevoMensaje.trim() && !fotoAdjuntaUrl) || enviando ? { opacity: 0.45 } : null,
              ]}
              onPress={enviarMensaje}
              disabled={(!nuevoMensaje.trim() && !fotoAdjuntaUrl) || enviando}
            >
              {enviando ? (
                <ActivityIndicator size="small" color={fgSobreAcento} />
              ) : (
                <Ionicons name="send" size={18} color={fgSobreAcento} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modal Menú Contextual (onLongPress) */}
      <Modal
        visible={modalMenuMsg}
        transparent
        animationType="fade"
        onRequestClose={() => setModalMenuMsg(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalMenuMsg(false)}
        >
          <View style={styles.menuContainer}>
            <Text style={[T.micro, { textAlign: 'center', marginBottom: S.md }]}>
              OPCIONES DE MENSAJE
            </Text>

            <TouchableOpacity style={styles.menuOption} onPress={abrirModalEditar}>
              <Ionicons name="pencil" size={20} color={C.text} style={{ marginRight: 12 }} />
              <Text style={T.bodyStrong}>Editar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuOption} onPress={confirmarBorrarMensaje}>
              <Ionicons name="trash-outline" size={20} color={C.danger} style={{ marginRight: 12 }} />
              <Text style={[T.bodyStrong, { color: C.danger }]}>Borrar</Text>
            </TouchableOpacity>

            <Button
              title="Cancelar"
              variant="secondary"
              small
              onPress={() => setModalMenuMsg(false)}
              style={{ marginTop: S.md }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal Editar Mensaje */}
      <Modal
        visible={modalEditarMsg}
        transparent
        animationType="slide"
        onRequestClose={() => setModalEditarMsg(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalEditContainer}>
            <Text style={[T.subtitle, { marginBottom: S.md }]}>Editar mensaje</Text>

            <TextInput
              style={styles.modalEditInput}
              value={textoEditar}
              onChangeText={setTextoEditar}
              multiline
              placeholder="Escribe el nuevo texto..."
              placeholderTextColor={C.textFaint}
              autoFocus
            />

            <View style={styles.modalEditButtons}>
              <Button
                title="Cancelar"
                variant="secondary"
                small
                onPress={() => setModalEditarMsg(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Guardar"
                color={colorAcento}
                small
                loading={guardandoEdicion}
                onPress={guardarEdicionMensaje}
                style={{ flex: 1 }}
              />
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
        destructive
        onCancel={() => setModalConfirmBorrarMsg(false)}
        onConfirm={borrarMensajeConfirmado}
      />

      <ImageViewer url={fotoVisor} onClose={() => setFotoVisor(null)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loadingContainer: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: S.lg,
    paddingBottom: S.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    overflow: 'hidden',
    gap: S.sm,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogoAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
  },
  body: { flex: 1 },
  infoCard: {
    marginHorizontal: S.lg,
    marginTop: S.md,
    marginBottom: S.sm,
    padding: S.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
  },
  heroLogoWrap: {
    width: 58,
    height: 58,
    borderRadius: R.lg,
    borderWidth: 2,
    backgroundColor: C.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroLogoImage: {
    width: '100%',
    height: '100%',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  joinContainer: {
    alignItems: 'center',
    paddingHorizontal: S.xxl,
    marginTop: S.xxxl,
  },
  lockIconContainer: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: S.lg,
  },
  joinText: {
    textAlign: 'center',
    marginTop: S.sm,
    marginBottom: S.xl,
    lineHeight: 20,
  },

  tabWrapper: {
    paddingHorizontal: S.lg,
    paddingVertical: S.sm,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: R.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: R.md,
  },
  tabText: {
    color: C.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },

  chatArea: {
    paddingHorizontal: S.lg,
    paddingTop: S.sm,
  },
  avisoCard: {
    padding: S.lg,
    marginBottom: S.md,
    borderLeftWidth: 4,
    gap: S.sm,
  },
  avisoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avisoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: R.pill,
  },
  avisoBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  avisoImagen: {
    width: '100%',
    height: 190,
    borderRadius: R.md,
    resizeMode: 'cover',
  },

  burbujaContenedor: { maxWidth: '80%', marginBottom: 12 },
  burbujaContenedorMia: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  burbujaContenedorAjena: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  burbuja: { padding: 12, borderRadius: R.lg },
  burbujaAjena: {
    backgroundColor: C.surfaceAlt,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  mensajeTexto: { fontSize: 15, lineHeight: 20 },
  horaTexto: { color: C.textFaint, fontSize: 11, marginTop: 4, marginHorizontal: 4 },
  mensajeImagen: { width: 220, height: 150, borderRadius: R.md, marginBottom: 6, resizeMode: 'cover' },

  inputWrapper: {
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: S.sm,
    paddingHorizontal: S.lg,
  },
  fotoAdjuntaContainer: { paddingBottom: S.sm },
  fotoAdjuntaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceAlt,
    padding: 6,
    paddingRight: 10,
    borderRadius: R.md,
    alignSelf: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  fotoAdjuntaMinia: { width: 34, height: 34, borderRadius: R.sm },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: S.sm,
  },
  fotoButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputBox: {
    flex: 1,
    backgroundColor: C.surfaceAlt,
    color: C.text,
    borderRadius: R.xl,
    paddingHorizontal: S.lg,
    paddingVertical: 11,
    maxHeight: 100,
    fontSize: 15,
    borderWidth: 1,
    borderColor: C.border,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: C.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: S.xl,
  },
  menuContainer: {
    backgroundColor: C.surface,
    borderRadius: R.xl,
    width: '100%',
    maxWidth: 320,
    padding: S.xl,
    borderWidth: 1,
    borderColor: C.borderStrong,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  modalEditContainer: {
    backgroundColor: C.surface,
    borderRadius: R.xl,
    width: '100%',
    maxWidth: 340,
    padding: S.xl,
    borderWidth: 1,
    borderColor: C.borderStrong,
  },
  modalEditInput: {
    backgroundColor: C.surfaceAlt,
    color: C.text,
    borderRadius: R.md,
    padding: 14,
    fontSize: 15,
    minHeight: 84,
    textAlignVertical: 'top',
    marginBottom: S.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalEditButtons: { flexDirection: 'row', gap: S.sm },
});

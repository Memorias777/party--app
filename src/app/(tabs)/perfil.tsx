import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../supabase';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import { Button, Card, FiestaGlow, IconButton, ScreenHeader, SectionLabel, tap } from '../../components/ui/kit';
import { C, R, S, T } from '../../constants/design';
import { alpha } from '../../utils/colors';

interface PerfilData {
  id: string;
  nombre: string;
  edad: number | null;
  bio: string;
  avatar_url: string;
  email: string;
}

const AVATARS = ['🥳', '😎', '🤩', '🎉', '🔥', '💃', '🕺', '👽', '🧑‍🎤', '👸'];

export default function PerfilScreen() {
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [perfil, setPerfil] = useState<PerfilData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [modalLogout, setModalLogout] = useState(false);

  const [nombre, setNombre] = useState('');
  const [edad, setEdad] = useState('');
  const [bio, setBio] = useState('');
  const [avatarSeleccionado, setAvatarSeleccionado] = useState('🥳');
  const [email, setEmail] = useState('');

  const [stats, setStats] = useState({ creadas: 0, asistidas: 0 });

  const cardScale = useRef(new Animated.Value(0.96)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  const animarEntrada = useCallback(() => {
    cardScale.setValue(0.96);
    cardOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, bounciness: 6, speed: 12 }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [cardScale, cardOpacity]);

  const cargarStats = useCallback(async (perfil_id: string) => {
    const { count: creadas } = await supabase
      .from('eventos')
      .select('*', { count: 'exact', head: true })
      .eq('creador_id', perfil_id);

    const { count: asistidas } = await supabase
      .from('participantes')
      .select('*', { count: 'exact', head: true })
      .eq('perfil_id', perfil_id);

    setStats({ creadas: creadas || 0, asistidas: asistidas || 0 });
  }, []);

  const cargarPerfil = useCallback(async (perfil_id: string) => {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', perfil_id)
        .maybeSingle();

      if (error) {
        console.error('Error cargando perfil:', error);
        showToast('No se pudo cargar tu perfil', 'error', error.message);
      } else if (data) {
        setPerfil(data);
        setNombre(data.nombre || '');
        setEdad(data.edad != null ? String(data.edad) : '');
        setBio(data.bio || '');
        setAvatarSeleccionado(data.avatar_url || '🥳');
      } else {
        setPerfil(null);
        setNombre('');
        setEdad('');
        setBio('');
        setAvatarSeleccionado('🥳');
        setEditando(true);
      }

      await cargarStats(perfil_id);
      animarEntrada();
    } catch (err: any) {
      console.error('Error:', err);
      showToast('Ocurrió un error al cargar tu perfil', 'error');
    } finally {
      setCargando(false);
    }
  }, [showToast, cargarStats, animarEntrada]);

  useEffect(() => {
    const inicializar = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        router.replace('/login');
        return;
      }
      setUserId(user.id);
      setEmail(user.email || '');
      cargarPerfil(user.id);
    };
    inicializar();
  }, [cargarPerfil]);

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        cargarPerfil(userId);
      }
    }, [userId, cargarPerfil])
  );

  const guardarPerfil = async () => {
    if (!nombre.trim()) {
      showToast('Por favor ingresa tu nombre', 'error');
      return;
    }
    if (!userId) {
      showToast('No se detectó tu sesión, vuelve a iniciar sesión', 'error');
      return;
    }

    setGuardando(true);
    try {
      const datosParaBD = {
        id: userId,
        nombre: nombre.trim(),
        edad: edad ? parseInt(edad, 10) : null,
        bio: bio.trim(),
        avatar_url: avatarSeleccionado,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('perfiles').upsert(datosParaBD, { onConflict: 'id' });

      if (error) {
        console.error('Error guardando perfil:', error);
        showToast('No se pudo guardar el perfil', 'error', error.message);
      } else {
        setPerfil({ ...datosParaBD, email } as PerfilData);
        setEditando(false);
        showToast('¡Perfil actualizado! 🎉', 'success');
      }
    } catch (err: any) {
      console.error('Error:', err);
      showToast('Ocurrió un error al guardar', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const cerrarSesion = async () => {
    const { error } = await supabase.auth.signOut();
    setModalLogout(false);
    if (!error) {
      router.replace('/login');
    } else {
      showToast('No se pudo cerrar sesión', 'error', error.message);
    }
  };

  if (cargando) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={C.brand} />
      </View>
    );
  }

  // -----------------------------------------------------------------
  // MODO EDICIÓN: el formulario completo
  // -----------------------------------------------------------------
  if (editando) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScreenHeader
          title="Editar Perfil"
          subtitle="Personaliza cómo te ven los demás"
          right={
            perfil ? (
              <IconButton name="close" onPress={() => setEditando(false)} />
            ) : undefined
          }
        />

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 110 }]}
          showsVerticalScrollIndicator={false}
        >
          <Card style={styles.sectionCard}>
            <SectionLabel>Tu Avatar</SectionLabel>
            <View style={styles.avatarGrid}>
              {AVATARS.map((avatar) => {
                const selected = avatarSeleccionado === avatar;
                return (
                  <TouchableOpacity
                    key={avatar}
                    style={[styles.avatarOption, selected && styles.avatarOptionSelected]}
                    onPress={() => {
                      tap();
                      setAvatarSeleccionado(avatar);
                    }}
                  >
                    <Text style={styles.avatarOptionText}>{avatar}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          <Card style={styles.sectionCard}>
            <SectionLabel>Nombre</SectionLabel>
            <TextInput
              style={styles.input}
              placeholder="Tu nombre"
              placeholderTextColor={C.textFaint}
              value={nombre}
              onChangeText={setNombre}
            />

            <SectionLabel style={{ marginTop: S.lg }}>Edad</SectionLabel>
            <TextInput
              style={styles.input}
              placeholder="Tu edad"
              placeholderTextColor={C.textFaint}
              value={edad}
              onChangeText={(text) => setEdad(text.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              maxLength={3}
            />

            <SectionLabel style={{ marginTop: S.lg }}>Bio / Descripción</SectionLabel>
            <TextInput
              style={styles.bioInput}
              placeholder="Cuéntanos sobre ti..."
              placeholderTextColor={C.textFaint}
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={150}
            />
            <Text style={styles.charCount}>{bio.length}/150</Text>

            <SectionLabel style={{ marginTop: S.md }}>Correo Electrónico</SectionLabel>
            <TextInput style={[styles.input, styles.inputDisabled]} value={email} editable={false} />
            <Text style={styles.helperText}>Este campo no puede ser editado</Text>
          </Card>

          <View style={styles.buttonContainer}>
            <Button
              title="Guardar Cambios"
              icon="checkmark"
              loading={guardando}
              onPress={guardarPerfil}
            />
            {perfil && (
              <Button
                title="Cancelar"
                variant="secondary"
                onPress={() => {
                  setEditando(false);
                  setNombre(perfil.nombre || '');
                  setEdad(perfil.edad != null ? String(perfil.edad) : '');
                  setBio(perfil.bio || '');
                  setAvatarSeleccionado(perfil.avatar_url || '🥳');
                }}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // -----------------------------------------------------------------
  // MODO VISTA RÁPIDA: tarjeta de presentación + accesos
  // -----------------------------------------------------------------
  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Tu Perfil"
        right={<IconButton name="pencil" onPress={() => setEditando(true)} />}
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ transform: [{ scale: cardScale }], opacity: cardOpacity }}>
          <Card style={styles.presentCard}>
            <FiestaGlow colores={[C.brand, C.brand2]} intensity={0.45} />

            <View style={styles.presentInfo}>
              <View style={styles.presentAvatarWrap}>
                <Text style={styles.presentAvatar}>{avatarSeleccionado}</Text>
              </View>

              <Text style={[T.title, { marginTop: S.md }]}>{nombre || 'Sin nombre'}</Text>
              {edad ? <Text style={[T.caption, { marginTop: 2 }]}>{edad} años</Text> : null}
              {bio ? (
                <Text style={[T.body, styles.presentBio]}>{bio}</Text>
              ) : (
                <Text style={[T.caption, { fontStyle: 'italic', marginTop: S.sm }]}>
                  Aún no has escrito tu bio
                </Text>
              )}

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{stats.creadas}</Text>
                  <Text style={T.caption}>Fiestas creadas</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{stats.asistidas}</Text>
                  <Text style={T.caption}>Fiestas asistidas</Text>
                </View>
              </View>
            </View>
          </Card>
        </Animated.View>

        <View style={styles.accionesContainer}>
          <Card onPress={() => setEditando(true)} style={styles.accionCard}>
            <View style={[styles.accionIconWrap, { backgroundColor: alpha(C.brand, 0.16) }]}>
              <Ionicons name="pencil" size={20} color={C.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={T.bodyStrong}>Editar Perfil</Text>
              <Text style={T.caption}>Cambia tu nombre, avatar y bio</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.textFaint} />
          </Card>

          <Card onPress={() => router.push('/(tabs)/crear')} style={styles.accionCard}>
            <View style={[styles.accionIconWrap, { backgroundColor: alpha(C.brand2, 0.18) }]}>
              <Ionicons name="sparkles" size={20} color={C.brand2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={T.bodyStrong}>Mis Fiestas Organizadas</Text>
              <Text style={T.caption}>Crea una nueva o edita las que ya tienes</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.textFaint} />
          </Card>
        </View>

        <Button
          title="Cerrar Sesión"
          icon="log-out-outline"
          variant="danger"
          onPress={() => setModalLogout(true)}
        />
      </ScrollView>

      <ConfirmModal
        visible={modalLogout}
        title="¿Cerrar sesión?"
        message="Tendrás que iniciar sesión de nuevo para volver a usar la app."
        confirmText="Cerrar sesión"
        destructive
        onCancel={() => setModalLogout(false)}
        onConfirm={cerrarSesion}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centerContent: { alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: S.xl, paddingTop: S.xs },

  presentCard: {
    marginBottom: S.lg,
  },
  presentInfo: {
    alignItems: 'center',
    padding: S.xl,
  },
  presentAvatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: C.surfaceAlt,
    borderWidth: 2,
    borderColor: alpha(C.brand, 0.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  presentAvatar: { fontSize: 42 },
  presentBio: {
    textAlign: 'center',
    marginTop: S.sm,
    paddingHorizontal: S.md,
    color: C.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: S.xl,
    paddingTop: S.lg,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, backgroundColor: C.border },
  statNumber: { color: C.brand, fontSize: 24, fontWeight: '800' },

  accionesContainer: { gap: S.md, marginBottom: S.xl },
  accionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: S.lg,
    gap: S.md,
  },
  accionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionCard: {
    padding: S.lg,
    marginBottom: S.lg,
  },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  avatarOption: {
    width: '17%',
    aspectRatio: 1,
    borderRadius: R.md,
    backgroundColor: C.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarOptionSelected: {
    borderColor: C.brand,
    backgroundColor: alpha(C.brand, 0.16),
  },
  avatarOptionText: { fontSize: 26 },
  input: {
    backgroundColor: C.surfaceAlt,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    paddingHorizontal: S.lg,
    paddingVertical: 13,
    fontSize: 15,
  },
  bioInput: {
    backgroundColor: C.surfaceAlt,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    paddingHorizontal: S.lg,
    paddingVertical: 13,
    fontSize: 15,
    height: 96,
    textAlignVertical: 'top',
  },
  inputDisabled: {
    backgroundColor: C.bg,
    color: C.textFaint,
  },
  charCount: { color: C.textFaint, fontSize: 12, marginTop: 4, textAlign: 'right' },
  helperText: { color: C.textFaint, fontSize: 12, marginTop: 4 },
  buttonContainer: { gap: S.md, marginBottom: S.lg },
});

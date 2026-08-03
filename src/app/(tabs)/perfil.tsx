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
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../supabase';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';

interface PerfilData {
  id: string;
  nombre: string;
  edad: number | null;
  bio: string;
  avatar_url: string;
  email: string;
}

const AVATARS = ['🥳', '😎', '🤩', '🎉', '🔥', '💃', '🕺', '👽', '🧑‍🎤', '👸'];

// Misma familia de paletas "pintura líquida" del resto de la app —
// aquí el perfil toma la suya fija según el id del usuario, así cada
// quien tiene "su color" consistente cada vez que entra.
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

export default function PerfilScreen() {
  const { showToast } = useToast();
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

  // Animación de entrada para la tarjeta de presentación
  const cardScale = useRef(new Animated.Value(0.9)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  const animarEntrada = useCallback(() => {
    cardScale.setValue(0.9);
    cardOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, bounciness: 8, speed: 10 }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
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
        <ActivityIndicator size="large" color="#ff3b30" />
      </View>
    );
  }

  const [colorA, colorB, colorC] = userId ? paletaParaId(userId) : PALETAS[0];

  // -----------------------------------------------------------------
  // MODO EDICIÓN: el formulario completo
  // -----------------------------------------------------------------
  if (editando) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            {perfil && (
              <TouchableOpacity onPress={() => setEditando(false)} style={styles.backButtonTop} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </TouchableOpacity>
            )}
            <Text style={styles.header}>Editar Perfil ✏️</Text>
            <View style={{ width: 32 }} />
          </View>

          <View style={styles.avatarSelectorContainer}>
            <Text style={styles.avatarLabel}>Tu Avatar</Text>
            <View style={styles.avatarGrid}>
              {AVATARS.map((avatar) => (
                <TouchableOpacity
                  key={avatar}
                  style={[styles.avatarOption, avatarSeleccionado === avatar && styles.avatarOptionSelected]}
                  onPress={() => setAvatarSeleccionado(avatar)}
                >
                  <Text style={styles.avatarOptionText}>{avatar}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Nombre</Text>
              <TextInput
                style={styles.input}
                placeholder="Tu nombre"
                placeholderTextColor="#6c6c8a"
                value={nombre}
                onChangeText={setNombre}
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Edad</Text>
              <TextInput
                style={styles.input}
                placeholder="Tu edad"
                placeholderTextColor="#6c6c8a"
                value={edad}
                onChangeText={(text) => setEdad(text.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                maxLength={3}
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Bio / Descripción</Text>
              <TextInput
                style={styles.bioInput}
                placeholder="Cuéntanos sobre ti..."
                placeholderTextColor="#6c6c8a"
                value={bio}
                onChangeText={setBio}
                multiline
                maxLength={150}
              />
              <Text style={styles.charCount}>{bio.length}/150</Text>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Correo Electrónico</Text>
              <TextInput style={[styles.input, styles.inputDisabled]} value={email} editable={false} />
              <Text style={styles.helperText}>Este campo no puede ser editado</Text>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.saveButton, guardando && styles.buttonDisabled]}
              activeOpacity={0.8}
              onPress={guardarPerfil}
              disabled={guardando}
            >
              {guardando ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.saveButtonText}>Guardar Cambios</Text>
                </>
              )}
            </TouchableOpacity>
            {perfil && (
              <TouchableOpacity
                style={styles.cancelButton}
                activeOpacity={0.8}
                onPress={() => {
                  setEditando(false);
                  setNombre(perfil.nombre || '');
                  setEdad(perfil.edad != null ? String(perfil.edad) : '');
                  setBio(perfil.bio || '');
                  setAvatarSeleccionado(perfil.avatar_url || '🥳');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // -----------------------------------------------------------------
  // MODO VISTA RÁPIDA (por defecto): tarjeta de presentación + accesos
  // -----------------------------------------------------------------
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>Tu Perfil 👤</Text>

        <Animated.View style={{ transform: [{ scale: cardScale }], opacity: cardOpacity }}>
          <View style={styles.presentCard}>
            <LinearGradient
              colors={[colorA, colorB, colorC]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={styles.presentBanner}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.6, y: 0.8 }}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)']}
                start={{ x: 0.3, y: 0.2 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </LinearGradient>

            <View style={styles.presentAvatarWrap}>
              <Text style={styles.presentAvatar}>{avatarSeleccionado}</Text>
            </View>

            <View style={styles.presentInfo}>
              <Text style={styles.presentNombre}>{nombre || 'Sin nombre'}</Text>
              {edad ? <Text style={styles.presentEdad}>{edad} años</Text> : null}
              {bio ? <Text style={styles.presentBio}>{bio}</Text> : (
                <Text style={styles.presentBioVacia}>Aún no has escrito tu bio</Text>
              )}

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{stats.creadas}</Text>
                  <Text style={styles.statLabel}>Fiestas creadas</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{stats.asistidas}</Text>
                  <Text style={styles.statLabel}>Fiestas asistidas</Text>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>

        <View style={styles.accionesContainer}>
          <TouchableOpacity style={styles.accionCard} activeOpacity={0.75} onPress={() => setEditando(true)}>
            <LinearGradient
              colors={['#FF6B6B', '#FF3B30']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.accionIconWrap}
            >
              <Ionicons name="pencil" size={20} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.accionTitulo}>Editar Perfil</Text>
              <Text style={styles.accionSubtitulo}>Cambia tu nombre, avatar y bio</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6c6c8a" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.accionCard} activeOpacity={0.75} onPress={() => router.push('/(tabs)/crear')}>
            <LinearGradient
              colors={['#0FC2C0', '#118AB2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.accionIconWrap}
            >
              <Ionicons name="add-circle" size={22} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.accionTitulo}>Mis Fiestas</Text>
              <Text style={styles.accionSubtitulo}>Crea una nueva o edita las que ya tienes</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6c6c8a" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} activeOpacity={0.8} onPress={() => setModalLogout(true)}>
          <Ionicons name="log-out" size={18} color="#ff3b30" style={{ marginRight: 8 }} />
          <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
        </TouchableOpacity>
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
  container: { flex: 1, backgroundColor: '#0d0d18' },
  centerContent: { alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backButtonTop: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  header: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 20 },

  // Tarjeta de presentación con banner tipo pintura líquida
  presentCard: {
    backgroundColor: '#16162a',
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  presentBanner: {
    height: 90,
  },
  presentAvatarWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#1c1c2e',
    borderWidth: 4,
    borderColor: '#16162a',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: -45,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  presentAvatar: { fontSize: 44 },
  presentInfo: { alignItems: 'center', padding: 20, paddingTop: 10 },
  presentNombre: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  presentEdad: { color: '#8a8aa3', fontSize: 14, marginBottom: 10 },
  presentBio: { color: '#c9c9e0', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 6, paddingHorizontal: 10 },
  presentBioVacia: { color: '#5a5a72', fontSize: 13, fontStyle: 'italic', marginBottom: 6 },
  statsRow: { flexDirection: 'row', width: '100%', marginTop: 18, paddingTop: 18, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  statNumber: { color: '#ff3b30', fontSize: 24, fontWeight: 'bold' },
  statLabel: { color: '#8a8aa3', fontSize: 12, marginTop: 4, textAlign: 'center' },

  accionesContainer: { gap: 10, marginBottom: 20 },
  accionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16162a',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  accionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  accionTitulo: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  accionSubtitulo: { color: '#8a8aa3', fontSize: 12 },

  avatarSelectorContainer: { backgroundColor: '#16162a', borderRadius: 18, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  avatarLabel: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  avatarOption: { width: '17%', aspectRatio: 1, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  avatarOptionSelected: { borderColor: '#ff3b30', backgroundColor: 'rgba(255, 59, 48, 0.12)' },
  avatarOptionText: { fontSize: 28 },
  formContainer: { marginBottom: 24 },
  fieldContainer: { marginBottom: 16 },
  label: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { backgroundColor: '#16162a', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', color: '#fff', padding: 12, fontSize: 14 },
  bioInput: { backgroundColor: '#16162a', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', color: '#fff', padding: 12, fontSize: 14, height: 100, textAlignVertical: 'top' },
  inputDisabled: { backgroundColor: 'rgba(255,255,255,0.03)', color: '#6c6c8a' },
  charCount: { color: '#6c6c8a', fontSize: 12, marginTop: 4, textAlign: 'right' },
  helperText: { color: '#6c6c8a', fontSize: 12, marginTop: 4 },
  buttonContainer: { gap: 12, marginBottom: 16 },
  saveButton: { backgroundColor: '#34c759', borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelButton: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  cancelButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  logoutButton: { backgroundColor: '#16162a', borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(255,59,48,0.4)' },
  logoutButtonText: { color: '#ff3b30', fontSize: 16, fontWeight: '600' },
});
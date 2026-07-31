import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { supabase } from '../../supabase.js';
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

  const cargarPerfil = useCallback(async (perfil_id: string, correo: string) => {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', perfil_id)
        .maybeSingle(); // 🔥 evita el error "no rows" que rompía la pantalla

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
        // No existe perfil todavía: dejamos campos vacíos y forzamos edición
        setPerfil(null);
        setNombre('');
        setEdad('');
        setBio('');
        setAvatarSeleccionado('🥳');
        setEditando(true);
      }
    } catch (err: any) {
      console.error('Error:', err);
      showToast('Ocurrió un error al cargar tu perfil', 'error');
    } finally {
      setCargando(false);
    }
  }, [showToast]);

  // Carga inicial: obtenemos el usuario y disparamos la carga de perfil
  useEffect(() => {
    const inicializar = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        router.replace('/login');
        return;
      }
      setUserId(user.id);
      setEmail(user.email || '');
      cargarPerfil(user.id, user.email || '');
    };
    inicializar();
  }, [cargarPerfil]);

  // Recarga al volver a la pantalla, pero solo si ya tenemos userId
  useFocusEffect(
    useCallback(() => {
      if (userId) {
        cargarPerfil(userId, email);
      }
    }, [userId, email, cargarPerfil])
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

      const { error } = await supabase
        .from('perfiles')
        .upsert(datosParaBD, { onConflict: 'id' });

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

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButtonTop} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.header}>Tu Perfil 👤</Text>
          <View style={{ width: 32 }} />
        </View>

        {!perfil && !editando ? null : (
          <>
            <View style={styles.avatarSelectorContainer}>
              <Text style={styles.avatarLabel}>Tu Avatar</Text>
              <View style={styles.avatarGrid}>
                {AVATARS.map((avatar) => (
                  <TouchableOpacity
                    key={avatar}
                    style={[styles.avatarOption, avatarSeleccionado === avatar && styles.avatarOptionSelected]}
                    onPress={() => editando && setAvatarSeleccionado(avatar)}
                    disabled={!editando}
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
                  style={[styles.input, !editando && styles.inputDisabled]}
                  placeholder="Tu nombre"
                  placeholderTextColor="#8e8e93"
                  value={nombre}
                  onChangeText={setNombre}
                  editable={editando}
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Edad</Text>
                <TextInput
                  style={[styles.input, !editando && styles.inputDisabled]}
                  placeholder="Tu edad"
                  placeholderTextColor="#8e8e93"
                  value={edad}
                  onChangeText={(text) => setEdad(text.replace(/[^0-9]/g, ''))}
                  editable={editando}
                  keyboardType="numeric"
                  maxLength={3}
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Bio / Descripción</Text>
                <TextInput
                  style={[styles.bioInput, !editando && styles.inputDisabled]}
                  placeholder="Cuéntanos sobre ti..."
                  placeholderTextColor="#8e8e93"
                  value={bio}
                  onChangeText={setBio}
                  editable={editando}
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
          </>
        )}

        <View style={styles.buttonContainer}>
          {!editando ? (
            <TouchableOpacity style={styles.editButton} activeOpacity={0.8} onPress={() => setEditando(true)}>
              <Ionicons name="pencil" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.editButtonText}>Editar Perfil</Text>
            </TouchableOpacity>
          ) : (
            <>
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
            </>
          )}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centerContent: { alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backButtonTop: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  header: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  avatarSelectorContainer: { backgroundColor: '#1c1c1e', borderRadius: 18, padding: 16, marginBottom: 24 },
  avatarLabel: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  avatarOption: { width: '17%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#2c2c2e', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  avatarOptionSelected: { borderColor: '#ff3b30', backgroundColor: 'rgba(255, 59, 48, 0.1)' },
  avatarOptionText: { fontSize: 28 },
  formContainer: { marginBottom: 24 },
  fieldContainer: { marginBottom: 16 },
  label: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { backgroundColor: '#1c1c1e', borderRadius: 12, borderWidth: 1, borderColor: '#2c2c2e', color: '#fff', padding: 12, fontSize: 14 },
  bioInput: { backgroundColor: '#1c1c1e', borderRadius: 12, borderWidth: 1, borderColor: '#2c2c2e', color: '#fff', padding: 12, fontSize: 14, height: 100, textAlignVertical: 'top' },
  inputDisabled: { backgroundColor: '#2c2c2e', color: '#8e8e93' },
  charCount: { color: '#8e8e93', fontSize: 12, marginTop: 4, textAlign: 'right' },
  helperText: { color: '#8e8e93', fontSize: 12, marginTop: 4 },
  buttonContainer: { gap: 12, marginBottom: 16 },
  editButton: { backgroundColor: '#ff3b30', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  editButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  saveButton: { backgroundColor: '#34c759', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelButton: { backgroundColor: '#2c2c2e', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  logoutButton: { backgroundColor: '#1c1c1e', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', borderWidth: 1, borderColor: '#ff3b30' },
  logoutButtonText: { color: '#ff3b30', fontSize: 16, fontWeight: '600' },
});

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../../../supabase.js';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

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
  const [perfil, setPerfil] = useState<PerfilData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [nombre, setNombre] = useState('');
  const [edad, setEdad] = useState('');
  const [bio, setBio] = useState('');
  const [avatarSeleccionado, setAvatarSeleccionado] = useState('🥳');
  const [email, setEmail] = useState('');

  // Cargar perfil al abrir la pantalla
  useEffect(() => {
    const inicializar = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setEmail(user.email || '');
        cargarPerfil(user.id);
      } else {
        Alert.alert('No autorizado', 'Por favor inicia sesión primero');
        router.push('/login');
      }
    };
    inicializar();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (userId) {
        cargarPerfil(userId);
      }
    }, [userId])
  );

  const cargarPerfil = async (perfil_id: string) => {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', perfil_id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error cargando perfil:', error);
      } else if (data) {
        setPerfil(data);
        setNombre(data.nombre || '');
        setEdad(data.edad ? data.edad.toString() : '');
        setBio(data.bio || '');
        setAvatarSeleccionado(data.avatar_url || '🥳');
      } else {
        // Si no existe, crear perfil vacío
        setNombre('');
        setEdad('');
        setBio('');
        setAvatarSeleccionado('🥳');
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setCargando(false);
    }
  };

  const guardarPerfil = async () => {
    if (!nombre.trim()) {
      Alert.alert('Campo requerido', 'Por favor ingresa tu nombre');
      return;
    }

    setGuardando(true);
    try {
      // 1. Datos EXCLUSIVOS para la base de datos (Sin el email)
      const datosParaBD = {
        id: userId,
        nombre: nombre.trim(),
        edad: edad ? parseInt(edad, 10) : null,
        bio: bio.trim(),
        avatar_url: avatarSeleccionado,
        updated_at: new Date().toISOString(),
      };

      // 2. Mandamos la info a Supabase
      const { error } = await supabase
        .from('perfiles')
        .upsert(datosParaBD);

      if (error) {
        console.error('Error guardando perfil:', error);
        Alert.alert('Error', 'No se pudo guardar el perfil');
      } else {
        // 3. Actualizamos la pantalla agregando el email de vuelta solo de forma visual
        setPerfil({ ...datosParaBD, email: email } as PerfilData);
        setEditando(false);
        Alert.alert('Éxito', '¡Tu perfil ha sido actualizado!');
      }
    } catch (err) {
      console.error('Error:', err);
      Alert.alert('Error', 'Ocurrió un error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const cerrarSesion = async () => {
    Alert.alert('¿Cerrar sesión?', '¿Estás seguro de que quieres cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.auth.signOut();
          if (!error) {
            router.replace('/login');
          }
        },
      },
    ]);
  };

  if (cargando) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#ff3b30" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Cabecera para salir al mapa (Opcional, pero da buena UX) */}
        <View style={styles.headerRow}>
          <Text style={styles.header}>Tu Perfil</Text>
          <TouchableOpacity style={styles.closeIcon} onPress={() => router.push('/(tabs)')}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {!editando ? (
          /* ==========================================
             🔥 MODO VISTA: TARJETA Y MENÚ DE OPCIONES
             ========================================== */
          <View>
            <View style={styles.perfilCard}>
              <View style={styles.avatarContainerGrande}>
                <Text style={styles.avatarEmojiGrande}>{avatarSeleccionado}</Text>
              </View>
              <Text style={styles.nombreGrande}>{nombre || 'Usuario Nuevo'}</Text>
              <Text style={styles.edadTexto}>{edad ? `${edad} años` : 'Edad no especificada'}</Text>
              {bio ? <Text style={styles.bioTexto}>{bio}</Text> : null}
            </View>

            <View style={styles.opcionesContainer}>
              <TouchableOpacity style={styles.btnOpcion} onPress={() => setEditando(true)}>
                <View style={styles.opcionIzquierda}>
                  <View style={styles.iconBox}>
                    <Ionicons name="pencil" size={20} color="#fff" />
                  </View>
                  <Text style={styles.opcionTexto}>Editar Perfil</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#8e8e93" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnOpcion} onPress={() => router.push('/(tabs)/crear')}>
  <View style={styles.opcionIzquierda}>
    <View style={styles.iconBox}>
      {/* 🔥 Ícono corregido y 100% válido */}
      <Ionicons name="musical-notes-outline" size={20} color="#fff" />
    </View>
    <Text style={styles.opcionTexto}>Mis Fiestas (Crear / Editar)</Text>
  </View>
  <Ionicons name="chevron-forward" size={20} color="#8e8e93" />
</TouchableOpacity>

              <TouchableOpacity style={[styles.btnOpcion, { borderBottomWidth: 0 }]} onPress={cerrarSesion}>
                <View style={styles.opcionIzquierda}>
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(255, 59, 48, 0.15)' }]}>
                    <Ionicons name="log-out-outline" size={20} color="#ff3b30" />
                  </View>
                  <Text style={[styles.opcionTexto, { color: '#ff3b30' }]}>Cerrar Sesión</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* ==========================================
             🔥 MODO EDICIÓN: TU FORMULARIO ORIGINAL
             ========================================== */
          <View>
            {/* Avatar Selector */}
            <View style={styles.avatarSelectorContainer}>
              <Text style={styles.avatarLabel}>Tu Avatar</Text>
              <View style={styles.avatarGrid}>
                {AVATARS.map((avatar) => (
                  <TouchableOpacity
                    key={avatar}
                    style={[
                      styles.avatarOption,
                      avatarSeleccionado === avatar && styles.avatarOptionSelected,
                    ]}
                    onPress={() => setAvatarSeleccionado(avatar)}
                  >
                    <Text style={styles.avatarOptionText}>{avatar}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Formulario de Perfil */}
            <View style={styles.formContainer}>
              {/* Nombre */}
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

              {/* Edad */}
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

              {/* Bio */}
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

              {/* Email (solo lectura) */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Correo Electrónico</Text>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  placeholder="Tu correo"
                  placeholderTextColor="#8e8e93"
                  value={email}
                  editable={false}
                />
                <Text style={styles.helperText}>Este campo no puede ser editado</Text>
              </View>
            </View>

            {/* Botones Guardar / Cancelar */}
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
              
              <TouchableOpacity
                style={styles.cancelButton}
                activeOpacity={0.8}
                onPress={() => {
                  setEditando(false);
                  if (perfil) {
                    setNombre(perfil.nombre || '');
                    setEdad(perfil.edad ? perfil.edad.toString() : '');
                    setBio(perfil.bio || '');
                    setAvatarSeleccionado(perfil.avatar_url || '🥳');
                  }
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  header: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  closeIcon: {
    backgroundColor: '#1c1c1e',
    borderRadius: 20,
    padding: 6,
  },

  // 🔥 Estilos de la nueva Tarjeta de Perfil y Menú
  perfilCard: {
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  avatarContainerGrande: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2c2c2e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarEmojiGrande: {
    fontSize: 50,
  },
  nombreGrande: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  edadTexto: {
    color: '#8e8e93',
    fontSize: 16,
    marginBottom: 12,
  },
  bioTexto: {
    color: '#d1d1d6',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 10,
    lineHeight: 20,
  },
  opcionesContainer: {
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    paddingVertical: 8,
  },
  btnOpcion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2e',
  },
  opcionIzquierda: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    backgroundColor: '#2c2c2e',
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  opcionTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },

  // 🔥 Tus estilos originales del Formulario
  avatarSelectorContainer: {
    backgroundColor: '#1c1c1e',
    borderRadius: 18,
    padding: 16,
    marginBottom: 24,
  },
  avatarLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  avatarOption: {
    width: '17%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#2c2c2e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarOptionSelected: {
    borderColor: '#ff3b30',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  avatarOptionText: {
    fontSize: 28,
  },
  formContainer: {
    marginBottom: 24,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2c2c2e',
    color: '#fff',
    padding: 12,
    fontSize: 14,
  },
  bioInput: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2c2c2e',
    color: '#fff',
    padding: 12,
    fontSize: 14,
    height: 100,
    textAlignVertical: 'top',
  },
  inputDisabled: {
    backgroundColor: '#2c2c2e',
    color: '#8e8e93',
  },
  charCount: {
    color: '#8e8e93',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
  },
  helperText: {
    color: '#8e8e93',
    fontSize: 12,
    marginTop: 4,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: '#34c759',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#2c2c2e',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
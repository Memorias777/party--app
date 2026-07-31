import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../supabase'; // Ajusta la ruta si tu supabase.js está en otro lado
import { useToast } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

export default function LoginScreen() {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalVerifica, setModalVerifica] = useState(false);

  const iniciarSesion = async () => {
    if (!email || !password) {
      showToast('Ingresa tu correo y contraseña', 'error');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      showToast('Error al entrar', 'error', error.message);
    } else {
      router.replace('/(tabs)');
    }
  };

  const registrarse = async () => {
    if (!email || !password) {
      showToast('Ingresa un correo y contraseña', 'error');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      showToast('Error en registro', 'error', error.message);
    } else {
      // 🔥 Recordatorio claro de que hay que verificar el correo
      setModalVerifica(true);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emojiLogo}>🪩</Text>
        <Text style={styles.header}>Zacatecas Party</Text>
        <Text style={styles.subheader}>Inicia sesión o crea tu cuenta para administrar tus eventos.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Correo Electrónico</Text>
          <TextInput
            style={styles.input}
            placeholder="memo@ejemplo.com"
            placeholderTextColor="#8e8e93"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="********"
            placeholderTextColor="#8e8e93"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {loading ? (
            <ActivityIndicator size="large" color="#ff3b30" style={{ marginTop: 20 }} />
          ) : (
            <>
              <TouchableOpacity style={styles.loginButton} onPress={iniciarSesion} activeOpacity={0.85}>
                <Text style={styles.loginButtonText}>Iniciar Sesión</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.registerButton} onPress={registrarse} activeOpacity={0.85}>
                <Text style={styles.registerButtonText}>Crear nueva cuenta</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <ConfirmModal
        visible={modalVerifica}
        title="¡Ya casi! 📩"
        message={`Te enviamos un correo de verificación a:\n${email}\n\nRevisa tu bandeja de entrada (o spam) y confirma tu cuenta antes de iniciar sesión.`}
        confirmText="Entendido"
        cancelText="Cerrar"
        onConfirm={() => setModalVerifica(false)}
        onCancel={() => setModalVerifica(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  emojiLogo: { fontSize: 60, textAlign: 'center', marginBottom: 16 },
  header: { color: '#fff', fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subheader: { color: '#8e8e93', fontSize: 15, textAlign: 'center', marginBottom: 40, paddingHorizontal: 20 },
  form: { width: '100%' },
  label: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  input: {
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2c2c2e',
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: '#ff3b30',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#ff3b30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  loginButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  registerButton: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  registerButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

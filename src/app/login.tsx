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
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabase';
import { useToast } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

interface PasswordStrength {
  checks: {
    length: boolean;
    hasUpper: boolean;
    hasLower: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  };
  passedCount: number;
  label: string;
  color: string;
  percent: number;
}

export default function LoginScreen() {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [modalVerifica, setModalVerifica] = useState(false);

  const getPasswordStrength = (pwd: string): PasswordStrength => {
    const checks = {
      length: pwd.length >= 8,
      hasUpper: /[A-Z]/.test(pwd),
      hasLower: /[a-z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd),
      hasSpecial: /[^A-Za-z0-9]/.test(pwd),
    };

    const passedCount = Object.values(checks).filter(Boolean).length;

    if (!pwd) {
      return {
        checks,
        passedCount: 0,
        label: 'Requerida',
        color: '#6c6c8a',
        percent: 0,
      };
    }

    if (passedCount <= 2 || !checks.length) {
      return { checks, passedCount, label: 'Débil', color: '#ff3b30', percent: 0.25 };
    }
    if (passedCount === 3) {
      return { checks, passedCount, label: 'Aceptable', color: '#ff9500', percent: 0.5 };
    }
    if (passedCount === 4) {
      return { checks, passedCount, label: 'Buena', color: '#34c759', percent: 0.75 };
    }
    return { checks, passedCount, label: 'Excelente', color: '#30d158', percent: 1.0 };
  };

  const strength = getPasswordStrength(password);
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  const handleSwitchMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

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
    if (!email || !password || !confirmPassword) {
      showToast('Campos incompletos', 'error', 'Ingresa tu correo, contraseña y confirmación.');
      return;
    }

    if (password !== confirmPassword) {
      showToast(
        'Las contraseñas no coinciden',
        'error',
        'Asegúrate de que ambas contraseñas sean idénticas.'
      );
      return;
    }

    if (strength.passedCount < 3 || !strength.checks.length) {
      showToast(
        'Contraseña poco segura',
        'error',
        'Tu contraseña debe tener al menos 8 caracteres y cumplir con los requisitos de seguridad.'
      );
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      showToast('Error en registro', 'error', error.message);
    } else {
      setModalVerifica(true);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Text style={styles.emojiLogo}>🪩</Text>
          <Text style={styles.header}>Zacatecas Party</Text>
          <Text style={styles.subheader}>
            {mode === 'login'
              ? 'Inicia sesión para administrar tus eventos.'
              : 'Crea tu nueva cuenta para administrar tus eventos.'}
          </Text>

          {/* Selector de modo */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, mode === 'login' && styles.tabButtonActive]}
              onPress={() => handleSwitchMode('login')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>
                Iniciar Sesión
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, mode === 'register' && styles.tabButtonActive]}
              onPress={() => handleSwitchMode('register')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>
                Crear Cuenta
              </Text>
            </TouchableOpacity>
          </View>

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
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="********"
                placeholderTextColor="#8e8e93"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
                accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color="#8e8e93"
                />
              </TouchableOpacity>
            </View>

            {/* Campo Confirmar Contraseña (solo en modo registro) */}
            {mode === 'register' && (
              <>
                <Text style={styles.label}>Confirmar Contraseña</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="********"
                    placeholderTextColor="#8e8e93"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                    accessibilityLabel={
                      showConfirmPassword
                        ? 'Ocultar confirmación de contraseña'
                        : 'Mostrar confirmación de contraseña'
                    }
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color="#8e8e93"
                    />
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Verificador de Contraseña (solo en modo registro) */}
            {mode === 'register' && (
              <View style={styles.verifierCard}>
                <View style={styles.verifierHeader}>
                  <Text style={styles.verifierTitle}>Requisitos de seguridad</Text>
                  {password.length > 0 && (
                    <View style={[styles.badge, { backgroundColor: `${strength.color}22` }]}>
                      <Text style={[styles.badgeText, { color: strength.color }]}>
                        {strength.label}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Barra de progreso de fortaleza */}
                <View style={styles.strengthBarTrack}>
                  <View
                    style={[
                      styles.strengthBarFill,
                      {
                        width: `${strength.percent * 100}%`,
                        backgroundColor: strength.color,
                      },
                    ]}
                  />
                </View>

                {/* Lista de requisitos */}
                <View style={styles.checklist}>
                  <View style={styles.checkItem}>
                    <Ionicons
                      name={strength.checks.length ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={strength.checks.length ? '#30d158' : '#545458'}
                    />
                    <Text
                      style={[
                        styles.checkText,
                        strength.checks.length && styles.checkTextActive,
                      ]}
                    >
                      Mínimo 8 caracteres
                    </Text>
                  </View>

                  <View style={styles.checkItem}>
                    <Ionicons
                      name={strength.checks.hasUpper ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={strength.checks.hasUpper ? '#30d158' : '#545458'}
                    />
                    <Text
                      style={[
                        styles.checkText,
                        strength.checks.hasUpper && styles.checkTextActive,
                      ]}
                    >
                      Una letra mayúscula (A-Z)
                    </Text>
                  </View>

                  <View style={styles.checkItem}>
                    <Ionicons
                      name={strength.checks.hasNumber ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={strength.checks.hasNumber ? '#30d158' : '#545458'}
                    />
                    <Text
                      style={[
                        styles.checkText,
                        strength.checks.hasNumber && styles.checkTextActive,
                      ]}
                    >
                      Un número (0-9)
                    </Text>
                  </View>

                  <View style={styles.checkItem}>
                    <Ionicons
                      name={strength.checks.hasSpecial ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={strength.checks.hasSpecial ? '#30d158' : '#545458'}
                    />
                    <Text
                      style={[
                        styles.checkText,
                        strength.checks.hasSpecial && styles.checkTextActive,
                      ]}
                    >
                      Un carácter especial (!@#$%...)
                    </Text>
                  </View>

                  <View style={styles.checkItem}>
                    <Ionicons
                      name={passwordsMatch ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={passwordsMatch ? '#30d158' : '#545458'}
                    />
                    <Text
                      style={[
                        styles.checkText,
                        passwordsMatch && styles.checkTextActive,
                      ]}
                    >
                      Las contraseñas coinciden
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {loading ? (
              <ActivityIndicator size="large" color="#ff3b30" style={{ marginTop: 20 }} />
            ) : (
              <>
                {mode === 'login' ? (
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={iniciarSesion}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryButtonText}>Iniciar Sesión</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={registrarse}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryButtonText}>Crear mi cuenta</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.switchModeButton}
                  onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.switchModeText}>
                    {mode === 'login'
                      ? '¿No tienes cuenta? Regístrate aquí'
                      : '¿Ya tienes cuenta? Inicia sesión'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>

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
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  content: { padding: 24 },
  emojiLogo: { fontSize: 60, textAlign: 'center', marginBottom: 16 },
  header: { color: '#fff', fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subheader: { color: '#8e8e93', fontSize: 15, textAlign: 'center', marginBottom: 28, paddingHorizontal: 16 },
  
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#2c2c2e',
  },
  tabText: {
    color: '#8e8e93',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2c2c2e',
    marginBottom: 20,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: '#fff',
    fontSize: 15,
  },
  eyeButton: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  verifierCard: {
    backgroundColor: '#161618',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2c2c2e',
    marginBottom: 20,
  },
  verifierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  verifierTitle: {
    color: '#8e8e93',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  strengthBarTrack: {
    height: 6,
    backgroundColor: '#2c2c2e',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  checklist: {
    gap: 8,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkText: {
    color: '#545458',
    fontSize: 13,
    fontWeight: '500',
  },
  checkTextActive: {
    color: '#e5e5ea',
    fontWeight: '600',
  },

  primaryButton: {
    backgroundColor: '#ff3b30',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#ff3b30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  switchModeButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  switchModeText: { color: '#8e8e93', fontSize: 14, fontWeight: '600' },
});


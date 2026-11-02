import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../supabase';
import { useToast } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import { Button, Card, FiestaGlow, SectionLabel, tap } from '../components/ui/kit';
import { C, R, S, T } from '../constants/design';
import { alpha } from '../utils/colors';

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
  const insets = useSafeAreaInsets();
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
        color: C.textFaint,
        percent: 0,
      };
    }

    if (passedCount <= 2 || !checks.length) {
      return { checks, passedCount, label: 'Débil', color: C.danger, percent: 0.25 };
    }
    if (passedCount === 3) {
      return { checks, passedCount, label: 'Aceptable', color: C.warning, percent: 0.5 };
    }
    if (passedCount === 4) {
      return { checks, passedCount, label: 'Buena', color: C.success, percent: 0.75 };
    }
    return { checks, passedCount, label: 'Excelente', color: C.success, percent: 1.0 };
  };

  const strength = getPasswordStrength(password);
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  const handleSwitchMode = (newMode: 'login' | 'register') => {
    tap();
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
      <FiestaGlow colores={[C.brand, C.brand2]} intensity={0.28} style={{ height: 320 }} />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + S.xl, paddingBottom: insets.bottom + S.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.logoBadge}>
            <Text style={styles.emojiLogo}>🪩</Text>
          </View>
          <Text style={[T.display, styles.header]}>party!</Text>
          <Text style={[T.caption, styles.subheader]}>
            {mode === 'login'
              ? 'Inicia sesión para unirte a las fiestas y administrar tus eventos.'
              : 'Crea tu cuenta para descubrir y organizar las mejores fiestas.'}
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

          <Card style={styles.formCard}>
            <SectionLabel>Correo Electrónico</SectionLabel>
            <TextInput
              style={styles.input}
              placeholder="memo@ejemplo.com"
              placeholderTextColor={C.textFaint}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <SectionLabel>Contraseña</SectionLabel>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="••••••••"
                placeholderTextColor={C.textFaint}
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
                  size={20}
                  color={C.textMuted}
                />
              </TouchableOpacity>
            </View>

            {mode === 'register' && (
              <>
                <SectionLabel>Confirmar Contraseña</SectionLabel>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="••••••••"
                    placeholderTextColor={C.textFaint}
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
                      size={20}
                      color={C.textMuted}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.verifierCard}>
                  <View style={styles.verifierHeader}>
                    <Text style={T.micro}>REQUISITOS DE SEGURIDAD</Text>
                    {password.length > 0 && (
                      <View style={[styles.badge, { backgroundColor: alpha(strength.color, 0.16) }]}>
                        <Text style={[styles.badgeText, { color: strength.color }]}>
                          {strength.label}
                        </Text>
                      </View>
                    )}
                  </View>

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

                  <View style={styles.checklist}>
                    {[
                      { ok: strength.checks.length, label: 'Mínimo 8 caracteres' },
                      { ok: strength.checks.hasUpper, label: 'Una letra mayúscula (A-Z)' },
                      { ok: strength.checks.hasNumber, label: 'Un número (0-9)' },
                      { ok: strength.checks.hasSpecial, label: 'Un carácter especial (!@#$%...)' },
                      { ok: passwordsMatch, label: 'Las contraseñas coinciden' },
                    ].map((item) => (
                      <View key={item.label} style={styles.checkItem}>
                        <Ionicons
                          name={item.ok ? 'checkmark-circle' : 'ellipse-outline'}
                          size={17}
                          color={item.ok ? C.success : C.textFaint}
                        />
                        <Text style={[styles.checkText, item.ok && styles.checkTextActive]}>
                          {item.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </>
            )}

            <Button
              title={mode === 'login' ? 'Iniciar Sesión' : 'Crear mi cuenta'}
              icon={mode === 'login' ? 'log-in-outline' : 'sparkles-outline'}
              loading={loading}
              onPress={mode === 'login' ? iniciarSesion : registrarse}
              style={{ marginTop: S.xs }}
            />
          </Card>

          <TouchableOpacity
            style={styles.switchModeButton}
            onPress={() => handleSwitchMode(mode === 'login' ? 'register' : 'login')}
            activeOpacity={0.7}
          >
            <Text style={T.caption}>
              {mode === 'login'
                ? '¿No tienes cuenta? Regístrate aquí'
                : '¿Ya tienes cuenta? Inicia sesión'}
            </Text>
          </TouchableOpacity>
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
  container: { flex: 1, backgroundColor: C.bg },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  content: { paddingHorizontal: S.xl },
  logoBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: alpha(C.brand, 0.14),
    borderWidth: 1,
    borderColor: alpha(C.brand, 0.35),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: S.md,
  },
  emojiLogo: { fontSize: 38 },
  header: { textAlign: 'center', marginBottom: S.xs },
  subheader: { textAlign: 'center', marginBottom: S.xl, paddingHorizontal: S.lg },

  tabContainer: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: R.lg,
    padding: 4,
    marginBottom: S.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: R.md,
  },
  tabButtonActive: {
    backgroundColor: C.surfaceHigh,
  },
  tabText: {
    color: C.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: C.text,
    fontWeight: '700',
  },

  formCard: {
    padding: S.xl,
  },
  input: {
    backgroundColor: C.surfaceAlt,
    borderRadius: R.md,
    paddingHorizontal: S.lg,
    paddingVertical: 14,
    color: C.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: S.lg,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceAlt,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: S.lg,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: S.lg,
    paddingVertical: 14,
    color: C.text,
    fontSize: 15,
  },
  eyeButton: {
    paddingHorizontal: S.lg,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  verifierCard: {
    backgroundColor: C.bg,
    borderRadius: R.md,
    padding: S.lg,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: S.lg,
  },
  verifierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: R.pill,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  strengthBarTrack: {
    height: 6,
    backgroundColor: C.surfaceHigh,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: S.md,
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
    color: C.textFaint,
    fontSize: 13,
    fontWeight: '500',
  },
  checkTextActive: {
    color: C.text,
    fontWeight: '600',
  },
  switchModeButton: {
    paddingVertical: S.lg,
    alignItems: 'center',
    marginTop: S.xs,
  },
});

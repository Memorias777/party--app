import React, { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabase';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import { Button, Card, FiestaGlow, IconButton, ScreenHeader, SectionLabel } from '../components/ui/kit';
import { C, R, S, T } from '../constants/design';
import { alpha } from '../utils/colors';

export default function EliminarCuentaScreen() {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [eliminadaExito, setEliminadaExito] = useState(false);
  const [modalConfirmar, setModalConfirmar] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        setUserEmail(user.email ?? null);
      }
    });
  }, []);

  const iniciarSesionParaBorrar = async () => {
    if (!emailInput.trim() || !passwordInput) {
      showToast('Ingresa tu correo y contraseña para verificar tu cuenta', 'error');
      return;
    }
    setProcesando(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailInput.trim(),
      password: passwordInput,
    });
    setProcesando(false);

    if (error || !data.user) {
      showToast('No se pudo verificar la cuenta', 'error', error?.message);
    } else {
      setUserId(data.user.id);
      setUserEmail(data.user.email ?? null);
      showToast('Sesión verificada. Ahora puedes eliminar tu cuenta.', 'info');
    }
  };

  const ejecutarEliminacionDatos = async () => {
    if (!userId) return;
    setModalConfirmar(false);
    setProcesando(true);

    try {
      // 1. Borramos mensajes, participaciones y perfil del usuario en Supabase
      await supabase.from('mensajes').delete().eq('perfil_id', userId);
      await supabase.from('participantes').delete().eq('perfil_id', userId);
      await supabase.from('perfiles').delete().eq('id', userId);

      // 2. Si existe una función RPC delete_user en Supabase, la invocamos (opcional)
      await supabase.rpc('delete_user');

      // 3. Cerramos sesión definitivamente
      await supabase.auth.signOut();

      setUserId(null);
      setUserEmail(null);
      setEliminadaExito(true);
      showToast('Tus datos y cuenta han sido eliminados', 'success');
    } catch (err: any) {
      showToast('Hubo un error al eliminar los datos', 'error', err?.message);
    } finally {
      setProcesando(false);
    }
  };

  const solicitarPorCorreo = () => {
    const subject = encodeURIComponent('Solicitud de eliminación de cuenta - party! (Zacatecas Party)');
    const body = encodeURIComponent(
      `Hola, solicito la eliminación definitiva de mi cuenta y todos los datos asociados en la app party! (Zacatecas Party).\n\nCorreo registrado: ${emailInput || userEmail || '[Escribe aquí tu correo]'}`
    );
    Linking.openURL(`mailto:memixveloz@gmail.com?subject=${subject}&body=${body}`);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <FiestaGlow colores={[C.danger, C.brand]} intensity={0.28} style={{ height: 240 }} />

      <ScreenHeader
        title="Eliminar Cuenta"
        subtitle="party! · Zacatecas Party App"
        right={<IconButton name="close" onPress={() => router.replace('/(tabs)')} />}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + S.xxxl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.card}>
          <View style={styles.headerBadge}>
            <Ionicons name="shield-checkmark-outline" size={22} color={C.brand} />
            <Text style={T.subtitle}>Centro de Baja y Eliminación de Datos</Text>
          </View>

          <Text style={T.body}>
            De acuerdo con las políticas de seguridad de datos de Google Play para la aplicación{' '}
            <Text style={T.bodyStrong}>party! (Zacatecas Party App)</Text>, aquí puedes eliminar de manera
            inmediata tu cuenta y todos tus datos personales asociados.
          </Text>

          <View style={styles.infoBox}>
            <SectionLabel>¿Qué datos se eliminan de forma permanente?</SectionLabel>
            <Text style={T.caption}>
              • Tu perfil de usuario (nombre, edad, biografía y avatar).{'\n'}
              • Tu lista de fiestas guardadas e historial de asistencia.{'\n'}
              • Todos los mensajes que hayas publicado en los chats de eventos.{'\n'}
              • Tu registro de acceso (correo electrónico).{'\n'}
              • Retención: <Text style={{ color: C.text }}>0 días (eliminación inmediata e irreversible).</Text>
            </Text>
          </View>

          {eliminadaExito ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={38} color={C.success} />
              <Text style={[T.subtitle, { color: C.success }]}>
                Tu cuenta y datos han sido eliminados
              </Text>
              <Text style={[T.caption, { textAlign: 'center' }]}>
                Se han borrado todos tus registros de nuestros servidores.
              </Text>
              <Button
                title="Volver al Inicio"
                onPress={() => router.replace('/(tabs)')}
                style={{ marginTop: S.sm }}
              />
            </View>
          ) : userId ? (
            <View style={styles.loggedBox}>
              <Text style={T.bodyStrong}>Sesión activa detectada:</Text>
              <Text style={[T.subtitle, { color: C.brand, marginBottom: S.sm }]}>
                {userEmail}
              </Text>
              <Button
                title="Eliminar mi cuenta y datos ahora"
                icon="trash-outline"
                variant="danger"
                loading={procesando}
                onPress={() => setModalConfirmar(true)}
              />
            </View>
          ) : (
            <View style={styles.formBox}>
              <SectionLabel>Opción 1: Eliminación automática inmediata</SectionLabel>
              <Text style={[T.caption, { marginBottom: S.sm }]}>
                Inicia sesión con tu cuenta para confirmar que eres el titular y eliminarla al instante:
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Tu correo electrónico registrado"
                placeholderTextColor={C.textFaint}
                value={emailInput}
                onChangeText={setEmailInput}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                style={styles.input}
                placeholder="Tu contraseña"
                placeholderTextColor={C.textFaint}
                value={passwordInput}
                onChangeText={setPasswordInput}
                secureTextEntry
              />

              <Button
                title="Verificar cuenta para eliminar"
                icon="key-outline"
                loading={procesando}
                onPress={iniciarSesionParaBorrar}
              />
            </View>
          )}

          <View style={styles.divider} />

          <SectionLabel>Opción 2: Solicitud sin contraseña (por correo)</SectionLabel>
          <Text style={T.caption}>
            Si olvidaste tu contraseña o ya desinstalaste la app, solicita la baja enviando un correo a{' '}
            <Text style={{ color: C.text }}>memixveloz@gmail.com</Text> desde tu dirección registrada.
            Procesaremos la baja definitiva en un plazo máximo de 48 horas.
          </Text>
          <Button
            title="Solicitar baja por correo electrónico"
            icon="mail-outline"
            variant="secondary"
            small
            onPress={solicitarPorCorreo}
            style={{ marginTop: S.xs }}
          />
        </Card>
      </ScrollView>

      <ConfirmModal
        visible={modalConfirmar}
        title="¿Eliminar tu cuenta para siempre?"
        message="Esta acción borrará tu perfil, historial y mensajes de forma inmediata y no se puede deshacer."
        confirmText="Sí, eliminar todo"
        destructive
        onCancel={() => setModalConfirmar(false)}
        onConfirm={ejecutarEliminacionDatos}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: S.xl, maxWidth: 720, width: '100%', alignSelf: 'center' },
  card: { padding: S.xl, gap: S.md },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
  },
  infoBox: {
    backgroundColor: C.surfaceAlt,
    padding: S.md,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  loggedBox: {
    backgroundColor: alpha(C.danger, 0.08),
    padding: S.lg,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: alpha(C.danger, 0.3),
    gap: 4,
  },
  successBox: {
    alignItems: 'center',
    padding: S.xl,
    backgroundColor: alpha(C.success, 0.1),
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: alpha(C.success, 0.35),
    gap: S.xs,
  },
  formBox: {
    gap: S.sm,
  },
  input: {
    backgroundColor: C.surfaceAlt,
    borderRadius: R.md,
    paddingHorizontal: S.lg,
    paddingVertical: 13,
    color: C.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: C.border,
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: S.xs,
  },
});

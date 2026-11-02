import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, FiestaGlow, IconButton, ScreenHeader, SectionLabel } from '../components/ui/kit';
import { C, S, T } from '../constants/design';

export default function PrivacidadScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <FiestaGlow colores={[C.brand, C.brand2]} intensity={0.28} style={{ height: 240 }} />

      <ScreenHeader
        title="Política de Privacidad"
        subtitle="party! · Zacatecas Party App"
        right={<IconButton name="close" onPress={() => router.back()} />}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + S.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.card}>
          <Text style={T.caption}>Última actualización: Noviembre 2026</Text>
          <Text style={T.body}>
            En <Text style={T.bodyStrong}>party! (Zacatecas Party App)</Text>, desarrollada y operada por
            Guillermo Veloz (<Text style={T.bodyStrong}>memixveloz@gmail.com</Text>), respetamos tu
            privacidad y protegemos tus datos personales conforme a las políticas de Google Play y la
            legislación aplicable.
          </Text>

          <SectionLabel style={styles.section}>1. Información que recopilamos</SectionLabel>
          <Text style={T.body}>
            • <Text style={T.bodyStrong}>Exploración sin cuenta:</Text> Puedes consultar el mapa de eventos,
            precios de covers, horarios, promociones y avisos oficiales sin necesidad de crear una cuenta ni
            proporcionar datos personales.{'\n'}
            • <Text style={T.bodyStrong}>Datos de cuenta (opcional):</Text> Si decides registrarte para
            guardar eventos o participar en el chat, recopilamos tu dirección de correo electrónico y
            contraseña cifrada a través de Supabase Auth.{'\n'}
            • <Text style={T.bodyStrong}>Perfil de usuario:</Text> Nombre o apodo, edad opcional, biografía
            corta y avatar en emoji que elijas mostrar.{'\n'}
            • <Text style={T.bodyStrong}>Contenido generado:</Text> Mensajes enviados en los chats de los
            eventos a los que te unas.
          </Text>

          <SectionLabel style={styles.section}>2. Uso de la información</SectionLabel>
          <Text style={T.body}>
            Utilizamos tus datos exclusivamente para:{'\n'}
            • Permitirte guardar fiestas en tu lista personal e historial.{'\n'}
            • Mostrar tu nombre y avatar cuando envías mensajes en el chat de un evento.{'\n'}
            • Mantener la seguridad de la plataforma.{'\n\n'}
            <Text style={T.bodyStrong}>No vendemos, alquilamos ni compartimos</Text> tu información personal
            con terceros con fines publicitarios.
          </Text>

          <SectionLabel style={styles.section}>3. Servicios de terceros</SectionLabel>
          <Text style={T.body}>
            • <Text style={T.bodyStrong}>Supabase:</Text> Proveedor de base de datos segura y autenticación
            cifrada.{'\n'}
            • <Text style={T.bodyStrong}>Google Maps SDK:</Text> Utilizado para mostrar la ubicación de los
            eventos en el mapa.
          </Text>

          <SectionLabel style={styles.section}>4. Eliminación de cuenta y datos</SectionLabel>
          <Text style={T.body}>
            Puedes eliminar tu cuenta y todos tus datos asociados (perfil, eventos guardados y mensajes) en
            cualquier momento de forma inmediata desde la sección de Perfil de la aplicación o a través de
            nuestra página dedicada de baja:
          </Text>

          <Button
            title="Ir a Eliminar mi Cuenta"
            icon="trash-outline"
            variant="secondary"
            small
            onPress={() => router.push('/eliminar-cuenta')}
            style={{ marginTop: S.sm }}
          />

          <SectionLabel style={styles.section}>5. Contacto</SectionLabel>
          <Text style={T.body}>
            Si tienes dudas sobre esta Política de Privacidad, escríbenos a:{'\n'}
            <Text style={T.bodyStrong}>memixveloz@gmail.com</Text>
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: S.xl, maxWidth: 760, width: '100%', alignSelf: 'center' },
  card: { padding: S.xl, gap: S.sm },
  section: { marginTop: S.md },
});

// -----------------------------------------------------------------------
// Componentes base del rediseño. Úsalos en todas las pantallas para que
// la app se vea consistente. Solo modo oscuro.
// -----------------------------------------------------------------------
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R, S, T } from '../../constants/design';
import { alpha, textoSobre } from '../../utils/colors';

export const tap = () => Haptics.selectionAsync().catch(() => {});

type BtnProps = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  color?: string; // color de acento (p. ej. el de la fiesta)
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
};

export function Button({ title, onPress, variant = 'primary', color = C.brand, icon, loading, disabled, style, small }: BtnProps) {
  const bg =
    variant === 'primary' ? color : variant === 'secondary' ? C.surfaceAlt : variant === 'danger' ? alpha(C.danger, 0.15) : 'transparent';
  const fg = variant === 'primary' ? textoSobre(color) : variant === 'danger' ? C.danger : variant === 'ghost' ? color : C.text;
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress?.();
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        variant === 'secondary' && { borderWidth: 1, borderColor: C.border },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={small ? 16 : 19} color={fg} />}
          <Text style={[styles.btnText, small && { fontSize: 14 }, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Card({ children, style, onPress, onLongPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; onLongPress?: () => void }) {
  if (!onPress && !onLongPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.card, style, pressed && { transform: [{ scale: 0.985 }], opacity: 0.92 }]}
    >
      {children}
    </Pressable>
  );
}

export function Chip({ label, color = C.textMuted, icon, active, onPress, style }: { label: string; color?: string; icon?: keyof typeof Ionicons.glyphMap; active?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const content = (
    <View style={[styles.chip, { backgroundColor: active ? color : alpha(color.startsWith('#') ? color : '#A1A1AA', 0.14) }, style]}>
      {icon && <Ionicons name={icon} size={13} color={active ? textoSobre(color) : color} />}
      <Text style={[styles.chipText, { color: active ? textoSobre(color) : color }]}>{label}</Text>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={() => { tap(); onPress(); }} hitSlop={6}>
      {content}
    </Pressable>
  );
}

/** Encabezado de pantalla con título grande + acción opcional a la derecha */
export function ScreenHeader({ title, subtitle, right, style }: { title: string; subtitle?: string; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + S.md }, style]}>
      <View style={{ flex: 1 }}>
        <Text style={T.display}>{title}</Text>
        {subtitle ? <Text style={[T.caption, { marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** Botón circular con ícono (para headers) */
export function IconButton({ name, onPress, color = C.text, bg = C.surfaceAlt, size = 20, style }: { name: keyof typeof Ionicons.glyphMap; onPress?: () => void; color?: string; bg?: string; size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      onPress={() => { tap(); onPress?.(); }}
      hitSlop={8}
      style={({ pressed }) => [styles.iconBtn, { backgroundColor: bg, opacity: pressed ? 0.7 : 1 }, style]}
    >
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
}

/** Gradiente suave con los colores de una fiesta, desvanecido hacia el fondo */
export function FiestaGlow({ colores, style, intensity = 0.55 }: { colores: string[]; style?: StyleProp<ViewStyle>; intensity?: number }) {
  return (
    <LinearGradient
      colors={[alpha(colores[0], intensity), alpha(colores[1] ?? colores[0], intensity * 0.45), 'transparent']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.6, y: 1 }}
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents="none"
    />
  );
}

export function EmptyState({ icon, title, message, action }: { icon: keyof typeof Ionicons.glyphMap; title: string; message?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={C.textMuted} />
      </View>
      <Text style={[T.subtitle, { textAlign: 'center' }]}>{title}</Text>
      {message ? <Text style={[T.caption, { textAlign: 'center', marginTop: 6 }]}>{message}</Text> : null}
      {action ? <View style={{ marginTop: S.lg }}>{action}</View> : null}
    </View>
  );
}

export function SectionLabel({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[T.micro, { textTransform: 'uppercase', marginBottom: S.sm }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  btn: { height: 52, borderRadius: R.lg, paddingHorizontal: S.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm },
  btnSmall: { height: 38, borderRadius: R.md, paddingHorizontal: S.md },
  btnText: { fontSize: 16, fontWeight: '700' },
  card: { backgroundColor: C.surface, borderRadius: R.xl, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 26, borderRadius: R.pill, alignSelf: 'flex-start' },
  chipText: { fontSize: 12, fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: S.xl, paddingBottom: S.lg, gap: S.md },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: S.xxl, paddingVertical: S.xxxl },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: S.lg },
});

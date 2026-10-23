// -----------------------------------------------------------------------
// Sistema de diseÃ±o de party! â€” SOLO modo oscuro.
// Fondo neutro grafito; el color vivo lo aporta cada fiesta (ver utils/colors).
// Usa SIEMPRE estos tokens en vez de valores sueltos.
// -----------------------------------------------------------------------
import { Platform } from 'react-native';

export const C = {
  // Superficies (de mÃ¡s profunda a mÃ¡s elevada)
  bg: '#0B0B10',
  surface: '#14141B',
  surfaceAlt: '#1C1C25',
  surfaceHigh: '#252530',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',

  // Texto
  text: '#F5F5F7',
  textMuted: '#A1A1AA',
  textFaint: '#6B6B76',

  // Marca (acento global cuando no hay fiesta en contexto)
  brand: '#FF3D7F',
  brand2: '#7C5CFF',

  // Estados
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',

  overlay: 'rgba(0,0,0,0.6)',
} as const;

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;

export const R = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

export const T = {
  display: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.6, color: C.text },
  title: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.3, color: C.text },
  subtitle: { fontSize: 17, fontWeight: '700' as const, color: C.text },
  body: { fontSize: 15, fontWeight: '400' as const, color: C.text, lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const, color: C.text },
  caption: { fontSize: 13, fontWeight: '500' as const, color: C.textMuted },
  micro: { fontSize: 11, fontWeight: '700' as const, color: C.textFaint, letterSpacing: 0.6 },
} as const;

export const shadow = (color = '#000', elevation = 8) =>
  Platform.select({
    ios: {
      shadowColor: color,
      shadowOpacity: 0.35,
      shadowRadius: elevation * 1.5,
      shadowOffset: { width: 0, height: elevation / 2 },
    },
    default: { elevation },
  });

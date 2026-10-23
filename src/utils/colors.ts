import { useEffect, useState } from 'react';
import { supabase } from '../../supabase';

// -----------------------------------------------------------------------
// Colores de cada fiesta.
// Prioridad: 1) evento.colores (extraídos del logo y guardados en Supabase)
//            2) paleta por tipo de fiesta   3) paleta por hash del id.
// Siempre devuelve 3 colores: [principal, secundario, oscuro].
// -----------------------------------------------------------------------

export const PALETAS_FIESTA: Record<string, string[]> = {
  antro: ['#8A2BE2', '#FF007F', '#2A0F4A'],
  callejoneada: ['#FF6B00', '#FFD700', '#4A2408'],
  norteno: ['#00B0FF', '#00E676', '#06324A'],
  rave: ['#00E5FF', '#7928CA', '#0A2A40'],
  boda: ['#D4AF37', '#F5E6CA', '#3A2E10'],
  default: ['#FF2A6D', '#05D9E8', '#3A0A1E'],
};

export const PALETAS_LISTA = [
  ['#FF355E', '#FFCC33', '#4A0F1C'],
  ['#8A2BE2', '#00F0FF', '#26104A'],
  ['#00E676', '#00E5FF', '#063A24'],
  ['#FF007F', '#4299E1', '#4A0026'],
  ['#FF9100', '#FF3D00', '#4A2600'],
  ['#3A86FF', '#FFCA3A', '#0A2450'],
];

type EventoColor = {
  id?: string | number;
  tipo_fiesta?: string;
  link_logo?: string | null;
  colores?: string[] | null;
};

// ---------- utilidades de color ----------
const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};
const rgbToHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase();

const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return { h, s, l };
};
const hslToHex = (h: number, s: number, l: number) => {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
};

/** Agrega transparencia a un hex: alpha('#FF0000', 0.2) → 'rgba(255,0,0,0.2)' */
export const alpha = (hex: string, a: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

/** Luminancia relativa (0 = negro, 1 = blanco) */
export const luminancia = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const ch = (v: number) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};

/** Color de texto legible encima de `bg` */
export const textoSobre = (bg: string) => (luminancia(bg) > 0.45 ? '#0B0B10' : '#FFFFFF');

/** Ajusta un color para que luzca vivo y legible sobre fondo oscuro */
export const vivificar = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  return hslToHex(h, Math.max(s, 0.55), Math.min(Math.max(l, 0.5), 0.68));
};
/** Versión muy oscura del color (para fondos) */
export const oscurecer = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const { h, s } = rgbToHsl(r, g, b);
  return hslToHex(h, Math.min(Math.max(s, 0.35), 0.7), 0.14);
};

const esValida = (p?: string[] | null): p is string[] =>
  Array.isArray(p) && p.length >= 2 && p.every((c) => /^#[0-9A-Fa-f]{6}$/.test(c));

/** Paleta síncrona (sin extraer). Úsala para listas/mapa. */
export function paletaParaFiesta(evento?: EventoColor): string[] {
  if (esValida(evento?.colores)) {
    const [a, b, c] = evento!.colores!;
    return [a, b, c ?? oscurecer(a)];
  }
  const cacheada = evento?.link_logo ? cache.get(evento.link_logo) : undefined;
  if (cacheada) return cacheada;

  if (evento?.tipo_fiesta) {
    const t = evento.tipo_fiesta.toLowerCase();
    if (t.includes('antro')) return PALETAS_FIESTA.antro;
    if (t.includes('callejoneada')) return PALETAS_FIESTA.callejoneada;
    if (t.includes('norteño') || t.includes('norteno')) return PALETAS_FIESTA.norteno;
    if (t.includes('rave') || t.includes('electro')) return PALETAS_FIESTA.rave;
    if (t.includes('boda') || t.includes('gala')) return PALETAS_FIESTA.boda;
  }
  const str = String(evento?.link_logo || evento?.id || 'fiesta');
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return PALETAS_LISTA[hash % PALETAS_LISTA.length];
}

// ---------- extracción desde el logo ----------
const cache = new Map<string, string[]>();
const enCurso = new Map<string, Promise<string[] | null>>();

/**
 * Extrae [principal, secundario, oscuro] de una imagen.
 * Devuelve null si el módulo nativo no está disponible (p. ej. Expo Go).
 */
export async function extraerColoresDeImagen(url: string): Promise<string[] | null> {
  if (!url) return null;
  if (cache.has(url)) return cache.get(url)!;
  if (enCurso.has(url)) return enCurso.get(url)!;

  const p = (async () => {
    try {
      // require perezoso: si el módulo nativo no existe, no rompe la app
      const ImageColors = require('react-native-image-colors').default ?? require('react-native-image-colors');
      const r: any = await ImageColors.getColors(url, { fallback: '#FF3D7F', cache: true, key: url, quality: 'low' });
      let candidatos: string[] = [];
      if (r.platform === 'android') candidatos = [r.vibrant, r.dominant, r.lightVibrant, r.muted, r.darkVibrant];
      else if (r.platform === 'ios') candidatos = [r.primary, r.secondary, r.detail, r.background];
      else candidatos = [r.vibrant, r.dominant, r.lightVibrant, r.muted];
      candidatos = candidatos.filter((c) => typeof c === 'string' && /^#[0-9A-Fa-f]{6}/.test(c)).map((c) => c.slice(0, 7));
      if (!candidatos.length) return null;

      const principal = vivificar(candidatos[0]);
      const secundario = vivificar(candidatos.find((c) => c.toUpperCase() !== candidatos[0].toUpperCase()) ?? candidatos[0]);
      const paleta = [principal, secundario, oscurecer(principal)];
      cache.set(url, paleta);
      return paleta;
    } catch {
      return null;
    } finally {
      enCurso.delete(url);
    }
  })();
  enCurso.set(url, p);
  return p;
}

/**
 * Hook: devuelve la paleta de la fiesta. Si tiene logo pero no colores
 * guardados, los extrae y (si se puede) los guarda en Supabase.
 */
export function useColoresFiesta(evento?: EventoColor | null): string[] {
  const [paleta, setPaleta] = useState(() => paletaParaFiesta(evento ?? undefined));

  useEffect(() => {
    if (!evento) return;
    setPaleta(paletaParaFiesta(evento));
    if (esValida(evento.colores) || !evento.link_logo) return;

    let vivo = true;
    extraerColoresDeImagen(evento.link_logo).then((p) => {
      if (!vivo || !p) return;
      setPaleta(p);
      if (evento.id) {
        // Auto-migración: se guarda una vez (si RLS lo permite; si no, se ignora)
        supabase.from('eventos').update({ colores: p }).eq('id', evento.id).then(() => {});
      }
    });
    return () => {
      vivo = false;
    };
  }, [evento?.id, evento?.link_logo, JSON.stringify(evento?.colores ?? null)]);

  return paleta;
}

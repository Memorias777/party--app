export const PALETAS_FIESTA: Record<string, string[]> = {
  antro: ['#8A2BE2', '#FF007F', '#00F0FF'],       // Neón Cyber/Antro (Púrpura, Magenta, Cyan)
  callejoneada: ['#FF6B00', '#FFD700', '#8B4513'],// Cálido Zacatecas (Naranja, Dorado, Ámbar)
  norteno: ['#00B0FF', '#00E676', '#FFEA00'],     // Fiesta Norteña (Azul Eléctrico, Verde, Amarillo)
  default: ['#FF2A6D', '#05D9E8', '#D1F7FF'],     // Synthwave Fiesta (Rosa neón, Turquesa, Azul)
};

export const PALETAS_LISTA = [
  ['#FF355E', '#FF6037', '#FFCC33'], // Red Orange Sunburst
  ['#8A2BE2', '#D100D1', '#00F0FF'], // Neon Purple Cyan
  ['#00E676', '#1DE9B6', '#00E5FF'], // Mint Electric
  ['#FF007F', '#7928CA', '#4299E1'], // Magenta Violet
  ['#FF9100', '#FF3D00', '#DD2C00'], // Fire Sunset
  ['#3A86FF', '#8AC926', '#FFCA3A'], // Electric Trio
];

export function paletaParaFiesta(evento: {
  id?: string | number;
  tipo_fiesta?: string;
  link_logo?: string;
}): string[] {
  if (evento.tipo_fiesta) {
    const tipoLower = evento.tipo_fiesta.toLowerCase();
    if (tipoLower.includes('antro')) return PALETAS_FIESTA.antro;
    if (tipoLower.includes('callejoneada')) return PALETAS_FIESTA.callejoneada;
    if (tipoLower.includes('norteño') || tipoLower.includes('norteno')) return PALETAS_FIESTA.norteno;
  }

  const strToHash = String(evento.link_logo || evento.id || 'fiesta');
  let hash = 0;
  for (let i = 0; i < strToHash.length; i++) {
    hash = (hash * 31 + strToHash.charCodeAt(i)) >>> 0;
  }

  return PALETAS_LISTA[hash % PALETAS_LISTA.length];
}

export interface IColorPreset {
  id: string;
  label: string;
  header: string;
  button: string;
}

/** El look original del sistema — default si la empresa no elige nada */
export const DEFAULT_PRESET_ID = 'purple';

/**
 * 10 paletas curadas de antemano. Todas usan header oscuro + texto claro a propósito: es la
 * combinación con mejor contraste garantizado (importante para accesibilidad — usuarios
 * mayores o con fatiga visual). Se probó una variante de fondo claro/texto oscuro y el
 * contraste quedaba pobre en varias zonas del sidebar; se descartó en vez de intentar
 * arreglarla — más simple y más seguro tener un solo esquema de contraste que garantizar
 * dos.
 */
export const COLOR_PRESETS: IColorPreset[] = [
  { id: 'purple', label: 'Morado (default)', header: '#1a1a2e', button: '#667eea' },
  { id: 'ocean', label: 'Azul océano', header: '#0c2d48', button: '#2563eb' },
  { id: 'emerald', label: 'Verde esmeralda', header: '#0f2e1f', button: '#16a34a' },
  { id: 'teal', label: 'Verde azulado', header: '#0d2b2e', button: '#0d9488' },
  { id: 'ruby', label: 'Rojo rubí', header: '#2b0f16', button: '#e11d48' },
  { id: 'amber', label: 'Naranja ámbar', header: '#2e1f0a', button: '#ea580c' },
  { id: 'rose', label: 'Rosa', header: '#2e0f22', button: '#db2777' },
  { id: 'indigo', label: 'Índigo', header: '#1a1a3e', button: '#4f46e5' },
  { id: 'slate', label: 'Gris pizarra', header: '#1f2937', button: '#475569' },
  { id: 'coffee', label: 'Café', header: '#2b1a12', button: '#92400e' }
];

export function getColorPreset(id: string | null | undefined): IColorPreset {
  return COLOR_PRESETS.find((p) => p.id === id) ?? COLOR_PRESETS[0];
}

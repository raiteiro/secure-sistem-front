import { Injectable } from '@angular/core';
import { getColorPreset } from '../constants/color-presets';

/**
 * Aplica la paleta de color de la empresa (una de las `COLOR_PRESETS`, ver
 * core/constants/color-presets.ts) como variables CSS sobre :root. Solo se usa dentro del
 * layout autenticado; las pantallas públicas (login, forgot/reset password) mantienen el
 * morado por defecto de styles.scss.
 *
 * A propósito la empresa NO elige un color libre — elige una paleta ya armada. Todas las
 * paletas usan header oscuro + texto claro (mejor contraste garantizado); no hay modo de
 * texto que resolver. El "difuminado" en botones, encabezados de modal y sidebar es una
 * capa de transparencia blanco/negro superpuesta en el CSS (ver rm-header / .btn-primary en
 * styles.scss y en cada *-list.component.scss) — dan sensación de degradado sin mezclar con
 * otro color.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  applyPreset(presetId: string | null): void {
    const preset = getColorPreset(presetId);

    const root = document.documentElement.style;
    root.setProperty('--brand-header', preset.header);
    root.setProperty('--brand-button', preset.button);
    root.setProperty('--brand-button-rgb', this.hexToRgbString(preset.button));
  }

  reset(): void {
    this.applyPreset(null);
  }

  private hexToRgbString(hex: string): string {
    const full = hex.length === 4 ? '#' + [...hex.slice(1)].map((c) => c + c).join('') : hex;
    const r = parseInt(full.slice(1, 3), 16);
    const g = parseInt(full.slice(3, 5), 16);
    const b = parseInt(full.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
  }
}

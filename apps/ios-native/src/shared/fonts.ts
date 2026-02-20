import {
  Sora_400Regular,
  Sora_600SemiBold,
  Sora_700Bold,
} from '@expo-google-fonts/sora';

/**
 * Sora font family — matches web (Google Fonts via next/font).
 * Loaded via expo-font in App.tsx and AppClip.tsx before rendering.
 *
 * Three weights: regular (body), semibold (buttons), bold (headings).
 */
export const SORA_FONT_MAP = {
  'Sora-Regular': Sora_400Regular,
  'Sora-SemiBold': Sora_600SemiBold,
  'Sora-Bold': Sora_700Bold,
};

export const SORA = {
  regular: 'Sora-Regular',   // 400
  semibold: 'Sora-SemiBold', // 600
  bold: 'Sora-Bold',         // 700
} as const;

/** @deprecated Use SORA instead — kept temporarily for migration */
export const SF_ROUNDED = SORA;

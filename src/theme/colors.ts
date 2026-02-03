// Big Fella Athletics Color Scheme
// Black background with white text and red (#AA0100) accents
// Inspired by the Athletics logo with laurel wreath

export const colors = {
  // Primary colors - Red from logo
  primary: '#AA0100',
  primaryDark: '#880100',
  primaryLight: '#CC0100',

  // Accent colors - White for contrast
  accent: '#FFFFFF',
  accentDark: '#E0E0E0',
  accentLight: '#FFFFFF',

  // Status colors
  success: '#4CAF50',
  successDark: '#388E3C',
  successLight: '#81C784',
  warning: '#FFC107',
  warningDark: '#FFA000',
  error: '#AA0100',
  errorDark: '#880100',

  // Neutral colors - Black background
  background: '#000000',
  backgroundDark: '#000000',
  surface: '#1A1A1A',
  surfaceDark: '#0A0A0A',

  // Text colors - White on black
  textPrimary: '#FFFFFF',
  textPrimaryDark: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textSecondaryDark: '#808080',
  textDisabled: '#666666',

  // Border colors
  border: '#333333',
  borderDark: '#1A1A1A',

  // Streak colors (for calendar heatmap) - Red gradient
  streakNone: '#1A1A1A',
  streakLight: '#4D0100',
  streakMedium: '#770100',
  streakStrong: '#AA0100',
  streakIntense: '#DD0100',

  // Lift progress colors
  liftPR: '#FFD700',
  liftProgress: '#4CAF50',
  liftMaintain: '#FFFFFF',
  liftRegress: '#AA0100',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  overlay: 'rgba(0, 0, 0, 0.7)',
};

export const darkColors = {
  ...colors,
  background: colors.backgroundDark,
  surface: colors.surfaceDark,
  textPrimary: colors.textPrimaryDark,
  textSecondary: colors.textSecondaryDark,
  border: colors.borderDark,
  streakNone: '#1A1A1A',
};

export type ColorScheme = typeof colors;

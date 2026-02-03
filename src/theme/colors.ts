// Big Fella Athletics Color Scheme
// Primary: Bold athletic orange - energetic and motivating
// Accent: Strong blue - contrasting for CTAs and highlights

export const colors = {
  // Primary colors
  primary: '#FF6B35',
  primaryDark: '#E55A2B',
  primaryLight: '#FF8F66',

  // Accent colors
  accent: '#2196F3',
  accentDark: '#1976D2',
  accentLight: '#64B5F6',

  // Status colors
  success: '#4CAF50',
  successDark: '#388E3C',
  successLight: '#81C784',
  warning: '#FFC107',
  warningDark: '#FFA000',
  error: '#F44336',
  errorDark: '#D32F2F',

  // Neutral colors
  background: '#FAFAFA',
  backgroundDark: '#121212',
  surface: '#FFFFFF',
  surfaceDark: '#1E1E1E',

  // Text colors
  textPrimary: '#212121',
  textPrimaryDark: '#FFFFFF',
  textSecondary: '#757575',
  textSecondaryDark: '#B0B0B0',
  textDisabled: '#9E9E9E',

  // Border colors
  border: '#E0E0E0',
  borderDark: '#333333',

  // Streak colors (for calendar heatmap)
  streakNone: '#EEEEEE',
  streakLight: '#FFE0B2',
  streakMedium: '#FFCC80',
  streakStrong: '#FF9800',
  streakIntense: '#F57C00',

  // Lift progress colors
  liftPR: '#FFD700',
  liftProgress: '#4CAF50',
  liftMaintain: '#2196F3',
  liftRegress: '#F44336',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

export const darkColors = {
  ...colors,
  background: colors.backgroundDark,
  surface: colors.surfaceDark,
  textPrimary: colors.textPrimaryDark,
  textSecondary: colors.textSecondaryDark,
  border: colors.borderDark,
  streakNone: '#333333',
};

export type ColorScheme = typeof colors;

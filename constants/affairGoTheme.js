export const affairGoTheme = {
  colors: {
    background: '#080B1E',
    backgroundStrong: '#060816',
    backgroundSoft: '#10152D',
    overlay: 'rgba(8, 11, 30, 0.82)',
    overlayStrong: 'rgba(8, 11, 30, 0.92)',
    card: '#121733',
    cardStrong: '#1A2042',
    cardMuted: 'rgba(255,255,255,0.04)',
    line: '#2A3055',
    lineStrong: 'rgba(169, 167, 190, 0.36)',
    text: '#F7F5FF',
    textMuted: '#A9A7BE',
    textFaint: '#7F7D97',
    accent: '#7657FF',
    accentSoft: '#FF6F91',
    access: '#FF6F91',
    accessHighlight: '#B39DFF',
    success: '#7FE1C2',
    blue: '#8E9BFF',
    yellow: '#FFD27A',
    danger: '#FF8AA3',
    warning: '#FFB37D',
    info: '#9FC2FF',
  },
  gradients: {
    hero: ['rgba(118,87,255,0.18)', 'rgba(255,111,145,0.06)'],
    cardGlow: ['rgba(118,87,255,0.14)', 'rgba(255,255,255,0.02)'],
  },
  spacing: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
  },
  radius: {
    sm: 14,
    md: 18,
    lg: 24,
    xl: 30,
    pill: 999,
  },
  typography: {
    eyebrow: {
      fontSize: 12,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    body: {
      fontSize: 16,
      lineHeight: 24,
    },
    bodySmall: {
      fontSize: 14,
      lineHeight: 20,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
    },
    titleLarge: {
      fontSize: 28,
      fontWeight: '700',
    },
  },
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  layout: {
    contentWidth: 1180,
    formWidth: 640,
  },
};

export const accessColors = {
  free: affairGoTheme.colors.access,
};

export const accessLabels = {
  free: 'Kostenfrei',
};

export const travelModeColors = {
  active: affairGoTheme.colors.blue,
  vacation: affairGoTheme.colors.blue,
  business: affairGoTheme.colors.yellow,
};

export const verificationColors = {
  verified: affairGoTheme.colors.success,
  review: affairGoTheme.colors.warning,
  expired: affairGoTheme.colors.danger,
};
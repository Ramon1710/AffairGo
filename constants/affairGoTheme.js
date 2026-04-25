export const affairGoTheme = {
  colors: {
    background: '#140304',
    backgroundStrong: '#240507',
    backgroundSoft: '#2d0d10',
    overlay: 'rgba(12, 0, 2, 0.6)',
    overlayStrong: 'rgba(10, 0, 2, 0.82)',
    card: 'rgba(95, 28, 38, 0.44)',
    cardStrong: 'rgba(111, 30, 32, 0.62)',
    cardMuted: 'rgba(255,255,255,0.06)',
    line: 'rgba(255, 226, 226, 0.28)',
    lineStrong: 'rgba(255, 226, 226, 0.46)',
    text: '#f6e5e2',
    textMuted: '#d6b8b8',
    textFaint: '#a98a8a',
    accent: '#ff4343',
    accentSoft: '#ff7a64',
    premium: '#f3c86c',
    gold: '#ffe08d',
    success: '#89d6b2',
    blue: '#4ea6ff',
    yellow: '#ffd24a',
    danger: '#ff8c8c',
    warning: '#ffbd6c',
    info: '#83c8ff',
  },
  gradients: {
    hero: ['rgba(255,122,100,0.22)', 'rgba(255,67,67,0.04)'],
    cardGlow: ['rgba(255,90,90,0.16)', 'rgba(255,255,255,0.02)'],
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
    sm: 12,
    md: 18,
    lg: 26,
    xl: 34,
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
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  layout: {
    contentWidth: 1180,
    formWidth: 640,
  },
};

export const membershipColors = {
  basic: affairGoTheme.colors.accent,
  premium: affairGoTheme.colors.premium,
  gold: affairGoTheme.colors.gold,
};

export const membershipLabels = {
  basic: 'Basic',
  premium: 'Premium',
  gold: 'Gold',
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
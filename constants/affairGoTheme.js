export const affairGoTheme = {
  colors: {
    background: '#140304',
    backgroundStrong: '#240507',
    overlay: 'rgba(12, 0, 2, 0.6)',
    card: 'rgba(95, 28, 38, 0.44)',
    cardStrong: 'rgba(111, 30, 32, 0.62)',
    line: 'rgba(255, 226, 226, 0.28)',
    text: '#f6e5e2',
    textMuted: '#d6b8b8',
    accent: '#ff4343',
    accentSoft: '#ff7a64',
    premium: '#f3c86c',
    gold: '#ffe08d',
    success: '#89d6b2',
    blue: '#4ea6ff',
    yellow: '#ffd24a',
    danger: '#ff8c8c',
  },
  spacing: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    sm: 12,
    md: 18,
    lg: 26,
    pill: 999,
  },
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
};

export const membershipColors = {
  basic: affairGoTheme.colors.accent,
  premium: affairGoTheme.colors.premium,
  gold: affairGoTheme.colors.gold,
};

export const travelModeColors = {
  active: affairGoTheme.colors.blue,
  vacation: affairGoTheme.colors.blue,
  business: affairGoTheme.colors.yellow,
};
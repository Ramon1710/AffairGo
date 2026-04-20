import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from './SimpleIcons';

export const palette = {
  background: '#130105',
  panel: 'rgba(92, 29, 47, 0.72)',
  panelStrong: 'rgba(59, 11, 21, 0.86)',
  line: 'rgba(255, 220, 220, 0.24)',
  text: '#f6dfdd',
  muted: '#d0b3b7',
  accent: '#ff4d4d',
  accentSoft: '#ff855f',
  gold: '#f2c76d',
  blue: '#45a7e8',
  trip: '#f2c94c',
};

export const AppScreen = ({ children, scroll = true, contentContainerStyle, footer }) => {
  const body = scroll ? (
    <ScrollView contentContainerStyle={[styles.scrollContent, contentContainerStyle]}>{children}</ScrollView>
  ) : (
    <View style={[styles.staticContent, contentContainerStyle]}>{children}</View>
  );

  return (
    <ImageBackground source={require('../assets/login-bg.png')} resizeMode="cover" style={styles.background}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          {body}
          {footer}
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
};

export const GlassCard = ({ children, style }) => <View style={[styles.card, style]}>{children}</View>;

export const AppButton = ({ title, onPress, variant = 'primary', icon, style, textStyle, disabled }) => {
  const buttonStyles = [
    styles.button,
    variant === 'secondary' && styles.buttonSecondary,
    variant === 'ghost' && styles.buttonGhost,
    disabled && styles.buttonDisabled,
    style,
  ];

  return (
    <Pressable style={buttonStyles} onPress={onPress} disabled={disabled}>
      {icon ? <Ionicons name={icon} size={18} color={variant === 'ghost' ? palette.text : '#ffffff'} /> : null}
      <Text style={[styles.buttonText, variant === 'ghost' && styles.buttonGhostText, textStyle]}>{title}</Text>
    </Pressable>
  );
};

export const AppInput = ({ label, hint, style, right, ...props }) => (
  <View style={styles.fieldWrap}>
    {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
    {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    <View style={[styles.inputShell, style]}>
      <TextInput placeholderTextColor={palette.muted} style={styles.input} {...props} />
      {right}
    </View>
  </View>
);

export const SectionTitle = ({ title, subtitle, right }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionTextWrap}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
    {right}
  </View>
);

export const Chip = ({ label, active, onPress, tone = 'default' }) => (
  <Pressable
    onPress={onPress}
    style={[
      styles.chip,
      active && styles.chipActive,
      tone === 'gold' && styles.chipGold,
      tone === 'blue' && styles.chipBlue,
    ]}
  >
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </Pressable>
);

export const StatPill = ({ label, value, accent }) => (
  <View style={[styles.statPill, accent ? { borderColor: accent } : null]}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

export const AvatarBadge = ({ label, subtitle, color = palette.accent, size = 76 }) => (
  <View style={styles.avatarWrap}>
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[styles.avatarText, { fontSize: size / 3.2 }]}>{label.slice(0, 2).toUpperCase()}</Text>
    </View>
    {subtitle ? <Text style={styles.avatarSubtitle}>{subtitle}</Text> : null}
  </View>
);

export const InlineNotice = ({ text, tone = 'default' }) => (
  <View style={[styles.notice, tone === 'warning' && styles.noticeWarning, tone === 'success' && styles.noticeSuccess]}>
    <Text style={styles.noticeText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: palette.background },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(14, 1, 5, 0.55)',
  },
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 18 },
  staticContent: { flex: 1, paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
  },
  button: {
    minHeight: 54,
    borderRadius: 28,
    backgroundColor: palette.accent,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: palette.line,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: palette.line,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonGhostText: {
    color: palette.text,
  },
  fieldWrap: { gap: 6 },
  fieldLabel: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '600',
  },
  fieldHint: {
    color: palette.muted,
    fontSize: 12,
  },
  inputShell: {
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    color: palette.text,
    fontSize: 17,
    paddingVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  sectionTextWrap: { flex: 1, gap: 4 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.text,
  },
  sectionSubtitle: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipActive: {
    backgroundColor: 'rgba(255, 77, 77, 0.22)',
    borderColor: 'rgba(255, 77, 77, 0.45)',
  },
  chipGold: {
    borderColor: 'rgba(242, 199, 109, 0.45)',
  },
  chipBlue: {
    borderColor: 'rgba(69, 167, 232, 0.45)',
  },
  chipText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: palette.text,
  },
  statPill: {
    minWidth: 92,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    gap: 4,
  },
  statValue: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    color: palette.muted,
    fontSize: 12,
  },
  avatarWrap: {
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  avatarSubtitle: {
    color: palette.muted,
    fontSize: 12,
  },
  notice: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeWarning: {
    borderColor: 'rgba(255, 173, 96, 0.45)',
  },
  noticeSuccess: {
    borderColor: 'rgba(69, 232, 162, 0.45)',
  },
  noticeText: {
    color: palette.text,
    fontSize: 13,
    lineHeight: 18,
  },
});
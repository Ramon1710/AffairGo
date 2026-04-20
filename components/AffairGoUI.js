import { ImageBackground, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { affairGoTheme } from '../constants/affairGoTheme';
import { Ionicons } from './SimpleIcons';

export const backgroundSource = require('../assets/login-bg.png');

export const AppBackground = ({ children, scroll = true, contentContainerStyle, style }) => {
  const content = scroll ? (
    <ScrollView contentContainerStyle={[styles.scrollContent, contentContainerStyle]} style={style}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fixedContent, style, contentContainerStyle]}>{children}</View>
  );

  return (
    <ImageBackground source={backgroundSource} resizeMode="cover" style={styles.background}>
      <View style={styles.scrim} />
      {content}
    </ImageBackground>
  );
};

export const GlassCard = ({ children, style, strong = false }) => (
  <View style={[styles.card, strong && styles.cardStrong, style]}>{children}</View>
);

export const ScreenHeader = ({ title, subtitle, leftAction, rightAction }) => (
  <View style={styles.header}>
    <View style={styles.headerAction}>{leftAction}</View>
    <View style={styles.headerCopy}>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <Text style={styles.title}>{title}</Text>
    </View>
    <View style={styles.headerAction}>{rightAction}</View>
  </View>
);

export const AccentButton = ({ label, onPress, variant = 'primary', disabled = false, style }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [
      styles.button,
      variant === 'secondary' && styles.buttonSecondary,
      variant === 'ghost' && styles.buttonGhost,
      disabled && styles.buttonDisabled,
      pressed && !disabled && styles.buttonPressed,
      style,
    ]}
  >
    <Text style={[styles.buttonLabel, variant === 'ghost' && styles.buttonGhostLabel]}>{label}</Text>
  </Pressable>
);

export const InlineStat = ({ label, value, accent }) => (
  <View style={styles.stat}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, accent ? { color: accent } : null]}>{value}</Text>
  </View>
);

export const FormField = ({ label, hint, right, multiline = false, style, ...props }) => (
  <View style={styles.fieldBlock}>
    <View style={styles.fieldMeta}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {right}
    </View>
    <TextInput
      placeholderTextColor={affairGoTheme.colors.textMuted}
      multiline={multiline}
      style={[styles.input, multiline && styles.multiline, style]}
      {...props}
    />
    {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
  </View>
);

export const ToggleChip = ({ label, active, onPress, color }) => (
  <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive, active && color ? { borderColor: color, backgroundColor: `${color}33` } : null]}>
    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
  </Pressable>
);

export const BulletRow = ({ icon, label, detail }) => (
  <View style={styles.bulletRow}>
    <Ionicons name={icon} size={18} color={affairGoTheme.colors.accentSoft} />
    <View style={styles.bulletCopy}>
      <Text style={styles.bulletLabel}>{label}</Text>
      {detail ? <Text style={styles.bulletDetail}>{detail}</Text> : null}
    </View>
  </View>
);

export const SectionTitle = ({ title, aside }) => (
  <View style={styles.sectionRow}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {aside ? <Text style={styles.sectionAside}>{aside}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: affairGoTheme.colors.background,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: affairGoTheme.colors.overlay,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'web' ? 28 : 48,
    paddingBottom: 36,
  },
  fixedContent: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'web' ? 28 : 48,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: affairGoTheme.colors.card,
    borderRadius: affairGoTheme.radius.lg,
    borderWidth: 1,
    borderColor: affairGoTheme.colors.line,
    padding: 18,
    ...affairGoTheme.shadow,
  },
  cardStrong: {
    backgroundColor: affairGoTheme.colors.cardStrong,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerAction: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    alignItems: 'center',
  },
  subtitle: {
    color: affairGoTheme.colors.accentSoft,
    fontSize: 16,
    marginBottom: 4,
  },
  title: {
    color: affairGoTheme.colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  button: {
    minHeight: 52,
    borderRadius: affairGoTheme.radius.pill,
    backgroundColor: affairGoTheme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  buttonSecondary: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderColor: affairGoTheme.colors.line,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.84,
  },
  buttonLabel: {
    color: affairGoTheme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  buttonGhostLabel: {
    color: affairGoTheme.colors.textMuted,
  },
  stat: {
    minWidth: 92,
  },
  statLabel: {
    color: affairGoTheme.colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statValue: {
    color: affairGoTheme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  fieldLabel: {
    color: affairGoTheme.colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    minHeight: 50,
    borderRadius: affairGoTheme.radius.md,
    borderWidth: 1,
    borderColor: affairGoTheme.colors.line,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    color: affairGoTheme.colors.text,
    fontSize: 16,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  fieldHint: {
    color: affairGoTheme.colors.textMuted,
    marginTop: 6,
    fontSize: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: affairGoTheme.radius.pill,
    borderWidth: 1,
    borderColor: affairGoTheme.colors.line,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipActive: {
    backgroundColor: 'rgba(255, 67, 67, 0.2)',
    borderColor: affairGoTheme.colors.accent,
  },
  chipLabel: {
    color: affairGoTheme.colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  chipLabelActive: {
    color: affairGoTheme.colors.text,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  bulletCopy: {
    flex: 1,
  },
  bulletLabel: {
    color: affairGoTheme.colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  bulletDetail: {
    color: affairGoTheme.colors.textMuted,
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  sectionAside: {
    color: affairGoTheme.colors.accentSoft,
    fontSize: 14,
  },
});
import { useEffect } from 'react';
import { ImageBackground, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useCurrentRoute } from '../naviagtion/SimpleNavigation';
import {
    MAIN_NAV_DESKTOP_BAR_HEIGHT,
    MAIN_NAV_MOBILE_BAR_HEIGHT,
    getMainNavRouteName,
    isDesktopMainNavigation,
} from '../untils/mainNavigation';
import { Ionicons } from './SimpleIcons';

export const backgroundSource = require('../assets/login-bg.png');

export const AppBackground = ({ children, scroll = true, contentContainerStyle, style, scrollViewRef }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const route = useCurrentRoute();
  const hasMainNavigation = Boolean(getMainNavRouteName(route?.name));
  const desktopMainNavigation = hasMainNavigation && isDesktopMainNavigation(width, Platform.OS);
  const bottomNavigationSpace = hasMainNavigation && !desktopMainNavigation
    ? MAIN_NAV_MOBILE_BAR_HEIGHT + Math.max(insets.bottom, 12) + 18
    : Math.max(insets.bottom, 16) + 20;
  const topNavigationSpace = desktopMainNavigation
    ? MAIN_NAV_DESKTOP_BAR_HEIGHT + Math.max(insets.top, 12) + 18
    : 0;
  const contentTopPadding = Math.max(insets.top + 12, Platform.OS === 'web' ? 28 : 24) + topNavigationSpace;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return undefined;
    }

    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const previous = {
      htmlBackground: html.style.backgroundColor,
      bodyBackground: body.style.backgroundColor,
      rootBackground: root?.style.backgroundColor || '',
      htmlOverflowX: html.style.overflowX,
      bodyOverflowX: body.style.overflowX,
      rootOverflowX: root?.style.overflowX || '',
      bodyMargin: body.style.margin,
      bodyMinHeight: body.style.minHeight,
      rootMinHeight: root?.style.minHeight || '',
    };

    html.style.backgroundColor = affairGoTheme.colors.background;
    html.style.overflowX = 'hidden';
    body.style.backgroundColor = affairGoTheme.colors.background;
    body.style.overflowX = 'hidden';
    body.style.margin = '0';
    body.style.minHeight = '100vh';

    if (root) {
      root.style.backgroundColor = affairGoTheme.colors.background;
      root.style.overflowX = 'hidden';
      root.style.minHeight = '100vh';
    }

    return () => {
      html.style.backgroundColor = previous.htmlBackground;
      html.style.overflowX = previous.htmlOverflowX;
      body.style.backgroundColor = previous.bodyBackground;
      body.style.overflowX = previous.bodyOverflowX;
      body.style.margin = previous.bodyMargin;
      body.style.minHeight = previous.bodyMinHeight;

      if (root) {
        root.style.backgroundColor = previous.rootBackground;
        root.style.overflowX = previous.rootOverflowX;
        root.style.minHeight = previous.rootMinHeight;
      }
    };
  }, []);

  const content = scroll ? (
    <ScrollView
      ref={scrollViewRef}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.scrollContent, { paddingTop: contentTopPadding, paddingBottom: bottomNavigationSpace }, contentContainerStyle]}
      style={[styles.scrollView, style]}
    >
      <View style={styles.contentShell}>{children}</View>
    </ScrollView>
  ) : (
    <View style={[styles.fixedContent, style, { paddingTop: contentTopPadding, paddingBottom: bottomNavigationSpace }, contentContainerStyle]}>
      <View style={styles.contentShell}>{children}</View>
    </View>
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

export const ScreenHeader = ({ title, subtitle, leftAction, rightAction, brand }) => (
  <View style={styles.header}>
    <View style={styles.headerAction}>{leftAction}</View>
    <View style={styles.headerCopy}>
      {brand ? <View style={styles.headerBrand}>{brand}</View> : null}
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

export const StatusPill = ({ label, tone = 'default', style }) => {
  const toneStyles = {
    default: [styles.statusPill, styles.statusPillDefault],
    success: [styles.statusPill, styles.statusPillSuccess],
    warning: [styles.statusPill, styles.statusPillWarning],
    danger: [styles.statusPill, styles.statusPillDanger],
    info: [styles.statusPill, styles.statusPillInfo],
  };

  return (
    <View style={[...(toneStyles[tone] || toneStyles.default), style]}>
      <Text style={styles.statusPillLabel}>{label}</Text>
    </View>
  );
};

export const InfoBanner = ({ title, detail, tone = 'info', style }) => (
  <View style={[styles.infoBanner, tone === 'warning' && styles.infoBannerWarning, tone === 'success' && styles.infoBannerSuccess, style]}>
    <Text style={styles.infoBannerTitle}>{title}</Text>
    {detail ? <Text style={styles.infoBannerDetail}>{detail}</Text> : null}
  </View>
);

export const EmptyState = ({ title, detail, action }) => (
  <GlassCard style={styles.emptyState}>
    <Text style={styles.emptyStateTitle}>{title}</Text>
    <Text style={styles.emptyStateDetail}>{detail}</Text>
    {action ? <View style={styles.emptyStateAction}>{action}</View> : null}
  </GlassCard>
);

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    backgroundColor: affairGoTheme.colors.background,
    minHeight: Platform.OS === 'web' ? '100vh' : undefined,
    overflow: 'hidden',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: affairGoTheme.colors.overlay,
  },
  scrollView: {
    flex: 1,
    width: '100%',
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: '100%',
    paddingHorizontal: 18,
    backgroundColor: 'transparent',
  },
  fixedContent: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    paddingHorizontal: 18,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  contentShell: {
    width: '100%',
    maxWidth: affairGoTheme.layout.contentWidth,
    alignSelf: 'center',
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
    marginBottom: 18,
    width: '100%',
  },
  headerAction: {
    width: 44,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerCopy: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  headerBrand: {
    marginBottom: 8,
    maxWidth: '100%',
  },
  subtitle: {
    color: affairGoTheme.colors.accentSoft,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 3,
  },
  title: {
    color: affairGoTheme.colors.text,
    fontSize: 20,
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
    backgroundColor: affairGoTheme.colors.cardStrong,
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
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: affairGoTheme.radius.pill,
    borderWidth: 1,
    borderColor: affairGoTheme.colors.line,
    backgroundColor: affairGoTheme.colors.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: 'rgba(118, 87, 255, 0.18)',
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
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: affairGoTheme.radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  statusPillDefault: {
    backgroundColor: affairGoTheme.colors.cardMuted,
    borderColor: affairGoTheme.colors.line,
  },
  statusPillSuccess: {
    backgroundColor: 'rgba(137,214,178,0.14)',
    borderColor: 'rgba(137,214,178,0.55)',
  },
  statusPillWarning: {
    backgroundColor: 'rgba(255,189,108,0.14)',
    borderColor: 'rgba(255,189,108,0.55)',
  },
  statusPillDanger: {
    backgroundColor: 'rgba(255,140,140,0.14)',
    borderColor: 'rgba(255,140,140,0.55)',
  },
  statusPillInfo: {
    backgroundColor: 'rgba(131,200,255,0.14)',
    borderColor: 'rgba(131,200,255,0.55)',
  },
  statusPillLabel: {
    color: affairGoTheme.colors.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  infoBanner: {
    padding: 14,
    borderRadius: affairGoTheme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(131,200,255,0.45)',
    backgroundColor: 'rgba(131,200,255,0.08)',
  },
  infoBannerWarning: {
    borderColor: 'rgba(255,189,108,0.45)',
    backgroundColor: 'rgba(255,189,108,0.08)',
  },
  infoBannerSuccess: {
    borderColor: 'rgba(137,214,178,0.45)',
    backgroundColor: 'rgba(137,214,178,0.08)',
  },
  infoBannerTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoBannerDetail: {
    color: affairGoTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'flex-start',
  },
  emptyStateTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyStateDetail: {
    color: affairGoTheme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  emptyStateAction: {
    marginTop: 14,
  },
});
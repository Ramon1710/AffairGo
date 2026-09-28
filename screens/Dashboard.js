import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AccentButton, AppBackground, EmptyState, GlassCard, InlineStat, ScreenHeader, StatusPill } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { accessColors, affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { useNavigation } from '../naviagtion/SimpleNavigation';
import { getProfileCompletionState } from '../untils/profileStatus';
import { formatRadiusKm } from '../untils/radius';

const DashboardMetricCard = ({ title, value, detail, tone = 'default', actionLabel, onPress, state = 'ready', testID }) => {
  if (state === 'loading') {
    return (
      <GlassCard strong style={styles.metricCard}>
        <Text style={styles.metricEyebrow}>{title}</Text>
        <Text style={styles.metricValue}>...</Text>
        <Text style={styles.metricDetail}>Wird geladen...</Text>
      </GlassCard>
    );
  }

  if (state === 'error') {
    return (
      <GlassCard strong style={styles.metricCard}>
        <Text style={styles.metricEyebrow}>{title}</Text>
        <Text style={styles.metricValue}>-</Text>
        <Text style={styles.metricDetail}>{detail}</Text>
      </GlassCard>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      testID={testID}
      style={({ pressed }) => [styles.metricPressable, pressed && onPress ? styles.metricPressablePressed : null]}
    >
      <GlassCard strong style={styles.metricCard}>
        <View style={styles.metricHeader}>
          <Text style={styles.metricEyebrow}>{title}</Text>
          <StatusPill label={tone === 'success' ? 'Live' : 'Aktiv'} tone={tone} />
        </View>
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricDetail}>{detail}</Text>
        {actionLabel ? <Text style={styles.metricAction}>{actionLabel}</Text> : null}
      </GlassCard>
    </Pressable>
  );
};

const Dashboard = () => {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const {
    accessStatusLabel,
    currentRadius,
    currentUser,
    locationError,
    locationPermissionGranted,
    matchedProfiles,
    nearbyOnlineProfiles,
    requestLiveLocationAccess,
    updateCurrentUser,
  } = useAffairGo();
  const profileCompletion = useMemo(() => getProfileCompletionState(currentUser), [currentUser]);
  const visibilityEnabled = Boolean(currentUser.searchActive && locationPermissionGranted);
  const matchCount = matchedProfiles.length;
  const onlineMatchCount = nearbyOnlineProfiles.length;
  const isTablet = width >= 760;
  const isDesktop = width >= 1180;

  const handleProfileStatusPress = () => {
    navigation.navigate('Profil');
  };

  const handleMatchesPress = (filter = 'all') => {
    navigation.navigate('Explore', { segment: 'matches', filter });
  };

  const handleVisibilityPress = async () => {
    if (visibilityEnabled) {
      await updateCurrentUser({ searchActive: false });
      return;
    }

    const granted = await requestLiveLocationAccess();
    if (!granted) {
      return;
    }

    await updateCurrentUser({ searchActive: true });
  };

  return (
    <AppBackground>
      <ScreenHeader
        title="Aktuelles"
        subtitle={currentUser.nickname || 'Night Whisper'}
        rightAction={
          <Pressable
            style={[styles.profileButton, { borderColor: accessColors[currentUser.membership] || affairGoTheme.colors.accent }]}
            onPress={() => navigation.navigate('Profil')}
          >
            <Ionicons name="person-outline" size={22} color={accessColors[currentUser.membership] || affairGoTheme.colors.accent} />
          </Pressable>
        }
      />

      <View style={styles.summaryStrip}>
        <StatusPill label={`Radius ${formatRadiusKm(currentRadius)}`} tone="default" />
        <StatusPill label={accessStatusLabel} tone="info" />
      </View>

      <View style={styles.metricsGrid}>
        {!profileCompletion.isComplete ? (
          <View style={[styles.metricColumn, isTablet ? styles.metricColumnTablet : null, isDesktop ? styles.metricColumnDesktopThird : null]}>
            <Pressable onPress={handleProfileStatusPress} testID="profile-status-card" style={({ pressed }) => [styles.metricPressable, pressed ? styles.metricPressablePressed : null]}>
              <GlassCard strong style={styles.profileStatusCard}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricEyebrow}>Profilstatus</Text>
                  <StatusPill label={`${profileCompletion.percent}%`} tone="warning" />
                </View>
                <Text style={styles.profileStatusValue}>{profileCompletion.percent}% vollständig</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${profileCompletion.percent}%` }]} />
                </View>
                <Text style={styles.profileStatusDetail} numberOfLines={3}>
                  Es fehlen noch: {profileCompletion.missingFieldLabels.join(', ')}.
                </Text>
                <Text style={styles.metricAction}>Zum Profil und fehlende Angaben ergänzen</Text>
              </GlassCard>
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.metricColumn, isTablet ? styles.metricColumnTablet : null, isDesktop ? styles.metricColumnDesktopThird : null]}>
          <DashboardMetricCard
            title="Matches"
            value={String(matchCount)}
            detail={matchCount ? 'Aktuell gültige Matches in deinem Bestand.' : 'Noch keine aktuell gültigen Matches vorhanden.'}
            actionLabel="Kennenlernen öffnen"
            onPress={() => handleMatchesPress('all')}
            state="ready"
            testID="matches-card"
          />
        </View>

        <View style={[styles.metricColumn, isTablet ? styles.metricColumnTablet : null, isDesktop ? styles.metricColumnDesktopThird : null]}>
          <DashboardMetricCard
            title="Online-Matches"
            value={String(onlineMatchCount)}
            detail={onlineMatchCount ? 'Diese Matches sind im aktuellen Presence-Fenster online.' : 'Zurzeit ist keines deiner gültigen Matches online.'}
            actionLabel="Mit Online-Filter öffnen"
            onPress={() => handleMatchesPress('online')}
            state="ready"
            tone="success"
            testID="online-matches-card"
          />
        </View>
      </View>

      <GlassCard strong style={styles.visibilityCard}>
        <View style={styles.metricHeader}>
          <Text style={styles.metricEyebrow}>Sichtbarkeit</Text>
          <StatusPill label={visibilityEnabled ? 'Aktiv' : 'Inaktiv'} tone={visibilityEnabled ? 'success' : 'default'} />
        </View>
        <View style={styles.visibilityStatsRow}>
          <InlineStat label="Radius" value={formatRadiusKm(currentRadius)} />
          <InlineStat label="Matches" value={String(matchCount)} accent={affairGoTheme.colors.accent} />
          <InlineStat label="Online" value={String(onlineMatchCount)} accent={affairGoTheme.colors.accentSoft} />
        </View>
        <Text style={styles.visibilityTitle}>Matching und Matching Map nutzen denselben Radius und dieselbe Sichtbarkeit.</Text>
        <Text style={styles.visibilityDetail}>
          {visibilityEnabled
            ? 'Dein Profil ist aktuell für passende Personen sichtbar.'
            : 'Aktiviere deine Sichtbarkeit, damit Matches und Map wieder vollständig arbeiten.'}
          {locationError ? ` ${locationError}` : ''}
        </Text>
        <AccentButton
          label={visibilityEnabled ? 'Sichtbarkeit pausieren' : 'Sichtbarkeit aktivieren'}
          variant={visibilityEnabled ? 'secondary' : 'primary'}
          onPress={handleVisibilityPress}
          style={styles.visibilityButton}
        />
      </GlassCard>

      {!matchCount ? (
        <EmptyState
          title="Noch keine Matches aktiv"
          detail="Vervollständige dein Profil und halte deine Sichtbarkeit aktiv. Danach erscheinen passende Kontakte in Kennenlernen und auf der Matching Map."
          action={<AccentButton label="Matching Map öffnen" variant="secondary" onPress={() => navigation.navigate('MatchingMap')} />}
        />
      ) : null}
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  summaryStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  metricPressable: {
    flex: 1,
  },
  metricPressablePressed: {
    opacity: 0.92,
  },
  profileStatusCard: {
    minHeight: 210,
    justifyContent: 'space-between',
  },
  profileStatusValue: {
    color: affairGoTheme.colors.text,
    fontSize: 30,
    fontWeight: '700',
    marginTop: 10,
  },
  profileStatusDetail: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 22,
    marginTop: 12,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: affairGoTheme.colors.backgroundSoft,
    overflow: 'hidden',
    marginTop: 14,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: affairGoTheme.colors.accentSoft,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 4,
  },
  metricColumn: {
    width: '100%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  metricColumnTablet: {
    width: '50%',
  },
  metricColumnDesktopThird: {
    width: '33.3333%',
  },
  metricCard: {
    minHeight: 210,
    justifyContent: 'space-between',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricEyebrow: {
    color: affairGoTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricValue: {
    color: affairGoTheme.colors.text,
    fontSize: 34,
    fontWeight: '800',
    marginTop: 12,
  },
  metricDetail: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 22,
    marginTop: 8,
  },
  metricAction: {
    color: affairGoTheme.colors.accent,
    fontWeight: '700',
    marginTop: 16,
  },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: affairGoTheme.colors.cardStrong,
  },
  visibilityCard: {
    marginBottom: 16,
  },
  visibilityStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
  },
  visibilityTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
    marginTop: 16,
  },
  visibilityDetail: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 22,
    marginTop: 8,
  },
  visibilityButton: {
    marginTop: 16,
  },
});

export default Dashboard;

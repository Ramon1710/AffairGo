import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, EmptyState, GlassCard, InfoBanner, InlineStat, ScreenHeader, SectionTitle, StatusPill } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { accessColors, affairGoTheme, travelModeColors } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { DASHBOARD_SIGNAL_CARDS, EMPTY_STATE_COPY } from '../data/mockData';
import { useNavigation } from '../naviagtion/SimpleNavigation';

const quickActions = [
  { key: 'Profil', label: 'Profil', icon: 'person-outline' },
  { key: 'MatchingMap', label: 'Matching Map', icon: 'map-outline', requiresVisibility: true },
  { key: 'Swipe', label: 'Swipe', icon: 'swap-horizontal-outline', requiresVisibility: true },
  { key: 'Chat', label: 'Chats', icon: 'chatbubbles-outline' },
];

const Dashboard = () => {
  const navigation = useNavigation();
  const {
    currentUser,
    visibleProfiles,
    events,
    nearbyOnlineProfiles,
    getProfileTravelSummary,
    accessStatusLabel,
    locationPermissionGranted,
    locationError,
    logout,
    requestLiveLocationAccess,
    updateCurrentUser,
  } = useAffairGo();
  const visibilityEnabled = Boolean(currentUser.searchActive && locationPermissionGranted);

  const handleVisibilityToggle = async () => {
    if (visibilityEnabled) {
      await updateCurrentUser({ searchActive: false });
      return;
    }

    const granted = await requestLiveLocationAccess();

    if (!granted) {
      await updateCurrentUser({ searchActive: false });
      return;
    }

    await updateCurrentUser({ searchActive: true });
  };

  const openQuickAction = (action) => {
    if (action.requiresVisibility && !visibilityEnabled) {
      return;
    }

    navigation.navigate(action.key);
  };
  const toTripList = (trips, mode) => {
    if (!Array.isArray(trips)) {
      return [];
    }

    return trips
      .filter((trip) => trip && typeof trip === 'object')
      .filter((trip) => trip.startDate || trip.endDate || trip.city || trip.street)
      .map((trip) => ({ ...trip, mode, id: trip.id || `${mode}-${trip.startDate || 'draft'}-${trip.city || 'unknown'}` }));
  };
  const plannedTrips = [
    ...toTripList(currentUser.travelPlans?.business, 'business'),
    ...toTripList(currentUser.travelPlans?.vacation, 'vacation'),
  ];

  return (
    <AppBackground>
      <ScreenHeader
        title="Dashboard"
        subtitle={currentUser.nickname}
        rightAction={
          <Pressable
            style={[styles.profileButton, { borderColor: accessColors[currentUser.membership] || affairGoTheme.colors.accent }]}
            onPress={async () => {
              await logout();
              navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
            }}
          >
            <Ionicons name="log-out-outline" size={24} color={accessColors[currentUser.membership] || affairGoTheme.colors.accent} />
          </Pressable>
        }
      />

      <View style={styles.travelRow}>
        <GlassCard style={styles.travelMenu}>
          <Pressable style={styles.menuItem} onPress={() => navigation.navigate('TravelPlanner', { mode: 'business' })}>
            <Text style={styles.menuItemText}>Dienstreise</Text>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => navigation.navigate('TravelPlanner', { mode: 'vacation' })}>
            <Text style={styles.menuItemText}>Urlaub</Text>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => navigation.navigate('Event')}>
            <Text style={styles.menuItemText}>Veranstaltungen in der Nähe</Text>
          </Pressable>
        </GlassCard>

        <View style={styles.statCluster}>
          <InlineStat label="Radius" value={`${currentUser.radius} km`} />
          <InlineStat label="Online jetzt" value={String(nearbyOnlineProfiles.length)} accent={affairGoTheme.colors.success} />
          <InlineStat label="Zugang" value="Kostenfrei" accent={accessColors[currentUser.membership] || affairGoTheme.colors.accent} />
        </View>
        <Text style={styles.membershipText}>{accessStatusLabel}</Text>
      </View>

      <GlassCard strong style={styles.visibilityCard}>
        <View style={styles.visibilityHeader}>
          <View style={styles.visibilityCopy}>
            <Text style={styles.visibilityTitle}>Sichtbarkeit</Text>
            <Text style={styles.visibilityStatus}>{visibilityEnabled ? 'Aktiv' : 'Inaktiv'}</Text>
          </View>
          <AccentButton
            label={visibilityEnabled ? 'Deaktivieren' : 'Aktivieren'}
            variant={visibilityEnabled ? 'secondary' : 'primary'}
            onPress={handleVisibilityToggle}
            style={styles.visibilityButton}
          />
        </View>
        {!visibilityEnabled ? (
          <Text style={styles.visibilityHint}>
            Sichtbarkeit/Standort aktivieren um Swipe und Matchingmap zu nutzen.
            {locationError ? ` ${locationError}` : ''}
          </Text>
        ) : null}
      </GlassCard>

      <View style={styles.signalGrid}>
        {DASHBOARD_SIGNAL_CARDS.map((card) => (
          <GlassCard key={card.id} style={styles.signalCard}>
            <StatusPill label={card.title} tone="info" style={styles.signalPill} />
            <Text style={styles.signalDetail}>{card.detail}</Text>
          </GlassCard>
        ))}
      </View>

      <View style={styles.grid}>
        {quickActions.map((action) => (
          <Pressable
            key={action.key}
            style={styles.tile}
            onPress={() => openQuickAction(action)}
            disabled={action.requiresVisibility && !visibilityEnabled}
          >
            <GlassCard strong style={[styles.tileCard, action.requiresVisibility && !visibilityEnabled ? styles.tileCardDisabled : null]}>
              <Ionicons
                name={action.icon}
                size={56}
                color={action.requiresVisibility && !visibilityEnabled ? affairGoTheme.colors.textMuted : affairGoTheme.colors.accent}
              />
              <Text style={[styles.tileLabel, action.requiresVisibility && !visibilityEnabled ? styles.tileLabelDisabled : null]}>{action.label}</Text>
            </GlassCard>
          </Pressable>
        ))}
      </View>

      <SectionTitle title="Veranstaltungen" aside="Werbung" />
      {events.length ? events.slice(0, 2).map((event) => (
        <GlassCard key={event.id} style={styles.eventCard}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <Text style={styles.eventText}>{event.date}, {event.time}</Text>
          <Text style={styles.eventText}>{event.address}</Text>
          <Text style={styles.eventText}>{event.distanceKm} km entfernt, {event.participants.total} Anmeldungen</Text>
          <AccentButton label="Event öffnen" variant="secondary" onPress={() => navigation.navigate('Event')} style={styles.eventButton} />
        </GlassCard>
      )) : (
        <EmptyState
          title={EMPTY_STATE_COPY.events.title}
          detail={EMPTY_STATE_COPY.events.detail}
          action={<AccentButton label="Event anlegen" variant="secondary" onPress={() => navigation.navigate('Event')} />}
        />
      )}

      <SectionTitle title="Geplante Reisen" aside="Dashboard" />
      {plannedTrips.length ? plannedTrips.map((trip) => (
        <GlassCard key={trip.id} style={styles.eventCard}>
          <Text style={styles.eventTitle}>{trip.mode === 'business' ? 'Dienstreise' : 'Urlaub'}</Text>
          <Text style={styles.eventText}>{trip.city || 'Ohne Ort'}{trip.postalCode ? `, ${trip.postalCode}` : ''}</Text>
          <Text style={styles.eventText}>{trip.startDate} bis {trip.endDate}</Text>
          <Text style={styles.eventText}>{trip.fromTime} bis {trip.toTime}</Text>
          {trip.street ? <Text style={styles.eventText}>{trip.street}</Text> : null}
        </GlassCard>
      )) : (
        <EmptyState
          title="Noch keine Reisen geplant"
          detail="Lege dein nächstes Dienstreise- oder Urlaubsfenster an, damit Matching und Events passend gefiltert werden."
          action={<AccentButton label="Reise planen" variant="secondary" onPress={() => navigation.navigate('TravelPlanner', { mode: 'business' })} />}
        />
      )}

      <SectionTitle title="Jetzt sichtbar" aside="Radar" />
      {visibleProfiles.length ? <View style={styles.radarList}>
        {visibleProfiles.slice(0, 3).map((profile) => {
          const travelSummary = getProfileTravelSummary(profile);
          return (
            <GlassCard key={profile.id} style={styles.radarCard}>
              <View style={styles.radarRow}>
                <View style={styles.radarInfo}>
                  <Text style={styles.radarName}>{profile.nickname}</Text>
                  <Text style={styles.radarMeta}>{profile.age} Jahre, {profile.figure}, {profile.distanceKm} km</Text>
                  {travelSummary ? (
                    <Text style={styles.radarMeta}>
                      {travelSummary.label}
                      {travelSummary.location ? ` in ${travelSummary.location}` : ''}
                      {travelSummary.period ? ` • ${travelSummary.period}` : ''}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.radarTag, { color: travelModeColors[travelSummary?.mode || profile.travelMode] || affairGoTheme.colors.blue }]}> 
                  {travelSummary?.label || 'Aktiv'}
                </Text>
              </View>
            </GlassCard>
          );
        })}
      </View> : (
        <EmptyState
          title={EMPTY_STATE_COPY.matches.title}
          detail={EMPTY_STATE_COPY.matches.detail}
          action={<AccentButton label="Matching Map öffnen" variant="secondary" onPress={() => navigation.navigate('MatchingMap')} disabled={!visibilityEnabled} />}
        />
      )}

      <InfoBanner title="Profilstatus" detail={accessStatusLabel} tone="success" style={styles.dashboardBanner} />
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  profileButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  travelRow: {
    marginBottom: 18,
  },
  travelMenu: {
    marginBottom: 16,
  },
  menuItem: {
    paddingVertical: 8,
  },
  menuItemText: {
    color: affairGoTheme.colors.text,
    fontSize: 20,
    lineHeight: 30,
  },
  statCluster: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  membershipText: {
    color: affairGoTheme.colors.textMuted,
    marginTop: 12,
    lineHeight: 22,
  },
  membershipHint: {
    color: affairGoTheme.colors.success,
    marginTop: 6,
    fontWeight: '700',
  },
  signalGrid: {
    marginBottom: 16,
  },
  visibilityCard: {
    marginBottom: 16,
  },
  visibilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  visibilityCopy: {
    flex: 1,
    paddingRight: 12,
  },
  visibilityTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  visibilityStatus: {
    color: affairGoTheme.colors.textMuted,
    marginTop: 4,
    fontSize: 15,
  },
  visibilityButton: {
    marginTop: 0,
  },
  visibilityHint: {
    color: affairGoTheme.colors.warning,
    marginTop: 14,
    lineHeight: 22,
  },
  signalCard: {
    marginBottom: 10,
  },
  signalPill: {
    marginBottom: 10,
  },
  signalDetail: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 22,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tile: {
    width: '48%',
    marginBottom: 16,
  },
  tileCard: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileCardDisabled: {
    opacity: 0.45,
  },
  tileLabel: {
    color: affairGoTheme.colors.text,
    fontSize: 24,
    fontWeight: '600',
    marginTop: 18,
  },
  tileLabelDisabled: {
    color: affairGoTheme.colors.textMuted,
  },
  eventCard: {
    marginBottom: 14,
  },
  eventTitle: {
    color: affairGoTheme.colors.accent,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  eventText: {
    color: affairGoTheme.colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  eventButton: {
    marginTop: 14,
  },
  radarList: {
    marginBottom: 12,
  },
  radarCard: {
    marginBottom: 12,
  },
  radarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  radarInfo: {
    flex: 1,
    paddingRight: 12,
  },
  radarName: {
    color: affairGoTheme.colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  radarMeta: {
    color: affairGoTheme.colors.textMuted,
    marginTop: 4,
  },
  radarTag: {
    fontWeight: '700',
  },
  dashboardBanner: {
    marginTop: 10,
    marginBottom: 10,
  },
});

export default Dashboard;
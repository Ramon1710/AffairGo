import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, EmptyState, GlassCard, InfoBanner, InlineStat, ScreenHeader, SectionTitle, StatusPill } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme, membershipColors, travelModeColors } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { DASHBOARD_SIGNAL_CARDS, EMPTY_STATE_COPY } from '../data/mockData';
import { useNavigation } from '../naviagtion/SimpleNavigation';

const quickActions = [
  { key: 'MatchingMap', label: 'Matching Map', icon: 'map-outline' },
  { key: 'Swipe', label: 'Swipe', icon: 'swap-horizontal-outline' },
  { key: 'Chat', label: 'Chats', icon: 'chatbubbles-outline' },
];

const Dashboard = () => {
  const navigation = useNavigation();
  const { currentUser, visibleProfiles, events, nearbyOnlineProfiles, getProfileTravelSummary, membershipStatusLabel } = useAffairGo();
  const toTripList = (trip, mode) => {
    if (!trip || typeof trip !== 'object' || Array.isArray(trip)) {
      return [];
    }
    if (!trip.startDate && !trip.endDate && !trip.city && !trip.street) {
      return [];
    }
    return [{ ...trip, mode, id: `${mode}-${trip.startDate || 'draft'}-${trip.city || 'unknown'}` }];
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
        leftAction={
          <View>
            <Pressable style={styles.menuIcon} onPress={() => navigation.navigate('TravelPlanner', { mode: 'business' })}>
              <Ionicons name="menu" size={34} color={affairGoTheme.colors.accent} />
            </Pressable>
          </View>
        }
        rightAction={
          <Pressable style={[styles.profileButton, { borderColor: membershipColors[currentUser.membership] }]} onPress={() => navigation.navigate('Profil')}>
            <Ionicons name="person" size={24} color={membershipColors[currentUser.membership]} />
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
          <InlineStat label="Premium" value={currentUser.membership.toUpperCase()} accent={membershipColors[currentUser.membership]} />
        </View>
        <Text style={styles.membershipText}>{membershipStatusLabel}</Text>
        {currentUser.membership === 'gold' && currentUser.invisibleMode ? <Text style={styles.membershipHint}>Unsichtbar-Modus ist aktiv.</Text> : null}
      </View>

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
          <Pressable key={action.key} style={styles.tile} onPress={() => navigation.navigate(action.key)}>
            <GlassCard strong style={styles.tileCard}>
              <Ionicons name={action.icon} size={56} color={affairGoTheme.colors.accent} />
              <Text style={styles.tileLabel}>{action.label}</Text>
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
          action={<AccentButton label="Matching Map öffnen" variant="secondary" onPress={() => navigation.navigate('MatchingMap')} />}
        />
      )}

      <InfoBanner title="Profilstatus" detail={membershipStatusLabel} tone={currentUser.membership === 'gold' ? 'warning' : 'info'} style={styles.dashboardBanner} />
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  menuIcon: {
    width: 40,
    alignItems: 'center',
  },
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
  tileLabel: {
    color: affairGoTheme.colors.text,
    fontSize: 24,
    fontWeight: '600',
    marginTop: 18,
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
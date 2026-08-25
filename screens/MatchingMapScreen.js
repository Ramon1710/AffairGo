import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, GlassCard, ScreenHeader, ToggleChip } from '../components/AffairGoUI';
import MatchingMapLeaflet from '../components/MatchingMapLeaflet';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme, travelModeColors } from '../constants/affairGoTheme';
import { getMapProviderLabel, hasConfiguredMapApiKey } from '../constants/mapProvider';
import { useAffairGo } from '../context/AffairGoContext';
import { RADIUS_OPTIONS } from '../data/mockData';
import { useNavigation } from '../naviagtion/SimpleNavigation';
import { buildRadarProfiles, filterMatchingMapProfiles } from '../untils/matchingMap';

const getProfileMapStatus = (profile, travelSummary) => {
  if (profile?.mapStatus) {
    return profile.mapStatus;
  }
  if (travelSummary?.mode === 'business') {
    return 'business';
  }
  if (travelSummary?.mode === 'vacation') {
    return 'vacation';
  }
  return 'active';
};

const getStatusLabel = (status) => {
  if (status === 'business') {
    return 'Dienstreise';
  }
  if (status === 'vacation') {
    return 'Urlaub';
  }
  if (status === 'event') {
    return 'Event';
  }
  return 'Aktiv';
};

const MatchingMapScreen = () => {
  const navigation = useNavigation();
  const [viewMode, setViewMode] = useState('map');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const {
    currentRadius,
    currentUser,
    getMatchEligibility,
    getProfileTravelSummary,
    lastLocationSyncLabel,
    locationError,
    locationPermissionGranted,
    mapCenterCoordinates,
    requestLiveLocationAccess,
    selectedProfile,
    setCurrentRadius,
    setSelectedProfileId,
    visibleMapEvents,
    visibleProfiles,
  } = useAffairGo();
  const hasMapApiKey = hasConfiguredMapApiKey();
  const filteredProfiles = useMemo(
    () => filterMatchingMapProfiles(visibleProfiles, { verifiedOnly }),
    [verifiedOnly, visibleProfiles],
  );
  const filteredSelectedProfile = filteredProfiles.find((profile) => profile.id === selectedProfile?.id) || filteredProfiles[0] || null;
  const selectedProfileTravel = filteredSelectedProfile ? getProfileTravelSummary(filteredSelectedProfile) : null;
  const selectedProfileMatch = filteredSelectedProfile ? getMatchEligibility(currentUser, filteredSelectedProfile) : null;

  const mapProfiles = useMemo(() => filteredProfiles.map((profile) => {
    const travelSummary = getProfileTravelSummary(profile);
    const status = getProfileMapStatus(profile, travelSummary);
    const matchEligibility = getMatchEligibility(currentUser, profile);

    return {
      ...profile,
      status,
      statusLabel: getStatusLabel(status),
      matchEligibility,
      commonPreferenceCount: matchEligibility.commonPreferenceCount,
      profileImageUri: profile.profilePhotoUrl || profile.profileImageUri || '',
    };
  }), [currentUser, filteredProfiles, getMatchEligibility, getProfileTravelSummary]);

  const mapEvents = useMemo(() => visibleMapEvents.map((event) => ({
    ...event,
    status: 'event',
    statusLabel: 'Event',
  })), [visibleMapEvents]);

  const openProfile = (profile) => {
    if (filteredSelectedProfile?.id === profile.id) {
      navigation.navigate('Profil', { profileId: profile.id });
      return;
    }

    setSelectedProfileId(profile.id);
  };

  return (
    <AppBackground>
      <ScreenHeader
        title="Matching Map"
        subtitle="OpenStreetMap mit Live-Standorten und Events"
        leftAction={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color={affairGoTheme.colors.text} />
          </Pressable>
        }
        rightAction={
          <Pressable onPress={() => navigation.navigate('Profil')}>
            <Ionicons name="options-outline" size={28} color={affairGoTheme.colors.text} />
          </Pressable>
        }
      />

      <Text style={styles.liveStatus}>{lastLocationSyncLabel}</Text>

      {!locationPermissionGranted ? (
        <GlassCard style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>Standortfreigabe benötigt</Text>
          <Text style={styles.selectedMeta}>{locationError || 'Aktiviere die Standortfreigabe, damit dein echter Browser- oder Gerätestandort gespeichert und für die Karte genutzt werden kann.'}</Text>
          <AccentButton label="Standort aktivieren" onPress={requestLiveLocationAccess} style={styles.permissionButton} />
        </GlassCard>
      ) : null}

      {!hasMapApiKey ? (
        <GlassCard style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>Karte derzeit nicht verfügbar</Text>
          <Text style={styles.selectedMeta}>{getMapProviderLabel()} ist momentan nicht erreichbar. Bitte versuche es in Kürze erneut.</Text>
        </GlassCard>
      ) : null}

      <View style={styles.filters}>
        {RADIUS_OPTIONS.filter((radius) => [5, 10, 20, 50, 100, 150].includes(radius)).map((radius) => (
          <View key={radius} style={styles.filterChip}>
            <ToggleChip label={`${radius} km`} active={currentRadius === radius} onPress={() => setCurrentRadius(radius)} />
          </View>
        ))}
      </View>

      <View style={styles.filters}>
        <View style={styles.filterChip}>
          <ToggleChip label="Nur verifiziert" active={verifiedOnly} onPress={() => setVerifiedOnly((previous) => !previous)} />
        </View>
      </View>

      <View style={styles.filters}>
        <View style={styles.filterChip}><ToggleChip label="Map" active={viewMode === 'map'} onPress={() => setViewMode('map')} /></View>
        <View style={styles.filterChip}><ToggleChip label="Liste" active={viewMode === 'list'} onPress={() => setViewMode('list')} /></View>
        <View style={styles.filterChip}><ToggleChip label="Radar" active={viewMode === 'radar'} onPress={() => setViewMode('radar')} /></View>
      </View>

      {viewMode === 'map' ? (
        <GlassCard strong style={styles.mapCard}>
          <MatchingMapLeaflet
            center={mapCenterCoordinates}
            radiusKm={currentRadius}
            profiles={mapProfiles}
            events={mapEvents}
            onProfilePress={openProfile}
          />
          <View style={styles.mapLegendRow}>
            <Text style={styles.mapLegendText}>{mapProfiles.length} sichtbare Profile</Text>
            <Text style={styles.mapLegendText}>{mapEvents.length} Events im Radius</Text>
          </View>
        </GlassCard>
      ) : null}

      {viewMode === 'list' ? (
        <GlassCard strong style={styles.mapCard}>
          {mapProfiles.map((profile) => {
            const travelSummary = getProfileTravelSummary(profile);
            return (
              <Pressable key={profile.id} onPress={() => openProfile(profile)} style={styles.listRow}>
                <View style={styles.listCopy}>
                  <Text style={styles.listName}>{profile.nickname}</Text>
                  <Text style={styles.listMeta}>{profile.age} Jahre, {profile.distanceKm} km, {profile.figure}</Text>
                  <Text style={styles.listMeta}>{profile.commonPreferenceCount} gemeinsame Vorlieben</Text>
                  {travelSummary ? (
                    <Text style={styles.listMeta}>
                      {travelSummary.label}
                      {travelSummary.location ? ` in ${travelSummary.location}` : ''}
                      {travelSummary.period ? ` • ${travelSummary.period}` : ''}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.listTag, { color: travelModeColors[profile.status] || affairGoTheme.colors.blue }]}>
                  {profile.statusLabel}
                </Text>
              </Pressable>
            );
          })}
        </GlassCard>
      ) : null}

      {viewMode === 'radar' ? (
        <GlassCard strong style={styles.mapCard}>
          <Text style={styles.radarTitle}>Jetzt online in deinem Radius</Text>
          {buildRadarProfiles(mapProfiles).map((profile) => {
            const travelSummary = getProfileTravelSummary(profile);
            return (
              <Pressable key={profile.id} onPress={() => openProfile(profile)} style={styles.radarRow}>
                <Ionicons name="radio-outline" size={20} color={affairGoTheme.colors.success} />
                <View style={styles.radarTextWrap}>
                  <Text style={styles.radarText}>{profile.nickname} ist online, {profile.distanceKm} km entfernt</Text>
                  <Text style={styles.radarSubtext}>Status: {profile.statusLabel}</Text>
                  {travelSummary ? (
                    <Text style={styles.radarSubtext}>
                      {travelSummary.label}
                      {travelSummary.location ? ` in ${travelSummary.location}` : ''}
                      {travelSummary.period ? ` • ${travelSummary.period}` : ''}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </GlassCard>
      ) : null}

      {filteredSelectedProfile ? (
        <GlassCard style={styles.selectedCard}>
          <Text style={styles.selectedName}>{filteredSelectedProfile.nickname}</Text>
          <Text style={styles.selectedMeta}>{filteredSelectedProfile.age} Jahre, {filteredSelectedProfile.distanceKm} km, {filteredSelectedProfile.figure}</Text>
          <Text style={styles.selectedMeta}>Gemeinsame Vorlieben: {selectedProfileMatch?.commonPreferenceCount || 0}</Text>
          <Text style={styles.selectedMeta}>{selectedProfileMatch?.ageCompatible ? 'Altersrange passt gegenseitig' : 'Altersrange passt nicht'}</Text>
          <Text style={styles.selectedMeta}>Status: {getStatusLabel(getProfileMapStatus(filteredSelectedProfile, selectedProfileTravel))}</Text>
          {selectedProfileMatch?.commonPreferences?.length ? <Text style={styles.selectedMeta}>Match-Hinweise: {selectedProfileMatch.commonPreferences.slice(0, 3).join(', ')}</Text> : null}
          {selectedProfileTravel ? (
            <Text style={styles.selectedMeta}>
              {selectedProfileTravel.label}
              {selectedProfileTravel.location ? ` in ${selectedProfileTravel.location}` : ''}
              {selectedProfileTravel.period ? ` • ${selectedProfileTravel.period}` : ''}
            </Text>
          ) : null}
          <Text style={styles.selectedMeta}>{filteredSelectedProfile.verified ? 'Profil verifiziert' : 'Profil nicht verifiziert'}</Text>
          <AccentButton label="Profil öffnen" onPress={() => navigation.navigate('Profil', { profileId: filteredSelectedProfile.id })} style={styles.selectedButton} />
        </GlassCard>
      ) : null}
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  liveStatus: {
    color: affairGoTheme.colors.textMuted,
    marginBottom: 10,
    lineHeight: 22,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  filterChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  mapCard: {
    marginBottom: 16,
  },
  permissionCard: {
    marginBottom: 12,
  },
  permissionTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  permissionButton: {
    marginTop: 12,
  },
  mapLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  mapLegendText: {
    color: affairGoTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  selectedCard: {
    marginBottom: 12,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: affairGoTheme.colors.line,
    paddingVertical: 14,
  },
  listCopy: {
    flex: 1,
    paddingRight: 12,
  },
  listName: {
    color: affairGoTheme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  listMeta: {
    color: affairGoTheme.colors.textMuted,
    marginTop: 4,
  },
  listTag: {
    fontWeight: '700',
  },
  radarTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 14,
  },
  radarRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: affairGoTheme.colors.line,
  },
  radarTextWrap: {
    marginLeft: 10,
    flex: 1,
  },
  radarText: {
    color: affairGoTheme.colors.text,
    fontWeight: '700',
  },
  radarSubtext: {
    color: affairGoTheme.colors.textMuted,
    marginTop: 4,
  },
  selectedName: {
    color: affairGoTheme.colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  selectedMeta: {
    color: affairGoTheme.colors.textMuted,
    marginBottom: 6,
    lineHeight: 20,
  },
  selectedButton: {
    marginTop: 12,
  },
});

export default MatchingMapScreen;

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, GlassCard, ScreenHeader, ToggleChip } from '../components/AffairGoUI';
import MatchingMapLeaflet from '../components/MatchingMapLeaflet';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme, travelModeColors } from '../constants/affairGoTheme';
import { getMapProviderLabel, hasConfiguredMapApiKey } from '../constants/mapProvider';
import { useAffairGo } from '../context/AffairGoContext';
import { PHOTO_AGE_FILTERS, RADIUS_OPTIONS } from '../data/mockData';
import { useNavigation } from '../naviagtion/SimpleNavigation';

const getMatchingPreferenceSummary = (currentUser, profile) => {
  const currentPreferences = Array.isArray(currentUser?.preferences) ? currentUser.preferences : [];
  const profilePreferences = Array.isArray(profile?.preferences) ? profile.preferences : [];
  const matchingPreferences = currentPreferences.filter((item) => profilePreferences.includes(item));

  return {
    count: matchingPreferences.length,
    preview: matchingPreferences.slice(0, 3),
  };
};

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
    getCompatibility,
    getProfileTravelSummary,
    lastLocationSyncLabel,
    locationError,
    locationPermissionGranted,
    mapCenterCoordinates,
    photoAgeFilter,
    requestLiveLocationAccess,
    selectedProfile,
    setCurrentRadius,
    setPhotoAgeFilter,
    setSelectedProfileId,
    visibleMapEvents,
    visibleProfiles,
  } = useAffairGo();
  const hasMapApiKey = hasConfiguredMapApiKey();
  const filteredProfiles = verifiedOnly ? visibleProfiles.filter((profile) => profile.verified) : visibleProfiles;
  const filteredSelectedProfile = filteredProfiles.find((profile) => profile.id === selectedProfile?.id) || filteredProfiles[0] || null;
  const selectedProfileTravel = filteredSelectedProfile ? getProfileTravelSummary(filteredSelectedProfile) : null;
  const matchingPreferenceSummary = filteredSelectedProfile ? getMatchingPreferenceSummary(currentUser, filteredSelectedProfile) : { count: 0, preview: [] };

  const mapProfiles = useMemo(() => filteredProfiles.map((profile) => {
    const travelSummary = getProfileTravelSummary(profile);
    const status = getProfileMapStatus(profile, travelSummary);

    return {
      ...profile,
      status,
      statusLabel: getStatusLabel(status),
      compatibility: getCompatibility(currentUser, profile),
      profileImageUri: profile.profilePhotoUrl || profile.profileImageUri || '',
    };
  }), [currentUser, filteredProfiles, getCompatibility, getProfileTravelSummary]);

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
        {PHOTO_AGE_FILTERS.map((months) => (
          <View key={months} style={styles.filterChip}>
            <ToggleChip
              label={`Foto > ${months}M`}
              active={photoAgeFilter === months}
              onPress={() => setPhotoAgeFilter(photoAgeFilter === months ? null : months)}
            />
          </View>
        ))}
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
                  <Text style={styles.listMeta}>Matching {profile.compatibility}%</Text>
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
          {mapProfiles.filter((profile) => profile.online).map((profile) => {
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
          <Text style={styles.selectedMeta}>Kompatibilität: {getCompatibility(currentUser, filteredSelectedProfile)}%</Text>
          <Text style={styles.selectedMeta}>Gemeinsame Vorlieben: {matchingPreferenceSummary.count}</Text>
          <Text style={styles.selectedMeta}>Status: {getStatusLabel(getProfileMapStatus(filteredSelectedProfile, selectedProfileTravel))}</Text>
          {matchingPreferenceSummary.preview.length ? <Text style={styles.selectedMeta}>Match-Hinweise: {matchingPreferenceSummary.preview.join(', ')}</Text> : null}
          {selectedProfileTravel ? (
            <Text style={styles.selectedMeta}>
              {selectedProfileTravel.label}
              {selectedProfileTravel.location ? ` in ${selectedProfileTravel.location}` : ''}
              {selectedProfileTravel.period ? ` • ${selectedProfileTravel.period}` : ''}
            </Text>
          ) : null}
          <Text style={styles.selectedMeta}>Profilfoto: {filteredSelectedProfile.profilePhotoAgeMonths} Monate alt</Text>
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

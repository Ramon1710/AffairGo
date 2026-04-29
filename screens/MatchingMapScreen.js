import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, GlassCard, ScreenHeader, ToggleChip } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme, travelModeColors } from '../constants/affairGoTheme';
import { buildStaticMapUrl, getMapProviderLabel, getMapSetupInstructions, hasConfiguredMapApiKey } from '../constants/mapProvider';
import { useAffairGo } from '../context/AffairGoContext';
import { PHOTO_AGE_FILTERS, RADIUS_OPTIONS } from '../data/mockData';
import { useNavigation } from '../naviagtion/SimpleNavigation';

const MatchingMapScreen = () => {
  const navigation = useNavigation();
  const [viewMode, setViewMode] = useState('map');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const {
    visibleProfiles,
    currentRadius,
    photoAgeFilter,
    setCurrentRadius,
    setPhotoAgeFilter,
    selectedProfile,
    setSelectedProfileId,
    getCompatibility,
    currentUser,
    getProfileTravelSummary,
    lastLocationSyncLabel,
    mapCenterCoordinates,
    locationPermissionGranted,
    locationError,
    requestLiveLocationAccess,
  } = useAffairGo();
  const filteredProfiles = verifiedOnly ? visibleProfiles.filter((profile) => profile.verified) : visibleProfiles;
  const filteredSelectedProfile = filteredProfiles.find((profile) => profile.id === selectedProfile?.id) || filteredProfiles[0] || null;
  const selectedProfileTravel = filteredSelectedProfile ? getProfileTravelSummary(filteredSelectedProfile) : null;
  const hasMapApiKey = hasConfiguredMapApiKey();

  const getMapZoom = (radius) => {
    if (radius <= 5) {
      return 13;
    }
    if (radius <= 10) {
      return 12;
    }
    if (radius <= 25) {
      return 11;
    }
    if (radius <= 50) {
      return 10;
    }
    if (radius <= 100) {
      return 9;
    }
    return 8;
  };

  const getMapBounds = (center, radius) => {
    const latitudeDelta = Math.max(0.05, radius / 111);
    const longitudeDelta = Math.max(0.08, radius / (111 * Math.max(0.2, Math.cos((center.latitude * Math.PI) / 180))));

    return {
      minLatitude: center.latitude - latitudeDelta,
      maxLatitude: center.latitude + latitudeDelta,
      minLongitude: center.longitude - longitudeDelta,
      maxLongitude: center.longitude + longitudeDelta,
    };
  };

  const getMarkerPosition = (profile, bounds) => {
    if (!Number.isFinite(Number(profile.latitude)) || !Number.isFinite(Number(profile.longitude))) {
      return null;
    }

    const left = ((profile.longitude - bounds.minLongitude) / (bounds.maxLongitude - bounds.minLongitude)) * 100;
    const top = ((bounds.maxLatitude - profile.latitude) / (bounds.maxLatitude - bounds.minLatitude)) * 100;

    return {
      left: `${Math.min(94, Math.max(4, left))}%`,
      top: `${Math.min(90, Math.max(6, top))}%`,
    };
  };

  const mapZoom = getMapZoom(currentRadius);
  const mapBounds = getMapBounds(mapCenterCoordinates, currentRadius);
  const providerMapUrl = buildStaticMapUrl({
    latitude: mapCenterCoordinates.latitude,
    longitude: mapCenterCoordinates.longitude,
    zoom: mapZoom,
  });

  const openProfile = (profile) => {
    if (filteredSelectedProfile?.id === profile.id) {
      navigation.navigate('Profil', { profileId: profile.id });
      return;
    }
    setSelectedProfileId(profile.id);
  };

  if (currentUser.membership === 'basic') {
    return (
      <AppBackground>
        <ScreenHeader
          title="Matching Map"
          subtitle="Premium oder Gold erforderlich"
          leftAction={
            <Pressable onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={28} color={affairGoTheme.colors.text} />
            </Pressable>
          }
        />
        <GlassCard strong style={styles.mapCard}>
          <Text style={styles.radarTitle}>Matching Map ist ab Premium verfügbar</Text>
          <Text style={styles.selectedMeta}>Mit Premium oder Gold bekommst du Kartenansicht, Fotoalter-Filter und den Verifiziert-Filter.</Text>
        </GlassCard>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <ScreenHeader
        title="Matching Map"
        subtitle="Live-Standorte im Suchmodus"
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
          <Text style={styles.selectedMeta}>{locationError || 'Erlaube den Gerätestandort, damit die Matching Map mit echten GPS-Daten statt Demo-Koordinaten arbeitet.'}</Text>
          <AccentButton label="Standort aktivieren" onPress={requestLiveLocationAccess} style={styles.permissionButton} />
        </GlassCard>
      ) : null}
      {!hasMapApiKey ? (
        <GlassCard style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>Karten-API vorbereiten</Text>
          <Text style={styles.selectedMeta}>{getMapProviderLabel()} ist vorbereitet, aber noch ohne API-Key konfiguriert.</Text>
          <Text style={styles.selectedMeta}>{getMapSetupInstructions()}</Text>
        </GlassCard>
      ) : null}

      <View style={styles.filters}>
        {RADIUS_OPTIONS.map((radius) => (
          <View key={radius} style={styles.filterChip}>
            <ToggleChip label={`${radius} km`} active={currentRadius === radius} onPress={() => setCurrentRadius(radius)} />
          </View>
        ))}
      </View>

      {currentUser.membership !== 'basic' ? (
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
      ) : null}

      <View style={styles.filters}>
        <View style={styles.filterChip}><ToggleChip label="Map" active={viewMode === 'map'} onPress={() => setViewMode('map')} /></View>
        <View style={styles.filterChip}><ToggleChip label="Liste" active={viewMode === 'list'} onPress={() => setViewMode('list')} /></View>
        <View style={styles.filterChip}><ToggleChip label="Radar" active={viewMode === 'radar'} onPress={() => setViewMode('radar')} /></View>
      </View>

      {viewMode === 'map' ? (
        <GlassCard strong style={styles.mapCard}>
          <View style={styles.mapArea}>
            {providerMapUrl ? <Image source={{ uri: providerMapUrl }} style={styles.mapImage} resizeMode="cover" /> : null}
            <View style={styles.centerPin}>
              <Ionicons name="location" size={54} color={affairGoTheme.colors.accent} />
            </View>
            {filteredProfiles.map((profile) => {
              const isSelected = filteredSelectedProfile?.id === profile.id;
              const travelSummary = getProfileTravelSummary(profile);
              const markerPosition = getMarkerPosition(profile, mapBounds);

              if (!markerPosition) {
                return null;
              }

              return (
                <Pressable
                  key={profile.id}
                  onPress={() => openProfile(profile)}
                  style={[
                    styles.pin,
                    { ...markerPosition, borderColor: travelModeColors[travelSummary?.mode || profile.travelMode] || affairGoTheme.colors.blue },
                    isSelected && styles.pinSelected,
                  ]}
                >
                  <Text style={styles.pinLabel}>{profile.age}</Text>
                </Pressable>
              );
            })}
            <View style={styles.osmBadge}>
              <Text style={styles.osmBadgeText}>{hasMapApiKey ? `${getMapProviderLabel()} live` : `${getMapProviderLabel()} bereit`}</Text>
            </View>
          </View>
        </GlassCard>
      ) : null}

      {viewMode === 'list' ? (
        <GlassCard strong style={styles.mapCard}>
          {filteredProfiles.map((profile) => {
            const travelSummary = getProfileTravelSummary(profile);
            return (
              <Pressable key={profile.id} onPress={() => openProfile(profile)} style={styles.listRow}>
                <View>
                  <Text style={styles.listName}>{profile.nickname}</Text>
                  <Text style={styles.listMeta}>{profile.age} Jahre, {profile.distanceKm} km, {profile.figure}</Text>
                  {travelSummary ? (
                    <Text style={styles.listMeta}>
                      {travelSummary.label}
                      {travelSummary.location ? ` in ${travelSummary.location}` : ''}
                      {travelSummary.period ? ` • ${travelSummary.period}` : ''}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.listTag, { color: travelModeColors[travelSummary?.mode || profile.travelMode] || affairGoTheme.colors.blue }]}> 
                  {travelSummary?.label || 'Aktiv'}
                </Text>
              </Pressable>
            );
          })}
        </GlassCard>
      ) : null}

      {viewMode === 'radar' ? (
        <GlassCard strong style={styles.mapCard}>
          <Text style={styles.radarTitle}>Jetzt online in deiner Nähe</Text>
          {filteredProfiles.filter((profile) => profile.online).map((profile) => {
            const travelSummary = getProfileTravelSummary(profile);
            return (
              <Pressable key={profile.id} onPress={() => openProfile(profile)} style={styles.radarRow}>
                <Ionicons name="radio-outline" size={20} color={affairGoTheme.colors.success} />
                <View style={styles.radarTextWrap}>
                  <Text style={styles.radarText}>{profile.nickname} ist online, {profile.distanceKm} km entfernt</Text>
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
  mapArea: {
    height: 520,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  mapImage: {
    ...StyleSheet.absoluteFillObject,
  },
  centerPin: {
    position: 'absolute',
    left: '48%',
    top: '46%',
    zIndex: 2,
  },
  pin: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(26, 13, 13, 0.85)',
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinSelected: {
    transform: [{ scale: 1.15 }],
  },
  pinLabel: {
    color: affairGoTheme.colors.text,
    fontWeight: '800',
    fontSize: 18,
  },
  osmBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(26, 13, 13, 0.78)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  osmBadgeText: {
    color: affairGoTheme.colors.text,
    fontSize: 12,
    fontWeight: '700',
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
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: affairGoTheme.colors.line,
  },
  radarTextWrap: {
    flex: 1,
    marginLeft: 10,
  },
  radarText: {
    color: affairGoTheme.colors.text,
  },
  radarSubtext: {
    color: affairGoTheme.colors.textMuted,
    marginTop: 4,
  },
  selectedName: {
    color: affairGoTheme.colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  selectedMeta: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 22,
  },
  selectedButton: {
    marginTop: 14,
  },
});

export default MatchingMapScreen;
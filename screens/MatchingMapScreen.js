import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, GlassCard, InfoBanner, ScreenHeader, StatusPill, ToggleChip } from '../components/AffairGoUI';
import MatchingMapLeaflet from '../components/MatchingMapLeaflet';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme, travelModeColors } from '../constants/affairGoTheme';
import { getMapProviderLabel, hasConfiguredMapApiKey } from '../constants/mapProvider';
import { useAffairGo } from '../context/AffairGoContext';
import { useNavigation } from '../naviagtion/SimpleNavigation';
import { buildRadarProfiles, filterMatchingMapProfiles } from '../untils/matchingMap';
import { formatRadiusKm, getAllowedRadiusOptions } from '../untils/radius';

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
    radiusUpdateError,
    requestLiveLocationAccess,
    selectedProfile,
    setCurrentRadius,
    setSelectedProfileId,
    visibleMapEvents,
    visibleProfiles,
  } = useAffairGo();
  const radiusOptions = useMemo(() => getAllowedRadiusOptions(), []);
  const [pendingRadius, setPendingRadius] = useState(currentRadius);
  const [radiusTrackWidth, setRadiusTrackWidth] = useState(0);
  const [isRadiusDragging, setIsRadiusDragging] = useState(false);
  const [isSavingRadius, setIsSavingRadius] = useState(false);
  const pendingRadiusRef = useRef(currentRadius);
  const radiusCommitStateRef = useRef({ saving: false, queuedRadius: null });
  const hasMapApiKey = hasConfiguredMapApiKey();
  const displayRadius = isRadiusDragging ? pendingRadius : currentRadius;
  const displayRadiusIndex = Math.max(radiusOptions.indexOf(displayRadius), 0);
  const displayRadiusProgress = radiusOptions.length > 1 ? displayRadiusIndex / (radiusOptions.length - 1) : 0;
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

  useEffect(() => {
    pendingRadiusRef.current = pendingRadius;
  }, [pendingRadius]);

  useEffect(() => {
    if (!isRadiusDragging) {
      setPendingRadius(currentRadius);
    }
  }, [currentRadius, isRadiusDragging]);

  const getRadiusIndexForValue = (value) => {
    const normalizedRadius = radiusOptions.includes(value) ? value : Number(value);
    const fallbackIndex = Math.max(radiusOptions.indexOf(currentRadius), 0);
    const nextIndex = radiusOptions.indexOf(normalizedRadius);
    return nextIndex >= 0 ? nextIndex : fallbackIndex;
  };

  const getRadiusFromTrackPosition = (positionX) => {
    if (radiusTrackWidth <= 0 || radiusOptions.length <= 1) {
      return radiusOptions[0] || currentRadius;
    }

    const clampedX = Math.max(0, Math.min(radiusTrackWidth, Number(positionX) || 0));
    const progress = clampedX / radiusTrackWidth;
    const index = Math.round(progress * (radiusOptions.length - 1));
    return radiusOptions[index] || radiusOptions[0] || currentRadius;
  };

  const commitRadiusSelection = async (nextRadius) => {
    const normalizedRadius = radiusOptions.includes(nextRadius) ? nextRadius : radiusOptions[getRadiusIndexForValue(nextRadius)] || currentRadius;

    if (normalizedRadius === currentRadius && !radiusCommitStateRef.current.saving) {
      setPendingRadius(normalizedRadius);
      return;
    }

    if (radiusCommitStateRef.current.saving) {
      radiusCommitStateRef.current.queuedRadius = normalizedRadius;
      return;
    }

    radiusCommitStateRef.current.saving = true;
    radiusCommitStateRef.current.queuedRadius = null;
    setIsSavingRadius(true);

    try {
      await setCurrentRadius(normalizedRadius);
    } finally {
      const queuedRadius = radiusCommitStateRef.current.queuedRadius;
      radiusCommitStateRef.current.saving = false;
      radiusCommitStateRef.current.queuedRadius = null;
      setIsSavingRadius(false);

      if (queuedRadius != null && queuedRadius !== normalizedRadius) {
        commitRadiusSelection(queuedRadius);
      }
    }
  };

  const handleRadiusTrackPress = (positionX) => {
    const nextRadius = getRadiusFromTrackPosition(positionX);
    setPendingRadius(nextRadius);
    commitRadiusSelection(nextRadius);
  };

  const handleRadiusKeyDown = (event) => {
    const key = event?.nativeEvent?.key || event?.key;
    const currentIndex = getRadiusIndexForValue(displayRadius);
    let nextIndex = currentIndex;

    if (key === 'ArrowLeft' || key === 'ArrowDown') {
      nextIndex = Math.max(0, currentIndex - 1);
    } else if (key === 'ArrowRight' || key === 'ArrowUp') {
      nextIndex = Math.min(radiusOptions.length - 1, currentIndex + 1);
    } else if (key === 'Home') {
      nextIndex = 0;
    } else if (key === 'End') {
      nextIndex = radiusOptions.length - 1;
    } else {
      return;
    }

    event?.preventDefault?.();
    const nextRadius = radiusOptions[nextIndex] || currentRadius;
    setPendingRadius(nextRadius);
    commitRadiusSelection(nextRadius);
  };

  const radiusPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      setIsRadiusDragging(true);
      setPendingRadius(getRadiusFromTrackPosition(event.nativeEvent.locationX));
    },
    onPanResponderMove: (event) => {
      setPendingRadius(getRadiusFromTrackPosition(event.nativeEvent.locationX));
    },
    onPanResponderRelease: () => {
      setIsRadiusDragging(false);
      commitRadiusSelection(pendingRadiusRef.current);
    },
    onPanResponderTerminate: () => {
      setIsRadiusDragging(false);
      commitRadiusSelection(pendingRadiusRef.current);
    },
  }), [currentRadius, radiusOptions, radiusTrackWidth]);

  return (
    <AppBackground>
      <ScreenHeader
        title="Matching Map"
        subtitle="OpenStreetMap mit Live-Standorten und Events"
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

      {radiusUpdateError ? (
        <InfoBanner tone="warning" title="Radius noch nicht gespeichert" detail={radiusUpdateError} />
      ) : null}

      <GlassCard strong style={styles.radiusCard}>
        <View style={styles.radiusHeaderRow}>
          <View style={styles.radiusHeaderCopy}>
            <Text style={styles.radiusEyebrow}>Entfernung</Text>
            <Text style={styles.radiusTitle}>{formatRadiusKm(displayRadius)}</Text>
            <Text style={styles.radiusMeta}>{isRadiusDragging ? 'Anzeige aktualisiert sich sofort, gespeichert wird erst beim Loslassen.' : isSavingRadius ? 'Radius wird gespeichert …' : 'Der bestehende Suchradius wird für Matching Map und Profile verwendet.'}</Text>
          </View>
          <StatusPill label={`${radiusOptions[0]}-${radiusOptions[radiusOptions.length - 1]} km`} tone="info" />
        </View>

        <Pressable
          accessibilityRole="adjustable"
          accessibilityLabel="Suchradius"
          accessibilityValue={{ min: radiusOptions[0], max: radiusOptions[radiusOptions.length - 1], now: displayRadius, text: formatRadiusKm(displayRadius) }}
          focusable
          onKeyDown={handleRadiusKeyDown}
          onLayout={(event) => setRadiusTrackWidth(event.nativeEvent.layout.width)}
          onPress={(event) => handleRadiusTrackPress(event.nativeEvent.locationX)}
          style={styles.radiusScaleShell}
        >
          <View style={styles.radiusTrackBase} />
          <View style={[styles.radiusTrackActive, { width: `${displayRadiusProgress * 100}%` }]} />
          <View style={styles.radiusStopsRow} pointerEvents="box-none">
            {radiusOptions.map((radius, index) => {
              const active = index <= displayRadiusIndex;
              return (
                <Pressable key={radius} onPress={() => handleRadiusTrackPress((radiusTrackWidth / Math.max(radiusOptions.length - 1, 1)) * index)} hitSlop={10} style={styles.radiusStopHitArea}>
                  <View style={[styles.radiusStop, active ? styles.radiusStopActive : null]} />
                </Pressable>
              );
            })}
          </View>
          <View style={[styles.radiusHandle, { left: `${displayRadiusProgress * 100}%` }]} {...radiusPanResponder.panHandlers}>
            <View style={styles.radiusHandleInner} />
          </View>
        </Pressable>

        <View style={styles.radiusLabelsRow}>
          {radiusOptions.map((radius) => (
            <Text key={radius} style={[styles.radiusLabel, radius === displayRadius ? styles.radiusLabelActive : null]}>{formatRadiusKm(radius)}</Text>
          ))}
        </View>
      </GlassCard>

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
            radiusKm={displayRadius}
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
  radiusCard: {
    marginBottom: 14,
  },
  radiusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  radiusHeaderCopy: {
    flex: 1,
  },
  radiusEyebrow: {
    color: affairGoTheme.colors.accentSoft,
    textTransform: 'uppercase',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  radiusTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 28,
    fontWeight: '700',
    marginTop: 6,
  },
  radiusMeta: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 21,
    marginTop: 8,
  },
  radiusScaleShell: {
    position: 'relative',
    height: 48,
    justifyContent: 'center',
    marginBottom: 10,
  },
  radiusTrackBase: {
    height: 8,
    borderRadius: affairGoTheme.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  radiusTrackActive: {
    position: 'absolute',
    left: 0,
    top: 20,
    height: 8,
    borderRadius: affairGoTheme.radius.pill,
    backgroundColor: affairGoTheme.colors.accent,
  },
  radiusStopsRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  radiusStopHitArea: {
    width: 32,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusStop: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: affairGoTheme.colors.line,
    backgroundColor: affairGoTheme.colors.cardStrong,
  },
  radiusStopActive: {
    borderColor: affairGoTheme.colors.accent,
    backgroundColor: affairGoTheme.colors.accent,
  },
  radiusHandle: {
    position: 'absolute',
    top: 10,
    marginLeft: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: affairGoTheme.colors.cardStrong,
    borderWidth: 2,
    borderColor: affairGoTheme.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    ...affairGoTheme.shadow,
  },
  radiusHandleInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: affairGoTheme.colors.accent,
  },
  radiusLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  radiusLabel: {
    flex: 1,
    color: affairGoTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  radiusLabelActive: {
    color: affairGoTheme.colors.text,
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

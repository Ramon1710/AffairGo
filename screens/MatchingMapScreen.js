import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, GlassCard, ScreenHeader, ToggleChip } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme, travelModeColors } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { PHOTO_AGE_FILTERS, RADIUS_OPTIONS } from '../data/mockData';
import { useNavigation } from '../naviagtion/SimpleNavigation';

const MatchingMapScreen = () => {
  const navigation = useNavigation();
  const [viewMode, setViewMode] = useState('map');
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
  } = useAffairGo();

  const openProfile = (profile) => {
    if (selectedProfile?.id === profile.id) {
      navigation.navigate('Profil', { profileId: profile.id });
      return;
    }
    setSelectedProfileId(profile.id);
  };

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
            <View style={styles.centerPin}>
              <Ionicons name="location" size={54} color={affairGoTheme.colors.accent} />
            </View>
            {visibleProfiles.map((profile) => {
              const isSelected = selectedProfile?.id === profile.id;
              return (
                <Pressable
                  key={profile.id}
                  onPress={() => openProfile(profile)}
                  style={[
                    styles.pin,
                    { left: profile.x, top: profile.y, borderColor: travelModeColors[profile.travelMode] || affairGoTheme.colors.blue },
                    isSelected && styles.pinSelected,
                  ]}
                >
                  <Text style={styles.pinLabel}>{profile.age}</Text>
                </Pressable>
              );
            })}
          </View>
        </GlassCard>
      ) : null}

      {viewMode === 'list' ? (
        <GlassCard strong style={styles.mapCard}>
          {visibleProfiles.map((profile) => (
            <Pressable key={profile.id} onPress={() => openProfile(profile)} style={styles.listRow}>
              <View>
                <Text style={styles.listName}>{profile.nickname}</Text>
                <Text style={styles.listMeta}>{profile.age} Jahre, {profile.distanceKm} km, {profile.figure}</Text>
              </View>
              <Text style={[styles.listTag, { color: travelModeColors[profile.travelMode] || affairGoTheme.colors.blue }]}>
                {profile.travelMode === 'business' ? 'Dienstreise' : profile.travelMode === 'vacation' ? 'Urlaub' : 'Aktiv'}
              </Text>
            </Pressable>
          ))}
        </GlassCard>
      ) : null}

      {viewMode === 'radar' ? (
        <GlassCard strong style={styles.mapCard}>
          <Text style={styles.radarTitle}>Jetzt online in deiner Naehe</Text>
          {visibleProfiles.filter((profile) => profile.online).map((profile) => (
            <Pressable key={profile.id} onPress={() => openProfile(profile)} style={styles.radarRow}>
              <Ionicons name="radio-outline" size={20} color={affairGoTheme.colors.success} />
              <Text style={styles.radarText}>{profile.nickname} ist online, {profile.distanceKm} km entfernt</Text>
            </Pressable>
          ))}
        </GlassCard>
      ) : null}

      {selectedProfile ? (
        <GlassCard style={styles.selectedCard}>
          <Text style={styles.selectedName}>{selectedProfile.nickname}</Text>
          <Text style={styles.selectedMeta}>{selectedProfile.age} Jahre, {selectedProfile.distanceKm} km, {selectedProfile.figure}</Text>
          <Text style={styles.selectedMeta}>Kompatibilitaet: {getCompatibility(currentUser.preferences, selectedProfile.preferences)}%</Text>
          <Text style={styles.selectedMeta}>Profilfoto: {selectedProfile.profilePhotoAgeMonths} Monate alt</Text>
          <AccentButton label="Profil oeffnen" onPress={() => navigation.navigate('Profil', { profileId: selectedProfile.id })} style={styles.selectedButton} />
        </GlassCard>
      ) : null}
    </AppBackground>
  );
};

const styles = StyleSheet.create({
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
  mapArea: {
    height: 520,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
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
  radarText: {
    color: affairGoTheme.colors.text,
    marginLeft: 10,
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
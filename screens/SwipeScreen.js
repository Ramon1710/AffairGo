import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, GlassCard, ScreenHeader, ToggleChip } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { useNavigation } from '../naviagtion/SimpleNavigation';

const SwipeScreen = () => {
  const navigation = useNavigation();
  const { visibleProfiles, respondToSwipe, rewindLastSwipe, currentUser, getCompatibility } = useAffairGo();
  const currentProfile = visibleProfiles[0];

  return (
    <AppBackground contentContainerStyle={styles.content}>
      <ScreenHeader
        title="Swipe"
        subtitle="Tinder-aehnlicher Demo-Flow"
        leftAction={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color={affairGoTheme.colors.text} />
          </Pressable>
        }
        rightAction={currentUser.membership === 'gold' ? <ToggleChip label="Zurueck" active={false} onPress={rewindLastSwipe} /> : null}
      />

      {currentProfile ? (
        <GlassCard strong style={styles.card}>
          <View style={styles.heroPhoto}>
            <Ionicons name="person" size={74} color={affairGoTheme.colors.text} />
          </View>
          <Text style={styles.name}>{currentProfile.nickname}</Text>
          <Text style={styles.meta}>{currentProfile.age} Jahre, {currentProfile.distanceKm} km, {currentProfile.figure}</Text>
          <Text style={styles.meta}>Matching-Score: {getCompatibility(currentUser.preferences, currentProfile.preferences)}%</Text>
          <Text style={styles.copy}>Vorlieben treffen zu, wenn mindestens 30% passen und beide Altersfilter einander zulassen.</Text>
          <View style={styles.actionRow}>
            <AccentButton label="Kein Interesse" variant="secondary" onPress={() => respondToSwipe(currentProfile.id, 'dismiss')} style={styles.actionButton} />
            <AccentButton label="Match" onPress={() => respondToSwipe(currentProfile.id, 'like')} style={styles.actionButton} />
          </View>
          <AccentButton label="Profil ansehen" variant="ghost" onPress={() => navigation.navigate('Profil', { profileId: currentProfile.id })} />
        </GlassCard>
      ) : (
        <GlassCard strong style={styles.card}>
          <Text style={styles.name}>Keine weiteren Profile im aktuellen Radius</Text>
          <Text style={styles.copy}>Erhoehe den Radius, passe Vorlieben an oder warte auf neue aktive Suchanfragen in deiner Naehe.</Text>
          <AccentButton label="Zur Matching Map" onPress={() => navigation.navigate('MatchingMap')} style={styles.cta} />
        </GlassCard>
      )}
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
  },
  card: {
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  heroPhoto: {
    height: 260,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  name: {
    color: affairGoTheme.colors.text,
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  meta: {
    color: affairGoTheme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  copy: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 22,
    marginVertical: 18,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    marginHorizontal: -6,
    marginBottom: 10,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 6,
  },
  cta: {
    marginTop: 12,
  },
});

export default SwipeScreen;
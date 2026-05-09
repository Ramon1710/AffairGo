import { useEffect, useMemo, useRef } from 'react';
import { Alert, Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, GlassCard, ScreenHeader, ToggleChip } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { useNavigation } from '../naviagtion/SimpleNavigation';

const SWIPE_THRESHOLD = 120;
const SWIPE_OUT_DISTANCE = 560;

const SwipeScreen = () => {
  const navigation = useNavigation();
  const { visibleProfiles, respondToSwipe, rewindLastSwipe, currentUser, getCompatibility, remainingSwipes, swipeLimitReached, getProfileTravelSummary } = useAffairGo();
  const currentProfile = visibleProfiles[0];
  const nextProfile = visibleProfiles[1] || null;
  const currentProfileTravel = currentProfile ? getProfileTravelSummary(currentProfile) : null;
  const swipePosition = useRef(new Animated.ValueXY()).current;

  useEffect(() => {
    swipePosition.setValue({ x: 0, y: 0 });
  }, [currentProfile?.id, swipePosition]);

  const animateCardReset = () => {
    Animated.spring(swipePosition, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
      friction: 6,
    }).start();
  };

  const handleSwipe = async (action) => {
    try {
      swipePosition.setValue({ x: 0, y: 0 });
      await respondToSwipe(currentProfile.id, action);
    } catch (error) {
      Alert.alert('Swipe blockiert', error.message);
      animateCardReset();
    }
  };

  const triggerGestureSwipe = (action) => {
    const toValue = action === 'like'
      ? { x: SWIPE_OUT_DISTANCE, y: 40 }
      : { x: -SWIPE_OUT_DISTANCE, y: 40 };

    Animated.timing(swipePosition, {
      toValue,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      handleSwipe(action);
    });
  };

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 8 || Math.abs(gestureState.dy) > 8,
    onPanResponderMove: (_, gestureState) => {
      swipePosition.setValue({ x: gestureState.dx, y: gestureState.dy * 0.35 });
    },
    onPanResponderRelease: (_, gestureState) => {
      if (swipeLimitReached || !currentProfile) {
        animateCardReset();
        return;
      }

      if (gestureState.dx >= SWIPE_THRESHOLD) {
        triggerGestureSwipe('like');
        return;
      }

      if (gestureState.dx <= -SWIPE_THRESHOLD) {
        triggerGestureSwipe('dismiss');
        return;
      }

      animateCardReset();
    },
  }), [currentProfile, swipeLimitReached]);

  const rotate = swipePosition.x.interpolate({
    inputRange: [-240, 0, 240],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });

  const likeOpacity = swipePosition.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const dismissOpacity = swipePosition.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const nextCardScale = swipePosition.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
    outputRange: [1, 0.96, 1],
    extrapolate: 'clamp',
  });

  const animatedCardStyle = {
    transform: [
      { translateX: swipePosition.x },
      { translateY: swipePosition.y },
      { rotate },
    ],
  };

  const nextCardStyle = {
    transform: [{ scale: nextCardScale }],
  };

  return (
    <AppBackground contentContainerStyle={styles.content}>
      <ScreenHeader
        title="Swipe"
        subtitle="Profile entdecken"
        leftAction={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color={affairGoTheme.colors.text} />
          </Pressable>
        }
        rightAction={<ToggleChip label="Zurück" active={false} onPress={rewindLastSwipe} />}
      />

      {currentProfile ? (
        <View style={styles.deckWrap}>
          {nextProfile ? (
            <Animated.View style={[styles.nextCardWrap, nextCardStyle]} pointerEvents="none">
              <GlassCard style={[styles.card, styles.nextCard]}>
                <View style={styles.heroPhotoSecondary}>
                  <Ionicons name="person-outline" size={52} color={affairGoTheme.colors.textMuted} />
                </View>
                <Text style={styles.nextName}>{nextProfile.nickname}</Text>
                <Text style={styles.meta}>{nextProfile.age} Jahre, {nextProfile.distanceKm} km</Text>
              </GlassCard>
            </Animated.View>
          ) : null}

          <Animated.View style={[styles.activeCardWrap, animatedCardStyle]} {...panResponder.panHandlers}>
            <GlassCard strong style={styles.card}>
              <Animated.View style={[styles.swipeBadge, styles.dismissBadge, { opacity: dismissOpacity }]}>
                <Text style={styles.swipeBadgeText}>NOPE</Text>
              </Animated.View>
              <Animated.View style={[styles.swipeBadge, styles.likeBadge, { opacity: likeOpacity }]}>
                <Text style={styles.swipeBadgeText}>MATCH</Text>
              </Animated.View>

              <View style={styles.heroPhoto}>
                <Ionicons name="person" size={74} color={affairGoTheme.colors.text} />
              </View>
              <Text style={styles.name}>{currentProfile.nickname}</Text>
              <Text style={styles.meta}>{currentProfile.age} Jahre, {currentProfile.distanceKm} km, {currentProfile.figure}</Text>
              <Text style={styles.meta}>Matching-Score: {getCompatibility(currentUser, currentProfile)}%</Text>
              {currentProfileTravel ? (
                <Text style={styles.meta}>
                  {currentProfileTravel.label}
                  {currentProfileTravel.location ? ` in ${currentProfileTravel.location}` : ''}
                  {currentProfileTravel.period ? ` • ${currentProfileTravel.period}` : ''}
                </Text>
              ) : null}
              <Text style={styles.copy}>Ziehe die Karte nach links oder rechts. Ab 30% Kompatibilität, gegenseitiger Alterssuche und Suchaktivität erscheint ein Profil hier im Deck.</Text>
              <View style={styles.actionRow}>
                <AccentButton label="Kein Interesse" variant="secondary" onPress={() => triggerGestureSwipe('dismiss')} disabled={swipeLimitReached} style={styles.actionButton} />
                <AccentButton label="Match" onPress={() => triggerGestureSwipe('like')} disabled={swipeLimitReached} style={styles.actionButton} />
              </View>
              <AccentButton label="Profil ansehen" variant="ghost" onPress={() => navigation.navigate('Profil', { profileId: currentProfile.id })} />
            </GlassCard>
          </Animated.View>
        </View>
      ) : (
        <GlassCard strong style={styles.card}>
          <Text style={styles.name}>Keine weiteren Profile im aktuellen Radius</Text>
          <Text style={styles.copy}>Erhöhe den Radius, passe Vorlieben an oder warte auf neue aktive Suchanfragen in deiner Nähe.</Text>
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
  deckWrap: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    minHeight: 620,
    position: 'relative',
  },
  activeCardWrap: {
    position: 'absolute',
    width: '100%',
    zIndex: 2,
  },
  nextCardWrap: {
    position: 'absolute',
    width: '100%',
    top: 18,
    zIndex: 1,
  },
  nextCard: {
    opacity: 0.72,
  },
  limitCard: {
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
    marginBottom: 14,
  },
  limitTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  heroPhoto: {
    height: 260,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  heroPhotoSecondary: {
    height: 180,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.04)',
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
  nextName: {
    color: affairGoTheme.colors.text,
    fontSize: 24,
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
  swipeBadge: {
    position: 'absolute',
    top: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 2,
    zIndex: 3,
  },
  likeBadge: {
    right: 22,
    borderColor: affairGoTheme.colors.success,
    backgroundColor: 'rgba(137,214,178,0.16)',
    transform: [{ rotate: '10deg' }],
  },
  dismissBadge: {
    left: 22,
    borderColor: affairGoTheme.colors.danger,
    backgroundColor: 'rgba(255,140,140,0.16)',
    transform: [{ rotate: '-10deg' }],
  },
  swipeBadgeText: {
    color: affairGoTheme.colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },
});

export default SwipeScreen;
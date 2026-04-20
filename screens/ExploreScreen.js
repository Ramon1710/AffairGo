import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, GlassCard, ScreenHeader, ToggleChip } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { useNavigation } from '../naviagtion/SimpleNavigation';

const ExploreScreen = () => {
  const navigation = useNavigation();
  const { currentUser, exploreCities, submitFeatureIdea, featureIdeas } = useAffairGo();
  const [selectedCity, setSelectedCity] = useState(exploreCities[0]);

  if (currentUser.membership !== 'gold') {
    return (
      <AppBackground contentContainerStyle={styles.centered}>
        <GlassCard strong style={styles.lockedCard}>
          <Text style={styles.title}>Explore-Modus ist Gold-only</Text>
          <Text style={styles.copy}>Fiktive Staedte und freies Erkunden ausserhalb des echten Radius sind nur im Gold-Paket verfuegbar.</Text>
          <AccentButton label="Zurueck" onPress={() => navigation.goBack()} />
        </GlassCard>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <ScreenHeader
        title="Explore"
        subtitle="Fiktive Staedte fuer Gold"
        leftAction={<Pressable onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={28} color={affairGoTheme.colors.text} /></Pressable>}
      />

      <GlassCard strong style={styles.lockedCard}>
        <Text style={styles.title}>Zielstadt waehlen</Text>
        <View style={styles.cityWrap}>
          {exploreCities.map((city) => (
            <View key={city} style={styles.cityItem}>
              <ToggleChip label={city} active={selectedCity === city} onPress={() => setSelectedCity(city)} />
            </View>
          ))}
        </View>
        <Text style={styles.copy}>Aktuell explorierst du {selectedCity}. Dieser Modus ist bewusst getrennt vom echten Suchradius.</Text>
      </GlassCard>

      <GlassCard style={styles.lockedCard}>
        <Text style={styles.title}>Ideenbox</Text>
        <Text style={styles.copy}>Community-Vorschlaege koennen mit Premium-Tagen oder Boosts belohnt werden.</Text>
        <AccentButton label="Feature-Idee einreichen" onPress={() => submitFeatureIdea(`Neues Spiel fuer ${selectedCity}`)} style={styles.ideaButton} />
        <Text style={styles.copy}>Bisherige Ideen: {featureIdeas.length}</Text>
      </GlassCard>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
  },
  lockedCard: {
    marginBottom: 14,
  },
  title: {
    color: affairGoTheme.colors.text,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 10,
  },
  copy: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 22,
  },
  cityWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  cityItem: {
    marginRight: 8,
    marginBottom: 8,
  },
  ideaButton: {
    marginVertical: 14,
  },
});

export default ExploreScreen;

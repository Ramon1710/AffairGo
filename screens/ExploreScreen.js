import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, GlassCard, ScreenHeader, ToggleChip } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { useNavigation } from '../naviagtion/SimpleNavigation';

const ExploreScreen = () => {
  const navigation = useNavigation();
  const { currentUser, exploreCities, submitFeatureIdea, featureIdeas } = useAffairGo();
  const [selectedCity, setSelectedCity] = useState(exploreCities[0]);

  const handleSubmitIdea = async () => {
    try {
      await submitFeatureIdea(`Neues Spiel für ${selectedCity}`);
      Alert.alert('Idee eingereicht', 'Deine Idee wurde gespeichert und fuer die Moderationspruefung markiert.');
    } catch (error) {
      Alert.alert('Idee blockiert', error.message || 'Die Idee konnte aktuell nicht eingereicht werden.');
    }
  };

  if (currentUser.membership !== 'gold') {
    return (
      <AppBackground contentContainerStyle={styles.centered}>
        <GlassCard strong style={styles.lockedCard}>
          <Text style={styles.title}>Explore-Modus ist Gold-only</Text>
          <Text style={styles.copy}>Fiktive Städte und freies Erkunden außerhalb des echten Radius sind nur im Gold-Paket verfügbar.</Text>
          <AccentButton label="Zurück" onPress={() => navigation.goBack()} />
        </GlassCard>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <ScreenHeader
        title="Explore"
        subtitle="Fiktive Städte für Gold"
        leftAction={<Pressable onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={28} color={affairGoTheme.colors.text} /></Pressable>}
      />

      <GlassCard strong style={styles.lockedCard}>
        <Text style={styles.title}>Zielstadt wählen</Text>
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
        <Text style={styles.copy}>Community-Vorschläge können mit Premium-Tagen oder Boosts belohnt werden.</Text>
        <AccentButton label="Feature-Idee einreichen" onPress={handleSubmitIdea} style={styles.ideaButton} />
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

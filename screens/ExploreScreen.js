import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, GlassCard, ScreenHeader, ToggleChip } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { useNavigation } from '../naviagtion/SimpleNavigation';

const ExploreScreen = () => {
  const navigation = useNavigation();
  const { currentUser, exploreCities, submitFeatureIdea, approveFeatureIdea, featureIdeas } = useAffairGo();
  const [selectedCity, setSelectedCity] = useState(exploreCities[0]);
  const [isApprovingIdeaId, setIsApprovingIdeaId] = useState('');

  const handleSubmitIdea = async () => {
    try {
      await submitFeatureIdea(`Neues Spiel für ${selectedCity}`);
      Alert.alert('Idee eingereicht', 'Deine Idee wurde gespeichert und fuer die Moderationspruefung markiert.');
    } catch (error) {
      Alert.alert('Idee blockiert', error.message || 'Die Idee konnte aktuell nicht eingereicht werden.');
    }
  };

  const handleApproveIdea = async (ideaId) => {
    try {
      setIsApprovingIdeaId(ideaId);
      const approvedIdea = await approveFeatureIdea(ideaId);
      Alert.alert('Idee freigegeben', `${approvedIdea.title} wurde freigegeben. Die Belohnung ${approvedIdea.reward} wurde dem Nutzerkonto hinterlegt.`);
    } catch (error) {
      Alert.alert('Freigabe fehlgeschlagen', error.message || 'Die Idee konnte nicht freigegeben werden.');
    } finally {
      setIsApprovingIdeaId('');
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
        <View style={styles.ideaList}>
          {featureIdeas.length ? featureIdeas.map((idea) => (
            <View key={idea.id} style={styles.ideaItem}>
              <Text style={styles.ideaTitle}>{idea.title}</Text>
              <Text style={styles.ideaMeta}>Von {idea.submitterNickname || 'Anonym'} • Status: {idea.status === 'approved' ? 'Freigegeben' : 'In Prüfung'}</Text>
              <Text style={styles.ideaMeta}>Belohnung: {idea.reward}</Text>
              {idea.approvedAt ? <Text style={styles.ideaMeta}>Freigegeben am: {idea.approvedAt}</Text> : null}
              {currentUser.isAdmin && idea.status !== 'approved' ? (
                <AccentButton
                  label={isApprovingIdeaId === idea.id ? 'Freigabe läuft...' : 'Idee freigeben'}
                  onPress={() => handleApproveIdea(idea.id)}
                  variant="secondary"
                  disabled={isApprovingIdeaId === idea.id}
                  style={styles.approveButton}
                />
              ) : null}
            </View>
          )) : <Text style={styles.copy}>Noch keine Community-Ideen vorhanden.</Text>}
        </View>
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
  ideaList: {
    marginTop: 12,
  },
  ideaItem: {
    borderWidth: 1,
    borderColor: affairGoTheme.colors.line,
    borderRadius: affairGoTheme.radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    marginBottom: 10,
  },
  ideaTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  ideaMeta: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 20,
  },
  approveButton: {
    marginTop: 10,
  },
});

export default ExploreScreen;

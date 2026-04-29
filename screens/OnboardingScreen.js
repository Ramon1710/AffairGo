import { Alert, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, GlassCard, ScreenHeader, ToggleChip } from '../components/AffairGoUI';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { useNavigation } from '../naviagtion/SimpleNavigation';

const OnboardingScreen = () => {
  const navigation = useNavigation();
  const { preferenceOptions, tabooOptions, completeOnboarding } = useAffairGo();
  const [preferences, setPreferences] = React.useState([]);
  const [taboos, setTaboos] = React.useState([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const toggleValue = (list, setList, value) => {
    setList((previous) =>
      previous.includes(value) ? previous.filter((entry) => entry !== value) : [...previous, value]
    );
  };

  const handleContinue = async () => {
    if (!preferences.length) {
      Alert.alert('Vorlieben fehlen', 'Wähle mindestens eine Vorliebe aus, damit Matching und Kompatibilität funktionieren.');
      return;
    }

    try {
      setIsSubmitting(true);
      await completeOnboarding({ preferences, taboos });
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    } catch (error) {
      Alert.alert('Onboarding fehlgeschlagen', error?.message || 'Die Angaben konnten nicht gespeichert werden.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppBackground>
      <ScreenHeader title="Vorlieben und Tabus" subtitle="Erster Login" />
      <GlassCard strong style={styles.card}>
        <Text style={styles.copy}>
          Dieses Fenster erscheint erst nach bestätigter E-Mail und dem ersten Login. Die Angaben steuern Matching,
          Sichtbarkeit und den Kompatibilitäts-Score.
        </Text>
        <Text style={styles.label}>Vorlieben</Text>
        <View style={styles.chipWrap}>
          {preferenceOptions.map((option) => (
            <View key={option} style={styles.chipItem}>
              <ToggleChip label={option} active={preferences.includes(option)} onPress={() => toggleValue(preferences, setPreferences, option)} />
            </View>
          ))}
        </View>

        <Text style={styles.label}>Tabus</Text>
        <View style={styles.chipWrap}>
          {tabooOptions.map((option) => (
            <View key={option} style={styles.chipItem}>
              <ToggleChip label={option} active={taboos.includes(option)} onPress={() => toggleValue(taboos, setTaboos, option)} />
            </View>
          ))}
        </View>

        <AccentButton label={isSubmitting ? 'Speichern...' : 'Onboarding abschließen'} onPress={handleContinue} disabled={isSubmitting} style={styles.button} />
      </GlassCard>
    </AppBackground>
  );
};

const React = require('react');

const styles = StyleSheet.create({
  card: {
    marginBottom: 24,
  },
  copy: {
    color: affairGoTheme.colors.textMuted,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 18,
  },
  label: {
    color: affairGoTheme.colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 14,
    marginTop: 8,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  chipItem: {
    marginRight: 10,
    marginBottom: 10,
  },
  button: {
    marginTop: 18,
  },
});

export default OnboardingScreen;
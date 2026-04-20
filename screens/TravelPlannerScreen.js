import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, FormField, GlassCard, ScreenHeader } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { VISIBILITY_OPTIONS } from '../data/mockData';
import { useNavigation, useRoute } from '../naviagtion/SimpleNavigation';

const TravelPlannerScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const mode = route.params?.mode === 'vacation' ? 'vacation' : 'business';
  const { currentUser, saveTravelPlan } = useAffairGo();
  const initialPlan = currentUser.travelPlans[mode];

  const [form, setForm] = React.useState(initialPlan);
  const labels = {
    business: {
      title: 'Dienstreise',
      button: 'Dienstreise speichern',
      accent: affairGoTheme.colors.yellow,
    },
    vacation: {
      title: 'Urlaub',
      button: 'Urlaub speichern',
      accent: affairGoTheme.colors.blue,
    },
  };

  const meta = labels[mode];

  const updateField = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const toggleVisibility = (value) => {
    setForm((previous) => ({
      ...previous,
      visibility: previous.visibility.includes(value)
        ? previous.visibility.filter((entry) => entry !== value)
        : [...previous.visibility, value],
    }));
  };

  const save = () => {
    saveTravelPlan(mode, form);
    Alert.alert('Gespeichert', `${meta.title} wurde aktualisiert und ist sofort im Dashboard sichtbar.`);
    navigation.goBack();
  };

  return (
    <AppBackground>
      <ScreenHeader
        title={meta.title}
        subtitle="Planung bis zu 2 Wochen voraus"
        leftAction={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color={affairGoTheme.colors.text} />
          </Pressable>
        }
      />

      <GlassCard strong>
        <View style={styles.row}>
          <View style={styles.half}>
            <FormField label="Von" value={form.startDate} onChangeText={(value) => updateField('startDate', value)} placeholder="TT.MM.JJJJ" />
          </View>
          <View style={styles.half}>
            <FormField label="Bis" value={form.endDate} onChangeText={(value) => updateField('endDate', value)} placeholder="TT.MM.JJJJ" />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <FormField label="Verfuegbar ab" value={form.fromTime} onChangeText={(value) => updateField('fromTime', value)} placeholder="00:00 Uhr" />
          </View>
          <View style={styles.half}>
            <FormField label="Bis" value={form.toTime} onChangeText={(value) => updateField('toTime', value)} placeholder="00:00 Uhr" />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <FormField label="PLZ" value={form.postalCode} onChangeText={(value) => updateField('postalCode', value)} placeholder="PLZ" />
          </View>
          <View style={styles.half}>
            <FormField label="Ort" value={form.city} onChangeText={(value) => updateField('city', value)} placeholder="Ort" />
          </View>
        </View>

        <FormField label="Strasse" value={form.street} onChangeText={(value) => updateField('street', value)} placeholder="Strasse und Hausnummer" />

        <Text style={styles.sectionLabel}>Sichtbarkeit</Text>
        {VISIBILITY_OPTIONS.map((option) => {
          const active = form.visibility.includes(option);
          return (
            <Pressable key={option} onPress={() => toggleVisibility(option)} style={styles.checkboxRow}>
              <View style={[styles.checkbox, active && { backgroundColor: meta.accent, borderColor: meta.accent }]}>
                {active ? <Ionicons name="checkmark" size={18} color="#1a0909" /> : null}
              </View>
              <Text style={styles.checkboxLabel}>{option}</Text>
            </Pressable>
          );
        })}

        <AccentButton label={meta.button} onPress={save} style={styles.button} />
      </GlassCard>
    </AppBackground>
  );
};

const React = require('react');

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginHorizontal: -6,
  },
  half: {
    flex: 1,
    marginHorizontal: 6,
  },
  sectionLabel: {
    color: affairGoTheme.colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: affairGoTheme.colors.line,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    color: affairGoTheme.colors.text,
    fontSize: 16,
  },
  button: {
    marginTop: 10,
  },
});

export default TravelPlannerScreen;
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, FormField, GlassCard, ScreenHeader } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { VISIBILITY_OPTIONS } from '../data/mockData';
import { useNavigation, useRoute } from '../naviagtion/SimpleNavigation';

const createEmptyPlan = () => ({
  startDate: '',
  endDate: '',
  fromTime: '',
  toTime: '',
  postalCode: '',
  city: '',
  street: '',
  visibility: [],
});

const TravelPlannerScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const mode = route.params?.mode === 'vacation' ? 'vacation' : 'business';
  const { currentUser, saveTravelPlan, deleteTravelPlan } = useAffairGo();
  const existingPlans = currentUser.travelPlans[mode] || [];

  const [form, setForm] = React.useState(createEmptyPlan());
  const labels = {
    business: {
      title: 'Dienstreise',
      button: 'Dienstreise speichern',
      accent: affairGoTheme.colors.yellow,
      empty: 'Noch keine Dienstreisen geplant.',
    },
    vacation: {
      title: 'Urlaub',
      button: 'Urlaub speichern',
      accent: affairGoTheme.colors.blue,
      empty: 'Noch keine Urlaube geplant.',
    },
  };
  const [editingPlanId, setEditingPlanId] = React.useState(null);

  const meta = labels[mode];
  const isEditing = Boolean(editingPlanId);

  const resetForm = () => {
    setForm(createEmptyPlan());
    setEditingPlanId(null);
  };

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

  const save = async () => {
    await saveTravelPlan(mode, { ...form, id: editingPlanId || undefined });
    Alert.alert('Gespeichert', `${meta.title} wurde ${isEditing ? 'aktualisiert' : 'gespeichert'} und ist sofort im Dashboard sichtbar.`);
    navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
  };

  const startEditing = (plan) => {
    setForm({
      id: plan.id,
      startDate: plan.startDate,
      endDate: plan.endDate,
      fromTime: plan.fromTime,
      toTime: plan.toTime,
      postalCode: plan.postalCode,
      city: plan.city,
      street: plan.street,
      visibility: [...plan.visibility],
    });
    setEditingPlanId(plan.id);
  };

  const handleDelete = (plan) => {
    Alert.alert(
      'Eintrag löschen',
      `Soll ${meta.title.toLowerCase()} ${plan.city ? `für ${plan.city}` : 'wirklich'} gelöscht werden?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            await deleteTravelPlan(mode, plan.id);
            if (editingPlanId === plan.id) {
              resetForm();
            }
          },
        },
      ]
    );
  };

  return (
    <AppBackground>
      <ScreenHeader
        title={meta.title}
        subtitle={isEditing ? 'Eintrag bearbeiten' : 'Planung bis zu 2 Wochen voraus'}
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
            <FormField label="Verfügbar ab" value={form.fromTime} onChangeText={(value) => updateField('fromTime', value)} placeholder="00:00 Uhr" />
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

        <FormField label="Straße" value={form.street} onChangeText={(value) => updateField('street', value)} placeholder="Straße und Hausnummer" />

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

        <AccentButton label={isEditing ? `${meta.title} aktualisieren` : meta.button} onPress={save} style={styles.button} />
        {isEditing ? <AccentButton label="Bearbeitung abbrechen" variant="ghost" onPress={resetForm} /> : null}
      </GlassCard>

      <GlassCard style={styles.plannedCard}>
        <Text style={styles.sectionLabel}>Bereits geplant</Text>
        {existingPlans.length ? existingPlans.map((plan) => (
          <View key={plan.id} style={styles.planRow}>
            <Text style={styles.planTitle}>{plan.city || 'Ohne Ort'}{plan.postalCode ? `, ${plan.postalCode}` : ''}</Text>
            <Text style={styles.planMeta}>{plan.startDate} bis {plan.endDate}</Text>
            <Text style={styles.planMeta}>{plan.fromTime} bis {plan.toTime}</Text>
            <View style={styles.planActions}>
              <Pressable onPress={() => startEditing(plan)} style={styles.planActionButton}>
                <Text style={styles.planActionText}>Bearbeiten</Text>
              </Pressable>
              <Pressable onPress={() => handleDelete(plan)} style={styles.planActionButton}>
                <Text style={[styles.planActionText, styles.deleteText]}>Löschen</Text>
              </Pressable>
            </View>
          </View>
        )) : <Text style={styles.planMeta}>{meta.empty}</Text>}
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
  plannedCard: {
    marginTop: 14,
  },
  planRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: affairGoTheme.colors.line,
  },
  planTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  planMeta: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 22,
  },
  planActions: {
    flexDirection: 'row',
    marginTop: 8,
  },
  planActionButton: {
    marginRight: 18,
    paddingVertical: 4,
  },
  planActionText: {
    color: affairGoTheme.colors.accentSoft,
    fontWeight: '700',
  },
  deleteText: {
    color: affairGoTheme.colors.danger,
  },
});

export default TravelPlannerScreen;
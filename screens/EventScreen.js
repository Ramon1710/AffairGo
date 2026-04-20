import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, FormField, GlassCard, ScreenHeader, ToggleChip } from '../components/AffairGoUI';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { RADIUS_OPTIONS } from '../data/mockData';
import { useNavigation } from '../naviagtion/SimpleNavigation';

const EventScreen = () => {
  const navigation = useNavigation();
  const { events, registerForEvent, createEvent, currentRadius, setCurrentRadius } = useAffairGo();
  const [form, setForm] = useState({ title: '', date: '', time: '', address: '', description: '', maxParticipants: '20', verifiedOnly: true });

  const visibleEvents = events.filter((event) => event.distanceKm <= currentRadius);

  return (
    <AppBackground>
      <ScreenHeader
        title="Veranstaltungen in der Naehe"
        subtitle="Events, Partys und Community"
        leftAction={<Pressable onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={28} color={affairGoTheme.colors.text} /></Pressable>}
      />

      <View style={styles.filterWrap}>
        {RADIUS_OPTIONS.map((radius) => (
          <View key={radius} style={styles.filterItem}>
            <ToggleChip label={`${radius} km`} active={currentRadius === radius} onPress={() => setCurrentRadius(radius)} />
          </View>
        ))}
      </View>

      {visibleEvents.map((event) => (
        <GlassCard key={event.id} strong style={styles.card}>
          <View style={styles.eventImage}>
            <Ionicons name="images-outline" size={34} color={affairGoTheme.colors.text} />
            <Text style={styles.eventImageLabel}>{event.imageLabel || 'Eventbild'}</Text>
          </View>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.meta}>{event.date}, {event.time}</Text>
          <Text style={styles.meta}>{event.address}</Text>
          <Text style={styles.meta}>{event.distanceKm} km von dir entfernt</Text>
          <Text style={styles.meta}>{event.participants.total} Anmeldungen ({event.participants.women}w, {event.participants.men}m, {event.participants.divers}div.)</Text>
          <Text style={styles.meta}>Maximal {event.maxParticipants} Anmeldungen</Text>
          <Text style={styles.meta}>{event.verifiedOnly ? 'Nur verifizierte Teilnehmer sichtbar' : 'Anmeldung anonym auch ohne Verifizierung moeglich'}</Text>
          <Text style={styles.copy}>{event.description}</Text>
          <AccentButton label="Anmelden" onPress={() => registerForEvent(event.id)} style={styles.button} />
        </GlassCard>
      ))}

      <GlassCard style={styles.card}>
        <Text style={styles.title}>Eigenes Event erstellen</Text>
        <FormField label="Titel" value={form.title} onChangeText={(value) => setForm((previous) => ({ ...previous, title: value }))} placeholder="Private Swingerparty" />
        <View style={styles.row}>
          <View style={styles.half}><FormField label="Datum" value={form.date} onChangeText={(value) => setForm((previous) => ({ ...previous, date: value }))} placeholder="TT.MM.JJJJ" /></View>
          <View style={styles.half}><FormField label="Uhrzeit" value={form.time} onChangeText={(value) => setForm((previous) => ({ ...previous, time: value }))} placeholder="21:00" /></View>
        </View>
        <FormField label="Adresse" value={form.address} onChangeText={(value) => setForm((previous) => ({ ...previous, address: value }))} placeholder="PLZ, Ort, Strasse, Hausnummer" />
        <FormField label="Beschreibung" value={form.description} onChangeText={(value) => setForm((previous) => ({ ...previous, description: value }))} placeholder="Beschreibung" multiline />
        <FormField label="Max Teilnehmer" value={form.maxParticipants} onChangeText={(value) => setForm((previous) => ({ ...previous, maxParticipants: value }))} placeholder="20" />
        <ToggleChip label="Nur fuer verifizierte Teilnehmer" active={form.verifiedOnly} onPress={() => setForm((previous) => ({ ...previous, verifiedOnly: !previous.verifiedOnly }))} />
        <AccentButton label="Event erstellen" onPress={() => createEvent(form)} />
      </GlassCard>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  filterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  filterItem: {
    marginRight: 8,
    marginBottom: 8,
  },
  card: {
    marginBottom: 14,
  },
  eventImage: {
    height: 160,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: affairGoTheme.colors.line,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  eventImageLabel: {
    color: affairGoTheme.colors.textMuted,
    marginTop: 10,
    fontSize: 13,
  },
  title: {
    color: affairGoTheme.colors.accent,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  meta: {
    color: affairGoTheme.colors.text,
    lineHeight: 24,
  },
  copy: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 22,
    marginTop: 8,
  },
  button: {
    marginTop: 14,
  },
  row: {
    flexDirection: 'row',
    marginHorizontal: -6,
  },
  half: {
    flex: 1,
    marginHorizontal: 6,
  },
});

export default EventScreen;

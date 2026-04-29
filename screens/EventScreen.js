import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, EmptyState, FormField, GlassCard, InfoBanner, ScreenHeader, StatusPill, ToggleChip } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { EMPTY_STATE_COPY, RADIUS_OPTIONS } from '../data/mockData';
import { useNavigation } from '../naviagtion/SimpleNavigation';

const EMPTY_EVENT_FORM = {
  title: '',
  date: '',
  time: '',
  address: '',
  description: '',
  maxParticipants: '20',
  verifiedOnly: true,
  imageUri: '',
};

const EventScreen = () => {
  const navigation = useNavigation();
  const { events, registerForEvent, createEvent, currentRadius, setCurrentRadius, currentUser } = useAffairGo();
  const [form, setForm] = useState(EMPTY_EVENT_FORM);
  const canJoinEvents = currentUser.verified && currentUser.searchActive;

  const travelCities = useMemo(() => Array.from(new Set([
    currentUser.city,
    ...(currentUser.travelPlans?.business || []).map((trip) => trip.city),
    ...(currentUser.travelPlans?.vacation || []).map((trip) => trip.city),
  ].filter(Boolean).map((entry) => entry.trim().toLowerCase()))), [currentUser.city, currentUser.travelPlans?.business, currentUser.travelPlans?.vacation]);

  const visibleEvents = useMemo(() => events
    .filter((event) => event.distanceKm <= currentRadius)
    .map((event) => ({
      ...event,
      matchesTravelPlan: travelCities.some((city) => event.address?.toLowerCase().includes(city)),
    }))
    .sort((left, right) => {
      if (left.matchesTravelPlan !== right.matchesTravelPlan) {
        return left.matchesTravelPlan ? -1 : 1;
      }

      return left.distanceKm - right.distanceKm;
    }), [currentRadius, events, travelCities]);

  const applyTravelCityToAddress = (city) => {
    setForm((previous) => ({
      ...previous,
      address: previous.address ? `${previous.address}, ${city}` : city,
    }));
  };

  const handleCreateEvent = async () => {
    try {
      const nextEvent = await createEvent(form);
      setForm(EMPTY_EVENT_FORM);
      Alert.alert(
        'Event erstellt',
        nextEvent.travelReferenceCity
          ? `Dein Event wurde erstellt und mit deiner Reise nach ${nextEvent.travelReferenceCity} verknüpft.`
          : 'Dein Event wurde erstellt.'
      );
    } catch (error) {
      Alert.alert('Event konnte nicht erstellt werden', error.message || 'Bitte prüfe deine Eingaben.');
    }
  };

  const handlePickEventImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Kein Zugriff', 'Bitte erlaube den Zugriff auf deine Mediathek, damit du ein Event-Bild auswählen kannst.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      setForm((previous) => ({ ...previous, imageUri: result.assets[0].uri }));
    } catch (error) {
      Alert.alert('Bild konnte nicht geladen werden', error.message || 'Bitte versuche es erneut.');
    }
  };

  const clearEventImage = () => {
    setForm((previous) => ({ ...previous, imageUri: '' }));
  };

  const handleRegisterForEvent = async (eventId) => {
    try {
      const joined = await registerForEvent(eventId);
      Alert.alert('Gespeichert', joined ? 'Deine Teilnahme wurde aktualisiert.' : 'Du bist bereits für dieses Event angemeldet.');
    } catch (error) {
      Alert.alert('Teilnahme nicht möglich', error.message || 'Du kannst dich aktuell nicht für dieses Event anmelden.');
    }
  };

  const getAnonymousAttendeeLabel = (attendeeId, index) => {
    if (attendeeId === currentUser.id) {
      return `Teilnehmer ${index + 1} • Du`;
    }

    return `Teilnehmer ${index + 1} • anonym`; 
  };

  return (
    <AppBackground>
      <ScreenHeader
        title="Veranstaltungen in der Nähe"
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

      {!canJoinEvents ? <InfoBanner title="Teilnahme gesperrt" detail="Für jede Event-Teilnahme musst du verifiziert sein und deine Suche aktiv geschaltet haben." tone="warning" style={styles.card} /> : null}

      {visibleEvents.length ? visibleEvents.map((event) => (
        <GlassCard key={event.id} strong style={styles.card}>
          <View style={styles.eventImage}>
            {event.imageUri ? (
              <Image source={{ uri: event.imageUri }} style={styles.eventImageAsset} resizeMode="cover" />
            ) : (
              <View style={styles.eventImageFallback}>
                <Ionicons name="images-outline" size={34} color={affairGoTheme.colors.text} />
                <Text style={styles.eventImageLabel}>{event.imageLabel || 'Eventbild'}</Text>
              </View>
            )}
          </View>
          <Text style={styles.title}>{event.title}</Text>
          {event.category ? <StatusPill label={event.category} tone="info" style={styles.categoryPill} /> : null}
          <Text style={styles.meta}>{event.date}, {event.time}</Text>
          <Text style={styles.meta}>{event.address}</Text>
          <Text style={styles.meta}>{event.distanceKm} km von dir entfernt</Text>
          {event.matchesTravelPlan ? <Text style={styles.travelHint}>Passend zu deiner Reiseplanung</Text> : null}
          <Text style={styles.meta}>{event.participants.total} Anmeldungen ({event.participants.women}w, {event.participants.men}m, {event.participants.divers}div.)</Text>
          <Text style={styles.meta}>Maximal {event.maxParticipants} Anmeldungen</Text>
          <Text style={styles.meta}>{event.verifiedOnly ? 'Nur verifizierte Teilnehmer sichtbar' : 'Teilnahme nur mit Verifizierung und aktiver Suche'}</Text>
          <Text style={styles.copy}>{event.description}</Text>
          <AccentButton label="Anmelden" onPress={() => handleRegisterForEvent(event.id)} disabled={!canJoinEvents} style={styles.button} />
          {event.organizerId === currentUser.id ? (
            <View style={styles.organizerBox}>
              <Text style={styles.organizerTitle}>Anmeldungen anonymisiert</Text>
              {(event.attendeeIds || []).map((attendeeId, index) => (
                <Text key={attendeeId} style={styles.organizerEntry}>{getAnonymousAttendeeLabel(attendeeId, index)}</Text>
              ))}
            </View>
          ) : null}
        </GlassCard>
      )) : <EmptyState title={EMPTY_STATE_COPY.events.title} detail={EMPTY_STATE_COPY.events.detail} />}

      <GlassCard style={styles.card}>
        <Text style={styles.title}>Eigenes Event erstellen</Text>
        {currentUser.membership === 'basic' ? (
          <>
            <Text style={styles.copy}>Basic kann Events ansehen und beitreten. Eigene Events sind ab Premium verfügbar.</Text>
            <AccentButton label="Premium aktivieren" onPress={() => navigation.navigate('Landing')} />
          </>
        ) : (
          <>
            <FormField label="Titel" value={form.title} onChangeText={(value) => setForm((previous) => ({ ...previous, title: value }))} placeholder="Private Swingerparty" />
            <View style={styles.row}>
              <View style={styles.half}><FormField label="Datum" value={form.date} onChangeText={(value) => setForm((previous) => ({ ...previous, date: value }))} placeholder="TT.MM.JJJJ" /></View>
              <View style={styles.half}><FormField label="Uhrzeit" value={form.time} onChangeText={(value) => setForm((previous) => ({ ...previous, time: value }))} placeholder="21:00" /></View>
            </View>
            <FormField label="Adresse" value={form.address} onChangeText={(value) => setForm((previous) => ({ ...previous, address: value }))} placeholder="PLZ, Ort, Straße, Hausnummer" />
            {travelCities.length ? (
              <View style={styles.travelChipWrap}>
                {travelCities.map((city) => (
                  <View key={city} style={styles.filterItem}>
                    <ToggleChip label={`Reiseort ${city}`} active={form.address.toLowerCase().includes(city)} onPress={() => applyTravelCityToAddress(city)} />
                  </View>
                ))}
              </View>
            ) : null}
            <FormField label="Beschreibung" value={form.description} onChangeText={(value) => setForm((previous) => ({ ...previous, description: value }))} placeholder="Beschreibung" multiline />
            <FormField label="Max Teilnehmer" value={form.maxParticipants} onChangeText={(value) => setForm((previous) => ({ ...previous, maxParticipants: value }))} placeholder="20" />
            <View style={styles.imagePickerWrap}>
              <Text style={styles.imagePickerLabel}>Event-Bild</Text>
              {form.imageUri ? (
                <View style={styles.imagePreviewWrap}>
                  <Image source={{ uri: form.imageUri }} style={styles.imagePreview} resizeMode="cover" />
                  <View style={styles.imageActionRow}>
                    <AccentButton label="Anderes Bild wählen" onPress={handlePickEventImage} style={styles.imageActionButton} />
                    <Pressable onPress={clearEventImage} style={styles.clearImageButton}>
                      <Text style={styles.clearImageText}>Bild entfernen</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.copy}>Wähle ein echtes Bild aus deiner Mediathek, damit dein Event nicht nur mit einem Platzhalter angezeigt wird.</Text>
                  <AccentButton label="Event-Bild auswählen" onPress={handlePickEventImage} style={styles.button} />
                </>
              )}
            </View>
            <ToggleChip label="Nur für verifizierte Teilnehmer" active={form.verifiedOnly} onPress={() => setForm((previous) => ({ ...previous, verifiedOnly: !previous.verifiedOnly }))} />
            {form.verifiedOnly && (!currentUser.verified || !currentUser.searchActive) ? (
              <Text style={styles.lockHint}>Verifizierte Events kannst du erst mit geprüftem Profil und aktiver Suche anlegen.</Text>
            ) : null}
            <AccentButton label="Event erstellen" onPress={handleCreateEvent} />
          </>
        )}
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
  travelChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  card: {
    marginBottom: 14,
  },
  categoryPill: {
    marginBottom: 10,
  },
  eventImage: {
    height: 160,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: affairGoTheme.colors.line,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginBottom: 14,
  },
  eventImageAsset: {
    width: '100%',
    height: '100%',
  },
  eventImageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  travelHint: {
    color: affairGoTheme.colors.success,
    lineHeight: 24,
    fontWeight: '700',
  },
  lockHint: {
    color: affairGoTheme.colors.warning,
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 12,
  },
  copy: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 22,
    marginTop: 8,
  },
  button: {
    marginTop: 14,
  },
  imagePickerWrap: {
    marginBottom: 14,
  },
  imagePickerLabel: {
    color: affairGoTheme.colors.text,
    fontWeight: '700',
    marginBottom: 8,
  },
  imagePreviewWrap: {
    marginTop: 4,
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: affairGoTheme.colors.line,
    marginTop: 8,
  },
  imageActionRow: {
    marginTop: 10,
  },
  imageActionButton: {
    marginTop: 0,
  },
  clearImageButton: {
    paddingVertical: 10,
  },
  clearImageText: {
    color: affairGoTheme.colors.textMuted,
    textAlign: 'center',
  },
  organizerBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: affairGoTheme.colors.line,
  },
  organizerTitle: {
    color: affairGoTheme.colors.text,
    fontWeight: '700',
    marginBottom: 8,
  },
  organizerEntry: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 22,
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

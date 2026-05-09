import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AccentButton, AppBackground, EmptyState, FormField, GlassCard, InfoBanner, InlineStat, ScreenHeader, StatusPill, ToggleChip } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { EMPTY_STATE_COPY, RADIUS_OPTIONS } from '../data/mockData';
import { useNavigation } from '../naviagtion/SimpleNavigation';

const EVENT_CATEGORY_OPTIONS = ['Private Party', 'Afterwork', 'Reise Meetup', 'Hotelbar', 'Club Night'];
const EVENT_FILTER_OPTIONS = ['Alle', 'Verifiziert', 'Meine', 'Reisebezug'];

const getParticipantBreakdownLabel = (participants = {}) => {
  const women = Number(participants.women || 0);
  const men = Number(participants.men || 0);
  const divers = Number(participants.divers || 0);
  return `${women}w, ${men}m, ${divers}div.`;
};

const EMPTY_EVENT_FORM = {
  title: '',
  category: 'Private Party',
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
  const { width } = useWindowDimensions();
  const { events, registerForEvent, createEvent, currentRadius, setCurrentRadius, currentUser } = useAffairGo();
  const [form, setForm] = useState(EMPTY_EVENT_FORM);
  const [activeFilter, setActiveFilter] = useState('Alle');
  const canJoinEvents = currentUser.verified && currentUser.searchActive;
  const canCreateEvents = true;
  const isTwoColumnLayout = Platform.OS === 'web' && width >= 1100;

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
      isHostedByMe: event.organizerId === currentUser.id,
      isJoined: (event.attendeeIds || []).includes(currentUser.id),
      remainingSeats: Math.max(0, Number(event.maxParticipants || 0) - Number(event.participants?.total || 0)),
    }))
    .filter((event) => {
      if (activeFilter === 'Verifiziert') {
        return event.verifiedOnly;
      }

      if (activeFilter === 'Meine') {
        return event.isHostedByMe;
      }

      if (activeFilter === 'Reisebezug') {
        return event.matchesTravelPlan;
      }

      return true;
    })
    .sort((left, right) => {
      if (left.isHostedByMe !== right.isHostedByMe) {
        return left.isHostedByMe ? -1 : 1;
      }

      if (left.matchesTravelPlan !== right.matchesTravelPlan) {
        return left.matchesTravelPlan ? -1 : 1;
      }

      return left.distanceKm - right.distanceKm;
    }), [activeFilter, currentRadius, currentUser.id, events, travelCities]);

  const eventStats = useMemo(() => ({
    visible: visibleEvents.length,
    hosted: events.filter((event) => event.organizerId === currentUser.id).length,
    travelFit: visibleEvents.filter((event) => event.matchesTravelPlan).length,
    verified: visibleEvents.filter((event) => event.verifiedOnly).length,
  }), [currentUser.id, events, visibleEvents]);

  const applyTravelCityToAddress = (city) => {
    setForm((previous) => ({
      ...previous,
      address: previous.address ? `${previous.address}, ${city}` : city,
    }));
  };

  const handleCreateEvent = async () => {
    if (!form.title.trim() || !form.date.trim() || !form.time.trim() || !form.address.trim() || !form.description.trim()) {
      Alert.alert('Unvollständig', 'Bitte fülle Titel, Kategorie, Datum, Uhrzeit, Adresse und Beschreibung aus.');
      return;
    }

    const maxParticipants = Number.parseInt(String(form.maxParticipants).replace(/\D/g, ''), 10);

    if (!Number.isFinite(maxParticipants) || maxParticipants < 2) {
      Alert.alert('Teilnehmerzahl ungültig', 'Bitte gib mindestens 2 Teilnehmer an.');
      return;
    }

    try {
      const nextEvent = await createEvent({ ...form, maxParticipants });
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

  const eventFeed = (
    <>
      <GlassCard strong style={styles.summaryCard}>
        <Text style={styles.summaryEyebrow}>Event Hub</Text>
        <Text style={styles.summaryTitle}>Finde passende Events im Radius oder hoste dein eigenes Format.</Text>
        <View style={styles.statsRow}>
          <InlineStat label="Sichtbar" value={String(eventStats.visible)} accent={affairGoTheme.colors.accent} />
          <InlineStat label="Meine" value={String(eventStats.hosted)} accent={affairGoTheme.colors.accentSoft} />
          <InlineStat label="Reisefit" value={String(eventStats.travelFit)} accent={affairGoTheme.colors.success} />
          <InlineStat label="Verifiziert" value={String(eventStats.verified)} accent={affairGoTheme.colors.warning} />
        </View>
        <Text style={styles.summaryCopy}>Events mit Reisebezug und eigene Formate werden zuerst priorisiert. Volle Events nehmen keine weiteren Anmeldungen mehr an.</Text>
      </GlassCard>

      <View style={styles.filterWrap}>
        {RADIUS_OPTIONS.map((radius) => (
          <View key={radius} style={styles.filterItem}>
            <ToggleChip label={`${radius} km`} active={currentRadius === radius} onPress={() => setCurrentRadius(radius)} />
          </View>
        ))}
      </View>

      <View style={styles.filterWrap}>
        {EVENT_FILTER_OPTIONS.map((filter) => (
          <View key={filter} style={styles.filterItem}>
            <ToggleChip label={filter} active={activeFilter === filter} onPress={() => setActiveFilter(filter)} />
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
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.title}>{event.title}</Text>
              <Text style={styles.meta}>{event.date}, {event.time}</Text>
            </View>
            {event.category ? <StatusPill label={event.category} tone="info" style={styles.categoryPill} /> : null}
          </View>
          <Text style={styles.meta}>{event.address}</Text>
          <View style={styles.eventInfoGrid}>
            <Text style={styles.meta}>{event.distanceKm} km von dir entfernt</Text>
            <Text style={styles.meta}>{event.participants.total} / {event.maxParticipants} Plätze belegt</Text>
            <Text style={styles.meta}>Verteilung: {getParticipantBreakdownLabel(event.participants)}</Text>
            <Text style={styles.meta}>{event.verifiedOnly ? 'Nur verifizierte Teilnehmer sichtbar' : 'Offen für aktive, verifizierte Suche'}</Text>
            <Text style={[styles.meta, event.remainingSeats === 0 ? styles.warnText : null]}>
              {event.remainingSeats === 0 ? 'Ausgebucht' : `${event.remainingSeats} Plätze frei`}
            </Text>
          </View>
          {event.matchesTravelPlan ? <Text style={styles.travelHint}>Passend zu deiner Reiseplanung</Text> : null}
          {event.travelReferenceCity ? <Text style={styles.travelMeta}>Travel-Link: {event.travelReferenceCity}</Text> : null}
          <Text style={styles.copy}>{event.description}</Text>
          <AccentButton
            label={event.isJoined ? 'Bereits angemeldet' : event.remainingSeats === 0 ? 'Event voll' : 'Anmelden'}
            onPress={() => handleRegisterForEvent(event.id)}
            disabled={!canJoinEvents || event.isJoined || event.remainingSeats === 0}
            style={styles.button}
          />
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
    </>
  );

  const creationPanel = (
    <GlassCard style={styles.card}>
      <Text style={styles.title}>Eigenes Event erstellen</Text>
      <Text style={styles.copy}>Lege private Partys, Afterworks oder Reise-Meetups mit echter Kapazität und Bild an.</Text>
      <>
          <FormField label="Titel" value={form.title} onChangeText={(value) => setForm((previous) => ({ ...previous, title: value }))} placeholder="Private Swingerparty" />
          <Text style={styles.sectionLabel}>Kategorie</Text>
          <View style={styles.travelChipWrap}>
            {EVENT_CATEGORY_OPTIONS.map((category) => (
              <View key={category} style={styles.filterItem}>
                <ToggleChip label={category} active={form.category === category} onPress={() => setForm((previous) => ({ ...previous, category }))} />
              </View>
            ))}
          </View>
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
          <FormField label="Max Teilnehmer" value={form.maxParticipants} onChangeText={(value) => setForm((previous) => ({ ...previous, maxParticipants: value.replace(/\D/g, '') }))} placeholder="20" />
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
    </GlassCard>
  );

  return (
    <AppBackground>
      <ScreenHeader
        title="Veranstaltungen in der Nähe"
        subtitle="Events, Partys und Community"
        leftAction={<Pressable onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={28} color={affairGoTheme.colors.text} /></Pressable>}
      />
      {isTwoColumnLayout ? (
        <View style={styles.webLayout}>
          <View style={styles.primaryColumn}>{eventFeed}</View>
          <View style={styles.secondaryColumn}>{creationPanel}</View>
        </View>
      ) : (
        <>
          {eventFeed}
          {creationPanel}
        </>
      )}
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  webLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  primaryColumn: {
    flex: 1.25,
    marginRight: Platform.OS === 'web' ? 16 : 0,
  },
  secondaryColumn: {
    flex: 0.85,
    position: Platform.OS === 'web' ? 'sticky' : 'relative',
    top: 24,
    alignSelf: 'flex-start',
  },
  summaryCard: {
    marginBottom: 14,
  },
  summaryEyebrow: {
    color: affairGoTheme.colors.accentSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  summaryTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
    marginBottom: 12,
  },
  summaryCopy: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 22,
    marginTop: 12,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
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
    marginLeft: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardHeaderCopy: {
    flex: 1,
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
  eventInfoGrid: {
    marginTop: 4,
    marginBottom: 4,
  },
  travelHint: {
    color: affairGoTheme.colors.success,
    lineHeight: 24,
    fontWeight: '700',
  },
  travelMeta: {
    color: affairGoTheme.colors.accentSoft,
    lineHeight: 22,
  },
  warnText: {
    color: affairGoTheme.colors.warning,
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
  sectionLabel: {
    color: affairGoTheme.colors.text,
    fontWeight: '700',
    marginBottom: 8,
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

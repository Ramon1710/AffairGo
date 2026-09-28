import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AccentButton, AppBackground, EmptyState, FormField, GlassCard, InfoBanner, ScreenHeader, StatusPill, ToggleChip } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme } from '../constants/affairGoTheme';
import { cancelDate, createDate, listDates, toggleDateInterest, updateDate } from '../constants/dateProvider';
import { useAffairGo } from '../context/AffairGoContext';
import { db } from '../firebase';
import { useNavigation, useRoute } from '../naviagtion/SimpleNavigation';
import { isPresenceFresh } from '../untils/matching';

const { normalizeCommunityRoom } = require('../untils/communityChat');

const SEGMENTS = ['matches', 'dates', 'events'];
const MATCH_FILTERS = ['all', 'online'];
const EMPTY_DATE_FORM = {
  title: '',
  description: '',
  dateValue: '',
  timeValue: '',
  regionLabel: '',
  category: '',
  visibility: 'community',
};

const parseEventDateTimeMs = (event = {}) => {
  const dateLabel = String(event.date || '').trim();
  if (!dateLabel) {
    return Number.MAX_SAFE_INTEGER;
  }

  const parts = dateLabel.split('.').map((entry) => Number(entry));
  if (parts.length !== 3 || parts.some((entry) => !Number.isFinite(entry))) {
    return Number.MAX_SAFE_INTEGER;
  }

  const timeParts = String(event.time || '00:00').split(':').map((entry) => Number(entry));
  const hours = Number.isFinite(timeParts[0]) ? timeParts[0] : 0;
  const minutes = Number.isFinite(timeParts[1]) ? timeParts[1] : 0;
  return new Date(parts[2], parts[1] - 1, parts[0], hours, minutes).getTime();
};

const formatDateCardLabel = (scheduledAtMs) => {
  if (!Number.isFinite(Number(scheduledAtMs))) {
    return 'Termin offen';
  }

  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(scheduledAtMs));
};

const buildScheduledAtPayload = (dateValue, timeValue) => {
  if (!dateValue || !timeValue) {
    return null;
  }

  const scheduledAt = new Date(`${dateValue}T${timeValue}:00`);
  if (Number.isNaN(scheduledAt.getTime())) {
    return null;
  }

  return scheduledAt.toISOString();
};

const ExploreScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { width } = useWindowDimensions();
  const {
    currentRadius,
    currentUser,
    events,
    matchedProfiles,
    reportUser,
    softBlock,
    users,
    visibleProfiles,
  } = useAffairGo();
  const [segment, setSegment] = useState('matches');
  const [matchFilter, setMatchFilter] = useState('all');
  const [datesState, setDatesState] = useState({ loading: true, error: '', items: [] });
  const [isDateModalVisible, setIsDateModalVisible] = useState(false);
  const [dateForm, setDateForm] = useState(EMPTY_DATE_FORM);
  const [editingDateId, setEditingDateId] = useState('');
  const [submittingDate, setSubmittingDate] = useState(false);
  const [selectedDateId, setSelectedDateId] = useState('');
  const [interestMap, setInterestMap] = useState({});
  const [eventRooms, setEventRooms] = useState([]);
  const scrollRef = useRef(null);
  const selectedDate = datesState.items.find((entry) => entry.id === selectedDateId) || null;
  const isDesktop = Platform.OS === 'web' && width >= 980;
  const isCompactLayout = width < 420;

  useEffect(() => {
    if (SEGMENTS.includes(route.params?.segment)) {
      setSegment(route.params.segment);
    }

    if (MATCH_FILTERS.includes(route.params?.filter)) {
      setMatchFilter(route.params.filter);
    }
  }, [route.params?.filter, route.params?.segment]);

  useEffect(() => {
    const roomsQuery = query(collection(db, 'communityRooms'), where('active', '==', true));
    const unsubscribe = onSnapshot(roomsQuery, (snapshot) => {
      setEventRooms(snapshot.docs
        .map((roomDoc) => normalizeCommunityRoom({ id: roomDoc.id, ...roomDoc.data() }, roomDoc.id))
        .filter((room) => room.type === 'EVENT' && room.eventId));
    }, () => {
      setEventRooms([]);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const refreshDates = async ({ keepLoadingState = false } = {}) => {
    if (!keepLoadingState) {
      setDatesState((previous) => ({ ...previous, loading: true, error: '' }));
    }

    try {
      const result = await listDates();
      setDatesState({ loading: false, error: '', items: Array.isArray(result?.dates) ? result.dates : [] });
    } catch (error) {
      setDatesState({ loading: false, error: error.message || 'Dates konnten nicht geladen werden.', items: [] });
    }
  };

  useEffect(() => {
    refreshDates();
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo?.({ y: 0, animated: false });
    });
  }, [matchFilter, segment]);

  const userMap = useMemo(() => new Map(users.map((entry) => [entry.id, entry])), [users]);
  const filteredMatches = useMemo(() => visibleProfiles.filter((profile) => (
    matchFilter === 'online' ? profile.online : true
  )), [matchFilter, visibleProfiles]);
  const eventRoomMap = useMemo(() => Object.fromEntries(eventRooms.map((room) => [room.eventId, room])), [eventRooms]);
  const upcomingEvents = useMemo(() => events
    .map((event) => ({
      ...event,
      startsAtMs: parseEventDateTimeMs(event),
    }))
    .filter((event) => event.active !== false)
    .filter((event) => event.startsAtMs === Number.MAX_SAFE_INTEGER || event.startsAtMs >= Date.now())
    .sort((left, right) => {
      if (left.startsAtMs !== right.startsAtMs) {
        return left.startsAtMs - right.startsAtMs;
      }

      return Number(left.distanceKm || 0) - Number(right.distanceKm || 0);
    }), [events]);
  const nearbyDates = useMemo(() => datesState.items
    .map((entry) => {
      const creatorProfile = userMap.get(entry.creatorId) || null;
      const creatorDistanceKm = Number(creatorProfile?.distanceKm);
      return {
        ...entry,
        creatorProfile,
        creatorDistanceKm: Number.isFinite(creatorDistanceKm) ? creatorDistanceKm : null,
        creatorOnline: Boolean(creatorProfile?.online) && isPresenceFresh(creatorProfile?.lastLiveSyncAt),
      };
    })
    .filter((entry) => entry.creatorDistanceKm == null || entry.creatorDistanceKm <= currentRadius)
    .sort((left, right) => Number(left.scheduledAtMs || 0) - Number(right.scheduledAtMs || 0)), [currentRadius, datesState.items, userMap]);

  const openDateCreate = () => {
    setEditingDateId('');
    setDateForm(EMPTY_DATE_FORM);
    setIsDateModalVisible(true);
  };

  const openDateEdit = (dateEntry) => {
    const scheduledAtDate = Number.isFinite(Number(dateEntry?.scheduledAtMs)) ? new Date(dateEntry.scheduledAtMs) : null;
    const localDate = scheduledAtDate ? scheduledAtDate.toISOString().slice(0, 10) : '';
    const localTime = scheduledAtDate ? scheduledAtDate.toTimeString().slice(0, 5) : '';
    setEditingDateId(dateEntry.id);
    setDateForm({
      title: dateEntry.title || '',
      description: dateEntry.description || '',
      dateValue: localDate,
      timeValue: localTime,
      regionLabel: dateEntry.regionLabel || '',
      category: dateEntry.category || '',
      visibility: dateEntry.visibility || 'community',
    });
    setIsDateModalVisible(true);
  };

  const submitDateForm = async () => {
    const scheduledAt = buildScheduledAtPayload(dateForm.dateValue, dateForm.timeValue);
    if (!scheduledAt) {
      Alert.alert('Ungültiger Termin', 'Bitte gib ein gültiges Datum und eine Uhrzeit an.');
      return;
    }

    try {
      setSubmittingDate(true);
      const payload = {
        title: dateForm.title,
        description: dateForm.description,
        scheduledAt,
        regionLabel: dateForm.regionLabel,
        category: dateForm.category,
        visibility: dateForm.visibility,
      };

      if (editingDateId) {
        await updateDate({ dateId: editingDateId, ...payload });
      } else {
        await createDate(payload);
      }

      setIsDateModalVisible(false);
      setEditingDateId('');
      setDateForm(EMPTY_DATE_FORM);
      await refreshDates({ keepLoadingState: true });
    } catch (error) {
      Alert.alert('Date konnte nicht gespeichert werden', error.message || 'Bitte prüfe deine Eingaben.');
    } finally {
      setSubmittingDate(false);
    }
  };

  const handleCancelDate = async (dateId) => {
    try {
      await cancelDate({ dateId });
      setSelectedDateId('');
      await refreshDates({ keepLoadingState: true });
    } catch (error) {
      Alert.alert('Date konnte nicht abgesagt werden', error.message || 'Bitte versuche es erneut.');
    }
  };

  const handleToggleInterest = async (dateId) => {
    const nextInterested = interestMap[dateId] !== true;

    try {
      const result = await toggleDateInterest({ dateId, interested: nextInterested });
      setInterestMap((previous) => ({ ...previous, [dateId]: result.interested === true }));
      await refreshDates({ keepLoadingState: true });
    } catch (error) {
      Alert.alert('Interesse konnte nicht aktualisiert werden', error.message || 'Bitte versuche es erneut.');
    }
  };

  const handleReportDateOwner = async (dateEntry) => {
    try {
      await reportUser({
        targetUserId: dateEntry.creatorId,
        reason: 'date_report',
        description: `Date gemeldet: ${dateEntry.title}`,
      });
      Alert.alert('Meldung gespeichert', 'Der Eintrag wurde für die Moderation vorgemerkt.');
    } catch (error) {
      Alert.alert('Melden nicht möglich', error.message || 'Bitte versuche es erneut.');
    }
  };

  const handleBlockDateOwner = async (dateEntry) => {
    try {
      await softBlock(dateEntry.creatorId, 'date_block');
      setSelectedDateId('');
      await refreshDates({ keepLoadingState: true });
    } catch (error) {
      Alert.alert('Blockieren nicht möglich', error.message || 'Bitte versuche es erneut.');
    }
  };

  const renderMatches = () => {
    if (!filteredMatches.length) {
      return (
        <EmptyState
          title={matchFilter === 'online' ? 'Keine Online-Matches im Radius' : 'Keine Matches im Radius'}
          detail="Passe deinen Radius oder deine Sichtbarkeit an, damit wieder passende Profile auftauchen."
          action={<AccentButton label="Matching Map öffnen" variant="secondary" onPress={() => navigation.navigate('MatchingMap')} />}
        />
      );
    }

    return (
      <View style={styles.grid}>
        {filteredMatches.map((profile) => (
          <Pressable key={profile.id} style={[styles.gridItem, isDesktop ? styles.gridItemDesktop : null]} onPress={() => navigation.navigate('Profil', { profileId: profile.id })}>
            <GlassCard strong style={styles.card}>
              <View style={styles.profileRow}>
                <View style={styles.avatarShell}>
                  {profile.profilePhotoUrl || profile.profileImageUri ? (
                    <Image source={{ uri: profile.profilePhotoUrl || profile.profileImageUri }} style={styles.avatarImage} resizeMode="cover" />
                  ) : (
                    <Ionicons name="person" size={34} color={affairGoTheme.colors.text} />
                  )}
                </View>
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle}>{profile.nickname}</Text>
                  <Text style={styles.cardMeta}>{profile.age} Jahre · {profile.figure} · {Math.round(Number(profile.distanceKm) || 0)} km</Text>
                  <Text style={styles.cardMeta}>{profile.commonPreferenceCount || 0} gemeinsame Vorlieben</Text>
                </View>
                <StatusPill label={profile.online ? 'Online' : 'Aktiv'} tone={profile.online ? 'success' : 'default'} />
              </View>
            </GlassCard>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderDates = () => {
    if (datesState.loading) {
      return (
        <GlassCard strong style={styles.card}>
          <Text style={styles.cardTitle}>Dates werden geladen...</Text>
          <Text style={styles.cardMeta}>Aktive und kommende Verabredungen aus deiner Nähe werden vorbereitet.</Text>
        </GlassCard>
      );
    }

    if (datesState.error) {
      return (
        <EmptyState
          title="Dates konnten nicht geladen werden"
          detail={datesState.error}
          action={<AccentButton label="Erneut laden" variant="secondary" onPress={() => refreshDates()} />}
        />
      );
    }

    if (!nearbyDates.length) {
      return (
        <EmptyState
          title="Noch keine aktiven Dates in deiner Nähe"
          detail="Erstelle das erste Date oder prüfe später erneut, sobald neue Verabredungen veröffentlicht werden."
          action={<AccentButton label="Date erstellen" onPress={openDateCreate} />}
        />
      );
    }

    return (
      <>
        <View style={styles.sectionActionRow}>
          <Text style={styles.sectionHint}>Nur aktive und zukünftige Dates werden hier angezeigt.</Text>
          <AccentButton label="Date erstellen" onPress={openDateCreate} />
        </View>
        <View style={styles.grid}>
          {nearbyDates.map((dateEntry) => {
            const isOwnDate = dateEntry.creatorId === currentUser.id;
            const creatorName = dateEntry.creatorProfile?.nickname || dateEntry.creatorNickname || 'Night-Whisper Mitglied';
            const isInterested = interestMap[dateEntry.id] === true;
            const knownOnlineMatch = matchedProfiles.some((profile) => profile.id === dateEntry.creatorId);
            return (
              <Pressable key={dateEntry.id} style={[styles.gridItem, isDesktop ? styles.gridItemDesktop : null]} onPress={() => setSelectedDateId(dateEntry.id)}>
                <GlassCard strong style={styles.card}>
                  <View style={styles.metricRow}>
                    <StatusPill label={isOwnDate ? 'Dein Date' : dateEntry.creatorOnline ? 'Online' : knownOnlineMatch ? 'Match' : 'Date'} tone={isOwnDate ? 'info' : dateEntry.creatorOnline ? 'success' : knownOnlineMatch ? 'info' : 'default'} />
                    {dateEntry.category ? <StatusPill label={dateEntry.category} tone="default" /> : null}
                  </View>
                  <Text style={styles.cardTitle}>{dateEntry.title}</Text>
                  <Text style={styles.cardMeta}>{formatDateCardLabel(dateEntry.scheduledAtMs)}</Text>
                  <Text style={styles.cardMeta}>{dateEntry.regionLabel}</Text>
                  <Text style={styles.cardMeta}>Von {creatorName}{dateEntry.creatorDistanceKm != null ? ` · ca. ${Math.round(dateEntry.creatorDistanceKm)} km` : ''}</Text>
                  <Text style={styles.cardBody}>{dateEntry.description}</Text>
                  <Text style={styles.cardMeta}>{dateEntry.interestCount || 0} Interessenbekundungen</Text>
                  {!isOwnDate ? (
                    <AccentButton label={isInterested ? 'Interesse zurückziehen' : 'Interesse bekunden'} variant={isInterested ? 'secondary' : 'primary'} onPress={() => handleToggleInterest(dateEntry.id)} style={styles.inlineButton} />
                  ) : (
                    <AccentButton label="Bearbeiten" variant="secondary" onPress={() => openDateEdit(dateEntry)} style={styles.inlineButton} />
                  )}
                </GlassCard>
              </Pressable>
            );
          })}
        </View>
      </>
    );
  };

  const renderEvents = () => {
    if (!upcomingEvents.length) {
      return (
        <EmptyState
          title="Keine kommenden Events im Feed"
          detail="Sobald neue Partys oder Veranstaltungen aktiv sind, erscheinen sie hier automatisch."
          action={<AccentButton label="Event-Hub öffnen" variant="secondary" onPress={() => navigation.navigate('Event')} />}
        />
      );
    }

    return (
      <View style={styles.grid}>
        {upcomingEvents.map((event) => (
          <Pressable key={event.id} style={[styles.gridItem, isDesktop ? styles.gridItemDesktop : null]} onPress={() => navigation.navigate('Event', { eventId: event.id })}>
            <GlassCard strong style={styles.card}>
              <Text style={styles.cardTitle}>{event.title}</Text>
              <Text style={styles.cardMeta}>{event.date}, {event.time}</Text>
              <Text style={styles.cardMeta}>{event.address}</Text>
              <Text style={styles.cardBody}>{event.description}</Text>
              {event.imageUri ? <Image source={{ uri: event.imageUri }} style={styles.eventImage} resizeMode="cover" /> : null}
              <View style={styles.metricRow}>
                <StatusPill label={event.category || 'Event'} tone="info" />
                {eventRoomMap[event.id]?.id ? <StatusPill label="Event-Room" tone="success" /> : null}
              </View>
              {eventRoomMap[event.id]?.id ? (
                <AccentButton label="Zum Event-Room" variant="secondary" onPress={() => navigation.navigate('CommunityRoom', { roomId: eventRoomMap[event.id].id })} style={styles.inlineButton} />
              ) : null}
            </GlassCard>
          </Pressable>
        ))}
      </View>
    );
  };

  return (
    <AppBackground scrollViewRef={scrollRef}>
      <ScreenHeader title="Kennenlernen" subtitle="Matches, Dates und Events" />

      <GlassCard strong style={styles.segmentCard}>
        <View style={styles.segmentRow}>
          {SEGMENTS.map((entry) => (
            <Pressable key={entry} onPress={() => setSegment(entry)} style={[styles.segmentButton, isCompactLayout ? styles.segmentButtonCompact : null, segment === entry ? styles.segmentButtonActive : null]}>
              <Text style={[styles.segmentButtonLabel, segment === entry ? styles.segmentButtonLabelActive : null]}>
                {entry === 'matches' ? 'Matches' : entry === 'dates' ? 'Dates' : 'Events'}
              </Text>
            </Pressable>
          ))}
        </View>
        {segment === 'matches' ? (
          <View style={styles.filterRow}>
            <View style={styles.filterChipWrap}><ToggleChip label="Alle" active={matchFilter === 'all'} onPress={() => setMatchFilter('all')} /></View>
            <View style={styles.filterChipWrap}><ToggleChip label="Online" active={matchFilter === 'online'} onPress={() => setMatchFilter('online')} /></View>
          </View>
        ) : null}
        {segment === 'events' ? (
          <View style={styles.filterRow}>
            <StatusPill label={`${currentRadius} km Radius`} tone="info" />
            <AccentButton label="Event-Hub" variant="secondary" onPress={() => navigation.navigate('Event')} />
          </View>
        ) : null}
      </GlassCard>

      {segment === 'matches' ? renderMatches() : null}
      {segment === 'dates' ? renderDates() : null}
      {segment === 'events' ? renderEvents() : null}

      <InfoBanner
        title="Datenschutz"
        detail="Dates speichern nur ungefähre Regionen. Interesse erzeugt keinen privaten Chat und umgeht keine bestehenden Berechtigungen."
        tone="warning"
      />

      <Modal transparent visible={isDateModalVisible} animationType="fade" onRequestClose={() => setIsDateModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKeyboardWrap}>
            <GlassCard strong style={styles.modalCard}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>{editingDateId ? 'Date bearbeiten' : 'Date erstellen'}</Text>
                <FormField label="Titel" value={dateForm.title} onChangeText={(value) => setDateForm((previous) => ({ ...previous, title: value }))} />
                <FormField label="Beschreibung" value={dateForm.description} multiline onChangeText={(value) => setDateForm((previous) => ({ ...previous, description: value }))} />
                <FormField label="Datum" value={dateForm.dateValue} onChangeText={(value) => setDateForm((previous) => ({ ...previous, dateValue: value }))} placeholder="2026-10-03" />
                <FormField label="Uhrzeit" value={dateForm.timeValue} onChangeText={(value) => setDateForm((previous) => ({ ...previous, timeValue: value }))} placeholder="20:00" />
                <FormField label="Stadt oder Region" value={dateForm.regionLabel} onChangeText={(value) => setDateForm((previous) => ({ ...previous, regionLabel: value }))} />
                <FormField label="Kategorie" value={dateForm.category} onChangeText={(value) => setDateForm((previous) => ({ ...previous, category: value }))} placeholder="Optional" />
                <View style={styles.filterRow}>
                  <View style={styles.filterChipWrap}><ToggleChip label="Community" active={dateForm.visibility === 'community'} onPress={() => setDateForm((previous) => ({ ...previous, visibility: 'community' }))} /></View>
                  <View style={styles.filterChipWrap}><ToggleChip label="Öffentlich" active={dateForm.visibility === 'public'} onPress={() => setDateForm((previous) => ({ ...previous, visibility: 'public' }))} /></View>
                </View>
                <View style={styles.modalActions}>
                  <AccentButton label="Abbrechen" variant="ghost" onPress={() => setIsDateModalVisible(false)} style={styles.modalAction} />
                  <AccentButton label={submittingDate ? 'Speichert...' : editingDateId ? 'Aktualisieren' : 'Erstellen'} onPress={submitDateForm} style={styles.modalAction} />
                </View>
              </ScrollView>
            </GlassCard>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal transparent visible={Boolean(selectedDate)} animationType="fade" onRequestClose={() => setSelectedDateId('')}>
        <View style={styles.modalBackdrop}>
          <GlassCard strong style={styles.modalCard}>
            {selectedDate ? (
              <>
                <Text style={styles.modalTitle}>{selectedDate.title}</Text>
                <Text style={styles.cardMeta}>{formatDateCardLabel(selectedDate.scheduledAtMs)}</Text>
                <Text style={styles.cardMeta}>{selectedDate.regionLabel}</Text>
                <Text style={styles.cardBody}>{selectedDate.description}</Text>
                <Text style={styles.cardMeta}>Sichtbarkeit: {selectedDate.visibility === 'public' ? 'Öffentlich' : 'Community'}</Text>
                <Text style={styles.cardMeta}>{selectedDate.interestCount || 0} Interessenbekundungen</Text>
                {selectedDate.creatorId === currentUser.id ? (
                  <>
                    <AccentButton label="Date bearbeiten" variant="secondary" onPress={() => { setSelectedDateId(''); openDateEdit(selectedDate); }} style={styles.inlineButton} />
                    <AccentButton label="Date absagen" variant="ghost" onPress={() => handleCancelDate(selectedDate.id)} style={styles.inlineButton} />
                  </>
                ) : (
                  <>
                    <AccentButton label={interestMap[selectedDate.id] ? 'Interesse zurückziehen' : 'Interesse bekunden'} onPress={() => handleToggleInterest(selectedDate.id)} style={styles.inlineButton} />
                    <AccentButton label="Profil melden" variant="secondary" onPress={() => handleReportDateOwner(selectedDate)} style={styles.inlineButton} />
                    <AccentButton label="Nutzer blockieren" variant="ghost" onPress={() => handleBlockDateOwner(selectedDate)} style={styles.inlineButton} />
                  </>
                )}
                <AccentButton label="Schließen" variant="ghost" onPress={() => setSelectedDateId('')} style={styles.inlineButton} />
              </>
            ) : null}
          </GlassCard>
        </View>
      </Modal>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  segmentCard: {
    marginBottom: 16,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentButton: {
    minHeight: 46,
    flexGrow: 1,
    flexBasis: '31%',
    borderRadius: affairGoTheme.radius.pill,
    borderWidth: 1,
    borderColor: affairGoTheme.colors.line,
    backgroundColor: affairGoTheme.colors.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  segmentButtonCompact: {
    flexBasis: '100%',
  },
  segmentButtonActive: {
    backgroundColor: 'rgba(118, 87, 255, 0.18)',
    borderColor: affairGoTheme.colors.accent,
  },
  segmentButtonLabel: {
    color: affairGoTheme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  segmentButtonLabelActive: {
    color: affairGoTheme.colors.text,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  filterChipWrap: {
    flexGrow: 1,
  },
  sectionActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  sectionHint: {
    flex: 1,
    color: affairGoTheme.colors.textMuted,
    lineHeight: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  gridItem: {
    width: '100%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  gridItemDesktop: {
    width: '50%',
  },
  card: {
    minHeight: 180,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarShell: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: affairGoTheme.colors.backgroundSoft,
    borderWidth: 1,
    borderColor: affairGoTheme.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  cardCopy: {
    flex: 1,
  },
  cardTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  cardMeta: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 21,
    marginTop: 4,
  },
  cardBody: {
    color: affairGoTheme.colors.text,
    lineHeight: 22,
    marginTop: 12,
  },
  inlineButton: {
    marginTop: 14,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  eventImage: {
    width: '100%',
    height: 140,
    borderRadius: affairGoTheme.radius.md,
    marginTop: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.46)',
    padding: 20,
    justifyContent: 'center',
  },
  modalKeyboardWrap: {
    width: '100%',
    alignItems: 'center',
  },
  modalCard: {
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
    maxHeight: '88%',
  },
  modalTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  modalAction: {
    flexGrow: 1,
    minWidth: 180,
  },
});

export default ExploreScreen;

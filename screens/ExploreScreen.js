import { Picker } from '@react-native-picker/picker';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AccentButton, AppBackground, EmptyState, FormField, GlassCard, InfoBanner, ScreenHeader, StatusPill, ToggleChip } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme } from '../constants/affairGoTheme';
import { getCommunityRules } from '../constants/communityChatProvider';
import { cancelDate, createDate, listDates, toggleDateInterest, updateDate } from '../constants/dateProvider';
import { useAffairGo } from '../context/AffairGoContext';
import { auth, db } from '../firebase';
import { useNavigation, useRoute } from '../naviagtion/SimpleNavigation';
import { isPresenceFresh } from '../untils/matching';

const {
  getCommunityAccessRequirements,
  normalizeCommunityRoom,
  normalizeCommunityRulesEnvelope,
} = require('../untils/communityChat');
const { filterNearbyDates } = require('../untils/dateLocation');

const SEGMENTS = ['matches', 'dates', 'events'];
const MATCH_FILTERS = ['all', 'online'];
const DATE_PICKER_TOTAL_DAYS = 90;
const DATE_PICKER_STEP_MINUTES = 30;

const createEmptyDateForm = ({
  title = '',
  description = '',
  dateValue = '',
  timeValue = '',
  locationQuery = '',
  publicPlaceLabel = '',
  clientRequestId = '',
} = {}) => ({
  description,
  dateValue,
  timeValue,
  locationQuery,
  publicPlaceLabel,
  visibility: 'community',
  clientRequestId,
  title,
});

const buildDatePickerValue = (value) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildTimePickerValue = (value) => {
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const buildDateOptions = (totalDays = DATE_PICKER_TOTAL_DAYS) => Array.from({ length: totalDays }, (_, index) => {
  const nextDate = new Date();
  nextDate.setHours(0, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() + index + 1);
  return {
    value: buildDatePickerValue(nextDate),
    label: nextDate.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
  };
});

const buildTimeOptions = (stepMinutes = DATE_PICKER_STEP_MINUTES) => {
  const options = [];

  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += stepMinutes) {
      const current = new Date();
      current.setHours(hour, minute, 0, 0);
      options.push({
        value: buildTimePickerValue(current),
        label: current.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      });
    }
  }

  return options;
};

const createClientRequestId = () => `date_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

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

  const [year, month, day] = String(dateValue).split('-').map((entry) => Number(entry));
  const [hours, minutes] = String(timeValue).split(':').map((entry) => Number(entry));
  const scheduledAt = new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0, 0, 0);
  if (Number.isNaN(scheduledAt.getTime())) {
    return null;
  }

  return scheduledAt.toISOString();
};

const getDefaultDateFormSelection = (dateOptions = [], timeOptions = [], currentUser = {}) => createEmptyDateForm({
  dateValue: dateOptions[0]?.value || '',
  timeValue: timeOptions.find((entry) => entry.value === '19:00')?.value || timeOptions[0]?.value || '',
  locationQuery: String(currentUser?.city || '').trim(),
  clientRequestId: createClientRequestId(),
});

const getDateAccessMessage = (accessRequirements = {}) => {
  if (!accessRequirements.loggedIn) {
    return 'Bitte melde dich zuerst an, um Dates zu sehen oder selbst zu erstellen.';
  }

  if (!accessRequirements.emailVerified) {
    return 'Für Dates muss deine E-Mail-Adresse bestätigt sein.';
  }

  if (!accessRequirements.ageVerified) {
    return 'Für Dates ist eine bestätigte 18+-Freigabe erforderlich.';
  }

  if (!accessRequirements.accountActive) {
    return 'Mit offener Kontolöschung kannst du keine Dates nutzen.';
  }

  if (!accessRequirements.moderationAllowed) {
    return 'Dein Konto ist derzeit nicht für Dates freigeschaltet.';
  }

  if (!accessRequirements.rulesAccepted) {
    return 'Akzeptiere zuerst die aktuellen Community-Regeln, bevor du Dates nutzt.';
  }

  return '';
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
  const [datesRulesEnvelope, setDatesRulesEnvelope] = useState(null);
  const [datesRulesLoaded, setDatesRulesLoaded] = useState(false);
  const [isDateModalVisible, setIsDateModalVisible] = useState(false);
  const dateOptions = useMemo(() => buildDateOptions(), []);
  const timeOptions = useMemo(() => buildTimeOptions(), []);
  const [dateForm, setDateForm] = useState(() => getDefaultDateFormSelection(dateOptions, timeOptions));
  const [editingDateId, setEditingDateId] = useState('');
  const [submittingDate, setSubmittingDate] = useState(false);
  const [selectedDateId, setSelectedDateId] = useState('');
  const [interestMap, setInterestMap] = useState({});
  const [eventRooms, setEventRooms] = useState([]);
  const scrollRef = useRef(null);
  const selectedDate = datesState.items.find((entry) => entry.id === selectedDateId) || null;
  const isDesktop = Platform.OS === 'web' && width >= 980;
  const isCompactLayout = width < 420;
  const dateAccessRequirements = useMemo(
    () => getCommunityAccessRequirements(currentUser, auth.currentUser, datesRulesEnvelope),
    [currentUser, datesRulesEnvelope],
  );
  const canUseDates = dateAccessRequirements.allRequirementsMet === true;
  const dateAccessMessage = getDateAccessMessage(dateAccessRequirements);

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

  useEffect(() => {
    let active = true;

    const loadDateRules = async () => {
      if (!currentUser?.id) {
        setDatesRulesEnvelope(null);
        setDatesRulesLoaded(true);
        return;
      }

      setDatesRulesLoaded(false);

      try {
        const result = await getCommunityRules();

        if (!active) {
          return;
        }

        setDatesRulesEnvelope(normalizeCommunityRulesEnvelope(result));
      } catch {
        try {
          const [rulesSnapshot, acceptanceSnapshot] = await Promise.all([
            getDoc(doc(db, 'communityConfig', 'rules')),
            getDoc(doc(db, 'communityRuleAcceptances', currentUser.id)),
          ]);

          if (!active) {
            return;
          }

          setDatesRulesEnvelope(normalizeCommunityRulesEnvelope({
            rules: rulesSnapshot.exists() ? rulesSnapshot.data() : null,
            acceptance: acceptanceSnapshot.exists() ? acceptanceSnapshot.data() : null,
          }));
        } catch {
          if (active) {
            setDatesRulesEnvelope(null);
          }
        }
      } finally {
        if (active) {
          setDatesRulesLoaded(true);
        }
      }
    };

    loadDateRules();

    return () => {
      active = false;
    };
  }, [currentUser?.id]);

  const refreshDates = async ({ keepLoadingState = false } = {}) => {
    if (!canUseDates) {
      setDatesState({ loading: false, error: '', items: [] });
      return;
    }

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
    if (!datesRulesLoaded) {
      return;
    }

    refreshDates();
  }, [datesRulesLoaded, canUseDates]);

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
  const nearbyDates = useMemo(() => filterNearbyDates(datesState.items
    .map((entry) => {
      const creatorProfile = userMap.get(entry.creatorId) || null;
      return {
        ...entry,
        creatorProfile,
        creatorOnline: Boolean(creatorProfile?.online) && isPresenceFresh(creatorProfile?.lastLiveSyncAt),
      };
    }), { currentUser, radiusKm: currentRadius }), [currentRadius, currentUser, datesState.items, userMap]);

  const openDateCreate = () => {
    if (!canUseDates) {
      Alert.alert('Date erstellen', dateAccessMessage || 'Dates sind für dein Konto derzeit nicht freigeschaltet.');
      return;
    }

    setEditingDateId('');
    setDateForm(getDefaultDateFormSelection(dateOptions, timeOptions, currentUser));
    setIsDateModalVisible(true);
  };

  const openEventCreate = () => {
    navigation.navigate('Event', { focus: 'create' });
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
      locationQuery: dateEntry.locationQuery || dateEntry.cityLabel || dateEntry.regionLabel || '',
      publicPlaceLabel: dateEntry.publicPlaceLabel || '',
      visibility: dateEntry.visibility || 'community',
      clientRequestId: '',
    });
    setIsDateModalVisible(true);
  };

  const submitDateForm = async () => {
    if (submittingDate) {
      return;
    }

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
        locationQuery: dateForm.locationQuery,
        publicPlaceLabel: dateForm.publicPlaceLabel,
        clientRequestId: editingDateId ? '' : dateForm.clientRequestId,
        visibility: dateForm.visibility,
      };

      if (editingDateId) {
        await updateDate({ dateId: editingDateId, ...payload });
      } else {
        await createDate(payload);
      }

      setIsDateModalVisible(false);
      setEditingDateId('');
      setDateForm(getDefaultDateFormSelection(dateOptions, timeOptions, currentUser));
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
    const createButton = <AccentButton label="+ Date erstellen" onPress={openDateCreate} />;

    if (!datesRulesLoaded) {
      return (
        <>
          <View style={styles.sectionActionRow}>
            <Text style={styles.sectionHint}>Date-Zugriff wird geprüft.</Text>
            {createButton}
          </View>
          <GlassCard strong style={styles.card}>
            <Text style={styles.cardTitle}>Dates werden vorbereitet...</Text>
            <Text style={styles.cardMeta}>Zugriff und Regeln werden geprüft.</Text>
          </GlassCard>
        </>
      );
    }

    if (!canUseDates) {
      return (
        <>
          <View style={styles.sectionActionRow}>
            <Text style={styles.sectionHint}>Nur freigeschaltete Community-Mitglieder können Dates nutzen.</Text>
            {createButton}
          </View>
          <InfoBanner
            title="Dates aktuell nicht freigeschaltet"
            detail={dateAccessMessage}
            tone="warning"
          />
        </>
      );
    }

    const header = (
      <View style={styles.sectionActionRow}>
        <Text style={styles.sectionHint}>Aktive Dates werden nur innerhalb deines aktuellen Radius angezeigt.</Text>
        {createButton}
      </View>
    );

    if (datesState.loading) {
      return (
        <>
          {header}
          <GlassCard strong style={styles.card}>
            <Text style={styles.cardTitle}>Dates werden geladen...</Text>
            <Text style={styles.cardMeta}>Aktive und kommende Verabredungen aus deiner Nähe werden vorbereitet.</Text>
          </GlassCard>
        </>
      );
    }

    if (datesState.error) {
      return (
        <>
          {header}
          <EmptyState
            title="Dates konnten nicht geladen werden"
            detail={datesState.error}
            action={<AccentButton label="Erneut laden" variant="secondary" onPress={() => refreshDates()} />}
          />
        </>
      );
    }

    if (!nearbyDates.length) {
      return (
        <>
          {header}
          <EmptyState
            title="In deiner Umgebung gibt es noch keine Dates."
            detail="Erstelle das erste Date oder prüfe später erneut, sobald neue Verabredungen veröffentlicht werden."
            action={<AccentButton label="Erstes Date erstellen" onPress={openDateCreate} />}
          />
        </>
      );
    }

    return (
      <>
        {header}
        <View style={styles.grid}>
          {nearbyDates.map((dateEntry) => {
            const isOwnDate = dateEntry.creatorId === currentUser.id;
            const creatorName = dateEntry.creatorProfileSummary?.nickname || dateEntry.creatorProfile?.nickname || dateEntry.creatorNickname || 'Night-Whisper Mitglied';
            const isInterested = interestMap[dateEntry.id] === true;
            const knownOnlineMatch = matchedProfiles.some((profile) => profile.id === dateEntry.creatorId);
            return (
              <Pressable key={dateEntry.id} style={[styles.gridItem, isDesktop ? styles.gridItemDesktop : null]} onPress={() => setSelectedDateId(dateEntry.id)}>
                <GlassCard strong style={styles.card}>
                  <View style={styles.metricRow}>
                    <StatusPill label={isOwnDate ? 'Dein Date' : dateEntry.creatorOnline ? 'Online' : knownOnlineMatch ? 'Match' : 'Aktiv'} tone={isOwnDate ? 'info' : dateEntry.creatorOnline ? 'success' : knownOnlineMatch ? 'info' : 'default'} />
                    <StatusPill label={dateEntry.status === 'active' ? 'Aktiv' : dateEntry.status} tone="default" />
                  </View>
                  <Text style={styles.cardTitle}>{dateEntry.title}</Text>
                  <Text style={styles.cardMeta}>{formatDateCardLabel(dateEntry.scheduledAtMs)}</Text>
                  <Text style={styles.cardMeta}>{dateEntry.regionLabel}</Text>
                  <Text style={styles.cardMeta}>Von {creatorName}{dateEntry.distanceKm != null ? ` · ca. ${Math.round(dateEntry.distanceKm)} km` : ''}</Text>
                  {dateEntry.description ? <Text style={styles.cardBody}>{dateEntry.description}</Text> : null}
                  <Text style={styles.cardMeta}>{dateEntry.interestCount || 0} Interessenbekundungen</Text>
                  <View style={styles.cardActionRow}>
                    <AccentButton label="Details" variant="secondary" onPress={() => setSelectedDateId(dateEntry.id)} style={styles.inlineButtonHalf} />
                    {!isOwnDate ? (
                      <AccentButton label={isInterested ? 'Interesse zurückziehen' : 'Interesse'} variant={isInterested ? 'secondary' : 'primary'} onPress={() => handleToggleInterest(dateEntry.id)} style={styles.inlineButtonHalf} />
                    ) : (
                      <AccentButton label="Bearbeiten" variant="secondary" onPress={() => openDateEdit(dateEntry)} style={styles.inlineButtonHalf} />
                    )}
                  </View>
                </GlassCard>
              </Pressable>
            );
          })}
        </View>
      </>
    );
  };

  const renderEvents = () => {
    const header = (
      <View style={styles.sectionActionRow}>
        <Text style={styles.sectionHint}>Events verwenden den bestehenden Event-Hub und zeigen nur aktive, kommende Veranstaltungen.</Text>
        <View style={styles.sectionActionGroup}>
          <AccentButton label="+ Event erstellen" onPress={openEventCreate} />
          <AccentButton label="Event-Hub" variant="secondary" onPress={() => navigation.navigate('Event')} />
        </View>
      </View>
    );

    if (!upcomingEvents.length) {
      return (
        <>
          {header}
          <EmptyState
            title="Keine kommenden Events im Feed"
            detail="Sobald neue Partys oder Veranstaltungen aktiv sind, erscheinen sie hier automatisch."
            action={<AccentButton label="Event-Hub öffnen" variant="secondary" onPress={() => navigation.navigate('Event')} />}
          />
        </>
      );
    }

    return (
      <>
        {header}
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
      </>
    );
  };

  return (
    <AppBackground scrollViewRef={scrollRef}>
      <ScreenHeader title="Kennenlernen" subtitle="Matches, Dates und Events" />

      <GlassCard strong style={styles.segmentCard}>
        <View style={styles.segmentRow}>
          {SEGMENTS.map((entry) => (
            <Pressable key={entry} onPress={() => setSegment(entry)} style={[styles.segmentButton, isCompactLayout ? styles.segmentButtonCompact : null, segment === entry ? styles.segmentButtonActive : null]}>
              <Text style={[styles.segmentButtonLabel, isCompactLayout ? styles.segmentButtonLabelCompact : null, segment === entry ? styles.segmentButtonLabelActive : null]}>
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
        {segment === 'events' ? <View style={styles.filterRow}><StatusPill label={`${currentRadius} km Radius`} tone="info" /></View> : null}
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
                <FormField label="Aktivität oder Wunsch" value={dateForm.title} onChangeText={(value) => setDateForm((previous) => ({ ...previous, title: value }))} hint="Zum Beispiel: Kaffeetrinken, Freitagabend gemeinsam essen gehen, Sexdate" />
                <FormField label="Zusätzliche Beschreibung" value={dateForm.description} multiline onChangeText={(value) => setDateForm((previous) => ({ ...previous, description: value }))} hint="Optional" />
                <FormField label="Ort oder Stadt" value={dateForm.locationQuery} onChangeText={(value) => setDateForm((previous) => ({ ...previous, locationQuery: value }))} hint="Aktuell serverseitig nur für bekannte Städte aus der Matching-Map auflösbar" placeholder="z. B. Köln oder 50667 Köln" />
                <FormField label="Öffentliche Ortsbezeichnung" value={dateForm.publicPlaceLabel} onChangeText={(value) => setDateForm((previous) => ({ ...previous, publicPlaceLabel: value }))} hint="Optional, zum Beispiel Café oder Club" placeholder="z. B. Café am Rhein" />
                <View style={styles.pickerGrid}>
                  <View style={[styles.pickerField, styles.pickerFieldDate]}>
                    <Text style={styles.pickerLabel}>Datum</Text>
                    <View style={styles.pickerWrap}>
                      <Picker selectedValue={dateForm.dateValue} onValueChange={(value) => setDateForm((previous) => ({ ...previous, dateValue: value }))} dropdownIconColor={affairGoTheme.colors.text}>
                        {dateOptions.map((entry) => <Picker.Item key={entry.value} label={entry.label} value={entry.value} color="#111" />)}
                      </Picker>
                    </View>
                  </View>
                  <View style={[styles.pickerField, styles.pickerFieldTime]}>
                    <Text style={styles.pickerLabel}>Uhrzeit</Text>
                    <View style={styles.pickerWrap}>
                      <Picker selectedValue={dateForm.timeValue} onValueChange={(value) => setDateForm((previous) => ({ ...previous, timeValue: value }))} dropdownIconColor={affairGoTheme.colors.text}>
                        {timeOptions.map((entry) => <Picker.Item key={entry.value} label={entry.label} value={entry.value} color="#111" />)}
                      </Picker>
                    </View>
                  </View>
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
                {selectedDate.distanceKm != null ? <Text style={styles.cardMeta}>Entfernung ungefähr {selectedDate.distanceKm} km</Text> : null}
                {selectedDate.description ? <Text style={styles.cardBody}>{selectedDate.description}</Text> : null}
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
    flexWrap: 'nowrap',
    gap: 8,
  },
  segmentButton: {
    minHeight: 46,
    flex: 1,
    minWidth: 0,
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
    minHeight: 42,
    paddingHorizontal: 8,
  },
  segmentButtonActive: {
    backgroundColor: 'rgba(118, 87, 255, 0.18)',
    borderColor: affairGoTheme.colors.accent,
  },
  segmentButtonLabel: {
    color: affairGoTheme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  segmentButtonLabelCompact: {
    fontSize: 12,
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
  sectionActionGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-end',
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
  cardActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  inlineButton: {
    marginTop: 14,
  },
  inlineButtonHalf: {
    flexGrow: 1,
    minWidth: 160,
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
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 6,
  },
  pickerField: {
    flexGrow: 1,
  },
  pickerFieldDate: {
    minWidth: 260,
    flex: 1.45,
  },
  pickerFieldTime: {
    minWidth: 180,
    flex: 1,
  },
  pickerLabel: {
    color: affairGoTheme.colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  pickerWrap: {
    minHeight: 52,
    borderRadius: affairGoTheme.radius.md,
    borderWidth: 1,
    borderColor: affairGoTheme.colors.line,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    justifyContent: 'center',
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

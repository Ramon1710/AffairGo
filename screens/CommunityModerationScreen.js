import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { AccentButton, AppBackground, EmptyState, FormField, GlassCard, InfoBanner, ScreenHeader, StatusPill, ToggleChip } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { createEventCommunityRoom, getCommunityRules, moderateCommunityReport, publishCommunityRules, setCommunityRoomActive, syncEventCommunityRooms, upsertCommunityRoom } from '../constants/communityChatProvider';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { db } from '../firebase';
import { useNavigation } from '../naviagtion/SimpleNavigation';

const {
  formatCommunityRulesVersionLabel,
  getCommunityRoomTypeLabel,
  normalizeCommunityRoom,
  normalizeCommunityRulesEnvelope,
  parseCommunityRulesEditor,
  stringifyCommunityRulesSections,
  formatCommunityDateTime,
  mapCommunityErrorMessage,
} = require('../untils/communityChat');

const REPORT_REASON_LABELS = {
  HARASSMENT: 'Belästigung',
  INSULT: 'Beleidigung',
  SPAM: 'Spam',
  FAKE_PROFILE: 'Fake-Profil',
  SUSPECTED_MINOR: 'Minderjährigkeit vermutet',
  ILLEGAL_CONTENT: 'Illegale Inhalte',
  UNWANTED_CONTACT: 'Unerwünschter Kontakt',
  OTHER: 'Sonstiges',
};

const MODERATION_ACTIONS = [
  { key: 'START_REVIEW', label: 'Prüfen', variant: 'secondary' },
  { key: 'REMOVE_MESSAGE', label: 'Nachricht entfernen', variant: 'secondary' },
  { key: 'WARN_USER', label: 'Verwarnen', variant: 'secondary' },
  { key: 'BAN_24H', label: '24h sperren', variant: 'secondary' },
  { key: 'BAN_7D', label: '7 Tage sperren', variant: 'secondary' },
  { key: 'BAN_PERMANENT', label: 'Dauerhaft sperren', variant: 'secondary' },
  { key: 'CLOSE_REPORT', label: 'Schließen', variant: 'ghost' },
];

const CommunityModerationScreen = () => {
  const navigation = useNavigation();
  const { currentUser, events } = useAffairGo();
  const [reports, setReports] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [busyActionKey, setBusyActionKey] = useState('');
  const [roomForm, setRoomForm] = useState({ roomId: '', name: '', slug: '', description: '', type: 'GLOBAL', region: '', active: true });
  const [rulesEnvelope, setRulesEnvelope] = useState(null);
  const [rulesLoaded, setRulesLoaded] = useState(false);
  const [rulesForm, setRulesForm] = useState({ version: '', title: '', editorValue: '' });

  useEffect(() => {
    if (!currentUser.isAdmin) {
      setLoaded(true);
      return undefined;
    }

    const reportsQuery = query(
      collection(db, 'communityReports'),
      orderBy('priorityRank', 'desc'),
      orderBy('createdAt', 'desc'),
      limit(50),
    );

    const unsubscribe = onSnapshot(reportsQuery, (snapshot) => {
      const nextReports = snapshot.docs.map((reportDoc) => ({ id: reportDoc.id, ...reportDoc.data() }));
      setReports(nextReports);
      setLoaded(true);
      setLoadError('');
    }, (error) => {
      setLoaded(true);
      setReports([]);
      setLoadError(mapCommunityErrorMessage(error, 'load'));
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser.isAdmin]);

  useEffect(() => {
    if (!currentUser.isAdmin) {
      setRoomsLoaded(true);
      return undefined;
    }

    syncEventCommunityRooms().catch(() => {});

    const roomsQuery = query(collection(db, 'communityRooms'), orderBy('name'), limit(100));
    const unsubscribe = onSnapshot(roomsQuery, (snapshot) => {
      setRooms(snapshot.docs.map((roomDoc) => normalizeCommunityRoom({ id: roomDoc.id, ...roomDoc.data() }, roomDoc.id)));
      setRoomsLoaded(true);
    }, (error) => {
      setRooms([]);
      setRoomsLoaded(true);
      setLoadError(mapCommunityErrorMessage(error, 'rooms'));
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser.isAdmin]);

  useEffect(() => {
    let active = true;

    if (!currentUser.isAdmin) {
      setRulesEnvelope(null);
      setRulesLoaded(true);
      return undefined;
    }

    setRulesLoaded(false);

    const loadRules = async () => {
      try {
        const result = await getCommunityRules();

        if (!active) {
          return;
        }

        const nextEnvelope = normalizeCommunityRulesEnvelope(result);
        setRulesEnvelope(nextEnvelope);
        setRulesForm({
          version: '',
          title: nextEnvelope.title || '',
          editorValue: stringifyCommunityRulesSections(nextEnvelope.sections),
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setRulesEnvelope(null);
        setLoadError(mapCommunityErrorMessage(error, 'load'));
      } finally {
        if (active) {
          setRulesLoaded(true);
        }
      }
    };

    loadRules();

    return () => {
      active = false;
    };
  }, [currentUser.isAdmin]);

  const openReports = useMemo(() => reports.filter((report) => report.status === 'OPEN' || report.status === 'REVIEWING'), [reports]);
  const roomMap = useMemo(() => Object.fromEntries(rooms.map((room) => [room.id, room])), [rooms]);
  const eventRoomMap = useMemo(() => Object.fromEntries(rooms.filter((room) => room.type === 'EVENT' && room.eventId).map((room) => [room.eventId, room])), [rooms]);
  const currentRulesVersionLabel = formatCommunityRulesVersionLabel(rulesEnvelope?.version);

  const handleAction = async (reportId, action) => {
    const actionKey = `${reportId}:${action}`;

    try {
      setBusyActionKey(actionKey);
      setLoadError('');
      await moderateCommunityReport({ reportId, action });
    } catch (error) {
      setLoadError(mapCommunityErrorMessage(error, 'send'));
    } finally {
      setBusyActionKey('');
    }
  };

  const handleSaveRoom = async () => {
    try {
      setBusyActionKey('room-save');
      setLoadError('');
      await upsertCommunityRoom({
        roomId: roomForm.roomId || null,
        name: roomForm.name,
        slug: roomForm.slug,
        description: roomForm.description,
        type: roomForm.type,
        region: roomForm.type === 'REGION' ? roomForm.region : null,
        active: roomForm.active,
      });
      setRoomForm({ roomId: '', name: '', slug: '', description: '', type: 'GLOBAL', region: '', active: true });
    } catch (error) {
      setLoadError(mapCommunityErrorMessage(error, 'send'));
    } finally {
      setBusyActionKey('');
    }
  };

  const handleToggleRoomActive = async (roomId, active) => {
    try {
      setBusyActionKey(`room:${roomId}`);
      setLoadError('');
      await setCommunityRoomActive({ roomId, active });
    } catch (error) {
      setLoadError(mapCommunityErrorMessage(error, 'send'));
    } finally {
      setBusyActionKey('');
    }
  };

  const handleEditRoom = (room) => {
    setRoomForm({
      roomId: room.id,
      name: room.name,
      slug: room.slug,
      description: room.description,
      type: room.type,
      region: room.region || '',
      active: room.active === true,
    });
  };

  const handleCreateEventChat = async (eventId) => {
    try {
      setBusyActionKey(`event-create:${eventId}`);
      setLoadError('');
      await createEventCommunityRoom({ eventId });
      await syncEventCommunityRooms({ eventId });
    } catch (error) {
      setLoadError(mapCommunityErrorMessage(error, 'send'));
    } finally {
      setBusyActionKey('');
    }
  };

  const handleOpenEventRoom = (roomId) => navigation.navigate('CommunityRoom', { roomId });

  const handlePublishRules = async () => {
    try {
      setBusyActionKey('rules-publish');
      setLoadError('');
      await publishCommunityRules({
        version: rulesForm.version,
        title: rulesForm.title,
        sections: parseCommunityRulesEditor(rulesForm.editorValue),
      });

      const result = await getCommunityRules();
      const nextEnvelope = normalizeCommunityRulesEnvelope(result);
      setRulesEnvelope(nextEnvelope);
      setRulesForm({
        version: '',
        title: nextEnvelope.title || '',
        editorValue: stringifyCommunityRulesSections(nextEnvelope.sections),
      });
    } catch (error) {
      setLoadError(mapCommunityErrorMessage(error, 'send'));
    } finally {
      setBusyActionKey('');
    }
  };

  return (
    <AppBackground>
      <ScreenHeader
        title="Community Moderation"
        subtitle="Admin"
        leftAction={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color={affairGoTheme.colors.text} />
          </Pressable>
        }
      />

      {!currentUser.isAdmin ? (
        <GlassCard strong style={styles.stateCard}>
          <Text style={styles.stateTitle}>Dieser Bereich ist nur für Admins verfügbar.</Text>
        </GlassCard>
      ) : null}

      {currentUser.isAdmin ? (
        <>
          <InfoBanner
            title="Moderationsbereich"
            detail="Offene Meldungen werden mit kritischen Fällen zuerst angezeigt. Alle Maßnahmen laufen ausschließlich serverseitig über Firebase Functions."
            tone="warning"
            style={styles.banner}
          />

          <GlassCard strong style={styles.roomAdminCard}>
            <Text style={styles.roomAdminTitle}>Community-Regeln veröffentlichen</Text>
            {!rulesLoaded ? (
              <View style={styles.rulesStateRow}>
                <ActivityIndicator size="small" color={affairGoTheme.colors.accent} />
                <Text style={styles.roomMeta}>Regelstand wird geladen …</Text>
              </View>
            ) : (
              <>
                <Text style={styles.reportLine}>Aktuelle Version: {currentRulesVersionLabel}</Text>
                <Text style={styles.roomMeta}>Veröffentlicht: {formatCommunityDateTime(rulesEnvelope?.publishedAt) || 'Unbekannt'}</Text>
                <FormField label="Neue Versionsnummer" value={rulesForm.version} onChangeText={(value) => setRulesForm((previous) => ({ ...previous, version: value }))} placeholder="z. B. 1.1" />
                <FormField label="Titel" value={rulesForm.title} onChangeText={(value) => setRulesForm((previous) => ({ ...previous, title: value }))} />
                <FormField
                  label="Regelabschnitte"
                  value={rulesForm.editorValue}
                  onChangeText={(value) => setRulesForm((previous) => ({ ...previous, editorValue: value }))}
                  multiline
                  numberOfLines={12}
                />
                <Text style={styles.rulesHint}>Format: pro Abschnitt zuerst die Überschrift, darunter je Zeile ein Absatz. Abschnitte mit Leerzeile trennen.</Text>
                <AccentButton label={busyActionKey === 'rules-publish' ? 'Veröffentlicht...' : 'Neue Regelversion veröffentlichen'} onPress={handlePublishRules} disabled={Boolean(busyActionKey) || !rulesLoaded} style={styles.roomSaveButton} />
              </>
            )}
          </GlassCard>

          {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

          {!loaded ? (
            <GlassCard strong style={styles.stateCard}>
              <ActivityIndicator size="small" color={affairGoTheme.colors.accent} />
              <Text style={styles.stateTitle}>Moderationsdaten werden geladen …</Text>
            </GlassCard>
          ) : openReports.length ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              {openReports.map((report) => {
                const isCritical = report.priority === 'CRITICAL';
                const reportRoom = roomMap[report.roomId] || null;
                const reportRoomLabel = reportRoom?.type === 'EVENT'
                  ? `${reportRoom.eventTitle || reportRoom.name} • Event-Chat`
                  : reportRoom?.name || report.roomId || 'whisper-lounge';

                return (
                  <GlassCard key={report.id} strong style={styles.reportCard}>
                    <View style={styles.reportHeader}>
                      <View style={styles.reportHeaderCopy}>
                        <Text style={styles.reportTitle}>{isCritical ? 'KRITISCH – Minderjährigkeit vermutet' : REPORT_REASON_LABELS[report.reason] || report.reason}</Text>
                        <Text style={styles.reportMeta}>{formatCommunityDateTime(report.createdAt)} • Raum: {reportRoomLabel}</Text>
                      </View>
                      <StatusPill label={report.priority || 'NORMAL'} tone={isCritical ? 'danger' : 'info'} />
                    </View>

                    <Text style={styles.reportLine}>Gemeldet von: {report.reporterNickname || report.reporterUserId}</Text>
                    <Text style={styles.reportLine}>Gemeldeter Nutzer: {report.reportedNickname || report.reportedUserId}</Text>
                    <Text style={styles.reportLine}>Status: {report.status}</Text>
                    {report.messageId ? <Text style={styles.reportLine}>Nachricht: {report.messagePreview || 'Kein Ausschnitt verfügbar.'}</Text> : null}
                    {report.comment ? <Text style={styles.reportComment}>{report.comment}</Text> : null}

                    <View style={styles.actionsWrap}>
                      {MODERATION_ACTIONS.map((action) => (
                        <View key={action.key} style={styles.actionItem}>
                          <AccentButton
                            label={busyActionKey === `${report.id}:${action.key}` ? '...' : action.label}
                            variant={action.variant}
                            disabled={Boolean(busyActionKey)}
                            onPress={() => handleAction(report.id, action.key)}
                          />
                        </View>
                      ))}
                    </View>
                  </GlassCard>
                );
              })}
            </ScrollView>
          ) : (
            <EmptyState title="Keine offenen Meldungen" detail="Der Moderationsbereich ist aktuell leer." />
          )}

          <GlassCard strong style={styles.roomAdminCard}>
            <Text style={styles.roomAdminTitle}>Räume verwalten</Text>
            <FormField label="Name" value={roomForm.name} onChangeText={(value) => setRoomForm((previous) => ({ ...previous, name: value }))} />
            <FormField label="Slug" value={roomForm.slug} onChangeText={(value) => setRoomForm((previous) => ({ ...previous, slug: value.toLowerCase().replace(/\s+/g, '-') }))} />
            <FormField label="Beschreibung" value={roomForm.description} onChangeText={(value) => setRoomForm((previous) => ({ ...previous, description: value }))} multiline />
            <Text style={styles.roomTypeLabel}>Typ</Text>
            <View style={styles.roomTypeRow}>
              <ToggleChip label="Global" active={roomForm.type === 'GLOBAL'} onPress={() => setRoomForm((previous) => ({ ...previous, type: 'GLOBAL', region: '' }))} />
              <ToggleChip label="Region" active={roomForm.type === 'REGION'} onPress={() => setRoomForm((previous) => ({ ...previous, type: 'REGION' }))} />
            </View>
            {roomForm.type === 'REGION' ? <FormField label="Region" value={roomForm.region} onChangeText={(value) => setRoomForm((previous) => ({ ...previous, region: value.toUpperCase() }))} /> : null}
            <View style={styles.roomTypeRow}>
              <ToggleChip label="Aktiv" active={roomForm.active === true} onPress={() => setRoomForm((previous) => ({ ...previous, active: true }))} />
              <ToggleChip label="Inaktiv" active={roomForm.active === false} onPress={() => setRoomForm((previous) => ({ ...previous, active: false }))} />
            </View>
            <AccentButton label={busyActionKey === 'room-save' ? 'Speichert...' : roomForm.roomId ? 'Raum speichern' : 'Raum erstellen'} onPress={handleSaveRoom} disabled={Boolean(busyActionKey)} style={styles.roomSaveButton} />
          </GlassCard>

          {!roomsLoaded ? (
            <GlassCard style={styles.stateCard}>
              <ActivityIndicator size="small" color={affairGoTheme.colors.accent} />
              <Text style={styles.stateTitle}>Räume werden geladen …</Text>
            </GlassCard>
          ) : rooms.length ? (
            <View style={styles.roomListWrap}>
              {rooms.map((room) => (
                <GlassCard key={room.id} style={styles.roomCard}>
                  <View style={styles.roomRow}>
                    <View style={styles.roomCopy}>
                      <Text style={styles.roomName}>{room.name}</Text>
                      <Text style={styles.roomMeta}>{room.region ? `${getCommunityRoomTypeLabel(room.type)} • ${room.region}` : getCommunityRoomTypeLabel(room.type)}</Text>
                      <Text style={styles.roomMeta}>{room.slug}</Text>
                    </View>
                    <StatusPill label={room.active ? 'Aktiv' : 'Inaktiv'} tone={room.active ? 'success' : 'warning'} />
                  </View>
                  <Text style={styles.roomDescription}>{room.description}</Text>
                  <View style={styles.roomActions}>
                    <View style={styles.roomActionItem}><AccentButton label="Bearbeiten" variant="secondary" onPress={() => handleEditRoom(room)} disabled={Boolean(busyActionKey)} /></View>
                    <View style={styles.roomActionItem}><AccentButton label={busyActionKey === `room:${room.id}` ? '...' : room.active ? 'Deaktivieren' : 'Reaktivieren'} variant="ghost" onPress={() => handleToggleRoomActive(room.id, !room.active)} disabled={Boolean(busyActionKey)} /></View>
                  </View>
                </GlassCard>
              ))}
            </View>
          ) : null}

          <GlassCard strong style={styles.roomAdminCard}>
            <Text style={styles.roomAdminTitle}>Event-Chats</Text>
            {events.length ? events.map((event) => {
              const room = eventRoomMap[event.id] || null;

              return (
                <View key={event.id} style={styles.eventAdminRow}>
                  <View style={styles.eventAdminCopy}>
                    <Text style={styles.roomName}>{event.title}</Text>
                    <Text style={styles.roomMeta}>{event.date}{event.time ? ` • ${event.time}` : ''}</Text>
                    <Text style={styles.roomMeta}>{event.travelReferenceCity || event.address}</Text>
                    <Text style={styles.roomMeta}>Chat vorhanden: {room ? 'Ja' : 'Nein'}{room ? ` • Status: ${room.active ? 'Aktiv' : 'Inaktiv'}` : ''}</Text>
                  </View>
                  <View style={styles.eventAdminActions}>
                    {!room ? (
                      <AccentButton label={busyActionKey === `event-create:${event.id}` ? '...' : 'Chat erstellen'} variant="secondary" onPress={() => handleCreateEventChat(event.id)} disabled={Boolean(busyActionKey)} />
                    ) : room.active ? (
                      <>
                        <AccentButton label="Chat öffnen" variant="secondary" onPress={() => handleOpenEventRoom(room.id)} disabled={Boolean(busyActionKey)} />
                        <AccentButton label={busyActionKey === `room:${room.id}` ? '...' : 'Deaktivieren'} variant="ghost" onPress={() => handleToggleRoomActive(room.id, false)} disabled={Boolean(busyActionKey)} style={styles.eventAdminButton} />
                      </>
                    ) : (
                      <>
                        <AccentButton label={busyActionKey === `room:${room.id}` ? '...' : 'Reaktivieren'} variant="secondary" onPress={() => handleToggleRoomActive(room.id, true)} disabled={Boolean(busyActionKey)} />
                        <AccentButton label="Verwalten" variant="ghost" onPress={() => handleEditRoom(room)} disabled={Boolean(busyActionKey)} style={styles.eventAdminButton} />
                      </>
                    )}
                  </View>
                </View>
              );
            }) : (
              <Text style={styles.roomMeta}>Aktuell sind keine Events verfügbar.</Text>
            )}
          </GlassCard>
        </>
      ) : null}
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  banner: {
    marginBottom: 12,
  },
  stateCard: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  stateTitle: {
    color: affairGoTheme.colors.text,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorText: {
    color: affairGoTheme.colors.warning,
    marginBottom: 12,
    lineHeight: 20,
  },
  reportCard: {
    marginBottom: 12,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  reportHeaderCopy: {
    flex: 1,
  },
  reportTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  reportMeta: {
    color: affairGoTheme.colors.textMuted,
    marginTop: 6,
  },
  reportLine: {
    color: affairGoTheme.colors.text,
    lineHeight: 22,
    marginBottom: 6,
  },
  reportComment: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 22,
    marginTop: 4,
    marginBottom: 10,
  },
  actionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginTop: 4,
  },
  actionItem: {
    width: '50%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  roomAdminCard: {
    marginTop: 16,
    marginBottom: 16,
  },
  roomAdminTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  rulesStateRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  rulesHint: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  roomTypeLabel: {
    color: affairGoTheme.colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  roomTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  roomSaveButton: {
    marginTop: 4,
  },
  roomListWrap: {
    marginBottom: 16,
  },
  roomCard: {
    marginBottom: 10,
  },
  roomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  roomCopy: {
    flex: 1,
  },
  roomName: {
    color: affairGoTheme.colors.text,
    fontWeight: '700',
    fontSize: 18,
  },
  roomMeta: {
    color: affairGoTheme.colors.textMuted,
    marginTop: 4,
  },
  roomDescription: {
    color: affairGoTheme.colors.text,
    lineHeight: 22,
    marginTop: 10,
  },
  roomActions: {
    flexDirection: 'row',
    marginHorizontal: -4,
    marginTop: 12,
  },
  roomActionItem: {
    width: '50%',
    paddingHorizontal: 4,
  },
  eventAdminRow: {
    borderTopWidth: 1,
    borderTopColor: affairGoTheme.colors.line,
    paddingTop: 12,
    marginTop: 12,
  },
  eventAdminCopy: {
    marginBottom: 10,
  },
  eventAdminActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  eventAdminButton: {
    marginTop: 10,
  },
});

export default CommunityModerationScreen;
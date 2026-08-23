import { Fragment, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { AccentButton, AppBackground, EmptyState, GlassCard, InfoBanner, ScreenHeader, StatusPill } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { acceptCommunityRules, getCommunityPresenceSummary, getCommunityRules, seedCommunityRooms, syncEventCommunityRooms, touchCommunityPresence } from '../constants/communityChatProvider';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { db } from '../firebase';
import { useNavigation } from '../naviagtion/SimpleNavigation';

const {
  COMMUNITY_ROOM_ID,
  buildCommunityRoomSections,
  formatCommunityEventDateLabel,
  formatCommunityRulesVersionLabel,
  getCommunityActiveCountLabel,
  getCommunityRoomActivityLabel,
  getCommunityRoomTypeLabel,
  getCommunityRoomUnreadCount,
  getCommunityRoomUnreadLabel,
  getCommunityUnreadRoomsCount,
  hasUnreadCommunityRoom,
  mapCommunityErrorMessage,
  normalizeCommunityPresenceSummary,
  normalizeCommunityRulesEnvelope,
  normalizeCommunityRoom,
  normalizeCommunityRoomRead,
  sortCommunityRooms,
} = require('../untils/communityChat');

const CommunityScreen = () => {
  const navigation = useNavigation();
  const { currentUser } = useAffairGo();
  const [rooms, setRooms] = useState([]);
  const [reads, setReads] = useState([]);
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [readsLoaded, setReadsLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isSeedingRoom, setIsSeedingRoom] = useState(false);
  const [rulesEnvelope, setRulesEnvelope] = useState(null);
  const [rulesLoaded, setRulesLoaded] = useState(false);
  const [rulesError, setRulesError] = useState('');
  const [rulesModalVisible, setRulesModalVisible] = useState(false);
  const [isAcceptingRules, setIsAcceptingRules] = useState(false);
  const [presenceSummary, setPresenceSummary] = useState(normalizeCommunityPresenceSummary());

  useEffect(() => {
    syncEventCommunityRooms().catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;

    if (!currentUser?.id) {
      setRulesEnvelope(null);
      setRulesLoaded(true);
      setRulesError('');
      return undefined;
    }

    setRulesLoaded(false);
    setRulesError('');

    const loadRules = async () => {
      try {
        const result = await getCommunityRules();

        if (!active) {
          return;
        }

        const nextEnvelope = normalizeCommunityRulesEnvelope(result);
        setRulesEnvelope(nextEnvelope);
        setRulesModalVisible(nextEnvelope.acceptedCurrent !== true);
      } catch (error) {
        if (!active) {
          return;
        }

        setRulesEnvelope(null);
        setRulesError(mapCommunityErrorMessage(error, 'load'));
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
  }, [currentUser?.id]);

  useEffect(() => {
    setRoomsLoaded(false);
    setLoadError('');

    const roomsQuery = query(collection(db, 'communityRooms'), where('active', '==', true));
    const unsubscribe = onSnapshot(
      roomsQuery,
      (snapshot) => {
        const nextRooms = snapshot.docs.map((roomDoc) => normalizeCommunityRoom({ id: roomDoc.id, ...roomDoc.data() }, roomDoc.id));
        setRooms(nextRooms);
        setRoomsLoaded(true);
        setLoadError('');
      },
      (error) => {
        setRooms([]);
        setRoomsLoaded(true);
        setLoadError(mapCommunityErrorMessage(error, 'rooms'));
      },
    );

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentUser?.id) {
      setReads([]);
      setReadsLoaded(true);
      return undefined;
    }

    setReadsLoaded(false);
    const readsQuery = query(collection(db, 'communityRoomReads'), where('userId', '==', currentUser.id));
    const unsubscribe = onSnapshot(
      readsQuery,
      (snapshot) => {
        const nextReads = snapshot.docs.map((readDoc) => normalizeCommunityRoomRead({ id: readDoc.id, ...readDoc.data() }, readDoc.id));
        setReads(nextReads);
        setReadsLoaded(true);
      },
      () => {
        setReads([]);
        setReadsLoaded(true);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [currentUser?.id]);

  useEffect(() => {
    let active = true;

    const refreshPresence = async () => {
      try {
        if (rulesAcceptedCurrent) {
          touchCommunityPresence({ roomId: null }).catch(() => {});
        }

        const result = await getCommunityPresenceSummary();

        if (!active) {
          return;
        }

        setPresenceSummary(normalizeCommunityPresenceSummary(result.summary));
      } catch {
        if (active) {
          setPresenceSummary(normalizeCommunityPresenceSummary());
        }
      }
    };

    if (!currentUser?.id) {
      setPresenceSummary(normalizeCommunityPresenceSummary());
      return () => {
        active = false;
      };
    }

    refreshPresence();
    const timerId = setInterval(refreshPresence, 60 * 1000);

    return () => {
      active = false;
      clearInterval(timerId);
    };
  }, [currentUser?.id, rulesAcceptedCurrent]);

  const readMap = useMemo(() => Object.fromEntries(reads.map((entry) => [entry.roomId, entry])), [reads]);
  const roomsWithPresence = useMemo(() => rooms.map((room) => normalizeCommunityRoom({
    ...room,
    activeMemberCount: Number(presenceSummary.roomActiveCounts?.[room.id] || 0),
  }, room.id)), [presenceSummary.roomActiveCounts, rooms]);
  const lastVisitedRoom = useMemo(() => {
    const latestRead = [...reads].sort((left, right) => right.lastReadAtMs - left.lastReadAtMs)[0];
    return latestRead ? roomsWithPresence.find((room) => room.id === latestRead.roomId) || null : null;
  }, [reads, roomsWithPresence]);
  const rulesAcceptedCurrent = rulesEnvelope?.acceptedCurrent === true;
  const rulesVersionLabel = formatCommunityRulesVersionLabel(rulesEnvelope?.version);
  const sections = useMemo(() => buildCommunityRoomSections(roomsWithPresence, {
    readMap,
    lastVisitedRoomId: lastVisitedRoom?.id || '',
  }), [lastVisitedRoom?.id, readMap, roomsWithPresence]);
  const highlightRoom = roomsWithPresence.find((room) => room.id === COMMUNITY_ROOM_ID) || null;
  const eventRooms = useMemo(() => sortCommunityRooms(roomsWithPresence.filter((room) => room.type === 'EVENT'), {
    readMap,
    lastVisitedRoomId: lastVisitedRoom?.id || '',
  }), [lastVisitedRoom?.id, readMap, roomsWithPresence]);
  const noRoomsAvailable = roomsLoaded && !roomsWithPresence.length;
  const unreadRoomsCount = useMemo(() => getCommunityUnreadRoomsCount(roomsWithPresence, reads), [reads, roomsWithPresence]);
  const activeMembersLabel = getCommunityActiveCountLabel(presenceSummary.activeMemberCount, presenceSummary.publicCountThreshold);

  const openRoom = (roomId) => {
    if (!rulesAcceptedCurrent) {
      setRulesModalVisible(true);
      return;
    }

    navigation.navigate('CommunityRoom', { roomId });
  };

  const handleSeedRooms = async () => {
    if (!currentUser?.isAdmin || isSeedingRoom) {
      return;
    }

    try {
      setIsSeedingRoom(true);
      setLoadError('');
      await seedCommunityRooms();
    } catch (error) {
      setLoadError(mapCommunityErrorMessage(error, 'rooms'));
    } finally {
      setIsSeedingRoom(false);
    }
  };

  const handleAcceptRules = async () => {
    if (!rulesEnvelope?.version || isAcceptingRules) {
      return;
    }

    try {
      setIsAcceptingRules(true);
      setRulesError('');
      await acceptCommunityRules({ rulesVersion: rulesEnvelope.version });
      const result = await getCommunityRules();
      const nextEnvelope = normalizeCommunityRulesEnvelope(result);
      setRulesEnvelope(nextEnvelope);
      setRulesModalVisible(false);
    } catch (error) {
      setRulesError(mapCommunityErrorMessage(error, 'send'));
    } finally {
      setIsAcceptingRules(false);
    }
  };

  const renderRoomCard = (room, prominent = false) => {
    const readEntry = readMap[room.id] || null;
    const unread = hasUnreadCommunityRoom(room, readEntry);
    const roomUnreadCount = getCommunityRoomUnreadCount(room, readEntry);
    const roomSummary = [
      getCommunityRoomActivityLabel(room.activeMemberCount, presenceSummary.publicCountThreshold),
      roomUnreadCount !== null && roomUnreadCount > 0 ? getCommunityRoomUnreadLabel(room, readEntry) : null,
    ].filter(Boolean).join(' · ');

    return (
      <Pressable key={room.id} onPress={() => openRoom(room.id)} style={styles.roomPressable}>
        <GlassCard strong={prominent} style={[styles.roomCard, prominent ? styles.roomCardProminent : null]}>
          <Text style={styles.roomTitle}>{room.name}</Text>
          <Text style={styles.roomMeta}>{room.region ? `${getCommunityRoomTypeLabel(room.type)} • ${room.region}` : getCommunityRoomTypeLabel(room.type)}</Text>
          <Text style={styles.roomDescription}>{room.description}</Text>
          <Text style={styles.roomActivity}>{roomSummary || 'Noch keine Aktivität'}</Text>
          <StatusPill label={getCommunityRoomUnreadLabel(room, readEntry)} tone={unread ? 'info' : 'default'} style={styles.roomPill} />
        </GlassCard>
      </Pressable>
    );
  };

  const renderEventRoomCard = (room) => {
    const readEntry = readMap[room.id] || null;
    const unread = hasUnreadCommunityRoom(room, readEntry);
    const roomUnreadCount = getCommunityRoomUnreadCount(room, readEntry);
    const roomSummary = [
      getCommunityRoomActivityLabel(room.activeMemberCount, presenceSummary.publicCountThreshold),
      roomUnreadCount !== null && roomUnreadCount > 0 ? getCommunityRoomUnreadLabel(room, readEntry) : null,
    ].filter(Boolean).join(' · ');

    return (
      <Pressable key={room.id} onPress={() => openRoom(room.id)} style={styles.roomPressable}>
        <GlassCard style={styles.roomCard}>
          <Text style={styles.roomTitle}>{room.eventTitle || room.name}</Text>
          <Text style={styles.roomMeta}>{formatCommunityEventDateLabel(room)}{room.eventCity ? ` • ${room.eventCity}` : ''}</Text>
          <Text style={styles.roomDescription}>Event-Chat öffnen</Text>
          <Text style={styles.roomActivity}>{roomSummary || 'Noch keine Aktivität'}</Text>
          <StatusPill label={getCommunityRoomUnreadLabel(room, readEntry)} tone={unread ? 'info' : 'default'} style={styles.roomPill} />
        </GlassCard>
      </Pressable>
    );
  };

  return (
    <AppBackground>
      <ScreenHeader
        title="Community"
        subtitle="Night-Whisper"
        leftAction={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color={affairGoTheme.colors.text} />
          </Pressable>
        }
        rightAction={currentUser?.isAdmin ? (
          <Pressable onPress={() => navigation.navigate('CommunityModeration')}>
            <Ionicons name="shield-checkmark-outline" size={24} color={affairGoTheme.colors.accentSoft} />
          </Pressable>
        ) : null}
      />

      <GlassCard strong style={styles.introCard}>
        <Text style={styles.introTitle}>Raumübersicht</Text>
        <Text style={styles.introCopy}>Wähle einen globalen oder regionalen Community-Raum. Matching und private Nachrichten bleiben separat.</Text>
        <Text style={styles.activityHeadline}>{activeMembersLabel}</Text>
        {unreadRoomsCount > 0 ? <Text style={styles.activitySubline}>In {unreadRoomsCount} Räumen gibt es neue Nachrichten.</Text> : null}
        {rulesEnvelope ? (
          <Pressable onPress={() => setRulesModalVisible(true)} style={styles.rulesLink}>
            <Text style={styles.rulesLinkText}>Community-Regeln ansehen · {rulesVersionLabel}</Text>
          </Pressable>
        ) : null}
      </GlassCard>

      <InfoBanner
        title="Community-Räume"
        detail="Regionale Räume basieren auf freigeschalteten Kategorien, nicht auf GPS. Inaktive Räume werden hier nicht angezeigt."
        tone="warning"
        style={styles.infoBanner}
      />

      {rulesLoaded && rulesEnvelope && !rulesAcceptedCurrent ? (
        <InfoBanner
          title="Regelzustimmung erforderlich"
          detail="Du kannst die Raumübersicht sehen, musst aber vor dem Öffnen eines Chats zuerst die aktuellen Community-Regeln bestätigen."
          tone="warning"
          style={styles.infoBanner}
        />
      ) : null}

      {rulesError ? <Text style={styles.errorText}>{rulesError}</Text> : null}

      {!roomsLoaded || !readsLoaded || !rulesLoaded ? (
        <GlassCard strong style={styles.stateCard}>
          <ActivityIndicator size="small" color={affairGoTheme.colors.accent} />
          <Text style={styles.stateTitle}>Community-Räume werden geladen …</Text>
        </GlassCard>
      ) : loadError ? (
        <GlassCard strong style={styles.stateCard}>
          <Text style={styles.stateTitle}>{loadError}</Text>
          {currentUser?.isAdmin ? (
            <AccentButton
              label={isSeedingRoom ? 'Räume werden ergänzt...' : 'Standardräume ergänzen'}
              onPress={handleSeedRooms}
              disabled={isSeedingRoom}
              style={styles.stateAction}
            />
          ) : null}
        </GlassCard>
      ) : noRoomsAvailable ? (
        <EmptyState
          title="Aktuell sind keine Community-Räume verfügbar."
          detail="Es wurden noch keine aktiven Räume freigeschaltet."
          action={currentUser?.isAdmin ? <AccentButton label={isSeedingRoom ? 'Räume werden ergänzt...' : 'Standardräume ergänzen'} onPress={handleSeedRooms} disabled={isSeedingRoom} /> : null}
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {lastVisitedRoom ? (
            <GlassCard style={styles.lastVisitedCard}>
              <Text style={styles.lastVisitedEyebrow}>Zuletzt besucht</Text>
              <Pressable onPress={() => openRoom(lastVisitedRoom.id)}>
                <Text style={styles.lastVisitedTitle}>{lastVisitedRoom.name}</Text>
                <Text style={styles.lastVisitedMeta}>{getCommunityRoomUnreadLabel(lastVisitedRoom, readMap[lastVisitedRoom.id] || null)}</Text>
              </Pressable>
              <AccentButton label="Weiterlesen" variant="secondary" onPress={() => openRoom(lastVisitedRoom.id)} style={styles.lastVisitedAction} />
            </GlassCard>
          ) : null}

          {highlightRoom ? renderRoomCard(highlightRoom, true) : null}

          {sections.map((section) => (
            <Fragment key={section.key}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.rooms.filter((room) => room.id !== COMMUNITY_ROOM_ID).map((room) => renderRoomCard(room))}
            </Fragment>
          ))}

          <Text style={styles.sectionTitle}>Events</Text>
          {eventRooms.length ? eventRooms.map((room) => renderEventRoomCard(room)) : (
            <GlassCard style={styles.emptyEventCard}>
              <Text style={styles.emptyEventTitle}>Aktuell sind keine Event-Chats geöffnet.</Text>
              <Text style={styles.emptyEventCopy}>Sobald ein passendes Night-Whisper Event freigeschaltet wird, erscheint es hier.</Text>
            </GlassCard>
          )}
        </ScrollView>
      )}

      <Modal
        visible={rulesModalVisible && Boolean(rulesEnvelope)}
        animationType="slide"
        transparent
        onRequestClose={() => setRulesModalVisible(rulesAcceptedCurrent)}
      >
        <View style={styles.modalBackdrop}>
          <GlassCard strong style={styles.rulesModalCard}>
            <View style={styles.rulesModalHeader}>
              <View style={styles.rulesModalCopy}>
                <Text style={styles.rulesModalEyebrow}>Night-Whisper Community</Text>
                <Text style={styles.rulesModalTitle}>{rulesEnvelope?.title || 'Community-Regeln'}</Text>
                <Text style={styles.rulesModalMeta}>{rulesVersionLabel}</Text>
              </View>
              {rulesAcceptedCurrent ? (
                <Pressable onPress={() => setRulesModalVisible(false)}>
                  <Ionicons name="close" size={24} color={affairGoTheme.colors.text} />
                </Pressable>
              ) : null}
            </View>

            <ScrollView style={styles.rulesScroll} contentContainerStyle={styles.rulesScrollContent} showsVerticalScrollIndicator={false}>
              {rulesEnvelope?.sections.map((section) => (
                <View key={section.heading} style={styles.rulesSection}>
                  <Text style={styles.rulesSectionHeading}>{section.heading}</Text>
                  {section.paragraphs.map((paragraph) => (
                    <Text key={`${section.heading}:${paragraph}`} style={styles.rulesSectionParagraph}>{paragraph}</Text>
                  ))}
                </View>
              ))}
            </ScrollView>

            {!rulesAcceptedCurrent ? (
              <InfoBanner
                title="Zustimmung erforderlich"
                detail="Der offene Community-Chat ändert nichts an Matching, privaten Nachrichten oder Kontaktgrenzen auf Night-Whisper."
                tone="warning"
              />
            ) : null}

            <View style={styles.rulesActions}>
              {!rulesAcceptedCurrent ? (
                <AccentButton
                  label={isAcceptingRules ? 'Regeln werden bestätigt...' : 'Community-Regeln akzeptieren'}
                  onPress={handleAcceptRules}
                  disabled={isAcceptingRules || !rulesEnvelope?.version}
                />
              ) : null}
              <AccentButton
                label={rulesAcceptedCurrent ? 'Schließen' : 'Zurück'}
                variant="ghost"
                onPress={() => {
                  if (rulesAcceptedCurrent) {
                    setRulesModalVisible(false);
                    return;
                  }

                  navigation.goBack();
                }}
                disabled={isAcceptingRules}
                style={styles.rulesSecondaryAction}
              />
            </View>
          </GlassCard>
        </View>
      </Modal>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  introCard: {
    marginBottom: 12,
  },
  introTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  introCopy: {
    color: affairGoTheme.colors.text,
    lineHeight: 22,
    marginTop: 10,
  },
  activityHeadline: {
    color: affairGoTheme.colors.accentSoft,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
  },
  activitySubline: {
    color: affairGoTheme.colors.textMuted,
    marginTop: 6,
  },
  rulesLink: {
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  rulesLinkText: {
    color: affairGoTheme.colors.accentSoft,
    fontWeight: '600',
  },
  infoBanner: {
    marginBottom: 12,
  },
  errorText: {
    color: affairGoTheme.colors.warning,
    lineHeight: 20,
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
  stateAction: {
    marginTop: 14,
  },
  lastVisitedCard: {
    marginBottom: 12,
  },
  lastVisitedEyebrow: {
    color: affairGoTheme.colors.accentSoft,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  lastVisitedTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  lastVisitedMeta: {
    color: affairGoTheme.colors.textMuted,
    marginTop: 6,
  },
  lastVisitedAction: {
    marginTop: 12,
  },
  sectionTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 2,
  },
  roomPressable: {
    marginBottom: 10,
  },
  roomCard: {
    padding: 18,
  },
  roomCardProminent: {
    borderColor: 'rgba(255,122,100,0.45)',
    backgroundColor: 'rgba(255,67,67,0.16)',
  },
  roomTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 20,
    fontWeight: '700',
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
  roomActivity: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 20,
    marginTop: 12,
  },
  roomPill: {
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  emptyEventCard: {
    marginBottom: 12,
  },
  emptyEventTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  emptyEventCopy: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 22,
    marginTop: 8,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(8,12,20,0.76)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  rulesModalCard: {
    maxHeight: '88%',
    padding: 18,
  },
  rulesModalHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  rulesModalCopy: {
    flex: 1,
  },
  rulesModalEyebrow: {
    color: affairGoTheme.colors.accentSoft,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  rulesModalTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
  },
  rulesModalMeta: {
    color: affairGoTheme.colors.textMuted,
    marginTop: 6,
  },
  rulesScroll: {
    marginBottom: 16,
    marginTop: 16,
  },
  rulesScrollContent: {
    paddingBottom: 8,
  },
  rulesSection: {
    marginBottom: 16,
  },
  rulesSectionHeading: {
    color: affairGoTheme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  rulesSectionParagraph: {
    color: affairGoTheme.colors.text,
    lineHeight: 22,
    marginBottom: 8,
  },
  rulesActions: {
    marginTop: 14,
  },
  rulesSecondaryAction: {
    marginTop: 10,
  },
});

export default CommunityScreen;

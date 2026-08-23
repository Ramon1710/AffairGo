import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, EmptyState, GlassCard, InfoBanner, ScreenHeader, StatusPill } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme } from '../constants/affairGoTheme';
import { acceptCommunityRules, getCommunityPresenceSummary, getCommunityRules, seedCommunityRooms, syncEventCommunityRooms, touchCommunityPresence } from '../constants/communityChatProvider';
import { useAffairGo } from '../context/AffairGoContext';
import { auth, db } from '../firebase';
import { useNavigation } from '../naviagtion/SimpleNavigation';

const {
  COMMUNITY_ROOM_ID,
  buildAcceptedCommunityRulesEnvelope,
  buildCommunityRoomSections,
  formatCommunityEventDateLabel,
  getCommunityAccessRequirements,
  formatCommunityRulesVersionLabel,
  getCommunityActiveCountLabel,
  getCommunityOverviewState,
  getCommunityRoomActivityLabel,
  getCommunityRoomTypeLabel,
  getCommunityRoomUnreadCount,
  getCommunityRoomUnreadLabel,
  getCommunityUnreadRoomsCount,
  hasUnreadCommunityRoom,
  mapCommunityErrorMessage,
  mergeCommunityRulesEnvelope,
  normalizeCommunityPresenceSummary,
  normalizeCommunityRulesEnvelope,
  normalizeCommunityRoom,
  normalizeCommunityRoomRead,
  sortCommunityRooms,
} = require('../untils/communityChat');

const CommunityScreen = () => {
  const navigation = useNavigation();
  const { currentUser, resendCurrentUserVerificationEmail, verifyPendingEmail } = useAffairGo();
  const rulesEnvelopeRef = useRef(null);
  const rulesLoadRequestIdRef = useRef(0);
  const [rooms, setRooms] = useState([]);
  const [reads, setReads] = useState([]);
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [readsLoaded, setReadsLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isSeedingRoom, setIsSeedingRoom] = useState(false);
  const [roomsQueryKey, setRoomsQueryKey] = useState(0);
  const [rulesEnvelope, setRulesEnvelope] = useState(null);
  const [rulesLoaded, setRulesLoaded] = useState(false);
  const [rulesError, setRulesError] = useState('');
  const [rulesModalVisible, setRulesModalVisible] = useState(false);
  const [isAcceptingRules, setIsAcceptingRules] = useState(false);
  const [presenceSummary, setPresenceSummary] = useState(normalizeCommunityPresenceSummary());
  const [accessActionError, setAccessActionError] = useState('');
  const [isRefreshingEmailVerification, setIsRefreshingEmailVerification] = useState(false);
  const [isResendingVerificationEmail, setIsResendingVerificationEmail] = useState(false);

  const accessRequirements = useMemo(() => getCommunityAccessRequirements(currentUser, auth.currentUser, rulesEnvelope), [currentUser, rulesEnvelope]);

  useEffect(() => {
    rulesEnvelopeRef.current = rulesEnvelope;
  }, [rulesEnvelope]);

  const logCommunityOverviewDebug = (scope, details = {}) => {
    const error = details.error || null;

    console.warn('[CommunityScreen]', {
      scope,
      errorCode: typeof error?.code === 'string' ? error.code : null,
      errorMessage: typeof error?.message === 'string' ? error.message : null,
      query: details.query || null,
      route: '/community',
      uid: currentUser?.id || null,
      communityRulesVersion: details.communityRulesVersion ?? rulesEnvelope?.version ?? null,
      acceptedRulesVersion: details.acceptedRulesVersion ?? rulesEnvelope?.acceptedVersion ?? null,
      acceptedRulesVersionAfter: details.acceptedRulesVersionAfter ?? null,
      needsRulesAcceptance: details.needsRulesAcceptance ?? null,
      acceptResponse: details.acceptResponse ?? null,
      ageVerified: currentUser?.ageVerified === true,
      emailVerified: currentUser?.emailVerified === true,
    });
  };

  const loadRulesViaFirestoreFallback = async (userId) => {
    const [rulesSnapshot, acceptanceSnapshot] = await Promise.all([
      getDoc(doc(db, 'communityConfig', 'rules')),
      getDoc(doc(db, 'communityRuleAcceptances', userId)),
    ]);

    if (!rulesSnapshot.exists()) {
      throw new Error('missing_rules');
    }

    return normalizeCommunityRulesEnvelope({
      rules: rulesSnapshot.data(),
      acceptance: acceptanceSnapshot.exists() ? acceptanceSnapshot.data() : null,
    });
  };

  const applyRulesEnvelope = (nextEnvelope, options = {}) => {
    const mergedEnvelope = mergeCommunityRulesEnvelope(rulesEnvelopeRef.current, nextEnvelope);
    rulesEnvelopeRef.current = mergedEnvelope;
    setRulesEnvelope(mergedEnvelope);
    setRulesModalVisible(options.keepModalOpen === true ? true : mergedEnvelope.acceptedCurrent !== true);
    return mergedEnvelope;
  };

  const refreshRulesStatus = async ({ userId, preserveAcceptedState = false } = {}) => {
    const requestId = ++rulesLoadRequestIdRef.current;

    try {
      const result = await getCommunityRules();

      if (requestId !== rulesLoadRequestIdRef.current) {
        return null;
      }

      const nextEnvelope = normalizeCommunityRulesEnvelope(result);
      const mergedEnvelope = preserveAcceptedState
        ? mergeCommunityRulesEnvelope(rulesEnvelopeRef.current, nextEnvelope)
        : nextEnvelope;

      setRulesError('');
      return applyRulesEnvelope(mergedEnvelope);
    } catch (error) {
      logCommunityOverviewDebug('rules-callable-failed', {
        error,
        query: 'callable:getCommunityRules',
      });

      try {
        const nextEnvelope = await loadRulesViaFirestoreFallback(userId);

        if (requestId !== rulesLoadRequestIdRef.current) {
          return null;
        }

        const mergedEnvelope = preserveAcceptedState
          ? mergeCommunityRulesEnvelope(rulesEnvelopeRef.current, nextEnvelope)
          : nextEnvelope;

        setRulesError('');
        return applyRulesEnvelope(mergedEnvelope);
      } catch (fallbackError) {
        logCommunityOverviewDebug('rules-fallback-failed', {
          error: fallbackError,
          query: 'communityConfig/rules + communityRuleAcceptances/{uid}',
        });

        if (requestId !== rulesLoadRequestIdRef.current) {
          return null;
        }

        if (!preserveAcceptedState) {
          setRulesEnvelope(null);
          rulesEnvelopeRef.current = null;
          setRulesError('Die Community-Regeln konnten gerade nicht geladen werden. Die Raumübersicht bleibt sichtbar, der Chat-Einstieg kann vorübergehend eingeschränkt sein.');
        }

        throw error;
      }
    }
  };

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

    if (!accessRequirements.nonRulesRequirementsMet) {
      setRulesEnvelope(null);
      rulesEnvelopeRef.current = null;
      setRulesLoaded(true);
      setRulesError('');
      return undefined;
    }

    setRulesLoaded(false);
    setRulesError('');

    const loadRules = async () => {
      try {
        await refreshRulesStatus({ userId: currentUser.id });

        if (!active) {
          return;
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setRulesError('Die Community-Regeln konnten gerade nicht geladen werden. Die Raumübersicht bleibt sichtbar, der Chat-Einstieg kann vorübergehend eingeschränkt sein.');
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
  }, [accessRequirements.nonRulesRequirementsMet, currentUser?.ageVerified, currentUser?.emailVerified, currentUser?.id]);

  useEffect(() => {
    if (!accessRequirements.canReadOverview) {
      setRooms([]);
      setRoomsLoaded(true);
      setLoadError('');
      return undefined;
    }

    setRoomsLoaded(false);
    setLoadError('');

    const roomsQuery = query(collection(db, 'communityRooms'), where('active', '==', true));
    const unsubscribe = onSnapshot(
      roomsQuery,
      (snapshot) => {
        const nextRooms = snapshot.docs.map((roomDoc) => normalizeCommunityRoom({ id: roomDoc.id, ...roomDoc.data() }, roomDoc.id));

        if (!nextRooms.length) {
          logCommunityOverviewDebug('rooms-query-empty', {
            query: "collection(db, 'communityRooms'), where('active', '==', true)",
          });
        }

        setRooms(nextRooms);
        setRoomsLoaded(true);
        setLoadError('');
      },
      (error) => {
        logCommunityOverviewDebug('rooms-query-failed', {
          error,
          query: "collection(db, 'communityRooms'), where('active', '==', true)",
        });
        setRooms([]);
        setRoomsLoaded(true);
        setLoadError(mapCommunityErrorMessage(error, 'rooms'));
      },
    );

    return () => {
      unsubscribe();
    };
  }, [accessRequirements.canReadOverview, currentUser?.ageVerified, currentUser?.emailVerified, currentUser?.id, roomsQueryKey]);

  useEffect(() => {
    if (!accessRequirements.canReadMessages || !currentUser?.id) {
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
      (error) => {
        logCommunityOverviewDebug('reads-query-failed', {
          error,
          query: "collection(db, 'communityRoomReads'), where('userId', '==', uid)",
        });
        setReads([]);
        setReadsLoaded(true);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [accessRequirements.canReadMessages, currentUser?.id]);

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
      } catch (error) {
        logCommunityOverviewDebug('presence-summary-failed', {
          error,
          query: 'callable:getCommunityPresenceSummary',
        });
        if (active) {
          setPresenceSummary(normalizeCommunityPresenceSummary());
        }
      }
    };

    if (!accessRequirements.canReadOverview || !currentUser?.id) {
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
  }, [accessRequirements.canReadOverview, currentUser?.id, rulesAcceptedCurrent]);

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
  const requirementItems = [
    {
      key: 'loggedIn',
      label: 'Anmeldung',
      met: accessRequirements.loggedIn,
      detail: accessRequirements.loggedIn ? 'Du bist mit deinem Night-Whisper Konto angemeldet.' : 'Bitte melde dich zuerst an.',
    },
    {
      key: 'emailVerified',
      label: 'E-Mail bestätigt',
      met: accessRequirements.emailVerified,
      detail: accessRequirements.emailVerified ? 'Deine E-Mail-Adresse ist bestätigt.' : 'Bitte bestätige zuerst deine E-Mail-Adresse.',
    },
    {
      key: 'ageVerified',
      label: '18+ verifiziert',
      met: accessRequirements.ageVerified,
      detail: accessRequirements.ageVerified ? 'Deine Altersfreigabe ist hinterlegt.' : 'Der Community-Bereich ist nur für verifizierte Erwachsene freigeschaltet.',
    },
    {
      key: 'accountActive',
      label: 'Konto aktiv',
      met: accessRequirements.accountActive,
      detail: accessRequirements.accountActive ? 'Für dein Konto liegt keine offene Löschanfrage vor.' : 'Mit offener Löschanfrage bleibt die Community gesperrt.',
    },
    {
      key: 'communityAllowed',
      label: 'Community-Zugang',
      met: accessRequirements.communityAllowed,
      detail: accessRequirements.communityAllowed ? 'Dein Konto hat derzeit keine Community-Einschränkung.' : 'Dein Community-Zugang ist derzeit eingeschränkt.',
    },
    {
      key: 'rulesAccepted',
      label: 'Regeln bestätigt',
      met: accessRequirements.rulesAccepted,
      detail: accessRequirements.rulesAccepted ? 'Die aktuelle Regelversion ist bestätigt.' : 'Vor dem Chat-Einstieg musst du noch die aktuellen Regeln akzeptieren.',
    },
  ];
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
  const overviewState = getCommunityOverviewState({
    roomsLoaded,
    readsLoaded,
    rulesLoaded,
    loadError,
    roomCount: roomsWithPresence.length,
  });

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

  const handleRetryRooms = () => {
    setLoadError('');
    setRoomsLoaded(false);
    setRoomsQueryKey((previous) => previous + 1);
  };

  const handleRefreshEmailVerification = async () => {
    try {
      setIsRefreshingEmailVerification(true);
      setAccessActionError('');
      const verified = await verifyPendingEmail();

      if (!verified) {
        setAccessActionError('Die E-Mail ist noch nicht bestätigt. Bitte öffne zuerst den Link aus deiner Bestätigungs-Mail.');
      }
    } catch (error) {
      setAccessActionError(error.message || 'Der Bestätigungsstatus konnte nicht aktualisiert werden.');
    } finally {
      setIsRefreshingEmailVerification(false);
    }
  };

  const handleResendVerificationEmail = async () => {
    try {
      setIsResendingVerificationEmail(true);
      setAccessActionError('');
      const result = await resendCurrentUserVerificationEmail();

      if (result?.alreadyVerified) {
        return;
      }
    } catch (error) {
      setAccessActionError(error.message || 'Die Verifizierungs-Mail konnte nicht erneut gesendet werden.');
    } finally {
      setIsResendingVerificationEmail(false);
    }
  };

  const openCommunityAccessProfile = () => {
    navigation.navigate('Profil');
  };

  const handleAcceptRules = async () => {
    if (!rulesEnvelope?.version || isAcceptingRules) {
      return;
    }

    try {
      setIsAcceptingRules(true);
      setRulesError('');
      logCommunityOverviewDebug('rules-accept-start', {
        communityRulesVersion: rulesEnvelope.version,
        acceptedRulesVersion: rulesEnvelope.acceptedVersion,
        needsRulesAcceptance: rulesEnvelope.acceptedCurrent !== true,
      });
      const acceptResponse = await acceptCommunityRules({ rulesVersion: rulesEnvelope.version });
      const acceptedEnvelope = buildAcceptedCommunityRulesEnvelope(rulesEnvelopeRef.current || rulesEnvelope, acceptResponse);
      applyRulesEnvelope(acceptedEnvelope);
      setRulesModalVisible(false);
      logCommunityOverviewDebug('rules-accept-success', {
        communityRulesVersion: rulesEnvelope.version,
        acceptedRulesVersion: rulesEnvelope.acceptedVersion,
        acceptedRulesVersionAfter: acceptedEnvelope.acceptedVersion,
        needsRulesAcceptance: acceptedEnvelope.acceptedCurrent !== true,
        acceptResponse,
      });
      refreshRulesStatus({ userId: currentUser.id, preserveAcceptedState: true }).catch((error) => {
        logCommunityOverviewDebug('rules-refresh-after-accept-failed', {
          error,
          query: 'post-accept:getCommunityRules',
          communityRulesVersion: acceptedEnvelope.version,
          acceptedRulesVersion: acceptedEnvelope.acceptedVersion,
        });
      });
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

      {!accessRequirements.nonRulesRequirementsMet ? (
        <GlassCard strong style={styles.accessCard}>
          <Text style={styles.accessTitle}>Community-Zugangsvoraussetzungen</Text>
          <Text style={styles.accessCopy}>Bevor wir Räume laden, siehst du hier transparent, welche Freigaben für die Night-Whisper Community noch fehlen.</Text>
          <View style={styles.requirementList}>
            {requirementItems.map((item) => (
              <View key={item.key} style={styles.requirementRow}>
                <View style={styles.requirementCopy}>
                  <Text style={styles.requirementLabel}>{item.label}</Text>
                  <Text style={styles.requirementDetail}>{item.detail}</Text>
                </View>
                <StatusPill label={item.met ? 'Erfüllt' : 'Offen'} tone={item.met ? 'success' : 'warning'} style={styles.requirementPill} />
              </View>
            ))}
          </View>
          {accessActionError ? <Text style={styles.accessError}>{accessActionError}</Text> : null}
          {!accessRequirements.loggedIn ? (
            <AccentButton label="Zum Login" onPress={() => navigation.navigate('Login')} style={styles.accessAction} />
          ) : null}
          {accessRequirements.loggedIn && !accessRequirements.emailVerified ? (
            <>
              <AccentButton
                label={isRefreshingEmailVerification ? 'Bestätigung wird geprüft...' : 'Bestätigung prüfen'}
                onPress={handleRefreshEmailVerification}
                disabled={isRefreshingEmailVerification || isResendingVerificationEmail}
                style={styles.accessAction}
              />
              <AccentButton
                label={isResendingVerificationEmail ? 'Mail wird gesendet...' : 'Verifizierungs-Mail erneut senden'}
                variant="secondary"
                onPress={handleResendVerificationEmail}
                disabled={isRefreshingEmailVerification || isResendingVerificationEmail}
                style={styles.accessAction}
              />
            </>
          ) : null}
          {accessRequirements.loggedIn && (!accessRequirements.ageVerified || !accessRequirements.accountActive || !accessRequirements.communityAllowed) ? (
            <AccentButton label="Zum Profil" variant="secondary" onPress={openCommunityAccessProfile} style={styles.accessAction} />
          ) : null}
        </GlassCard>
      ) : null}

      {rulesLoaded && rulesEnvelope && !rulesAcceptedCurrent ? (
        <InfoBanner
          title="Regelzustimmung erforderlich"
          detail="Du kannst die Raumübersicht sehen, musst aber vor dem Öffnen eines Chats zuerst die aktuellen Community-Regeln bestätigen."
          tone="warning"
          style={styles.infoBanner}
        />
      ) : null}

      {rulesError && overviewState === 'ready' ? (
        <InfoBanner
          title="Community-Regeln derzeit nicht erreichbar"
          detail={rulesError}
          tone="warning"
          style={styles.infoBanner}
        />
      ) : null}

      {accessRequirements.nonRulesRequirementsMet && overviewState === 'loading' ? (
        <GlassCard strong style={styles.stateCard}>
          <ActivityIndicator size="small" color={affairGoTheme.colors.accent} />
          <Text style={styles.stateTitle}>Community-Räume werden geladen …</Text>
        </GlassCard>
      ) : accessRequirements.nonRulesRequirementsMet && overviewState === 'error' ? (
        <GlassCard strong style={styles.stateCard}>
          <Text style={styles.stateTitle}>{loadError}</Text>
          <AccentButton label="Erneut versuchen" onPress={handleRetryRooms} style={styles.stateAction} />
        </GlassCard>
      ) : accessRequirements.nonRulesRequirementsMet && overviewState === 'empty' ? (
        <EmptyState
          title={currentUser?.isAdmin ? 'Es sind noch keine Community-Räume eingerichtet.' : 'Aktuell sind keine Community-Räume verfügbar.'}
          detail={currentUser?.isAdmin ? 'Die Raumabfrage war erfolgreich, aber es wurden keine aktiven Standardräume gefunden.' : 'Es wurden noch keine aktiven Räume freigeschaltet.'}
          action={currentUser?.isAdmin ? <AccentButton label={isSeedingRoom ? 'Räume werden ergänzt...' : 'Standardräume anlegen'} onPress={handleSeedRooms} disabled={isSeedingRoom} /> : null}
        />
      ) : accessRequirements.nonRulesRequirementsMet ? (
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
      ) : null}

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
  accessCard: {
    marginBottom: 12,
  },
  accessTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  accessCopy: {
    color: affairGoTheme.colors.text,
    lineHeight: 22,
    marginTop: 10,
  },
  requirementList: {
    marginTop: 14,
    gap: 10,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  requirementCopy: {
    flex: 1,
  },
  requirementLabel: {
    color: affairGoTheme.colors.text,
    fontWeight: '700',
  },
  requirementDetail: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 20,
    marginTop: 4,
  },
  requirementPill: {
    marginTop: 2,
  },
  accessError: {
    color: affairGoTheme.colors.warning,
    lineHeight: 20,
    marginTop: 12,
  },
  accessAction: {
    marginTop: 12,
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

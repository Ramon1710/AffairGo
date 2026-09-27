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
  buildCommunityRoomSections,
  formatCommunityEventDateLabel,
  getCommunityAccessState,
  getCommunityAccessRequirements,
  getCommunityNeedsRulesAcceptance,
  formatCommunityRulesVersionLabel,
  getCommunityActiveCountLabel,
  getCommunityRoomActivityLabel,
  getCommunityRoomTypeLabel,
  getCommunityRoomUnreadCount,
  getCommunityRoomUnreadLabel,
  getCommunityUnreadRoomsCount,
  hasUnreadCommunityRoom,
  isCommunityRulesAcceptanceConfirmed,
  mapCommunityErrorMessage,
  mergeCommunityRulesEnvelope,
  normalizeCommunityPresenceSummary,
  normalizeCommunityRulesEnvelope,
  normalizeCommunityRoom,
  normalizeCommunityRoomRead,
  sortCommunityRooms,
  COMMUNITY_RULES_UNCONFIRMED_MESSAGE,
} = require('../untils/communityChat');

const isDevEnvironment = typeof __DEV__ !== 'undefined' && __DEV__ === true;

const CommunityScreen = () => {
  const navigation = useNavigation();
  const { currentUser, refreshCurrentUserVerificationStatus, resendCurrentUserVerificationEmail } = useAffairGo();
  const rulesEnvelopeRef = useRef(null);
  const rulesLoadRequestIdRef = useRef(0);
  const isAcceptingRulesRef = useRef(false);
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
  const currentRulesVersion = String(rulesEnvelope?.version || '').trim();
  const acceptedRulesVersion = String(rulesEnvelope?.acceptedVersion || '').trim();
  const needsRulesAcceptance = getCommunityNeedsRulesAcceptance(rulesEnvelope);
  const showRulesModal = Boolean(rulesEnvelope) && rulesModalVisible;

  useEffect(() => {
    rulesEnvelopeRef.current = rulesEnvelope;
  }, [rulesEnvelope]);

  useEffect(() => {
    if (!accessRequirements.preRulesRequirementsMet || !rulesLoaded || !needsRulesAcceptance || !rulesEnvelope?.version) {
      return;
    }

    setRulesModalVisible(true);
  }, [accessRequirements.preRulesRequirementsMet, needsRulesAcceptance, rulesEnvelope?.version, rulesLoaded]);

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
      authEmailVerified: details.authEmailVerified ?? accessRequirements.authEmailVerified,
      profileEmailVerified: details.profileEmailVerified ?? accessRequirements.profileEmailVerified,
      effectiveEmailVerified: details.effectiveEmailVerified ?? accessRequirements.effectiveEmailVerified,
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

    if (options.keepModalOpen === true && mergedEnvelope.acceptedCurrent !== true) {
      setRulesModalVisible(true);
    } else if (mergedEnvelope.acceptedCurrent === true) {
      setRulesModalVisible(false);
    }

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

    if (!accessRequirements.preRulesRequirementsMet) {
      setRulesModalVisible(false);
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
  }, [accessRequirements.preRulesRequirementsMet, currentUser?.ageVerified, currentUser?.emailVerified, currentUser?.id]);

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
      statusLabel: accessRequirements.loggedIn ? '✓' : '!',
      detail: accessRequirements.loggedIn ? 'Konto angemeldet.' : 'Bitte melde dich zuerst an.',
    },
    {
      key: 'emailVerified',
      label: 'E-Mail-Adresse',
      met: accessRequirements.emailVerified,
      statusLabel: accessRequirements.emailVerified ? '✓' : '!',
      summary: accessRequirements.emailVerified ? 'E-Mail-Adresse bestätigt' : 'E-Mail-Adresse noch nicht bestätigt',
      detail: accessRequirements.emailVerified ? 'Deine E-Mail-Adresse ist bestätigt.' : 'Bitte bestätige deine E-Mail-Adresse, bevor du die Community nutzen kannst.',
    },
    {
      key: 'ageVerified',
      label: 'Volljährigkeit',
      met: accessRequirements.ageVerified,
      statusLabel: accessRequirements.ageVerified ? '✓' : '!',
      summary: accessRequirements.ageVerified ? 'Volljährigkeit bestätigt' : 'Volljährigkeit noch nicht bestätigt',
      detail: accessRequirements.ageVerified ? 'Deine Altersfreigabe ist hinterlegt.' : 'Der Community-Bereich ist nur für verifizierte Erwachsene freigeschaltet.',
    },
    {
      key: 'accountActive',
      label: 'Konto aktiv',
      met: accessRequirements.accountActive,
      statusLabel: accessRequirements.accountActive ? '✓' : '!',
      summary: accessRequirements.accountActive ? 'Konto aktiv' : 'Konto derzeit eingeschränkt',
      detail: accessRequirements.accountActive ? 'Für dein Konto liegt keine offene Löschanfrage vor.' : 'Mit offener Löschanfrage bleibt die Community gesperrt.',
    },
    {
      key: 'moderationAllowed',
      label: 'Community-Zugang',
      met: accessRequirements.moderationAllowed,
      statusLabel: accessRequirements.moderationAllowed ? '✓' : '!',
      summary: accessRequirements.moderationAllowed ? 'Community-Zugang erlaubt' : 'Community-Zugang eingeschränkt',
      detail: accessRequirements.moderationAllowed ? 'Dein Konto hat derzeit keine Community-Einschränkung.' : 'Dein Community-Zugang ist derzeit eingeschränkt.',
    },
    {
      key: 'rulesAccepted',
      label: 'Community-Regeln',
      met: accessRequirements.rulesAccepted,
      blocked: !accessRequirements.preRulesRequirementsMet,
      statusLabel: accessRequirements.rulesAccepted ? '✓' : accessRequirements.preRulesRequirementsMet ? '!' : '○',
      summary: accessRequirements.rulesAccepted ? 'Community-Regeln akzeptiert' : accessRequirements.preRulesRequirementsMet ? 'Community-Regeln noch akzeptieren' : 'Community-Regeln',
      detail: accessRequirements.rulesAccepted
        ? 'Die aktuelle Regelversion ist bestätigt.'
        : accessRequirements.preRulesRequirementsMet
          ? 'Vor dem Chat-Einstieg musst du noch die aktuellen Regeln akzeptieren.'
          : 'Die Community-Regeln kannst du bestätigen, sobald die vorherigen Voraussetzungen erfüllt sind.',
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
  const communityAccessState = useMemo(() => getCommunityAccessState({
    accessRequirements,
    rulesEnvelope,
    rulesLoaded,
    rulesError,
    roomsLoaded,
    readsLoaded,
    loadError,
    roomCount: roomsWithPresence.length,
  }), [accessRequirements, loadError, readsLoaded, roomsLoaded, roomsWithPresence.length, rulesEnvelope, rulesError, rulesLoaded]);

  const openRoom = (roomId) => {
    if (needsRulesAcceptance) {
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

  const handleRetryCommunity = async () => {
    setAccessActionError('');
    setLoadError('');
    setRulesError('');
    setRoomsLoaded(false);
    setRulesLoaded(false);

    try {
      if (currentUser?.id && accessRequirements.preRulesRequirementsMet) {
        await refreshRulesStatus({ userId: currentUser.id });
      }
    } catch (error) {
      setRulesError('Die Community konnte nicht geladen werden. Bitte versuche es erneut.');
    } finally {
      setRulesLoaded(true);
      setRoomsQueryKey((previous) => previous + 1);
    }
  };

  const handleRefreshEmailVerification = async () => {
    try {
      setIsRefreshingEmailVerification(true);
      setAccessActionError('');
      const result = await refreshCurrentUserVerificationStatus();

      logCommunityOverviewDebug('email-verification-refresh-complete', result);

      if (!result?.effectiveEmailVerified) {
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

      logCommunityOverviewDebug('email-verification-resend-complete', {
        authEmailVerified: result?.alreadyVerified ? true : accessRequirements.authEmailVerified,
        profileEmailVerified: accessRequirements.profileEmailVerified,
        effectiveEmailVerified: result?.alreadyVerified ? true : accessRequirements.effectiveEmailVerified,
      });

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

  const openRulesModal = () => {
    if (!rulesEnvelope) {
      return;
    }

    setRulesError('');
    setRulesModalVisible(true);
  };

  const handleAcceptRules = async () => {
    // Ref-Lock verhindert einen zweiten Request bei Doppelklick, unabhängig vom State-Batching.
    if (!rulesEnvelope?.version || isAcceptingRulesRef.current) {
      return;
    }

    const requestedVersion = String(rulesEnvelope.version || '').trim();
    isAcceptingRulesRef.current = true;
    setIsAcceptingRules(true);
    setRulesError('');

    if (isDevEnvironment) {
      console.log('[CommunityRules] ACCEPT_CLICK', {
        functionName: 'acceptCommunityRules',
        region: 'europe-west1',
        rulesVersion: requestedVersion,
        hasUid: Boolean(auth.currentUser?.uid),
        currentRulesVersion,
        acceptedRulesVersion,
        needsRulesAcceptance,
      });
    }

    let acceptResponse = null;

    try {
      acceptResponse = await acceptCommunityRules({ rulesVersion: requestedVersion });
    } catch (error) {
      if (isDevEnvironment) {
        console.error('[CommunityRules] ACCEPT_CALLABLE_ERROR', {
          code: error?.code,
          message: error?.message,
          reason: error?.details?.reason,
        });
      }

      const reason = String(error?.details?.reason || '').toLowerCase();

      if (['email_not_verified', 'age_not_verified', 'account_pending_deletion', 'moderation_restricted'].includes(reason)) {
        setRulesModalVisible(false);
        setRulesError('');
      } else {
        // Modal bleibt offen, lokaler Akzeptanzstatus wird nicht auf Erfolg gesetzt.
        setRulesError(mapCommunityErrorMessage(error, 'accept'));
      }

      isAcceptingRulesRef.current = false;
      setIsAcceptingRules(false);
      return;
    }

    if (isDevEnvironment) {
      console.log('[CommunityRules] ACCEPT_SERVER_SUCCESS', { result: acceptResponse });
    }

    if (acceptResponse?.ok !== true) {
      logCommunityOverviewDebug('accept-response-not-ok', {
        acceptResponse,
      });
      setRulesError(mapCommunityErrorMessage(new Error('accept_not_ok'), 'accept'));
      isAcceptingRulesRef.current = false;
      setIsAcceptingRules(false);
      return;
    }

    // Erfolg nur nach serverseitig bestätigtem Reload wirksam machen, kein optimistisches Schließen.
    let confirmedEnvelope = null;

    try {
      confirmedEnvelope = await refreshRulesStatus({ userId: currentUser.id, preserveAcceptedState: false });
    } catch (error) {
      logCommunityOverviewDebug('rules-refresh-after-accept-failed', {
        error,
        query: 'post-accept:getCommunityRules',
        communityRulesVersion: requestedVersion,
      });
    }

    const isConfirmed = isCommunityRulesAcceptanceConfirmed(confirmedEnvelope, requestedVersion);

    if (isDevEnvironment) {
      console.log('[CommunityRules] ACCEPT_GATE_RESULT', {
        currentRulesVersion: String(confirmedEnvelope?.version || '').trim(),
        acceptedRulesVersionAfter: String(confirmedEnvelope?.acceptedVersion || '').trim(),
        needsRulesAcceptanceAfter: !isConfirmed,
      });
    }

    if (isConfirmed) {
      setRulesModalVisible(false);
      setRulesError('');
      setRoomsQueryKey((previous) => previous + 1);
    } else {
      // Ein verspäteter/veralteter Snapshot darf den offenen Zustand nicht als Erfolg tarnen.
      setRulesError(COMMUNITY_RULES_UNCONFIRMED_MESSAGE);
    }

    isAcceptingRulesRef.current = false;
    setIsAcceptingRules(false);
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
          <Pressable onPress={openRulesModal} style={styles.rulesLink}>
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

      {!accessRequirements.preRulesRequirementsMet ? (
        <GlassCard strong style={styles.accessCard}>
          <Text style={styles.accessTitle}>Zugang zur Community</Text>
          <Text style={styles.accessCopy}>Für die Nutzung der Night-Whisper Community müssen folgende Voraussetzungen erfüllt sein.</Text>
          <View style={styles.requirementList}>
            {requirementItems.map((item) => (
              <View key={item.key} style={styles.requirementRow}>
                <View style={styles.requirementCopy}>
                  <Text style={styles.requirementLabel}>{item.label}</Text>
                  <Text style={styles.requirementSummary}>{item.statusLabel} {item.summary || item.label}</Text>
                  <Text style={styles.requirementDetail}>{item.detail}</Text>
                </View>
                <StatusPill label={item.met ? 'Erfüllt' : item.blocked ? 'Später' : 'Offen'} tone={item.met ? 'success' : item.blocked ? 'default' : 'warning'} style={styles.requirementPill} />
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
                label={isRefreshingEmailVerification ? 'Status wird geprüft...' : 'Status erneut prüfen'}
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
          {accessRequirements.loggedIn && !accessRequirements.ageVerified ? (
            <AccentButton label="Altersverifikation starten" variant="secondary" onPress={openCommunityAccessProfile} style={styles.accessAction} />
          ) : null}
          {accessRequirements.loggedIn && accessRequirements.ageVerified && (!accessRequirements.accountActive || !accessRequirements.moderationAllowed) ? (
            <AccentButton label="Zum Profil" variant="secondary" onPress={openCommunityAccessProfile} style={styles.accessAction} />
          ) : null}
        </GlassCard>
      ) : null}

      {rulesLoaded && rulesEnvelope && needsRulesAcceptance ? (
        <InfoBanner
          title="Regelzustimmung erforderlich"
          detail="Bitte akzeptiere zuerst die aktuellen Community-Regeln. Die Raumübersicht bleibt sichtbar, einzelne Räume bleiben bis zur Zustimmung gesperrt."
          tone="warning"
          style={styles.infoBanner}
        />
      ) : null}

      {rulesError && communityAccessState.status === 'allowed' ? (
        <InfoBanner
          title="Community-Regeln derzeit nicht erreichbar"
          detail={rulesError}
          tone="warning"
          style={styles.infoBanner}
        />
      ) : null}

      {accessRequirements.preRulesRequirementsMet && communityAccessState.status === 'loading' ? (
        <GlassCard strong style={styles.stateCard}>
          <ActivityIndicator size="small" color={affairGoTheme.colors.accent} />
          <Text style={styles.stateTitle}>Community-Räume werden geladen …</Text>
        </GlassCard>
      ) : accessRequirements.preRulesRequirementsMet && communityAccessState.status === 'backend_error' ? (
        <GlassCard strong style={styles.stateCard}>
          <Text style={styles.stateTitle}>{communityAccessState.message || loadError || rulesError}</Text>
          <AccentButton label="Erneut versuchen" onPress={handleRetryCommunity} style={styles.stateAction} />
        </GlassCard>
      ) : accessRequirements.preRulesRequirementsMet && communityAccessState.status === 'empty' ? (
        <EmptyState
          title={currentUser?.isAdmin ? 'Es sind noch keine Community-Räume eingerichtet.' : 'Aktuell sind keine Community-Räume verfügbar.'}
          detail={currentUser?.isAdmin ? 'Die Raumabfrage war erfolgreich, aber es wurden keine aktiven Standardräume gefunden.' : 'Es wurden noch keine aktiven Räume freigeschaltet.'}
          action={currentUser?.isAdmin ? <AccentButton label={isSeedingRoom ? 'Räume werden ergänzt...' : 'Standardräume anlegen'} onPress={handleSeedRooms} disabled={isSeedingRoom} /> : null}
        />
      ) : accessRequirements.preRulesRequirementsMet && ['allowed', 'rules_acceptance_required'].includes(communityAccessState.status) ? (
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
        visible={showRulesModal}
        animationType="slide"
        transparent
        onRequestClose={() => setRulesModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <GlassCard strong style={styles.rulesModalCard}>
            <View style={styles.rulesModalHeader}>
              <View style={styles.rulesModalCopy}>
                <Text style={styles.rulesModalEyebrow}>Night-Whisper Community</Text>
                <Text style={styles.rulesModalTitle}>{rulesEnvelope?.title || 'Community-Regeln'}</Text>
                <Text style={styles.rulesModalMeta}>{rulesVersionLabel}</Text>
              </View>
              {(!needsRulesAcceptance || !isAcceptingRules) ? (
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

            {rulesError ? <Text style={styles.errorText}>{rulesError}</Text> : null}

            {needsRulesAcceptance ? (
              <InfoBanner
                title="Zustimmung erforderlich"
                detail="Der offene Community-Chat ändert nichts an Matching, privaten Nachrichten oder Kontaktgrenzen auf Night-Whisper."
                tone="warning"
              />
            ) : null}

            <View style={styles.rulesActions}>
              {needsRulesAcceptance ? (
                <AccentButton
                  label={isAcceptingRules ? 'Regeln werden bestätigt...' : 'Regeln akzeptieren'}
                  onPress={handleAcceptRules}
                  disabled={isAcceptingRules || !rulesEnvelope?.version}
                />
              ) : null}
              <AccentButton
                label={!needsRulesAcceptance ? 'Schließen' : 'Zurück'}
                variant="ghost"
                onPress={() => setRulesModalVisible(false)}
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
  requirementSummary: {
    color: affairGoTheme.colors.text,
    fontWeight: '600',
    marginTop: 4,
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

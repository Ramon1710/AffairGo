import { collection, collectionGroup, doc, getDoc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { AccentButton, AppBackground, EmptyState, GlassCard, InfoBanner, ScreenHeader, StatusPill } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme } from '../constants/affairGoTheme';
import {
    acceptCommunityRules,
    blockCommunityUser,
    getCommunityRules,
    markCommunityRoomRead,
    reportCommunityContent,
    sendCommunityMessage,
    syncEventCommunityRooms,
    toggleCommunityReaction,
    touchCommunityPresence,
    unblockCommunityUser,
} from '../constants/communityChatProvider';
import { useAffairGo } from '../context/AffairGoContext';
import { auth, db } from '../firebase';
import { useCurrentRoute, useNavigation } from '../naviagtion/SimpleNavigation';

const {
  COMMUNITY_FALLBACK_NICKNAME,
  COMMUNITY_MESSAGE_COUNTER_THRESHOLD,
  COMMUNITY_MESSAGE_MAX_LENGTH,
  COMMUNITY_REPORT_COMMENT_MAX_LENGTH,
  COMMUNITY_REPORT_REASON_OPTIONS,
  COMMUNITY_ROOM_ROUTE_FALLBACK,
  buildAcceptedCommunityRulesEnvelope,
  buildCommunityMentionsPayload,
  clampCommunityDraft,
  findCommunityUnreadDividerIndex,
  formatCommunityEventDateLabel,
  formatCommunityDateTime,
  formatCommunityRulesVersionLabel,
  getCommunityAccessRequirements,
  getPreparedCommunityText,
  getCommunityMentionMatch,
  getCommunityReactionSummary,
  getCommunityRoomTypeLabel,
  insertCommunityMention,
  mapCommunityErrorMessage,
  mergeCommunityRulesEnvelope,
  normalizeCommunityMessage,
  normalizeCommunityRulesEnvelope,
  normalizeCommunityRoom,
  normalizeCommunityRoomRead,
} = require('../untils/communityChat');

const BOTTOM_THRESHOLD_PX = 72;
const PROFILE_FALLBACK = COMMUNITY_FALLBACK_NICKNAME || 'Night-Whisper Mitglied';

const CommunityRoomScreen = () => {
  const navigation = useNavigation();
  const route = useCurrentRoute();
  const roomId = String(route?.params?.roomId || COMMUNITY_ROOM_ROUTE_FALLBACK);
  const { currentUser, users, chats, getProfileTravelSummary, resendCurrentUserVerificationEmail, verifyPendingEmail } = useAffairGo();
  const listRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const hasInitialScrollRef = useRef(false);
  const lastMessageIdRef = useRef('');
  const roomListenerRef = useRef(null);
  const messagesListenerRef = useRef(null);
  const reactionsListenerRef = useRef(null);
  const blocksListenerRef = useRef(null);
  const readStateListenerRef = useRef(null);
  const previousVisibleCountRef = useRef(0);
  const visitReadStateInitializedRef = useRef(false);
  const rulesEnvelopeRef = useRef(null);
  const rulesLoadRequestIdRef = useRef(0);
  const [room, setRoom] = useState(null);
  const [roomLoaded, setRoomLoaded] = useState(false);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [readState, setReadState] = useState(null);
  const [visitReadState, setVisitReadState] = useState(null);
  const [myReactionKeys, setMyReactionKeys] = useState({});
  const [blockedEntries, setBlockedEntries] = useState([]);
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [replyTargetId, setReplyTargetId] = useState('');
  const [profileUserId, setProfileUserId] = useState('');
  const [busyReactionKey, setBusyReactionKey] = useState('');
  const [busySafetyActionKey, setBusySafetyActionKey] = useState('');
  const [actionMessageId, setActionMessageId] = useState('');
  const [blockConfirmUser, setBlockConfirmUser] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState(COMMUNITY_REPORT_REASON_OPTIONS[0].value);
  const [reportComment, setReportComment] = useState('');
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [pendingNewCount, setPendingNewCount] = useState(0);
  const [rulesEnvelope, setRulesEnvelope] = useState(null);
  const [rulesLoaded, setRulesLoaded] = useState(false);
  const [isAcceptingRules, setIsAcceptingRules] = useState(false);
  const [rulesError, setRulesError] = useState('');
  const [accessActionError, setAccessActionError] = useState('');
  const [isRefreshingEmailVerification, setIsRefreshingEmailVerification] = useState(false);
  const [isResendingVerificationEmail, setIsResendingVerificationEmail] = useState(false);

  const accessRequirements = useMemo(() => getCommunityAccessRequirements(currentUser, auth.currentUser, rulesEnvelope), [currentUser, rulesEnvelope]);

  const preparedDraft = useMemo(() => getPreparedCommunityText(draft), [draft]);
  const characterCount = draft.length;
  const canSend = Boolean(preparedDraft) && characterCount <= COMMUNITY_MESSAGE_MAX_LENGTH && !isSending && Boolean(room?.active);
  const roomMissing = roomLoaded && !room;
  const roomInactive = roomLoaded && room?.active === false;
  const messageMap = useMemo(() => Object.fromEntries(messages.map((message) => [message.id, message])), [messages]);
  const blockedUserIds = useMemo(() => new Set(blockedEntries.map((entry) => entry.blockedUserId).filter(Boolean)), [blockedEntries]);
  const visibleMessages = useMemo(() => messages.filter((message) => !blockedUserIds.has(message.userId)), [blockedUserIds, messages]);
  const participantDirectory = useMemo(() => {
    const nextEntries = new Map();

    messages.forEach((message) => {
      if (!message.userId || blockedUserIds.has(message.userId)) {
        return;
      }

      const profile = users.find((entry) => entry.id === message.userId) || null;
      nextEntries.set(message.userId, {
        userId: message.userId,
        nickname: message.nickname || profile?.nickname || PROFILE_FALLBACK,
        profile,
      });
    });

    if (currentUser?.id) {
      nextEntries.set(currentUser.id, {
        userId: currentUser.id,
        nickname: currentUser.nickname || PROFILE_FALLBACK,
        profile: currentUser,
      });
    }

    return Array.from(nextEntries.values());
  }, [blockedUserIds, currentUser, messages, users]);
  const mentionMatch = useMemo(() => getCommunityMentionMatch(draft), [draft]);
  const mentionSuggestions = useMemo(() => {
    if (!mentionMatch) {
      return [];
    }

    const normalizedQuery = mentionMatch.query.toLowerCase();
    return participantDirectory
      .filter((entry) => entry.userId !== currentUser.id)
      .filter((entry) => !normalizedQuery || entry.nickname.toLowerCase().includes(normalizedQuery))
      .slice(0, 5);
  }, [currentUser.id, mentionMatch, participantDirectory]);
  const replyTarget = replyTargetId ? messageMap[replyTargetId] || null : null;
  const selectedProfile = profileUserId ? participantDirectory.find((entry) => entry.userId === profileUserId)?.profile || null : null;
  const hasPrivateMatch = Boolean(selectedProfile?.id) && chats.some((chat) => chat.userId === selectedProfile.id && chat.match);
  const currentUserReactionMap = useMemo(() => myReactionKeys, [myReactionKeys]);
  const selectedActionMessage = actionMessageId ? messageMap[actionMessageId] || null : null;
  const selectedActionProfile = selectedActionMessage ? (participantDirectory.find((entry) => entry.userId === selectedActionMessage.userId)?.profile || null) : null;
  const selectedProfileIsBlocked = Boolean(selectedProfile?.id) && blockedUserIds.has(selectedProfile.id);
  const rulesAcceptedCurrent = rulesEnvelope?.acceptedCurrent === true;
  const rulesVersionLabel = formatCommunityRulesVersionLabel(rulesEnvelope?.version);
  const requirementItems = [
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
      detail: accessRequirements.ageVerified ? 'Die Altersfreigabe ist vorhanden.' : 'Dieser Bereich ist nur für verifizierte Erwachsene verfügbar.',
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
      detail: accessRequirements.rulesAccepted ? 'Die aktuelle Regelversion ist bestätigt.' : 'Vor dem Lesen und Schreiben in diesem Raum musst du noch die aktuellen Regeln akzeptieren.',
    },
  ];
  const unreadDividerIndex = useMemo(() => findCommunityUnreadDividerIndex(visibleMessages, visitReadState), [visibleMessages, visitReadState]);

  useEffect(() => {
    rulesEnvelopeRef.current = rulesEnvelope;
  }, [rulesEnvelope]);

  const logCommunityRoomRulesDebug = (scope, details = {}) => {
    const error = details.error || null;

    console.warn('[CommunityRoomScreen]', {
      scope,
      route: `/community/room/${roomId}`,
      roomId,
      errorCode: typeof error?.code === 'string' ? error.code : null,
      errorMessage: typeof error?.message === 'string' ? error.message : null,
      currentRulesVersion: details.currentRulesVersion ?? rulesEnvelopeRef.current?.version ?? null,
      acceptedRulesVersion: details.acceptedRulesVersion ?? rulesEnvelopeRef.current?.acceptedVersion ?? null,
      acceptedRulesVersionAfter: details.acceptedRulesVersionAfter ?? null,
      needsRulesAcceptance: details.needsRulesAcceptance ?? null,
      acceptResponse: details.acceptResponse ?? null,
      uid: currentUser?.id || null,
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

  const applyRulesEnvelope = (nextEnvelope) => {
    const mergedEnvelope = mergeCommunityRulesEnvelope(rulesEnvelopeRef.current, nextEnvelope);
    rulesEnvelopeRef.current = mergedEnvelope;
    setRulesEnvelope(mergedEnvelope);
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
      logCommunityRoomRulesDebug('rules-callable-failed', { error });

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
        logCommunityRoomRulesDebug('rules-fallback-failed', { error: fallbackError });

        if (requestId !== rulesLoadRequestIdRef.current) {
          return null;
        }

        if (!preserveAcceptedState) {
          setRulesEnvelope(null);
          rulesEnvelopeRef.current = null;
          setRulesError('Deine Zustimmung konnte nicht geprüft werden. Bitte versuche es erneut.');
        }

        throw error;
      }
    }
  };

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
  }, [accessRequirements.nonRulesRequirementsMet, currentUser?.id]);

  const handleAcceptRules = async () => {
    if (!rulesEnvelope?.version || isAcceptingRules) {
      return;
    }

    try {
      setIsAcceptingRules(true);
      setRulesError('');
      logCommunityRoomRulesDebug('rules-accept-start', {
        currentRulesVersion: rulesEnvelope.version,
        acceptedRulesVersion: rulesEnvelope.acceptedVersion,
        needsRulesAcceptance: rulesEnvelope.acceptedCurrent !== true,
      });
      const acceptResponse = await acceptCommunityRules({ rulesVersion: rulesEnvelope.version });
      const acceptedEnvelope = buildAcceptedCommunityRulesEnvelope(rulesEnvelopeRef.current || rulesEnvelope, acceptResponse);
      applyRulesEnvelope(acceptedEnvelope);
      logCommunityRoomRulesDebug('rules-accept-success', {
        currentRulesVersion: acceptedEnvelope.version,
        acceptedRulesVersion: rulesEnvelope.acceptedVersion,
        acceptedRulesVersionAfter: acceptedEnvelope.acceptedVersion,
        needsRulesAcceptance: acceptedEnvelope.acceptedCurrent !== true,
        acceptResponse,
      });
      refreshRulesStatus({ userId: currentUser.id, preserveAcceptedState: true }).catch((error) => {
        logCommunityRoomRulesDebug('rules-refresh-after-accept-failed', { error });
      });
    } catch (error) {
      setRulesError('Deine Zustimmung konnte nicht gespeichert werden. Bitte versuche es erneut.');
    } finally {
      setIsAcceptingRules(false);
    }
  };

  const scrollToLatest = (animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd?.({ animated });
      isNearBottomRef.current = true;
      setShowJumpToLatest(false);
      setPendingNewCount(0);
    });
  };

  useEffect(() => {
    syncEventCommunityRooms({ roomId }).catch(() => {});
    roomListenerRef.current?.();
    setRoomLoaded(false);
    setLoadError('');

    if (!accessRequirements.canReadOverview) {
      setRoom(null);
      setRoomLoaded(true);
      return undefined;
    }

    const roomRef = doc(db, 'communityRooms', roomId);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      setRoomLoaded(true);
      setLoadError('');

      if (!snapshot.exists()) {
        setRoom(null);
        return;
      }

      setRoom(normalizeCommunityRoom({ id: snapshot.id, ...snapshot.data() }, snapshot.id));
    }, (error) => {
      setRoomLoaded(true);
      setRoom(null);
      setLoadError(mapCommunityErrorMessage(error, 'load'));
    });

    roomListenerRef.current = unsubscribe;

    return () => {
      unsubscribe();
    };
  }, [accessRequirements.canReadOverview, roomId]);

  useEffect(() => {
    messagesListenerRef.current?.();
    setMessages([]);
    setMessagesLoaded(false);
    hasInitialScrollRef.current = false;
    lastMessageIdRef.current = '';
    setShowJumpToLatest(false);
    setPendingNewCount(0);
    previousVisibleCountRef.current = 0;

    if (!accessRequirements.canReadMessages || !room?.id || room.active !== true) {
      setMessagesLoaded(true);
      return undefined;
    }

    const messagesQuery = query(
      collection(db, 'communityRooms', room.id, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(50),
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const nextMessages = snapshot.docs
        .map((messageDoc) => normalizeCommunityMessage({ id: messageDoc.id, ...messageDoc.data() }, messageDoc.id))
        .reverse();

      setMessages(nextMessages);
      setMessagesLoaded(true);
      setLoadError('');
    }, (error) => {
      setMessagesLoaded(true);
      setMessages([]);
      setLoadError(mapCommunityErrorMessage(error, 'load'));
    });

    messagesListenerRef.current = unsubscribe;

    return () => {
      unsubscribe();
    };
  }, [accessRequirements.canReadMessages, room?.active, room?.id]);

  useEffect(() => {
    readStateListenerRef.current?.();
    setReadState(null);
    setVisitReadState(null);
    visitReadStateInitializedRef.current = false;

    if (!accessRequirements.canReadMessages || !currentUser?.id || !roomId) {
      return undefined;
    }

    const readRef = doc(db, 'communityRoomReads', `${currentUser.id}__${roomId}`);
    const unsubscribe = onSnapshot(readRef, (snapshot) => {
      const nextReadState = snapshot.exists() ? normalizeCommunityRoomRead({ id: snapshot.id, ...snapshot.data() }, snapshot.id) : null;
      setReadState(nextReadState);
      if (!visitReadStateInitializedRef.current) {
        visitReadStateInitializedRef.current = true;
        setVisitReadState(nextReadState);
      }
    }, () => {
      setReadState(null);
    });

    readStateListenerRef.current = unsubscribe;

    return () => {
      unsubscribe();
    };
  }, [accessRequirements.canReadMessages, currentUser?.id, roomId]);

  useEffect(() => {
    blocksListenerRef.current?.();
    setBlockedEntries([]);

    if (!accessRequirements.canReadMessages || !currentUser?.id) {
      return undefined;
    }

    const blocksQuery = query(collection(db, 'communityBlocks'), where('blockerUserId', '==', currentUser.id));
    const unsubscribe = onSnapshot(blocksQuery, (snapshot) => {
      setBlockedEntries(snapshot.docs.map((blockDoc) => ({ id: blockDoc.id, ...blockDoc.data() })));
    }, (error) => {
      setSendError(mapCommunityErrorMessage(error, 'load'));
    });

    blocksListenerRef.current = unsubscribe;

    return () => {
      unsubscribe();
    };
  }, [accessRequirements.canReadMessages, currentUser?.id]);

  useEffect(() => {
    reactionsListenerRef.current?.();
    setMyReactionKeys({});

    if (!accessRequirements.canReadMessages || !room?.id || !currentUser?.id) {
      return undefined;
    }

    const reactionsQuery = query(
      collectionGroup(db, 'reactions'),
      where('roomId', '==', room.id),
      where('userId', '==', currentUser.id),
    );
    const unsubscribe = onSnapshot(reactionsQuery, (snapshot) => {
      const nextReactionKeys = snapshot.docs.reduce((result, reactionDoc) => {
        const data = reactionDoc.data() || {};
        const messageId = String(data.messageId || '');
        const reactionType = String(data.reactionType || '');

        if (!messageId || !reactionType) {
          return result;
        }

        return {
          ...result,
          [`${messageId}:${reactionType}`]: true,
        };
      }, {});

      setMyReactionKeys(nextReactionKeys);
    });

    reactionsListenerRef.current = unsubscribe;

    return () => {
      unsubscribe();
    };
  }, [accessRequirements.canReadMessages, currentUser?.id, room?.id]);

  useEffect(() => {
    const latestMessageId = visibleMessages[visibleMessages.length - 1]?.id || messages[messages.length - 1]?.id || '';

    if (!latestMessageId) {
      lastMessageIdRef.current = '';
      return;
    }

    if (!hasInitialScrollRef.current) {
      hasInitialScrollRef.current = true;
      lastMessageIdRef.current = latestMessageId;
      scrollToLatest(false);
      markCommunityRoomRead({ roomId, lastReadMessageId: latestMessageId }).catch(() => {});
      return;
    }

    if (latestMessageId === lastMessageIdRef.current) {
      return;
    }

    lastMessageIdRef.current = latestMessageId;

    if (isNearBottomRef.current) {
      scrollToLatest(true);
      markCommunityRoomRead({ roomId, lastReadMessageId: latestMessageId }).catch(() => {});
      return;
    }

    setShowJumpToLatest(true);
  }, [messages, roomId, visibleMessages]);

  useEffect(() => {
    if (!accessRequirements.canReadMessages || !room?.id || !rulesAcceptedCurrent) {
      return undefined;
    }

    touchCommunityPresence({ roomId: room.id }).catch(() => {});
    const timerId = setInterval(() => {
      touchCommunityPresence({ roomId: room.id }).catch(() => {});
    }, 60 * 1000);

    return () => {
      clearInterval(timerId);
    };
  }, [accessRequirements.canReadMessages, room?.id, rulesAcceptedCurrent]);

  useEffect(() => {
    const previousVisibleCount = previousVisibleCountRef.current;
    const nextVisibleCount = visibleMessages.length;

    if (isNearBottomRef.current) {
      setPendingNewCount(0);
    } else if (previousVisibleCount > 0 && nextVisibleCount > previousVisibleCount) {
      setPendingNewCount((previous) => previous + (nextVisibleCount - previousVisibleCount));
    }

    previousVisibleCountRef.current = nextVisibleCount;
  }, [visibleMessages]);

  useEffect(() => () => {
    roomListenerRef.current?.();
    messagesListenerRef.current?.();
    reactionsListenerRef.current?.();
    blocksListenerRef.current?.();
    readStateListenerRef.current?.();
  }, []);

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
      await resendCurrentUserVerificationEmail();
    } catch (error) {
      setAccessActionError(error.message || 'Die Verifizierungs-Mail konnte nicht erneut gesendet werden.');
    } finally {
      setIsResendingVerificationEmail(false);
    }
  };

  const handleSend = async () => {
    const text = preparedDraft;

    if (!text || !room?.active || isSending) {
      return;
    }

    try {
      setIsSending(true);
      setSendError('');
      await sendCommunityMessage(room.id, text, {
        replyToMessageId: replyTargetId || null,
        mentions: buildCommunityMentionsPayload({ text, participants: participantDirectory }),
      });
      touchCommunityPresence({ roomId: room.id }).catch(() => {});
      setDraft('');
      setReplyTargetId('');
    } catch (error) {
      setSendError(mapCommunityErrorMessage(error, 'send'));
    } finally {
      setIsSending(false);
    }
  };

  const handleDraftChange = (value) => {
    setDraft(clampCommunityDraft(value));
    if (sendError) {
      setSendError('');
    }
  };

  const handleListScroll = (event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = Math.max(0, contentSize.height - (contentOffset.y + layoutMeasurement.height));
    const nextNearBottom = distanceFromBottom <= BOTTOM_THRESHOLD_PX;

    isNearBottomRef.current = nextNearBottom;

    if (nextNearBottom && showJumpToLatest) {
      setShowJumpToLatest(false);
    }

    if (nextNearBottom) {
      const latestVisibleMessageId = visibleMessages[visibleMessages.length - 1]?.id || '';

      if (latestVisibleMessageId) {
        markCommunityRoomRead({ roomId, lastReadMessageId: latestVisibleMessageId }).catch(() => {});
      }
    }
  };

  const handleSelectMention = (nickname) => setDraft((currentDraft) => insertCommunityMention({ draft: currentDraft, nickname }));
  const handleOpenProfile = (userId) => userId && setProfileUserId(userId);
  const handleStartReply = (messageId) => setReplyTargetId(messageId);
  const handleOpenPrivateChat = () => {
    if (!selectedProfile?.id || !hasPrivateMatch) {
      return;
    }

    setProfileUserId('');
    navigation.navigate('Chat', { userId: selectedProfile.id });
  };
  const closeMessageActions = () => setActionMessageId('');
  const openBlockConfirm = (targetUser) => {
    if (!targetUser?.id || targetUser.id === currentUser.id) {
      return;
    }
    setBlockConfirmUser(targetUser);
  };

  const handleToggleReaction = async (messageId, reactionType) => {
    if (!room?.active || busyReactionKey) {
      return;
    }

    const reactionKey = `${messageId}:${reactionType}`;

    try {
      setBusyReactionKey(reactionKey);
      setSendError('');
      await toggleCommunityReaction({ roomId, messageId, reactionType });
      touchCommunityPresence({ roomId }).catch(() => {});
    } catch (error) {
      setSendError(mapCommunityErrorMessage(error, 'send'));
    } finally {
      setBusyReactionKey('');
    }
  };

  const handleConfirmBlock = async () => {
    if (!blockConfirmUser?.id) {
      return;
    }

    try {
      setBusySafetyActionKey(`block:${blockConfirmUser.id}`);
      setSendError('');
      await blockCommunityUser({ targetUserId: blockConfirmUser.id });
      setBlockConfirmUser(null);
      setProfileUserId('');
      closeMessageActions();
    } catch (error) {
      setSendError(mapCommunityErrorMessage(error, 'send'));
    } finally {
      setBusySafetyActionKey('');
    }
  };

  const handleUnblock = async (targetUserId) => {
    if (!targetUserId) {
      return;
    }

    try {
      setBusySafetyActionKey(`unblock:${targetUserId}`);
      setSendError('');
      await unblockCommunityUser({ targetUserId });
    } catch (error) {
      setSendError(mapCommunityErrorMessage(error, 'send'));
    } finally {
      setBusySafetyActionKey('');
    }
  };

  const openReportModal = ({ type, message = null, user = null }) => {
    setReportTarget({ type, message, user });
    setReportReason(COMMUNITY_REPORT_REASON_OPTIONS[0].value);
    setReportComment('');
  };

  const closeReportModal = () => {
    setReportTarget(null);
    setReportComment('');
  };

  const handleSubmitReport = async () => {
    if (!reportTarget) {
      return;
    }

    try {
      setBusySafetyActionKey(`report:${reportTarget.type}`);
      setSendError('');
      await reportCommunityContent({
        roomId,
        messageId: reportTarget.type === 'message' ? reportTarget.message?.id || null : null,
        targetUserId: reportTarget.type === 'user' ? reportTarget.user?.id || null : null,
        reason: reportReason,
        comment: reportComment,
      });
      closeReportModal();
      closeMessageActions();
      setProfileUserId('');
    } catch (error) {
      setSendError(mapCommunityErrorMessage(error, 'send'));
    } finally {
      setBusySafetyActionKey('');
    }
  };

  const renderMessage = ({ item, index }) => {
    const isOwnMessage = item.userId === currentUser.id;
    const replyPreview = item.replyToMessageId ? messageMap[item.replyToMessageId] || null : null;
    const reactions = getCommunityReactionSummary(item.reactionCounts);

    return (
      <>
        {index === unreadDividerIndex ? (
          <View style={styles.unreadDivider}>
            <Text style={styles.unreadDividerText}>Neue Nachrichten seit deinem letzten Besuch</Text>
          </View>
        ) : null}
        <View style={[styles.messageRow, isOwnMessage ? styles.messageRowMine : styles.messageRowTheirs]}>
          <View style={[
            styles.messageBubble,
            isOwnMessage ? styles.messageBubbleMine : styles.messageBubbleTheirs,
            item.removed ? styles.messageBubbleRemoved : null,
          ]}>
            {!item.removed ? (
              <Pressable onPress={() => handleOpenProfile(item.userId)} hitSlop={6}>
                <Text style={[styles.messageNickname, isOwnMessage ? styles.messageNicknameMine : null]}>{item.nickname || PROFILE_FALLBACK}</Text>
              </Pressable>
            ) : null}
            {replyPreview ? (
              <Pressable style={styles.replyPreviewBox} onPress={() => handleStartReply(replyPreview.id)}>
                <Text style={styles.replyPreviewNickname}>{replyPreview.nickname || PROFILE_FALLBACK}</Text>
                <Text style={styles.replyPreviewText} numberOfLines={2}>{replyPreview.text}</Text>
              </Pressable>
            ) : null}
            <Text style={[styles.messageText, item.removed ? styles.messageTextRemoved : null]}>{item.text}</Text>
            <Text style={styles.messageTime}>{item.timeLabel}</Text>
          </View>
          {!item.removed ? (
            <View style={[styles.messageMetaRow, isOwnMessage ? styles.messageMetaRowMine : null]}>
              <Pressable style={styles.replyAction} onPress={() => handleStartReply(item.id)}>
                <Ionicons name="return-up-back-outline" size={14} color={affairGoTheme.colors.textMuted} />
                <Text style={styles.replyActionText}>Antworten</Text>
              </Pressable>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reactionList}>
                {reactions.map((reaction) => {
                  const reactionKey = `${item.id}:${reaction.reactionType}`;
                  const active = Boolean(currentUserReactionMap[reactionKey]);

                  return (
                    <Pressable
                      key={reaction.reactionType}
                      onPress={() => handleToggleReaction(item.id, reaction.reactionType)}
                      disabled={busyReactionKey === reactionKey}
                      style={[styles.reactionChip, active ? styles.reactionChipActive : null]}
                    >
                      <Text style={styles.reactionChipText}>{reaction.emoji}</Text>
                      {reaction.count ? <Text style={styles.reactionChipCount}>{reaction.count}</Text> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
              {!isOwnMessage ? (
                <Pressable style={styles.moreAction} onPress={() => setActionMessageId(item.id)}>
                  <Ionicons name="ellipsis-horizontal" size={16} color={affairGoTheme.colors.textMuted} />
                  <Text style={styles.replyActionText}>Mehr</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </>
    );
  };

  const renderContent = () => {
    if (!accessRequirements.nonRulesRequirementsMet) {
      return (
        <GlassCard strong style={styles.stateCard}>
          <Text style={styles.stateTitle}>Dieser Raum bleibt gesperrt, bis alle Community-Voraussetzungen erfüllt sind.</Text>
          <Text style={styles.stateSubtitle}>Der Zielraum bleibt erhalten. Sobald deine Freigaben vollständig sind, kannst du direkt hier weiterlesen.</Text>
          <View style={styles.accessRequirementList}>
            {requirementItems.map((item) => (
              <View key={item.key} style={styles.accessRequirementRow}>
                <View style={styles.accessRequirementCopy}>
                  <Text style={styles.accessRequirementLabel}>{item.label}</Text>
                  <Text style={styles.accessRequirementDetail}>{item.detail}</Text>
                </View>
                <StatusPill label={item.met ? 'Erfüllt' : 'Offen'} tone={item.met ? 'success' : 'warning'} style={styles.accessRequirementPill} />
              </View>
            ))}
          </View>
          {accessActionError ? <Text style={styles.errorText}>{accessActionError}</Text> : null}
          {!accessRequirements.emailVerified ? (
            <>
              <AccentButton
                label={isRefreshingEmailVerification ? 'Bestätigung wird geprüft...' : 'Bestätigung prüfen'}
                onPress={handleRefreshEmailVerification}
                disabled={isRefreshingEmailVerification || isResendingVerificationEmail}
                style={styles.stateActionButton}
              />
              <AccentButton
                label={isResendingVerificationEmail ? 'Mail wird gesendet...' : 'Verifizierungs-Mail erneut senden'}
                variant="secondary"
                onPress={handleResendVerificationEmail}
                disabled={isRefreshingEmailVerification || isResendingVerificationEmail}
                style={styles.secondaryAction}
              />
            </>
          ) : null}
          {(!accessRequirements.ageVerified || !accessRequirements.accountActive || !accessRequirements.communityAllowed) ? (
            <AccentButton label="Zum Profil" variant="secondary" onPress={() => navigation.navigate('Profil')} style={styles.secondaryAction} />
          ) : null}
          <AccentButton
            label="Zur Community-Übersicht"
            variant="ghost"
            onPress={() => navigation.navigate('Community')}
            style={styles.secondaryAction}
          />
        </GlassCard>
      );
    }

    if (!rulesLoaded) {
      return (
        <GlassCard strong style={styles.stateCard}>
          <ActivityIndicator size="small" color={affairGoTheme.colors.accent} />
          <Text style={styles.stateTitle}>Community-Zugriff wird geprüft …</Text>
        </GlassCard>
      );
    }

    if (rulesEnvelope && !rulesAcceptedCurrent) {
      return (
        <GlassCard strong style={styles.stateCard}>
          <Text style={styles.stateTitle}>Bitte bestätige zuerst die aktuellen Community-Regeln.</Text>
          <Text style={styles.stateSubtitle}>{rulesVersionLabel}</Text>
          {rulesError ? <Text style={styles.errorText}>{rulesError}</Text> : null}
          <AccentButton
            label={isAcceptingRules ? 'Regeln werden bestätigt...' : 'Community-Regeln akzeptieren'}
            onPress={handleAcceptRules}
            disabled={isAcceptingRules || !rulesEnvelope?.version}
            style={styles.stateActionButton}
          />
          <AccentButton
            label="Zur Community-Übersicht"
            variant="ghost"
            onPress={() => navigation.navigate('Community')}
            disabled={isAcceptingRules}
            style={styles.secondaryAction}
          />
        </GlassCard>
      );
    }

    if (!roomLoaded) {
      return (
        <GlassCard strong style={styles.stateCard}>
          <ActivityIndicator size="small" color={affairGoTheme.colors.accent} />
          <Text style={styles.stateTitle}>Community-Raum wird geladen …</Text>
        </GlassCard>
      );
    }

    if (loadError) {
      return (
        <GlassCard strong style={styles.stateCard}>
          <Text style={styles.stateTitle}>{loadError}</Text>
        </GlassCard>
      );
    }

    if (roomMissing || roomInactive) {
      return (
        <GlassCard strong style={styles.stateCard}>
          <Text style={styles.stateTitle}>Dieser Community-Raum ist momentan nicht verfügbar.</Text>
        </GlassCard>
      );
    }

    if (!messagesLoaded) {
      return (
        <GlassCard strong style={styles.stateCard}>
          <ActivityIndicator size="small" color={affairGoTheme.colors.accent} />
          <Text style={styles.stateTitle}>Nachrichten werden geladen …</Text>
        </GlassCard>
      );
    }

    return (
      <View style={styles.chatPanel}>
        {visibleMessages.length ? (
          <FlatList
            ref={listRef}
            data={visibleMessages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageListContent}
            style={styles.messageList}
            onScroll={handleListScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
          />
        ) : (
          <EmptyState
            title={messages.length && blockedEntries.length ? 'Aktuell sind nur ausgeblendete Nachrichten vorhanden.' : 'Noch ist es hier ruhig.'}
            detail={messages.length && blockedEntries.length ? 'Du blendest derzeit Nachrichten blockierter Community-Nutzer aus.' : 'Schreib die erste Nachricht in diesem Raum.'}
          />
        )}

        {showJumpToLatest && visibleMessages.length ? (
          <Pressable style={styles.jumpButton} onPress={() => scrollToLatest(true)}>
            <Text style={styles.jumpButtonText}>{pendingNewCount > 0 ? `${pendingNewCount} neue Nachrichten ↓` : 'Neue Nachrichten ↓'}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <AppBackground scroll={false} contentContainerStyle={styles.screenContent}>
      <ScreenHeader
        title={room?.name || 'Community'}
        subtitle={room?.type === 'EVENT'
          ? `${formatCommunityEventDateLabel(room)}${room?.eventCity ? ` • ${room.eventCity}` : ''}`
          : room?.type ? getCommunityRoomTypeLabel(room.type) : 'Community'}
        leftAction={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color={affairGoTheme.colors.text} />
          </Pressable>
        }
        rightAction={room?.type === 'EVENT' && room?.eventId ? (
          <Pressable onPress={() => navigation.navigate('Event', { eventId: room.eventId })}>
            <Ionicons name="calendar-outline" size={24} color={affairGoTheme.colors.accentSoft} />
          </Pressable>
        ) : null}
      />

      <GlassCard strong style={styles.introCard}>
        <Text style={styles.introTitle}>{room?.name || 'Community-Raum'}</Text>
        <Text style={styles.introCopy}>{room?.description || 'Öffentlicher Raum für die Night-Whisper Community.'}</Text>
        <Text style={styles.introMeta}>
          {room?.type === 'EVENT'
            ? `${formatCommunityEventDateLabel(room)}${room?.eventTimeLabel ? ` • ${room.eventTimeLabel}` : ''}${room?.eventCity ? ` • ${room.eventCity}` : ''}`
            : room?.region ? `${getCommunityRoomTypeLabel(room.type)} • ${room.region}` : getCommunityRoomTypeLabel(room?.type || 'GLOBAL')}
        </Text>
        {room?.type === 'EVENT' && room?.eventId ? <AccentButton label="Event ansehen" variant="secondary" onPress={() => navigation.navigate('Event', { eventId: room.eventId })} style={styles.eventButton} /> : null}
      </GlassCard>

      <InfoBanner
        title="Community und private Nachrichten"
        detail="Private Nachrichten bleiben weiterhin an die Night-Whisper-Matchingregeln gebunden. Dieser Raum ist nur ein öffentlicher Community-Bereich."
        tone="warning"
        style={styles.infoBanner}
      />

      {blockedEntries.length ? (
        <GlassCard style={styles.blockedCard}>
          <Text style={styles.blockedTitle}>Blockierte Community-Nutzer</Text>
          {blockedEntries.map((entry) => (
            <View key={entry.id} style={styles.blockedRow}>
              <View style={styles.blockedCopy}>
                <Text style={styles.blockedName}>{entry.blockedNickname || PROFILE_FALLBACK}</Text>
                <Text style={styles.blockedMeta}>{formatCommunityDateTime(entry.createdAt) || 'Blockiert'}</Text>
              </View>
              <AccentButton
                label={busySafetyActionKey === `unblock:${entry.blockedUserId}` ? '...' : 'Entblocken'}
                variant="ghost"
                onPress={() => handleUnblock(entry.blockedUserId)}
                disabled={Boolean(busySafetyActionKey)}
              />
            </View>
          ))}
        </GlassCard>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
      >
        <View style={styles.flex}>{renderContent()}</View>

        <GlassCard strong style={styles.composerCard}>
          <Text style={styles.composerLabel}>Nachricht an {room?.name || 'diesen Raum'}</Text>
          {replyTarget ? (
            <View style={styles.replyComposerCard}>
              <View style={styles.replyComposerCopy}>
                <Text style={styles.replyComposerTitle}>Antwort an {replyTarget.nickname || PROFILE_FALLBACK}</Text>
                <Text style={styles.replyComposerText} numberOfLines={2}>{replyTarget.text}</Text>
              </View>
              <Pressable onPress={() => setReplyTargetId('')} hitSlop={6}>
                <Ionicons name="close" size={18} color={affairGoTheme.colors.textMuted} />
              </Pressable>
            </View>
          ) : null}
          <TextInput
            value={draft}
            onChangeText={handleDraftChange}
            placeholder="Schreibe eine öffentliche Nachricht"
            placeholderTextColor={affairGoTheme.colors.textMuted}
            multiline
            maxLength={COMMUNITY_MESSAGE_MAX_LENGTH}
            editable={!isSending && Boolean(room?.active)}
            style={styles.composerInput}
            textAlignVertical="top"
          />
          {mentionSuggestions.length ? (
            <View style={styles.mentionMenu}>
              {mentionSuggestions.map((entry) => (
                <Pressable key={entry.userId} style={styles.mentionMenuItem} onPress={() => handleSelectMention(entry.nickname)}>
                  <Text style={styles.mentionMenuName}>{entry.nickname}</Text>
                  <Text style={styles.mentionMenuMeta}>{entry.profile?.city || 'Community-Mitglied'}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {characterCount >= COMMUNITY_MESSAGE_COUNTER_THRESHOLD ? <Text style={styles.counterText}>{characterCount} / {COMMUNITY_MESSAGE_MAX_LENGTH}</Text> : null}
          {sendError ? <Text style={styles.errorText}>{sendError}</Text> : null}
          <AccentButton label={isSending ? 'Wird gesendet...' : 'Senden'} onPress={handleSend} disabled={!canSend} style={styles.sendButton} />
        </GlassCard>
      </KeyboardAvoidingView>

      <Modal visible={Boolean(profileUserId && selectedProfile)} animationType="fade" transparent onRequestClose={() => setProfileUserId('')}>
        <Pressable style={styles.modalBackdrop} onPress={() => setProfileUserId('')}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedProfile?.nickname || PROFILE_FALLBACK}</Text>
                <Text style={styles.modalSubtitle}>Community-Profilkarte</Text>
              </View>
              <Pressable onPress={() => setProfileUserId('')} hitSlop={6}>
                <Ionicons name="close" size={22} color={affairGoTheme.colors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.profileFactsRow}>
              {selectedProfile?.age ? <StatusPill label={`${selectedProfile.age} Jahre`} tone="info" style={styles.profileFact} /> : null}
              {selectedProfile?.city ? <StatusPill label={selectedProfile.city} tone="default" style={styles.profileFact} /> : null}
              {selectedProfile?.gender ? <StatusPill label={selectedProfile.gender} tone="default" style={styles.profileFact} /> : null}
            </View>

            {getProfileTravelSummary(selectedProfile || {}) ? (
              <GlassCard style={styles.profileTravelCard}>
                <Text style={styles.profileTravelTitle}>{getProfileTravelSummary(selectedProfile || {}).label}</Text>
                {getProfileTravelSummary(selectedProfile || {}).location ? <Text style={styles.profileTravelText}>Ort: {getProfileTravelSummary(selectedProfile || {}).location}</Text> : null}
                {getProfileTravelSummary(selectedProfile || {}).period ? <Text style={styles.profileTravelText}>Zeitraum: {getProfileTravelSummary(selectedProfile || {}).period}</Text> : null}
              </GlassCard>
            ) : null}

            <GlassCard style={styles.privateStateCard}>
              <Text style={styles.privateStateTitle}>Private Nachrichten</Text>
              <Text style={styles.privateStateText}>
                {selectedProfile?.id === currentUser.id
                  ? 'Das ist dein eigenes Profil innerhalb der Community.'
                  : hasPrivateMatch
                    ? 'Privat schreiben ist nur möglich, weil bereits ein bestehendes privates Match vorliegt.'
                    : 'Kein privates Match. Community-Räume öffnen keine privaten Nachrichten außerhalb der bestehenden Regeln.'}
              </Text>
              {selectedProfile?.id !== currentUser.id ? (
                <>
                  {hasPrivateMatch ? <AccentButton label="Privat schreiben" onPress={handleOpenPrivateChat} style={styles.privateAction} /> : <StatusPill label="Kein privates Match" tone="warning" style={styles.privateStatePill} />}
                  <AccentButton
                    label={selectedProfileIsBlocked ? 'Nutzer entblocken' : 'Nutzer blockieren'}
                    variant="secondary"
                    onPress={() => (selectedProfileIsBlocked ? handleUnblock(selectedProfile.id) : openBlockConfirm(selectedProfile))}
                    disabled={Boolean(busySafetyActionKey)}
                    style={styles.secondaryAction}
                  />
                  <AccentButton label="Nutzer melden" variant="ghost" onPress={() => openReportModal({ type: 'user', user: selectedProfile })} disabled={Boolean(busySafetyActionKey)} style={styles.secondaryAction} />
                </>
              ) : null}
            </GlassCard>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(selectedActionMessage)} animationType="fade" transparent onRequestClose={closeMessageActions}>
        <Pressable style={styles.modalBackdrop} onPress={closeMessageActions}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Nachrichtenaktionen</Text>
            <Text style={styles.modalSubtitle}>{selectedActionMessage?.nickname || PROFILE_FALLBACK}</Text>
            <AccentButton label="Antworten" variant="secondary" onPress={() => { handleStartReply(selectedActionMessage.id); closeMessageActions(); }} style={styles.secondaryAction} />
            <AccentButton label="Nutzerprofil" variant="secondary" onPress={() => { handleOpenProfile(selectedActionMessage.userId); closeMessageActions(); }} style={styles.secondaryAction} />
            <AccentButton label="Melden" variant="ghost" onPress={() => openReportModal({ type: 'message', message: selectedActionMessage, user: selectedActionProfile })} style={styles.secondaryAction} />
            {selectedActionMessage?.userId !== currentUser.id ? <AccentButton label="Blockieren" variant="ghost" onPress={() => openBlockConfirm(selectedActionProfile || { id: selectedActionMessage.userId, nickname: selectedActionMessage.nickname })} style={styles.secondaryAction} /> : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(blockConfirmUser)} animationType="fade" transparent onRequestClose={() => setBlockConfirmUser(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setBlockConfirmUser(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Nutzer blockieren?</Text>
            <Text style={styles.privateStateText}>Möchtest du diesen Nutzer wirklich blockieren?</Text>
            <Text style={styles.privateStateText}>Seine Nachrichten werden dir in der Community nicht mehr angezeigt.</Text>
            <AccentButton label={busySafetyActionKey === `block:${blockConfirmUser?.id}` ? 'Blockiere...' : 'Blockieren'} onPress={handleConfirmBlock} disabled={Boolean(busySafetyActionKey)} style={styles.privateAction} />
            <AccentButton label="Abbrechen" variant="ghost" onPress={() => setBlockConfirmUser(null)} style={styles.secondaryAction} />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(reportTarget)} animationType="fade" transparent onRequestClose={closeReportModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeReportModal}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Meldung senden</Text>
            <Text style={styles.modalSubtitle}>{reportTarget?.type === 'message' ? 'Community-Nachricht melden' : 'Community-Nutzer melden'}</Text>
            <View style={styles.reasonGrid}>
              {COMMUNITY_REPORT_REASON_OPTIONS.map((option) => (
                <Pressable key={option.value} onPress={() => setReportReason(option.value)} style={[styles.reasonChip, reportReason === option.value ? styles.reasonChipActive : null]}>
                  <Text style={[styles.reasonChipText, reportReason === option.value ? styles.reasonChipTextActive : null]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={reportComment}
              onChangeText={(value) => setReportComment(value.slice(0, COMMUNITY_REPORT_COMMENT_MAX_LENGTH))}
              placeholder="Zusätzliche Hinweise (optional)"
              placeholderTextColor={affairGoTheme.colors.textMuted}
              multiline
              maxLength={COMMUNITY_REPORT_COMMENT_MAX_LENGTH}
              style={styles.composerInput}
              textAlignVertical="top"
            />
            <Text style={styles.counterText}>{reportComment.length} / {COMMUNITY_REPORT_COMMENT_MAX_LENGTH}</Text>
            <AccentButton label={busySafetyActionKey.startsWith('report:') ? 'Wird gesendet...' : 'Meldung senden'} onPress={handleSubmitReport} disabled={Boolean(busySafetyActionKey)} style={styles.privateAction} />
            <AccentButton label="Abbrechen" variant="ghost" onPress={closeReportModal} style={styles.secondaryAction} />
          </Pressable>
        </Pressable>
      </Modal>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  screenContent: { flexGrow: 1 },
  flex: { flex: 1, minHeight: 0 },
  introCard: { marginBottom: 12 },
  introTitle: { color: affairGoTheme.colors.text, fontSize: 22, fontWeight: '700' },
  introCopy: { color: affairGoTheme.colors.text, lineHeight: 22, marginTop: 10 },
  introMeta: { color: affairGoTheme.colors.textMuted, marginTop: 8, lineHeight: 20 },
  infoBanner: { marginBottom: 10 },
  eventButton: { marginTop: 12 },
  blockedCard: { marginBottom: 12 },
  blockedTitle: { color: affairGoTheme.colors.text, fontWeight: '700', marginBottom: 10 },
  blockedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, gap: 10 },
  blockedCopy: { flex: 1 },
  blockedName: { color: affairGoTheme.colors.text, fontWeight: '600' },
  blockedMeta: { color: affairGoTheme.colors.textMuted, marginTop: 4, fontSize: 12 },
  stateCard: { alignItems: 'center', justifyContent: 'center', minHeight: 220, marginBottom: 12 },
  stateTitle: { color: affairGoTheme.colors.text, marginTop: 12, textAlign: 'center', lineHeight: 22 },
  stateSubtitle: { color: affairGoTheme.colors.textMuted, marginTop: 8, textAlign: 'center' },
  stateActionButton: { marginTop: 14 },
  accessRequirementList: { width: '100%', marginTop: 14, gap: 10 },
  accessRequirementRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  accessRequirementCopy: { flex: 1 },
  accessRequirementLabel: { color: affairGoTheme.colors.text, fontWeight: '700' },
  accessRequirementDetail: { color: affairGoTheme.colors.textMuted, lineHeight: 20, marginTop: 4 },
  accessRequirementPill: { marginTop: 2 },
  chatPanel: { flex: 1, minHeight: 0, marginBottom: 12, position: 'relative' },
  messageList: { flex: 1 },
  messageListContent: { paddingBottom: 12 },
  messageRow: { width: '100%', marginBottom: 10 },
  messageRowMine: { alignItems: 'flex-end' },
  messageRowTheirs: { alignItems: 'flex-start' },
  messageBubble: { maxWidth: '86%', borderRadius: affairGoTheme.radius.md, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  messageBubbleMine: { backgroundColor: 'rgba(255,67,67,0.26)', borderColor: 'rgba(255,122,100,0.5)' },
  messageBubbleTheirs: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: affairGoTheme.colors.line },
  messageBubbleRemoved: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.12)' },
  messageNickname: { color: affairGoTheme.colors.accentSoft, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  messageNicknameMine: { color: affairGoTheme.colors.accessHighlight },
  replyPreviewBox: { borderLeftWidth: 2, borderLeftColor: affairGoTheme.colors.accentSoft, paddingLeft: 10, marginBottom: 10 },
  replyPreviewNickname: { color: affairGoTheme.colors.accentSoft, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  replyPreviewText: { color: affairGoTheme.colors.textMuted, lineHeight: 18, fontSize: 13 },
  messageText: { color: affairGoTheme.colors.text, lineHeight: 22 },
  messageTextRemoved: { color: affairGoTheme.colors.textMuted, fontStyle: 'italic' },
  messageTime: { color: affairGoTheme.colors.textMuted, fontSize: 12, marginTop: 8, alignSelf: 'flex-end' },
  messageMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 10, maxWidth: '86%' },
  messageMetaRowMine: { alignSelf: 'flex-end' },
  replyAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  replyActionText: { color: affairGoTheme.colors.textMuted, fontSize: 12, fontWeight: '600' },
  moreAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reactionList: { gap: 8 },
  reactionChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: affairGoTheme.radius.pill, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: affairGoTheme.colors.line, gap: 6 },
  reactionChipActive: { backgroundColor: 'rgba(255,67,67,0.2)', borderColor: 'rgba(255,122,100,0.45)' },
  reactionChipText: { fontSize: 14 },
  reactionChipCount: { color: affairGoTheme.colors.text, fontSize: 12, fontWeight: '700' },
  jumpButton: { position: 'absolute', right: 8, bottom: 8, borderRadius: affairGoTheme.radius.pill, backgroundColor: affairGoTheme.colors.cardStrong, borderWidth: 1, borderColor: affairGoTheme.colors.lineStrong, paddingHorizontal: 14, paddingVertical: 10 },
  jumpButtonText: { color: affairGoTheme.colors.text, fontWeight: '700' },
  composerCard: { marginBottom: Platform.OS === 'web' ? 0 : 8 },
  composerLabel: { color: affairGoTheme.colors.text, fontWeight: '700', marginBottom: 10 },
  replyComposerCard: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', borderWidth: 1, borderColor: affairGoTheme.colors.line, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: affairGoTheme.radius.md, padding: 12, marginBottom: 10, gap: 10 },
  replyComposerCopy: { flex: 1 },
  replyComposerTitle: { color: affairGoTheme.colors.accentSoft, fontWeight: '700', marginBottom: 4 },
  replyComposerText: { color: affairGoTheme.colors.textMuted, lineHeight: 18 },
  composerInput: { minHeight: 108, maxHeight: 180, borderRadius: affairGoTheme.radius.md, borderWidth: 1, borderColor: affairGoTheme.colors.line, backgroundColor: 'rgba(255,255,255,0.06)', color: affairGoTheme.colors.text, paddingHorizontal: 14, paddingVertical: 12 },
  mentionMenu: { marginTop: 10, borderWidth: 1, borderColor: affairGoTheme.colors.line, backgroundColor: affairGoTheme.colors.cardStrong, borderRadius: affairGoTheme.radius.md, overflow: 'hidden' },
  mentionMenuItem: { paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  mentionMenuName: { color: affairGoTheme.colors.text, fontWeight: '700' },
  mentionMenuMeta: { color: affairGoTheme.colors.textMuted, marginTop: 4, fontSize: 12 },
  counterText: { color: affairGoTheme.colors.textMuted, marginTop: 8, textAlign: 'right', fontSize: 12 },
  errorText: { color: affairGoTheme.colors.warning, marginTop: 10, lineHeight: 20 },
  sendButton: { marginTop: 12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(7,10,16,0.82)', justifyContent: 'center', paddingHorizontal: 18 },
  modalCard: { backgroundColor: affairGoTheme.colors.cardStrong, borderRadius: affairGoTheme.radius.lg, borderWidth: 1, borderColor: affairGoTheme.colors.lineStrong, padding: 18 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  modalTitle: { color: affairGoTheme.colors.text, fontSize: 22, fontWeight: '700' },
  modalSubtitle: { color: affairGoTheme.colors.textMuted, marginTop: 4 },
  profileFactsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  profileFact: { marginBottom: 0 },
  profileTravelCard: { marginBottom: 14, padding: 14 },
  profileTravelTitle: { color: affairGoTheme.colors.text, fontWeight: '700', marginBottom: 6 },
  profileTravelText: { color: affairGoTheme.colors.textMuted, lineHeight: 20 },
  privateStateCard: { padding: 14 },
  privateStateTitle: { color: affairGoTheme.colors.text, fontWeight: '700', marginBottom: 6 },
  privateStateText: { color: affairGoTheme.colors.textMuted, lineHeight: 20 },
  privateAction: { marginTop: 12 },
  privateStatePill: { alignSelf: 'flex-start', marginTop: 12 },
  secondaryAction: { marginTop: 10 },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  reasonChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: affairGoTheme.radius.pill, borderWidth: 1, borderColor: affairGoTheme.colors.line, backgroundColor: 'rgba(255,255,255,0.04)' },
  reasonChipActive: { backgroundColor: 'rgba(255,67,67,0.2)', borderColor: affairGoTheme.colors.accent },
  reasonChipText: { color: affairGoTheme.colors.textMuted, fontSize: 13, fontWeight: '600' },
  reasonChipTextActive: { color: affairGoTheme.colors.text },
});

export default CommunityRoomScreen;

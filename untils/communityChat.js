const COMMUNITY_ROOM_ID = 'whisper-lounge';
const COMMUNITY_ROOM_NAME = 'Offener Treffpunkt';
const COMMUNITY_ROOM_DESCRIPTION = 'Offener Austausch, Kennenlernen und allgemeine Gespräche innerhalb der Night-Whisper-Community.';
const COMMUNITY_ROOM_ROUTE_FALLBACK = 'whisper-lounge';
// Feste Anzeigereihenfolge der Starträume, identisch zu DEFAULT_COMMUNITY_ROOMS in functions/communityChat.js.
const COMMUNITY_ROOM_DISPLAY_ORDER = Object.freeze([
  'whisper-lounge',
  'kennenlernen-und-flirten',
  'swinger-und-paare',
  'sex-und-fantasien',
]);
const COMMUNITY_MESSAGE_MAX_LENGTH = 1000;
const COMMUNITY_MESSAGE_COUNTER_THRESHOLD = 800;
const COMMUNITY_FALLBACK_NICKNAME = 'Night-Whisper Mitglied';
const COMMUNITY_REMOVED_MESSAGE_LABEL = 'Diese Nachricht wurde entfernt.';
const COMMUNITY_RATE_LIMIT_ERROR_MESSAGE = 'Du schreibst gerade sehr schnell. Bitte warte einen Moment.';
const COMMUNITY_REACTION_TYPES = Object.freeze(['heart', 'fire', 'laugh', 'like']);
const COMMUNITY_REPORT_REASON_OPTIONS = Object.freeze([
  { value: 'HARASSMENT', label: 'Belästigung' },
  { value: 'INSULT', label: 'Beleidigung' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'FAKE_PROFILE', label: 'Fake-Profil' },
  { value: 'SUSPECTED_MINOR', label: 'Minderjährigkeit vermutet' },
  { value: 'ILLEGAL_CONTENT', label: 'Illegale Inhalte' },
  { value: 'UNWANTED_CONTACT', label: 'Unerwünschter Kontakt' },
  { value: 'OTHER', label: 'Sonstiges' },
]);
const COMMUNITY_REPORT_COMMENT_MAX_LENGTH = 500;
const COMMUNITY_REACTION_EMOJIS = Object.freeze({
  heart: '❤️',
  fire: '🔥',
  laugh: '😂',
  like: '👍',
});
const COMMUNITY_ROOM_TYPE_LABELS = Object.freeze({
  GLOBAL: 'Global',
  REGION: 'Region',
  EVENT: 'Event',
  SYSTEM: 'System',
});
const COMMUNITY_ROOM_GROUP_TITLES = Object.freeze({
  general: 'Allgemein',
  regions: 'Regionen',
  events: 'Events',
});
const COMMUNITY_ACTIVITY_EXACT_COUNT_THRESHOLD = 10;
const COMMUNITY_ALLOWED_AGE_VERIFICATION_STATUSES = new Set(['verified', 'approved']);
const COMMUNITY_RESTRICTED_MODERATION_STATES = new Set(['restricted']);

const COMMUNITY_RULES_EDITOR_SECTION_DELIMITER = '\n\n';

const clampCommunityDraft = (value = '') => String(value).slice(0, COMMUNITY_MESSAGE_MAX_LENGTH);

const normalizeCommunityDraft = (value = '') => clampCommunityDraft(value).replace(/\r\n?/g, '\n');

const getPreparedCommunityText = (value = '') => normalizeCommunityDraft(value).trim();

const normalizeCommunityRoom = (room = {}, fallbackId = '') => {
  const lastMessageAtMs = resolveTimestampMillis(room.lastMessageAt);
  const updatedAtMs = resolveTimestampMillis(room.updatedAt);
  const createdAtMs = resolveTimestampMillis(room.createdAt);

  return {
    id: String(room.id || fallbackId || ''),
    name: String(room.name || ''),
    slug: String(room.slug || ''),
    description: String(room.description || ''),
    type: String(room.type || 'GLOBAL').toUpperCase(),
    region: room.region ? String(room.region) : null,
    active: room.active === true,
    manualActive: room.manualActive !== false,
    eventId: room.eventId ? String(room.eventId) : '',
    eventTitle: room.eventTitle ? String(room.eventTitle) : '',
    eventDateLabel: room.eventDateLabel ? String(room.eventDateLabel) : '',
    eventTimeLabel: room.eventTimeLabel ? String(room.eventTimeLabel) : '',
    eventCity: room.eventCity ? String(room.eventCity) : '',
    eventStartAt: room.eventStartAt || null,
    eventEndAt: room.eventEndAt || null,
    eventVisibleFromAt: room.eventVisibleFromAt || null,
    eventVisibleUntilAt: room.eventVisibleUntilAt || null,
    lastMessageAt: room.lastMessageAt || null,
    updatedAt: room.updatedAt || null,
    createdAt: room.createdAt || null,
    messageCount: Number.isFinite(Number(room.messageCount)) ? Number(room.messageCount) : null,
    activeMemberCount: Number.isFinite(Number(room.activeMemberCount)) ? Number(room.activeMemberCount) : 0,
    eventStartAtMs: resolveTimestampMillis(room.eventStartAt) || 0,
    lastMessageAtMs: lastMessageAtMs || updatedAtMs || createdAtMs || 0,
  };
};

const normalizeCommunityRoomRead = (value = {}, fallbackId = '') => ({
  id: String(value.id || fallbackId || ''),
  userId: String(value.userId || ''),
  roomId: String(value.roomId || ''),
  lastReadMessageId: String(value.lastReadMessageId || ''),
  lastReadMessageCount: Number.isFinite(Number(value.lastReadMessageCount)) ? Number(value.lastReadMessageCount) : null,
  lastReadAt: value.lastReadAt || null,
  lastReadAtMs: resolveTimestampMillis(value.lastReadAt) || 0,
});

const getCommunityRoomTypeLabel = (type = 'GLOBAL') => COMMUNITY_ROOM_TYPE_LABELS[String(type || 'GLOBAL').toUpperCase()] || 'Raum';

const getCommunityRoomUnreadCount = (room = {}, readEntry = null) => {
  const messageCount = Number(room?.messageCount);
  const lastReadMessageCount = Number(readEntry?.lastReadMessageCount);

  if (Number.isFinite(messageCount) && Number.isFinite(lastReadMessageCount)) {
    return Math.max(0, messageCount - lastReadMessageCount);
  }

  if (Number.isFinite(messageCount) && !readEntry) {
    return Math.max(0, messageCount);
  }

  return null;
};

const sortCommunityRooms = (rooms = [], options = {}) => {
  const readMap = options.readMap || {};
  const lastVisitedRoomId = String(options.lastVisitedRoomId || '');
  const typeOrder = {
    GLOBAL: 0,
    REGION: 1,
    EVENT: 2,
    SYSTEM: 3,
  };

  return [...rooms].sort((left, right) => {
    const leftPriority = left.id === COMMUNITY_ROOM_ID ? -1 : (typeOrder[left.type] ?? 99);
    const rightPriority = right.id === COMMUNITY_ROOM_ID ? -1 : (typeOrder[right.type] ?? 99);
    const leftUnread = hasUnreadCommunityRoom(left, readMap[left.id] || null);
    const rightUnread = hasUnreadCommunityRoom(right, readMap[right.id] || null);

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    if (leftUnread !== rightUnread) {
      return leftUnread ? -1 : 1;
    }

    if (left.id === lastVisitedRoomId || right.id === lastVisitedRoomId) {
      return left.id === lastVisitedRoomId ? -1 : 1;
    }

    const leftDeclaredOrder = COMMUNITY_ROOM_DISPLAY_ORDER.indexOf(left.id);
    const rightDeclaredOrder = COMMUNITY_ROOM_DISPLAY_ORDER.indexOf(right.id);

    if (leftDeclaredOrder !== rightDeclaredOrder) {
      return (leftDeclaredOrder === -1 ? Number.MAX_SAFE_INTEGER : leftDeclaredOrder)
        - (rightDeclaredOrder === -1 ? Number.MAX_SAFE_INTEGER : rightDeclaredOrder);
    }

    if (left.lastMessageAtMs !== right.lastMessageAtMs) {
      return right.lastMessageAtMs - left.lastMessageAtMs;
    }

    return String(left.name || '').localeCompare(String(right.name || ''), 'de-DE');
  });
};

const buildCommunityRoomSections = (rooms = [], options = {}) => {
  const sortedRooms = sortCommunityRooms(rooms, options);
  const general = sortedRooms.filter((room) => room.type === 'GLOBAL');
  const regions = sortedRooms.filter((room) => room.type === 'REGION');

  return [
    { key: 'general', title: COMMUNITY_ROOM_GROUP_TITLES.general, rooms: general },
    { key: 'regions', title: COMMUNITY_ROOM_GROUP_TITLES.regions, rooms: regions },
  ].filter((section) => section.rooms.length);
};

const hasUnreadCommunityRoom = (room = {}, readEntry = null) => {
  const unreadCount = getCommunityRoomUnreadCount(room, readEntry);

  if (unreadCount !== null) {
    return unreadCount > 0;
  }

  const roomLastActivityMs = Number(room?.lastMessageAtMs) || 0;
  const lastReadAtMs = Number(readEntry?.lastReadAtMs) || 0;

  return roomLastActivityMs > lastReadAtMs;
};

const getCommunityRoomUnreadLabel = (room = {}, readEntry = null) => {
  const unreadCount = getCommunityRoomUnreadCount(room, readEntry);

  if (unreadCount !== null && unreadCount > 0) {
    return unreadCount === 1 ? '1 neu' : `${unreadCount} neu`;
  }

  return hasUnreadCommunityRoom(room, readEntry) ? 'Neue Nachrichten' : 'Alles gelesen';
};

const getCommunityUnreadRoomsCount = (rooms = [], reads = []) => {
  const readMap = Object.fromEntries((reads || []).map((entry) => [entry.roomId, entry]));
  return (rooms || []).filter((room) => hasUnreadCommunityRoom(room, readMap[room.id] || null)).length;
};

const getCommunityOverviewState = ({
  roomsLoaded = false,
  readsLoaded = false,
  rulesLoaded = false,
  loadError = '',
  roomCount = 0,
} = {}) => {
  if (!roomsLoaded || !readsLoaded || !rulesLoaded) {
    return 'loading';
  }

  if (String(loadError || '').trim()) {
    return 'error';
  }

  return Number(roomCount) > 0 ? 'ready' : 'empty';
};

const normalizeCommunityPresenceSummary = (value = {}) => ({
  activeMemberCount: Number.isFinite(Number(value.activeMemberCount)) ? Number(value.activeMemberCount) : 0,
  recentMemberCount: Number.isFinite(Number(value.recentMemberCount)) ? Number(value.recentMemberCount) : 0,
  roomActiveCounts: value.roomActiveCounts && typeof value.roomActiveCounts === 'object' ? value.roomActiveCounts : {},
  publicCountThreshold: Number.isFinite(Number(value.publicCountThreshold)) ? Number(value.publicCountThreshold) : COMMUNITY_ACTIVITY_EXACT_COUNT_THRESHOLD,
});

const getCommunityActiveCountLabel = (count = 0, minimumCount = COMMUNITY_ACTIVITY_EXACT_COUNT_THRESHOLD) => {
  const normalizedCount = Number.isFinite(Number(count)) ? Number(count) : 0;

  if (!normalizedCount) {
    return 'Aktuell aktiv';
  }

  if (normalizedCount < minimumCount) {
    return 'Mitglieder aktuell aktiv';
  }

  return `${normalizedCount} Mitglieder aktuell aktiv`;
};

const getCommunityRoomActivityLabel = (count = 0, minimumCount = COMMUNITY_ACTIVITY_EXACT_COUNT_THRESHOLD) => {
  const normalizedCount = Number.isFinite(Number(count)) ? Number(count) : 0;

  if (!normalizedCount) {
    return 'Aktuell aktiv';
  }

  if (normalizedCount < minimumCount) {
    return 'Aktuell aktiv';
  }

  return `${normalizedCount} aktuell aktiv`;
};

const findCommunityUnreadDividerIndex = (messages = [], readEntry = null) => {
  if (!Array.isArray(messages) || !messages.length) {
    return -1;
  }

  const lastReadMessageId = String(readEntry?.lastReadMessageId || '').trim();

  if (lastReadMessageId) {
    const lastReadIndex = messages.findIndex((message) => message.id === lastReadMessageId);

    if (lastReadIndex >= 0 && lastReadIndex < messages.length - 1) {
      return lastReadIndex + 1;
    }
  }

  const lastReadAtMs = Number(readEntry?.lastReadAtMs) || 0;

  if (lastReadAtMs) {
    const nextUnreadIndex = messages.findIndex((message) => Number(message.createdAtMs) > lastReadAtMs);
    return nextUnreadIndex;
  }

  return 0;
};

const formatCommunityEventDateLabel = (room = {}) => {
  const eventStartAtMs = Number(room?.eventStartAtMs) || 0;

  if (eventStartAtMs) {
    return new Date(eventStartAtMs).toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });
  }

  return String(room?.eventDateLabel || '').trim();
};

const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeReactionCounts = (value = {}) => ({
  heart: Math.max(0, Number(value?.heart) || 0),
  fire: Math.max(0, Number(value?.fire) || 0),
  laugh: Math.max(0, Number(value?.laugh) || 0),
  like: Math.max(0, Number(value?.like) || 0),
});

const getCommunityReactionSummary = (reactionCounts = {}) => COMMUNITY_REACTION_TYPES.map((reactionType) => ({
  reactionType,
  emoji: COMMUNITY_REACTION_EMOJIS[reactionType],
  count: normalizeReactionCounts(reactionCounts)[reactionType],
}));

const getCommunityMentionMatch = (value = '') => {
  const normalizedValue = normalizeCommunityDraft(value);
  const match = normalizedValue.match(/(?:^|\s)@([^\s@]*)$/);

  if (!match) {
    return null;
  }

  return {
    query: String(match[1] || '').trim(),
    raw: match[0],
  };
};

const insertCommunityMention = ({ draft = '', nickname = '' }) => {
  const normalizedDraft = normalizeCommunityDraft(draft);
  const normalizedNickname = String(nickname || '').trim();

  if (!normalizedNickname) {
    return normalizedDraft;
  }

  const mentionMatch = getCommunityMentionMatch(normalizedDraft);

  if (!mentionMatch) {
    return clampCommunityDraft(`${normalizedDraft}${normalizedDraft.endsWith(' ') || !normalizedDraft ? '' : ' '}@${normalizedNickname} `);
  }

  const replacement = mentionMatch.raw.startsWith(' ') ? ` @${normalizedNickname} ` : `@${normalizedNickname} `;
  return clampCommunityDraft(`${normalizedDraft.slice(0, normalizedDraft.length - mentionMatch.raw.length)}${replacement}`);
};

const buildCommunityMentionsPayload = ({ text = '', participants = [] }) => {
  const normalizedText = normalizeCommunityDraft(text);
  const seenUserIds = new Set();

  return participants.reduce((result, participant) => {
    const userId = String(participant?.userId || '').trim();
    const nickname = String(participant?.nickname || '').trim();

    if (!userId || !nickname || seenUserIds.has(userId)) {
      return result;
    }

    const mentionPattern = new RegExp(`(^|\\s)@${escapeRegExp(nickname)}(?=\\s|$)`, 'i');

    if (!mentionPattern.test(normalizedText)) {
      return result;
    }

    seenUserIds.add(userId);
    return [...result, { userId, nickname }];
  }, []);
};

const getCommunityAccessDeniedMessage = (reason = '') => {
  if (reason === 'age_not_verified') {
    return 'Für den Community-Chat ist eine bestätigte Altersverifikation erforderlich.';
  }

  if (reason === 'community_rules_not_accepted') {
    return 'Bitte bestätige zuerst die aktuellen Community-Regeln.';
  }

  if (reason === 'chat_banned') {
    return 'Dein Zugang zum Schreiben im Community-Chat ist momentan eingeschränkt.';
  }

  return 'Du hast aktuell keinen Zugriff auf die Community.';
};

const formatCommunityDateTime = (value) => {
  const timestampMs = resolveTimestampMillis(value);

  if (!timestampMs) {
    return '';
  }

  return new Date(timestampMs).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getCommunityChatBanMessage = (error) => {
  const until = formatCommunityDateTime(error?.details?.until);
  const permanent = error?.details?.permanent === true;

  if (permanent) {
    return 'Dein Schreibzugang zur Night-Whisper Community wurde eingeschränkt.';
  }

  if (until) {
    return `Dein Zugang zum Schreiben im Community-Chat ist momentan eingeschränkt. Sperre bis: ${until}`;
  }

  return 'Dein Zugang zum Schreiben im Community-Chat ist momentan eingeschränkt.';
};

const COMMUNITY_RULES_UNCONFIRMED_MESSAGE = 'Die Zustimmung wurde gesendet, konnte aber noch nicht bestätigt werden. Bitte versuche es erneut.';

const mapCommunityErrorMessage = (error, context = 'send') => {
  const code = String(error?.code || '').toLowerCase();
  const reason = String(error?.details?.reason || '').toLowerCase();

  if (context === 'accept') {
    if (code === 'unauthenticated') {
      return 'Bitte melde dich erneut an, um die Community-Regeln zu bestätigen.';
    }

    if (code === 'permission-denied') {
      if (reason === 'outdated_rules_version' || reason === 'community_rules_not_accepted') {
        return 'Die Community-Regeln wurden zwischenzeitlich aktualisiert. Bitte lade die Regeln erneut und bestätige sie noch einmal.';
      }

      return getCommunityAccessDeniedMessage(reason);
    }

    if (code === 'failed-precondition') {
      return 'Die Community-Regeln wurden zwischenzeitlich aktualisiert. Bitte lade die Regeln erneut und bestätige sie noch einmal.';
    }

    if (code === 'invalid-argument') {
      return 'Die Regelversion konnte nicht übermittelt werden. Bitte lade die Seite neu.';
    }

    if (code === 'not-found') {
      return 'Die Bestätigungsfunktion ist derzeit nicht verfügbar. Bitte versuche es später erneut.';
    }

    if (code === 'unavailable' || code === 'deadline-exceeded') {
      return 'Der Server ist derzeit nicht erreichbar. Bitte versuche es erneut.';
    }

    if (code === 'internal') {
      return 'Es ist ein unerwarteter Fehler aufgetreten. Bitte versuche es erneut.';
    }

    return 'Die Community-Regeln konnten nicht bestätigt werden. Bitte versuche es erneut.';
  }

  if (code === 'resource-exhausted') {
    return COMMUNITY_RATE_LIMIT_ERROR_MESSAGE;
  }

  if (code === 'permission-denied') {
    if (reason === 'chat_banned') {
      return getCommunityChatBanMessage(error);
    }

    return getCommunityAccessDeniedMessage(reason);
  }

  if (code === 'already-exists') {
    return 'Diese Meldung wurde bereits übermittelt.';
  }

  if (code === 'not-found' || code === 'failed-precondition') {
    if (context === 'rooms') {
      return 'Die Community-Räume konnten nicht geladen werden. Bitte versuche es erneut.';
    }

    return 'Die Whisper Lounge ist momentan nicht verfügbar.';
  }

  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'internal') {
    if (context === 'rooms') {
      return 'Die Community-Räume konnten nicht geladen werden. Bitte versuche es erneut.';
    }

    return context === 'load'
      ? 'Die Whisper Lounge konnte nicht geladen werden. Bitte versuche es erneut.'
      : 'Die Nachricht konnte nicht gesendet werden. Bitte versuche es erneut.';
  }

  if (code === 'unauthenticated') {
    return 'Du hast aktuell keinen Zugriff auf die Community.';
  }

  if (reason === 'age_not_verified') {
    return 'Für den Community-Chat ist eine bestätigte Altersverifikation erforderlich.';
  }

  if (context === 'rooms') {
    return 'Die Community-Räume konnten nicht geladen werden. Bitte versuche es erneut.';
  }

  return context === 'load'
    ? 'Die Whisper Lounge konnte nicht geladen werden. Bitte versuche es erneut.'
    : 'Die Nachricht konnte nicht gesendet werden. Bitte versuche es erneut.';
};

const resolveTimestampMillis = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value.seconds === 'number') {
    const millis = typeof value.nanoseconds === 'number'
      ? Math.round(value.seconds * 1000 + (value.nanoseconds / 1000000))
      : Math.round(value.seconds * 1000);

    return Number.isFinite(millis) ? millis : null;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

const formatCommunityTime = (value) => {
  const timestampMs = resolveTimestampMillis(value);

  if (!timestampMs) {
    return '...';
  }

  return new Date(timestampMs).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const normalizeCommunityMessage = (message = {}, fallbackId = '') => {
  const timestampMs = resolveTimestampMillis(message.createdAt);
  const removed = Boolean(message.deletedAt) || String(message.moderationStatus || 'VISIBLE') !== 'VISIBLE';

  return {
    id: String(message.id || fallbackId || ''),
    roomId: String(message.roomId || COMMUNITY_ROOM_ID),
    userId: String(message.userId || ''),
    nickname: String(message.nickname || COMMUNITY_FALLBACK_NICKNAME),
    text: removed ? COMMUNITY_REMOVED_MESSAGE_LABEL : String(message.text || ''),
    replyToMessageId: String(message.replyToMessageId || ''),
    mentions: Array.isArray(message.mentions)
      ? message.mentions.map((entry) => ({
        userId: String(entry?.userId || ''),
        nickname: String(entry?.nickname || '').trim(),
      })).filter((entry) => entry.userId && entry.nickname)
      : [],
    reactionCounts: normalizeReactionCounts(message.reactionCounts),
    createdAt: message.createdAt || null,
    createdAtMs: timestampMs,
    timeLabel: formatCommunityTime(message.createdAt),
    removed,
  };
};

const normalizeCommunityRulesEnvelope = (value = {}) => {
  const rules = value?.rules && typeof value.rules === 'object' ? value.rules : value;
  const acceptance = value?.acceptance || null;
  const version = String(rules.version || '').trim();
  const acceptedVersion = String(acceptance?.latestAcceptedVersion || '').trim();

  return {
    version,
    title: String(rules.title || 'Community-Regeln').trim() || 'Community-Regeln',
    sections: Array.isArray(rules.sections)
      ? rules.sections.map((section) => ({
        heading: String(section?.heading || '').trim(),
        paragraphs: Array.isArray(section?.paragraphs)
          ? section.paragraphs.map((entry) => String(entry || '').trim()).filter(Boolean)
          : [],
      })).filter((section) => section.heading && section.paragraphs.length)
      : [],
    publishedAt: rules.publishedAt || null,
    updatedAt: rules.updatedAt || null,
    active: rules.active !== false,
    acceptance,
    acceptedVersion,
    acceptedCurrent: Boolean(version) && acceptedVersion === version,
  };
};

const getCommunityAccessRequirements = (user = {}, authUser = null, rulesEnvelope = null) => {
  const profile = user && typeof user === 'object' ? user : {};
  const normalizedRulesEnvelope = rulesEnvelope ? normalizeCommunityRulesEnvelope(rulesEnvelope) : null;
  const loggedIn = Boolean(String(profile?.id || profile?.uid || authUser?.uid || '').trim());
  const authEmailVerified = authUser?.emailVerified === true;
  const profileEmailVerified = profile.emailVerified === true;
  const emailVerified = loggedIn && (authEmailVerified || profileEmailVerified);
  const ageVerificationStatus = String(profile.ageVerificationStatus || '').trim().toLowerCase();
  const ageVerified = loggedIn
    && profile.ageVerified === true
    && (!ageVerificationStatus || COMMUNITY_ALLOWED_AGE_VERIFICATION_STATUSES.has(ageVerificationStatus));
  const accountActive = loggedIn && !String(profile.accountDeletionRequestedAt || '').trim();
  const moderationAllowed = loggedIn
    && !COMMUNITY_RESTRICTED_MODERATION_STATES.has(String(profile.moderationState || '').trim().toLowerCase());
  const rulesAccepted = normalizedRulesEnvelope?.acceptedCurrent === true;
  const preRulesRequirementsMet = loggedIn && emailVerified && ageVerified && accountActive && moderationAllowed;
  const allRequirementsMet = preRulesRequirementsMet && rulesAccepted;

  return {
    loggedIn,
    authEmailVerified,
    profileEmailVerified,
    effectiveEmailVerified: emailVerified,
    emailVerified,
    ageVerified,
    rulesAccepted,
    accountActive,
    moderationAllowed,
    communityAllowed: moderationAllowed,
    preRulesRequirementsMet,
    nonRulesRequirementsMet: preRulesRequirementsMet,
    canReadOverview: preRulesRequirementsMet,
    canReadMessages: allRequirementsMet,
    allRequirementsMet,
    missingKeys: [
      !loggedIn ? 'loggedIn' : null,
      loggedIn && !emailVerified ? 'emailVerified' : null,
      loggedIn && !ageVerified ? 'ageVerified' : null,
      loggedIn && !accountActive ? 'accountActive' : null,
      loggedIn && !moderationAllowed ? 'moderationAllowed' : null,
      preRulesRequirementsMet && !rulesAccepted ? 'rulesAccepted' : null,
    ].filter(Boolean),
  };
};

const getCommunityNeedsRulesAcceptance = (rulesEnvelope = null) => {
  const normalizedRulesEnvelope = rulesEnvelope ? normalizeCommunityRulesEnvelope(rulesEnvelope) : null;
  const currentRulesVersion = String(normalizedRulesEnvelope?.version || '').trim();
  const acceptedRulesVersion = String(normalizedRulesEnvelope?.acceptedVersion || '').trim();

  return Boolean(currentRulesVersion) && acceptedRulesVersion !== currentRulesVersion;
};

const getCommunityAccessState = ({
  accessRequirements = {},
  rulesEnvelope = null,
  rulesLoaded = false,
  rulesError = '',
  roomsLoaded = false,
  readsLoaded = false,
  loadError = '',
  roomCount = 0,
} = {}) => {
  const normalizedRulesEnvelope = rulesEnvelope ? normalizeCommunityRulesEnvelope(rulesEnvelope) : null;
  const needsRulesAcceptance = accessRequirements.preRulesRequirementsMet === true
    && getCommunityNeedsRulesAcceptance(normalizedRulesEnvelope);
  const hasRulesError = Boolean(String(rulesError || '').trim());
  const hasLoadError = Boolean(String(loadError || '').trim());

  if (!accessRequirements.loggedIn) {
    return {
      status: 'login_required',
      accessAllowed: false,
      accessReason: 'logged_out',
      needsRulesAcceptance: false,
      message: 'Bitte melde dich zuerst an.',
    };
  }

  if (!accessRequirements.emailVerified) {
    return {
      status: 'email_verification_required',
      accessAllowed: false,
      accessReason: 'email_not_verified',
      needsRulesAcceptance: false,
      message: 'Bitte bestaetige zuerst deine E-Mail-Adresse.',
    };
  }

  if (!accessRequirements.ageVerified) {
    return {
      status: 'age_verification_required',
      accessAllowed: false,
      accessReason: 'age_not_verified',
      needsRulesAcceptance: false,
      message: 'Die Altersfreigabe ist noch nicht abgeschlossen.',
    };
  }

  if (!accessRequirements.accountActive) {
    return {
      status: 'account_inactive',
      accessAllowed: false,
      accessReason: 'account_pending_deletion',
      needsRulesAcceptance: false,
      message: 'Die Community ist derzeit deaktiviert.',
    };
  }

  if (!accessRequirements.moderationAllowed) {
    return {
      status: 'moderation_restricted',
      accessAllowed: false,
      accessReason: 'moderation_restricted',
      needsRulesAcceptance: false,
      message: 'Dein Community-Zugang wurde voruebergehend eingeschraenkt.',
    };
  }

  if (!rulesLoaded) {
    return {
      status: 'loading',
      accessAllowed: false,
      accessReason: 'loading_rules',
      needsRulesAcceptance: false,
      message: '',
    };
  }

  if (normalizedRulesEnvelope?.active === false) {
    return {
      status: 'community_disabled',
      accessAllowed: false,
      accessReason: 'community_disabled',
      needsRulesAcceptance: false,
      message: 'Die Community ist derzeit deaktiviert.',
    };
  }

  if (hasRulesError) {
    return {
      status: 'backend_error',
      accessAllowed: false,
      accessReason: 'rules_unavailable',
      needsRulesAcceptance: false,
      message: 'Die Community konnte nicht geladen werden. Bitte versuche es erneut.',
    };
  }

  if (needsRulesAcceptance) {
    return {
      status: 'rules_acceptance_required',
      accessAllowed: true,
      accessReason: 'rules_not_accepted',
      needsRulesAcceptance: true,
      message: 'Bitte akzeptiere zuerst die aktuellen Community-Regeln.',
    };
  }

  if (!roomsLoaded || !readsLoaded) {
    return {
      status: 'loading',
      accessAllowed: false,
      accessReason: 'loading_rooms',
      needsRulesAcceptance: false,
      message: '',
    };
  }

  if (hasLoadError) {
    return {
      status: 'backend_error',
      accessAllowed: false,
      accessReason: 'rooms_unavailable',
      needsRulesAcceptance: false,
      message: 'Die Community konnte nicht geladen werden. Bitte versuche es erneut.',
    };
  }

  if (Number(roomCount) < 1) {
    return {
      status: 'empty',
      accessAllowed: true,
      accessReason: 'no_rooms',
      needsRulesAcceptance: false,
      message: 'Derzeit sind keine Community-Raeume verfuegbar.',
    };
  }

  return {
    status: 'allowed',
    accessAllowed: true,
    accessReason: 'allowed',
    needsRulesAcceptance: false,
    message: '',
  };
};

const toCommunityRulesEnvelopePayload = (envelope = {}, acceptanceOverride) => ({
  rules: {
    version: String(envelope?.version || '').trim(),
    title: String(envelope?.title || 'Community-Regeln').trim() || 'Community-Regeln',
    sections: Array.isArray(envelope?.sections) ? envelope.sections : [],
    publishedAt: envelope?.publishedAt || null,
    updatedAt: envelope?.updatedAt || null,
    active: envelope?.active !== false,
  },
  acceptance: acceptanceOverride === undefined ? (envelope?.acceptance || null) : acceptanceOverride,
});

const buildAcceptedCommunityRulesEnvelope = (currentEnvelope = {}, acceptResponse = {}) => {
  const normalizedCurrent = normalizeCommunityRulesEnvelope(currentEnvelope);
  const acceptedVersion = String(
    acceptResponse?.acceptedVersion
    || acceptResponse?.rulesVersion
    || normalizedCurrent.version
    || ''
  ).trim();

  return normalizeCommunityRulesEnvelope(toCommunityRulesEnvelopePayload(normalizedCurrent, {
    ...(normalizedCurrent.acceptance && typeof normalizedCurrent.acceptance === 'object' ? normalizedCurrent.acceptance : {}),
    latestAcceptedVersion: acceptedVersion,
    latestAcceptedAt: acceptResponse?.acceptedAt || normalizedCurrent.acceptance?.latestAcceptedAt || null,
  }));
};

const isCommunityRulesAcceptanceConfirmed = (envelope = null, expectedVersion = '') => {
  const normalizedEnvelope = envelope ? normalizeCommunityRulesEnvelope(envelope) : null;
  const normalizedExpectedVersion = String(expectedVersion || '').trim();

  return Boolean(normalizedEnvelope)
    && Boolean(normalizedExpectedVersion)
    && normalizedEnvelope.version === normalizedExpectedVersion
    && normalizedEnvelope.acceptedVersion === normalizedExpectedVersion
    && normalizedEnvelope.acceptedCurrent === true;
};

const mergeCommunityRulesEnvelope = (currentEnvelope = null, nextEnvelope = {}) => {
  const normalizedNext = normalizeCommunityRulesEnvelope(nextEnvelope);
  const normalizedCurrent = currentEnvelope ? normalizeCommunityRulesEnvelope(currentEnvelope) : null;

  if (!normalizedCurrent) {
    return normalizedNext;
  }

  if (
    normalizedCurrent.acceptedCurrent
    && normalizedCurrent.version
    && normalizedCurrent.version === normalizedNext.version
    && normalizedNext.acceptedCurrent !== true
  ) {
    return normalizeCommunityRulesEnvelope(toCommunityRulesEnvelopePayload(normalizedNext, normalizedCurrent.acceptance || normalizedNext.acceptance || null));
  }

  return normalizedNext;
};

const formatCommunityRulesVersionLabel = (version = '') => {
  const normalizedVersion = String(version || '').trim();
  return normalizedVersion ? `Version ${normalizedVersion}` : 'Version unbekannt';
};

const stringifyCommunityRulesSections = (sections = []) => sections
  .map((section) => {
    const heading = String(section?.heading || '').trim();
    const paragraphs = Array.isArray(section?.paragraphs)
      ? section.paragraphs.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [];

    return [heading, ...paragraphs].filter(Boolean).join('\n');
  })
  .filter(Boolean)
  .join(COMMUNITY_RULES_EDITOR_SECTION_DELIMITER);

const parseCommunityRulesEditor = (value = '') => String(value || '')
  .split(/\n\s*\n/g)
  .map((block) => block.split('\n').map((line) => line.trim()).filter(Boolean))
  .filter((lines) => lines.length > 1)
  .map(([heading, ...paragraphs]) => ({
    heading,
    paragraphs,
  }));

module.exports = {
  COMMUNITY_FALLBACK_NICKNAME,
  COMMUNITY_MESSAGE_COUNTER_THRESHOLD,
  COMMUNITY_MESSAGE_MAX_LENGTH,
  COMMUNITY_REACTION_EMOJIS,
  COMMUNITY_REACTION_TYPES,
  COMMUNITY_REPORT_COMMENT_MAX_LENGTH,
  COMMUNITY_REPORT_REASON_OPTIONS,
  COMMUNITY_RATE_LIMIT_ERROR_MESSAGE,
  COMMUNITY_REMOVED_MESSAGE_LABEL,
  COMMUNITY_RULES_UNCONFIRMED_MESSAGE,
  COMMUNITY_ROOM_DESCRIPTION,
  COMMUNITY_ROOM_DISPLAY_ORDER,
  COMMUNITY_ROOM_GROUP_TITLES,
  COMMUNITY_ROOM_ID,
  COMMUNITY_ROOM_NAME,
  COMMUNITY_ROOM_ROUTE_FALLBACK,
  COMMUNITY_ROOM_TYPE_LABELS,
  COMMUNITY_ACTIVITY_EXACT_COUNT_THRESHOLD,
  buildAcceptedCommunityRulesEnvelope,
  buildCommunityRoomSections,
  buildCommunityMentionsPayload,
  clampCommunityDraft,
  findCommunityUnreadDividerIndex,
  formatCommunityTime,
  formatCommunityDateTime,
  formatCommunityRulesVersionLabel,
  getCommunityActiveCountLabel,
  getCommunityAccessState,
  getCommunityOverviewState,
  getPreparedCommunityText,
  getCommunityChatBanMessage,
  getCommunityAccessRequirements,
  getCommunityNeedsRulesAcceptance,
  getCommunityMentionMatch,
  getCommunityReactionSummary,
  getCommunityRoomActivityLabel,
  formatCommunityEventDateLabel,
  getCommunityRoomTypeLabel,
  getCommunityRoomUnreadCount,
  getCommunityRoomUnreadLabel,
  getCommunityUnreadRoomsCount,
  hasUnreadCommunityRoom,
  insertCommunityMention,
  isCommunityRulesAcceptanceConfirmed,
  mapCommunityErrorMessage,
  mergeCommunityRulesEnvelope,
  normalizeCommunityDraft,
  normalizeCommunityMessage,
  normalizeCommunityPresenceSummary,
  normalizeCommunityRulesEnvelope,
  normalizeCommunityRoom,
  normalizeCommunityRoomRead,
  normalizeReactionCounts,
  parseCommunityRulesEditor,
  resolveTimestampMillis,
  sortCommunityRooms,
  stringifyCommunityRulesSections,
};
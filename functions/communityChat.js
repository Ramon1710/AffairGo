const { HttpsError } = require('firebase-functions/v2/https');
const {
  COMMUNITY_RULE_ACCEPTANCES_COLLECTION,
  COMMUNITY_RULES_CONFIG_DOC_PATH,
  COMMUNITY_RULES_VERSIONS_COLLECTION,
  DEFAULT_COMMUNITY_RULES_VERSION,
  DEFAULT_COMMUNITY_RULES_TITLE,
  buildCommunityRulesAcceptanceRecord,
  buildCommunityRulesConfigRecord,
  buildCommunityRulesVersionRecord,
  buildDefaultCommunityRulesConfig,
  cloneRulesSections,
  getCommunityRulesErrorDetails,
  normalizeCommunityRulesConfig,
  sanitizeCommunityRulesSections,
  sanitizeCommunityRulesTitle,
  validateCommunityRulesVersion,
} = require('./communityRules');
const {
  buildCommunityPresenceRecord,
  buildCommunityPresenceSummary,
  shouldThrottleCommunityPresenceWrite,
} = require('./communityPresence');

const COMMUNITY_ROOM_TYPES = Object.freeze({
  GLOBAL: 'GLOBAL',
  REGION: 'REGION',
  EVENT: 'EVENT',
  SYSTEM: 'SYSTEM',
});

const COMMUNITY_MESSAGE_MODERATION_STATUSES = Object.freeze({
  VISIBLE: 'VISIBLE',
  REMOVED: 'REMOVED',
});

const COMMUNITY_REACTION_TYPES = Object.freeze({
  heart: 'heart',
  fire: 'fire',
  laugh: 'laugh',
  like: 'like',
});

const COMMUNITY_ACCESS_ACTIONS = Object.freeze({
  READ: 'read',
  WRITE: 'write',
  ADMIN: 'admin',
});

const COMMUNITY_REPORT_REASONS = Object.freeze({
  HARASSMENT: 'HARASSMENT',
  INSULT: 'INSULT',
  SPAM: 'SPAM',
  FAKE_PROFILE: 'FAKE_PROFILE',
  SUSPECTED_MINOR: 'SUSPECTED_MINOR',
  ILLEGAL_CONTENT: 'ILLEGAL_CONTENT',
  UNWANTED_CONTACT: 'UNWANTED_CONTACT',
  OTHER: 'OTHER',
});

const COMMUNITY_REPORT_PRIORITIES = Object.freeze({
  NORMAL: 'NORMAL',
  CRITICAL: 'CRITICAL',
});

const COMMUNITY_REPORT_STATUSES = Object.freeze({
  OPEN: 'OPEN',
  REVIEWING: 'REVIEWING',
  ACTION_TAKEN: 'ACTION_TAKEN',
  CLOSED: 'CLOSED',
});

const COMMUNITY_MODERATION_ACTIONS = Object.freeze({
  START_REVIEW: 'START_REVIEW',
  REMOVE_MESSAGE: 'REMOVE_MESSAGE',
  WARN_USER: 'WARN_USER',
  BAN_24H: 'BAN_24H',
  BAN_7D: 'BAN_7D',
  BAN_PERMANENT: 'BAN_PERMANENT',
  CLOSE_REPORT: 'CLOSE_REPORT',
});

const COMMUNITY_MODERATION_LOG_ACTIONS = Object.freeze({
  REPORT_REVIEW_STARTED: 'REPORT_REVIEW_STARTED',
  MESSAGE_REMOVED: 'MESSAGE_REMOVED',
  USER_WARNED: 'USER_WARNED',
  USER_BANNED_24H: 'USER_BANNED_24H',
  USER_BANNED_7D: 'USER_BANNED_7D',
  USER_BANNED_PERMANENT: 'USER_BANNED_PERMANENT',
  REPORT_CLOSED: 'REPORT_CLOSED',
  COMMUNITY_RULES_PUBLISHED: 'COMMUNITY_RULES_PUBLISHED',
});

const COMMUNITY_MESSAGE_MAX_LENGTH = 1000;
const COMMUNITY_MENTION_MAX_COUNT = 8;
const COMMUNITY_REPORT_COMMENT_MAX_LENGTH = 500;
const COMMUNITY_BLOCK_REASON_MAX_LENGTH = 160;
const COMMUNITY_RATE_LIMIT_MAX_MESSAGES = 2;
const COMMUNITY_RATE_LIMIT_WINDOW_MS = 5 * 1000;
const COMMUNITY_REPORT_RATE_LIMIT_MAX_REPORTS = 6;
const COMMUNITY_REPORT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const COMMUNITY_RATE_LIMIT_ERROR_MESSAGE = 'Du schreibst gerade sehr schnell. Bitte warte einen Moment.';
const COMMUNITY_EVENT_ROOM_VISIBLE_BEFORE_MS = 7 * 24 * 60 * 60 * 1000;
const COMMUNITY_EVENT_ROOM_VISIBLE_AFTER_MS = 48 * 60 * 60 * 1000;
const COMMUNITY_EVENT_ROOM_DEFAULT_DURATION_MS = 4 * 60 * 60 * 1000;
const DEFAULT_COMMUNITY_ROOM_ID = 'whisper-lounge';
const DEFAULT_COMMUNITY_ROOM_SLUG = 'whisper-lounge';
const DEFAULT_COMMUNITY_ROOM = Object.freeze({
  id: DEFAULT_COMMUNITY_ROOM_ID,
  name: 'Whisper Lounge',
  slug: DEFAULT_COMMUNITY_ROOM_SLUG,
  description: 'Der offene Community-Chat von Night-Whisper.',
  type: COMMUNITY_ROOM_TYPES.GLOBAL,
  region: null,
  active: true,
  eventId: null,
});
const DEFAULT_COMMUNITY_ROOMS = Object.freeze([
  DEFAULT_COMMUNITY_ROOM,
  {
    id: 'neu-bei-night-whisper',
    name: 'Neu bei Night-Whisper',
    slug: 'neu-bei-night-whisper',
    description: 'Ein Raum für neue Mitglieder, Fragen und erste Kontakte in der Community.',
    type: COMMUNITY_ROOM_TYPES.GLOBAL,
    region: null,
    active: true,
    eventId: null,
  },
  {
    id: 'events-partys',
    name: 'Events & Partys',
    slug: 'events-partys',
    description: 'Austausch über Partys, Treffen und Community-Momente bei Night-Whisper.',
    type: COMMUNITY_ROOM_TYPES.GLOBAL,
    region: null,
    active: true,
    eventId: null,
  },
  {
    id: 'nrw',
    name: 'NRW',
    slug: 'nrw',
    description: 'Austausch für Mitglieder aus Nordrhein-Westfalen.',
    type: COMMUNITY_ROOM_TYPES.REGION,
    region: 'NRW',
    active: true,
    eventId: null,
  },
  {
    id: 'norddeutschland',
    name: 'Norddeutschland',
    slug: 'norddeutschland',
    description: 'Community-Gespräche für Mitglieder aus dem Norden Deutschlands.',
    type: COMMUNITY_ROOM_TYPES.REGION,
    region: 'NORD',
    active: true,
    eventId: null,
  },
  {
    id: 'sueddeutschland',
    name: 'Süddeutschland',
    slug: 'sueddeutschland',
    description: 'Austausch für Mitglieder aus Süddeutschland.',
    type: COMMUNITY_ROOM_TYPES.REGION,
    region: 'SUED',
    active: true,
    eventId: null,
  },
  {
    id: 'ostdeutschland',
    name: 'Ostdeutschland',
    slug: 'ostdeutschland',
    description: 'Ein Raum für Gespräche und Verabredungen in Ostdeutschland.',
    type: COMMUNITY_ROOM_TYPES.REGION,
    region: 'OST',
    active: true,
    eventId: null,
  },
]);
const ALLOWED_AGE_VERIFICATION_STATUSES = new Set(['verified', 'approved']);
const RESTRICTED_MODERATION_STATES = new Set(['restricted']);
const ALLOWED_COMMUNITY_REACTION_TYPES = new Set(Object.values(COMMUNITY_REACTION_TYPES));
const ALLOWED_COMMUNITY_REPORT_REASONS = new Set(Object.values(COMMUNITY_REPORT_REASONS));
const ALLOWED_COMMUNITY_MODERATION_ACTIONS = new Set(Object.values(COMMUNITY_MODERATION_ACTIONS));
const ALLOWED_COMMUNITY_ROOM_TYPES = new Set([
  COMMUNITY_ROOM_TYPES.GLOBAL,
  COMMUNITY_ROOM_TYPES.REGION,
  COMMUNITY_ROOM_TYPES.EVENT,
  COMMUNITY_ROOM_TYPES.SYSTEM,
]);
const COMMUNITY_REPORT_PRIORITY_RANKS = Object.freeze({
  [COMMUNITY_REPORT_PRIORITIES.NORMAL]: 1,
  [COMMUNITY_REPORT_PRIORITIES.CRITICAL]: 2,
});
const COMMUNITY_BAN_DURATIONS_MS = Object.freeze({
  [COMMUNITY_MODERATION_ACTIONS.BAN_24H]: 24 * 60 * 60 * 1000,
  [COMMUNITY_MODERATION_ACTIONS.BAN_7D]: 7 * 24 * 60 * 60 * 1000,
});
const COMMUNITY_ROOM_PREVIEW_MAX_LENGTH = 120;
const GERMAN_MONTH_INDEX = Object.freeze({
  januar: 0,
  jan: 0,
  februar: 1,
  feb: 1,
  maerz: 2,
  märz: 2,
  marz: 2,
  mrz: 2,
  april: 3,
  apr: 3,
  mai: 4,
  juni: 5,
  jun: 5,
  juli: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  oktober: 9,
  okt: 9,
  november: 10,
  nov: 10,
  dezember: 11,
  dez: 11,
});

const createDefaultReactionCounts = () => ({
  heart: 0,
  fire: 0,
  laugh: 0,
  like: 0,
});

const normalizeOptionalString = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeOptionalBoolean = (value) => value === true;

const normalizeCommunityText = (text) => normalizeOptionalString(text).replace(/\r\n?/g, '\n');

const normalizeTextList = (value) => (Array.isArray(value) ? value.map((entry) => normalizeOptionalString(entry)).filter(Boolean) : []);

const sanitizeCommunityRoomId = (roomId) => {
  const normalizedRoomId = normalizeOptionalString(roomId);

  if (!normalizedRoomId) {
    throw new HttpsError('invalid-argument', 'roomId ist erforderlich.');
  }

  return normalizedRoomId;
};

const sanitizeCommunityRoomName = (value) => {
  const name = normalizeOptionalString(value);

  if (!name) {
    throw new HttpsError('invalid-argument', 'name ist erforderlich.', getCommunityErrorDetails('missing_room_name'));
  }

  if (name.length > 80) {
    throw new HttpsError('invalid-argument', 'Der Raumname ist zu lang.', getCommunityErrorDetails('room_name_too_long', {
      maxLength: 80,
    }));
  }

  return name;
};

const sanitizeCommunityRoomDescription = (value) => {
  const description = normalizeOptionalString(value);

  if (!description) {
    throw new HttpsError('invalid-argument', 'description ist erforderlich.', getCommunityErrorDetails('missing_room_description'));
  }

  if (description.length > 240) {
    throw new HttpsError('invalid-argument', 'Die Raumbeschreibung ist zu lang.', getCommunityErrorDetails('room_description_too_long', {
      maxLength: 240,
    }));
  }

  return description;
};

const sanitizeCommunityRoomSlug = (value) => {
  const slug = normalizeOptionalString(value).toLowerCase();

  if (!slug) {
    throw new HttpsError('invalid-argument', 'slug ist erforderlich.', getCommunityErrorDetails('missing_room_slug'));
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new HttpsError('invalid-argument', 'Der Raum-Slug ist ungültig.', getCommunityErrorDetails('invalid_room_slug', { slug }));
  }

  return slug;
};

const sanitizeCommunityRoomType = (value) => {
  const type = normalizeOptionalString(value).toUpperCase();

  if (!ALLOWED_COMMUNITY_ROOM_TYPES.has(type)) {
    throw new HttpsError('invalid-argument', 'Der Raumtyp ist ungültig.', getCommunityErrorDetails('invalid_room_type', { type }));
  }

  return type;
};

const sanitizeCommunityRoomRegion = (value, type) => {
  const region = normalizeOptionalString(value).toUpperCase() || null;

  if (type === COMMUNITY_ROOM_TYPES.REGION && !region) {
    throw new HttpsError('invalid-argument', 'Für regionale Räume ist region erforderlich.', getCommunityErrorDetails('missing_room_region'));
  }

  return type === COMMUNITY_ROOM_TYPES.REGION ? region : null;
};

const getCommunityErrorDetails = (reason, extra = {}) => ({
  scope: 'community-chat',
  reason,
  ...extra,
});

const sanitizeOptionalDocumentId = (value, fieldName) => {
  if (value == null) {
    return '';
  }

  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', `${fieldName} ist ungültig.`, getCommunityErrorDetails('invalid_document_id', { fieldName }));
  }

  return value.trim();
};

const requireDocumentId = (value, fieldName) => {
  const normalizedValue = sanitizeOptionalDocumentId(value, fieldName);

  if (!normalizedValue) {
    throw new HttpsError('invalid-argument', `${fieldName} ist erforderlich.`, getCommunityErrorDetails('missing_document_id', { fieldName }));
  }

  return normalizedValue;
};

const parseTimestampToMillis = (value) => {
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
    return Math.round(value.seconds * 1000 + ((Number(value.nanoseconds) || 0) / 1000000));
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

const slugifyCommunityText = (value, fallback = 'raum') => {
  const normalized = normalizeOptionalString(value)
    .toLowerCase()
    .replace(/[ä]/g, 'ae')
    .replace(/[ö]/g, 'oe')
    .replace(/[ü]/g, 'ue')
    .replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
};

const normalizeGermanDateInput = (value) => normalizeOptionalString(value)
  .replace(/^[A-Za-zÄÖÜäöüß.,\s-]+,\s*/u, '')
  .replace(/\s+/g, ' ')
  .trim();

const parseEventDateParts = (value, nowMs) => {
  const normalized = normalizeGermanDateInput(value);

  if (!normalized) {
    return null;
  }

  const dottedDateMatch = normalized.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);

  if (dottedDateMatch) {
    const [, dayValue, monthValue, yearValue] = dottedDateMatch;
    const year = yearValue.length === 2 ? Number(`20${yearValue}`) : Number(yearValue);
    return {
      day: Number(dayValue),
      monthIndex: Number(monthValue) - 1,
      year,
    };
  }

  const dottedDateWithoutYearMatch = normalized.match(/^(\d{1,2})\.(\d{1,2})\.?$/);

  if (dottedDateWithoutYearMatch) {
    const [, dayValue, monthValue] = dottedDateWithoutYearMatch;
    return {
      day: Number(dayValue),
      monthIndex: Number(monthValue) - 1,
      year: new Date(nowMs).getUTCFullYear(),
    };
  }

  const namedMonthMatch = normalized.match(/^(\d{1,2})\.?(?:\s+)([A-Za-zÄÖÜäöüß]+)(?:\s+(\d{2,4}))?$/u);

  if (namedMonthMatch) {
    const [, dayValue, monthNameValue, yearValue] = namedMonthMatch;
    const monthIndex = GERMAN_MONTH_INDEX[monthNameValue.toLowerCase()];

    if (Number.isInteger(monthIndex)) {
      return {
        day: Number(dayValue),
        monthIndex,
        year: yearValue ? (yearValue.length === 2 ? Number(`20${yearValue}`) : Number(yearValue)) : new Date(nowMs).getUTCFullYear(),
      };
    }
  }

  return null;
};

const parseEventTimeParts = (value) => {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    return { hours: 0, minutes: 0 };
  }

  const timeMatch = normalized.match(/(\d{1,2}):(\d{2})/);

  if (!timeMatch) {
    return { hours: 0, minutes: 0 };
  }

  return {
    hours: Math.min(23, Math.max(0, Number(timeMatch[1]) || 0)),
    minutes: Math.min(59, Math.max(0, Number(timeMatch[2]) || 0)),
  };
};

const resolveEventStartMillis = (event = {}, nowMs = Date.now()) => {
  const explicitStartMs = parseTimestampToMillis(event.eventStartAt || event.startAt || event.startsAt);

  if (explicitStartMs) {
    return explicitStartMs;
  }

  const dateParts = parseEventDateParts(event.date, nowMs);

  if (!dateParts) {
    return null;
  }

  const timeParts = parseEventTimeParts(event.time);
  return Date.UTC(dateParts.year, dateParts.monthIndex, dateParts.day, timeParts.hours, timeParts.minutes, 0, 0);
};

const resolveEventEndMillis = (event = {}, startMs) => {
  const explicitEndMs = parseTimestampToMillis(event.eventEndAt || event.endAt || event.endsAt);

  if (explicitEndMs) {
    return explicitEndMs;
  }

  const endTime = normalizeOptionalString(event.endTime);

  if (endTime && Number.isFinite(startMs)) {
    const startDate = new Date(startMs);
    const endTimeParts = parseEventTimeParts(endTime);
    const fallbackEndMs = Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate(),
      endTimeParts.hours,
      endTimeParts.minutes,
      0,
      0,
    );

    if (fallbackEndMs >= startMs) {
      return fallbackEndMs;
    }
  }

  return Number.isFinite(startMs) ? startMs + COMMUNITY_EVENT_ROOM_DEFAULT_DURATION_MS : null;
};

const extractEventCity = (event = {}) => {
  const directCity = normalizeOptionalString(event.city || event.travelReferenceCity || event.locationCity);

  if (directCity) {
    return directCity;
  }

  const address = normalizeOptionalString(event.address);

  if (!address) {
    return null;
  }

  const commaParts = address.split(',').map((entry) => normalizeOptionalString(entry)).filter(Boolean);
  const firstPart = commaParts[0] || '';
  const withoutPostalCode = firstPart.replace(/^\d{4,5}\s+/, '').trim();

  if (withoutPostalCode) {
    return withoutPostalCode;
  }

  return commaParts[1] || null;
};

const buildEventCommunityRoomId = (eventId) => `event-${eventId}`;

const buildEventCommunityRoomSlug = ({ title, eventId }) => {
  const titleSlug = slugifyCommunityText(title, 'event');
  const eventSuffix = slugifyCommunityText(eventId, 'event').slice(-12);
  return `event-${titleSlug}-${eventSuffix}`;
};

const isEventDocumentDisabled = (event = {}) => event.active === false || event.deleted === true || Boolean(normalizeOptionalString(event.deletedAt));

const buildEventRoomMetadataFromEvent = ({ eventId, event = {}, manualActive = true, nowMs = Date.now() }) => {
  const title = normalizeOptionalString(event.title || event.name);

  if (!title) {
    throw new HttpsError('failed-precondition', 'Das Event hat keinen gültigen Titel.', getCommunityErrorDetails('event_missing_title', { eventId }));
  }

  if (isEventDocumentDisabled(event)) {
    throw new HttpsError('failed-precondition', 'Das Event ist nicht aktiv.', getCommunityErrorDetails('event_inactive', { eventId }));
  }

  const eventStartMs = resolveEventStartMillis(event, nowMs);

  if (!eventStartMs) {
    throw new HttpsError('failed-precondition', 'Das Event hat keinen maschinenlesbaren Startzeitpunkt.', getCommunityErrorDetails('event_start_missing', { eventId }));
  }

  const eventEndMs = resolveEventEndMillis(event, eventStartMs);
  const visibleFromMs = eventStartMs - COMMUNITY_EVENT_ROOM_VISIBLE_BEFORE_MS;
  const visibleUntilMs = (eventEndMs || eventStartMs) + COMMUNITY_EVENT_ROOM_VISIBLE_AFTER_MS;
  const effectiveManualActive = manualActive !== false;

  return {
    roomId: buildEventCommunityRoomId(eventId),
    name: title,
    slug: buildEventCommunityRoomSlug({ title, eventId }),
    description: `Community-Chat zum Event \"${title}\".`,
    type: COMMUNITY_ROOM_TYPES.EVENT,
    region: null,
    manualActive: effectiveManualActive,
    active: effectiveManualActive && nowMs >= visibleFromMs && nowMs <= visibleUntilMs,
    eventId,
    eventTitle: title,
    eventDateLabel: normalizeOptionalString(event.date) || null,
    eventTimeLabel: normalizeOptionalString(event.time) || null,
    eventCity: extractEventCity(event),
    eventStartAt: new Date(eventStartMs).toISOString(),
    eventEndAt: new Date(eventEndMs || eventStartMs).toISOString(),
    eventVisibleFromAt: new Date(visibleFromMs).toISOString(),
    eventVisibleUntilAt: new Date(visibleUntilMs).toISOString(),
  };
};

const buildEventRoomSyncPatch = ({ room = {}, metadata = {}, fieldValue }) => {
  const patch = {
    name: metadata.name,
    slug: metadata.slug,
    description: metadata.description,
    type: metadata.type,
    region: metadata.region,
    active: metadata.active,
    manualActive: metadata.manualActive,
    eventId: metadata.eventId,
    eventTitle: metadata.eventTitle,
    eventDateLabel: metadata.eventDateLabel,
    eventTimeLabel: metadata.eventTimeLabel,
    eventCity: metadata.eventCity,
    eventStartAt: metadata.eventStartAt,
    eventEndAt: metadata.eventEndAt,
    eventVisibleFromAt: metadata.eventVisibleFromAt,
    eventVisibleUntilAt: metadata.eventVisibleUntilAt,
    updatedAt: fieldValue.serverTimestamp(),
  };

  const hasChanges = Object.entries(patch)
    .filter(([key]) => key !== 'updatedAt')
    .some(([key, value]) => room[key] !== value);

  return hasChanges ? patch : null;
};

const syncEventRoomStateInTransaction = async ({ firestore, transaction, roomRef, roomSnapshot, fieldValue, nowMs = Date.now() }) => {
  if (!roomSnapshot.exists) {
    return null;
  }

  const room = { id: roomSnapshot.id, ...roomSnapshot.data() };

  if (room.type !== COMMUNITY_ROOM_TYPES.EVENT || !normalizeOptionalString(room.eventId)) {
    return room;
  }

  const eventId = normalizeOptionalString(room.eventId);
  const eventRef = firestore.collection('events').doc(eventId);
  const eventSnapshot = await transaction.get(eventRef);

  if (!eventSnapshot.exists) {
    if (room.active !== false) {
      transaction.set(roomRef, {
        active: false,
        updatedAt: fieldValue.serverTimestamp(),
      }, { merge: true });
    }

    return {
      ...room,
      active: false,
    };
  }

  const metadata = buildEventRoomMetadataFromEvent({
    eventId,
    event: eventSnapshot.data(),
    manualActive: room.manualActive !== false,
    nowMs,
  });
  const patch = buildEventRoomSyncPatch({ room, metadata, fieldValue });

  if (patch) {
    transaction.set(roomRef, patch, { merge: true });
  }

  return {
    ...room,
    ...metadata,
  };
};

const sanitizeCommunityBlockReason = (value) => {
  const normalizedReason = normalizeOptionalString(value);

  if (normalizedReason.length > COMMUNITY_BLOCK_REASON_MAX_LENGTH) {
    throw new HttpsError('invalid-argument', `Der Blockiergrund darf maximal ${COMMUNITY_BLOCK_REASON_MAX_LENGTH} Zeichen lang sein.`, getCommunityErrorDetails('block_reason_too_long', {
      maxLength: COMMUNITY_BLOCK_REASON_MAX_LENGTH,
    }));
  }

  return normalizedReason;
};

const sanitizeCommunityReportComment = (value) => {
  const normalizedComment = normalizeOptionalString(value).slice(0, COMMUNITY_REPORT_COMMENT_MAX_LENGTH);

  if (normalizeOptionalString(value).length > COMMUNITY_REPORT_COMMENT_MAX_LENGTH) {
    throw new HttpsError('invalid-argument', `Der Kommentar darf maximal ${COMMUNITY_REPORT_COMMENT_MAX_LENGTH} Zeichen lang sein.`, getCommunityErrorDetails('report_comment_too_long', {
      maxLength: COMMUNITY_REPORT_COMMENT_MAX_LENGTH,
    }));
  }

  return normalizedComment;
};

const validateCommunityReportReason = (value) => {
  const reason = normalizeOptionalString(value).toUpperCase();

  if (!ALLOWED_COMMUNITY_REPORT_REASONS.has(reason)) {
    throw new HttpsError('invalid-argument', 'Der Meldegrund ist ungültig.', getCommunityErrorDetails('invalid_report_reason', { reason }));
  }

  return reason;
};

const validateCommunityModerationAction = (value) => {
  const action = normalizeOptionalString(value).toUpperCase();

  if (!ALLOWED_COMMUNITY_MODERATION_ACTIONS.has(action)) {
    throw new HttpsError('invalid-argument', 'Die Moderationsaktion ist ungültig.', getCommunityErrorDetails('invalid_moderation_action', { action }));
  }

  return action;
};

const hasVerifiedEmail = (authToken = {}, profile = {}) => {
  if (authToken && Object.prototype.hasOwnProperty.call(authToken, 'email_verified')) {
    return authToken.email_verified === true;
  }

  return profile.emailVerified === true;
};

const hasVerifiedAge = (profile = {}) => {
  if (profile.ageVerified !== true) {
    return false;
  }

  const status = normalizeOptionalString(profile.ageVerificationStatus).toLowerCase();

  if (!status) {
    return true;
  }

  return ALLOWED_AGE_VERIFICATION_STATUSES.has(status);
};

const hasPendingDeletion = (profile = {}) => Boolean(normalizeOptionalString(profile.accountDeletionRequestedAt));

const isModerationRestricted = (profile = {}) => RESTRICTED_MODERATION_STATES.has(normalizeOptionalString(profile.moderationState).toLowerCase());

const assertCommunityAccessFromProfile = ({ profile = {}, authToken = {}, action = COMMUNITY_ACCESS_ACTIONS.READ }) => {
  if (!profile || typeof profile !== 'object' || !normalizeOptionalString(profile.uid || profile.id)) {
    throw new HttpsError('permission-denied', 'Community-Zugriff nicht erlaubt.', getCommunityErrorDetails('missing_profile', { action }));
  }

  if (action === COMMUNITY_ACCESS_ACTIONS.ADMIN) {
    const isAdmin = profile.isAdmin === true || normalizeOptionalString(profile.role).toLowerCase() === 'admin';

    if (!isAdmin) {
      throw new HttpsError('permission-denied', 'Community-Räume dürfen nur von Admins verwaltet werden.', getCommunityErrorDetails('admin_required', { action }));
    }

    return profile;
  }

  if (!hasVerifiedEmail(authToken, profile)) {
    throw new HttpsError('permission-denied', 'Bitte bestätige zuerst deine E-Mail-Adresse.', getCommunityErrorDetails('email_not_verified', { action }));
  }

  if (!hasVerifiedAge(profile)) {
    throw new HttpsError('permission-denied', 'Der Community-Chat ist nur für verifizierte Erwachsene verfügbar.', getCommunityErrorDetails('age_not_verified', { action }));
  }

  if (hasPendingDeletion(profile)) {
    throw new HttpsError('permission-denied', 'Für Konten mit offener Löschanfrage ist der Community-Chat gesperrt.', getCommunityErrorDetails('account_pending_deletion', { action }));
  }

  if (isModerationRestricted(profile)) {
    throw new HttpsError('permission-denied', 'Dein Community-Zugriff ist derzeit eingeschränkt.', getCommunityErrorDetails('moderation_restricted', { action }));
  }

  return profile;
};

const assertCommunityAccess = async ({ firestore, uid, authToken = {}, action = COMMUNITY_ACCESS_ACTIONS.READ }) => {
  const userRef = firestore.collection('users').doc(uid);
  const userSnapshot = await userRef.get();

  if (!userSnapshot.exists) {
    throw new HttpsError('permission-denied', 'Community-Zugriff nicht erlaubt.', getCommunityErrorDetails('missing_profile', { action }));
  }

  return assertCommunityAccessFromProfile({
    profile: { id: userSnapshot.id, uid, ...userSnapshot.data() },
    authToken,
    action,
  });
};

const getCommunityRulesConfigRef = (firestore) => {
  const [collectionName, docId] = COMMUNITY_RULES_CONFIG_DOC_PATH.split('/');
  return firestore.collection(collectionName).doc(docId);
};

const getCommunityRulesVersionRef = (firestore, version) => firestore.collection(COMMUNITY_RULES_VERSIONS_COLLECTION).doc(version);

const getCommunityRulesAcceptanceRef = (firestore, uid) => firestore.collection(COMMUNITY_RULE_ACCEPTANCES_COLLECTION).doc(uid);
const getCommunityPresenceRef = (firestore, uid) => firestore.collection('communityPresence').doc(uid);

const ensureCurrentCommunityRulesConfigInTransaction = async ({ firestore, transaction, fieldValue }) => {
  const configRef = getCommunityRulesConfigRef(firestore);
  const configSnapshot = await transaction.get(configRef);

  if (configSnapshot.exists) {
    return {
      ref: configRef,
      config: normalizeCommunityRulesConfig(configSnapshot.data()),
    };
  }

  const defaultConfig = buildDefaultCommunityRulesConfig({ fieldValue });
  transaction.set(configRef, defaultConfig);
  transaction.set(getCommunityRulesVersionRef(firestore, DEFAULT_COMMUNITY_RULES_VERSION), buildCommunityRulesVersionRecord({
    version: DEFAULT_COMMUNITY_RULES_VERSION,
    title: DEFAULT_COMMUNITY_RULES_TITLE,
    sections: cloneRulesSections(),
    publishedAt: defaultConfig.publishedAt,
    createdBy: 'system',
    fieldValue,
  }), { merge: true });

  return {
    ref: configRef,
    config: normalizeCommunityRulesConfig(defaultConfig),
  };
};

const assertCommunityRulesAcceptedSnapshot = ({ uid, currentRulesConfig = {}, acceptanceSnapshot }) => {
  const currentVersion = normalizeOptionalString(currentRulesConfig.version);

  if (!currentVersion) {
    throw new HttpsError('failed-precondition', 'Die aktuellen Community-Regeln sind derzeit nicht verfügbar.', getCommunityRulesErrorDetails('missing_active_rules_config'));
  }

  const acceptedVersion = normalizeOptionalString(acceptanceSnapshot?.exists ? acceptanceSnapshot.data()?.latestAcceptedVersion : '');

  if (acceptedVersion !== currentVersion) {
    throw new HttpsError('permission-denied', 'Bitte bestätige zuerst die aktuellen Community-Regeln.', getCommunityRulesErrorDetails('community_rules_not_accepted', {
      currentVersion,
      acceptedVersion: acceptedVersion || null,
      userId: uid,
    }));
  }

  return {
    currentVersion,
    acceptedVersion,
  };
};

const getEffectiveCommunityPresenceVisibility = (profile = {}) => profile.showCommunityActivityStatus !== false;

const validateCommunityMessage = (text) => {
  const normalizedText = normalizeCommunityText(text);

  if (!normalizedText) {
    throw new HttpsError('invalid-argument', 'Leere Community-Nachrichten sind nicht erlaubt.', getCommunityErrorDetails('empty_message'));
  }

  if (normalizedText.length > COMMUNITY_MESSAGE_MAX_LENGTH) {
    throw new HttpsError('invalid-argument', `Community-Nachrichten dürfen maximal ${COMMUNITY_MESSAGE_MAX_LENGTH} Zeichen lang sein.`, getCommunityErrorDetails('message_too_long', {
      maxLength: COMMUNITY_MESSAGE_MAX_LENGTH,
    }));
  }

  return normalizedText;
};

const normalizeCommunityMessageMentions = (mentions = []) => {
  if (!Array.isArray(mentions)) {
    return [];
  }

  const uniqueUserIds = [];

  mentions.forEach((entry) => {
    const userId = normalizeOptionalString(entry?.userId);

    if (!userId || uniqueUserIds.includes(userId) || uniqueUserIds.length >= COMMUNITY_MENTION_MAX_COUNT) {
      return;
    }

    uniqueUserIds.push(userId);
  });

  return uniqueUserIds;
};

const normalizeReactionType = (value) => normalizeOptionalString(value).toLowerCase();

const validateReactionType = (value) => {
  const reactionType = normalizeReactionType(value);

  if (!ALLOWED_COMMUNITY_REACTION_TYPES.has(reactionType)) {
    throw new HttpsError('invalid-argument', 'Der Reaktionstyp ist ungültig.', getCommunityErrorDetails('invalid_reaction_type', {
      reactionType,
    }));
  }

  return reactionType;
};

const buildCommunityBlockDocumentId = ({ blockerUserId, blockedUserId }) => `${blockerUserId}__${blockedUserId}`;

const buildCommunityMessageReportDocumentId = ({ reporterUserId, messageId, reason }) => `message__${reporterUserId}__${messageId}__${reason}`;

const buildCommunityUserReportDocumentId = ({ reporterUserId, reportedUserId, roomId, reason }) => `user__${reporterUserId}__${reportedUserId}__${roomId}__${reason}`;

const buildCommunityReportPriority = (reason) => (reason === COMMUNITY_REPORT_REASONS.SUSPECTED_MINOR
  ? COMMUNITY_REPORT_PRIORITIES.CRITICAL
  : COMMUNITY_REPORT_PRIORITIES.NORMAL);

const isCriticalCommunityReportReason = (reason) => reason === COMMUNITY_REPORT_REASONS.SUSPECTED_MINOR;

const normalizeCommunityChatBan = (value = {}) => ({
  active: normalizeOptionalBoolean(value?.active),
  until: value?.until || null,
  reason: normalizeOptionalString(value?.reason),
  createdAt: value?.createdAt || null,
  createdBy: normalizeOptionalString(value?.createdBy),
});

const getActiveCommunityChatBan = ({ safetyState = {}, nowMs }) => {
  const chatBan = normalizeCommunityChatBan(safetyState?.chatBan || {});

  if (!chatBan.active) {
    return null;
  }

  if (!chatBan.until) {
    return { ...chatBan, permanent: true };
  }

  const untilMs = parseTimestampToMillis(chatBan.until);

  if (!untilMs || untilMs <= nowMs) {
    return null;
  }

  return {
    ...chatBan,
    permanent: false,
    untilMs,
  };
};

const assertCommunityChatWriteAllowed = ({ safetyState = {}, nowMs }) => {
  const activeBan = getActiveCommunityChatBan({ safetyState, nowMs });

  if (!activeBan) {
    return null;
  }

  throw new HttpsError('permission-denied', 'Dein Schreibzugang zur Night-Whisper Community wurde eingeschränkt.', getCommunityErrorDetails('chat_banned', {
    until: activeBan.permanent ? null : activeBan.until,
    permanent: activeBan.permanent === true,
  }));
};

const buildCommunityBlockRecord = ({ blockerUserId, blockedUserId, blockedNickname, reason, fieldValue }) => ({
  blockerUserId,
  blockedUserId,
  blockedNickname,
  reason: reason || '',
  createdAt: fieldValue.serverTimestamp(),
  updatedAt: fieldValue.serverTimestamp(),
});

const buildCommunityReportRecord = ({
  reportId,
  reporterUserId,
  reporterNickname,
  reportedUserId,
  reportedNickname,
  roomId,
  messageId = null,
  messagePreview = '',
  reason,
  comment,
  priority,
  fieldValue,
}) => ({
  id: reportId,
  reporterUserId,
  reporterNickname,
  reportedUserId,
  reportedNickname,
  roomId,
  messageId,
  messagePreview,
  reason,
  comment,
  priority,
  priorityRank: COMMUNITY_REPORT_PRIORITY_RANKS[priority] || COMMUNITY_REPORT_PRIORITY_RANKS[COMMUNITY_REPORT_PRIORITIES.NORMAL],
  status: COMMUNITY_REPORT_STATUSES.OPEN,
  createdAt: fieldValue.serverTimestamp(),
  handledAt: null,
  handledBy: null,
  reviewingAt: null,
  reviewingBy: null,
  handledAction: null,
});

const buildCommunityModerationLogRecord = ({
  moderatorId,
  targetUserId,
  targetMessageId = null,
  reportId = null,
  action,
  reason,
  fieldValue,
}) => ({
  moderatorId,
  targetUserId,
  targetMessageId,
  reportId,
  action,
  reason,
  createdAt: fieldValue.serverTimestamp(),
});

const buildCommunityReportRateLimitRecord = ({ uid, recentReportTimestamps, fieldValue }) => ({
  userId: uid,
  recentReportTimestamps,
  updatedAt: fieldValue.serverTimestamp(),
});

const buildCommunityRoomReadDocumentId = ({ uid, roomId }) => `${uid}__${roomId}`;

const buildCommunityRoomReadRecord = ({ uid, roomId, lastReadMessageId = '', lastReadMessageCount = null, fieldValue }) => ({
  userId: uid,
  roomId,
  lastReadMessageId: lastReadMessageId || null,
  lastReadMessageCount: Number.isFinite(Number(lastReadMessageCount)) ? Number(lastReadMessageCount) : null,
  lastReadAt: fieldValue.serverTimestamp(),
  updatedAt: fieldValue.serverTimestamp(),
});

const buildCommunityRoomRecord = ({ roomId, name, slug, description, type, region, active, manualActive = active, createdBy, eventId = null, eventMetadata = {}, fieldValue }) => ({
  id: roomId,
  name,
  slug,
  description,
  type,
  region,
  active,
  manualActive: manualActive !== false,
  eventId,
  eventTitle: eventMetadata.eventTitle || null,
  eventDateLabel: eventMetadata.eventDateLabel || null,
  eventTimeLabel: eventMetadata.eventTimeLabel || null,
  eventCity: eventMetadata.eventCity || null,
  eventStartAt: eventMetadata.eventStartAt || null,
  eventEndAt: eventMetadata.eventEndAt || null,
  eventVisibleFromAt: eventMetadata.eventVisibleFromAt || null,
  eventVisibleUntilAt: eventMetadata.eventVisibleUntilAt || null,
  createdBy,
  createdAt: fieldValue.serverTimestamp(),
  updatedAt: fieldValue.serverTimestamp(),
  lastMessageAt: null,
  messageCount: 0,
});

const buildCommunityRoomUpdatePatch = ({ name, slug, description, type, region, active, manualActive = active, eventId = null, eventMetadata = {}, fieldValue }) => ({
  name,
  slug,
  description,
  type,
  region,
  active,
  manualActive: manualActive !== false,
  eventId,
  eventTitle: eventMetadata.eventTitle || null,
  eventDateLabel: eventMetadata.eventDateLabel || null,
  eventTimeLabel: eventMetadata.eventTimeLabel || null,
  eventCity: eventMetadata.eventCity || null,
  eventStartAt: eventMetadata.eventStartAt || null,
  eventEndAt: eventMetadata.eventEndAt || null,
  eventVisibleFromAt: eventMetadata.eventVisibleFromAt || null,
  eventVisibleUntilAt: eventMetadata.eventVisibleUntilAt || null,
  updatedAt: fieldValue.serverTimestamp(),
});

const buildCommunitySafetyStatePatch = ({ uid, chatBan, warningCount, warningReason, fieldValue }) => {
  const patch = {
    userId: uid,
    updatedAt: fieldValue.serverTimestamp(),
  };

  if (chatBan) {
    patch.chatBan = chatBan;
  }

  if (typeof warningCount === 'number') {
    patch.warningCount = warningCount;
    patch.lastWarningAt = fieldValue.serverTimestamp();
    patch.lastWarningReason = warningReason || '';
  }

  return patch;
};

const buildCommunityBanRecord = ({ action, moderatorId, reason, nowMs }) => ({
  active: true,
  until: action === COMMUNITY_MODERATION_ACTIONS.BAN_PERMANENT
    ? null
    : new Date(nowMs + COMMUNITY_BAN_DURATIONS_MS[action]).toISOString(),
  reason,
  createdAt: new Date(nowMs).toISOString(),
  createdBy: moderatorId,
});

const normalizeReactionCounts = (value = {}) => {
  const defaults = createDefaultReactionCounts();

  return {
    heart: Math.max(0, Number(value?.heart) || defaults.heart),
    fire: Math.max(0, Number(value?.fire) || defaults.fire),
    laugh: Math.max(0, Number(value?.laugh) || defaults.laugh),
    like: Math.max(0, Number(value?.like) || defaults.like),
  };
};

const isVisibleCommunityMessage = (message = {}, expectedRoomId = '') => {
  if (!message || typeof message !== 'object') {
    return false;
  }

  if (expectedRoomId && normalizeOptionalString(message.roomId) !== expectedRoomId) {
    return false;
  }

  if (message.deletedAt) {
    return false;
  }

  return normalizeOptionalString(message.moderationStatus || COMMUNITY_MESSAGE_MODERATION_STATUSES.VISIBLE) === COMMUNITY_MESSAGE_MODERATION_STATUSES.VISIBLE;
};

const assertVisibleCommunityMessage = ({ snapshot, roomId, reason = 'message_not_visible' }) => {
  if (!snapshot?.exists) {
    throw new HttpsError('failed-precondition', 'Die Community-Nachricht ist nicht verfügbar.', getCommunityErrorDetails(reason, {
      roomId,
    }));
  }

  const message = snapshot.data();

  if (!isVisibleCommunityMessage(message, roomId)) {
    throw new HttpsError('failed-precondition', 'Die Community-Nachricht ist nicht verfügbar.', getCommunityErrorDetails(reason, {
      roomId,
      messageId: snapshot.id,
    }));
  }

  return message;
};

const validateReplyTarget = ({ roomId, replySnapshot }) => {
  assertVisibleCommunityMessage({
    snapshot: replySnapshot,
    roomId,
    reason: 'reply_target_invalid',
  });

  return replySnapshot.id;
};

const buildNormalizedMentions = ({ userSnapshots = [] }) => userSnapshots
  .filter((snapshot) => snapshot?.exists)
  .reduce((result, snapshot) => {
    try {
      const profile = assertCommunityAccessFromProfile({
        profile: { id: snapshot.id, uid: snapshot.id, ...snapshot.data() },
        authToken: {},
        action: COMMUNITY_ACCESS_ACTIONS.READ,
      });
      const nickname = normalizeOptionalString(profile.nickname) || 'Night-Whisper Mitglied';

      return [...result, {
        userId: snapshot.id,
        nickname,
      }];
    } catch {
      return result;
    }
  }, []);

const extractRecentMessageTimestamps = (value, nowMs) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry) && nowMs - entry <= COMMUNITY_RATE_LIMIT_WINDOW_MS)
    .sort((left, right) => left - right);
};

const extractRecentActivityTimestamps = (value, nowMs, windowMs) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry) && nowMs - entry <= windowMs)
    .sort((left, right) => left - right);
};

const checkCommunityRateLimit = ({ rateLimitData = {}, nowMs }) => {
  const recentMessageTimestamps = extractRecentMessageTimestamps(rateLimitData.recentMessageTimestamps, nowMs);

  if (recentMessageTimestamps.length >= COMMUNITY_RATE_LIMIT_MAX_MESSAGES) {
    const oldestTimestamp = recentMessageTimestamps[0];
    const retryAfterMs = Math.max(1, COMMUNITY_RATE_LIMIT_WINDOW_MS - (nowMs - oldestTimestamp));
    throw new HttpsError('resource-exhausted', COMMUNITY_RATE_LIMIT_ERROR_MESSAGE, getCommunityErrorDetails('rate_limit_exceeded', {
      retryAfterMs,
      maxMessages: COMMUNITY_RATE_LIMIT_MAX_MESSAGES,
      windowMs: COMMUNITY_RATE_LIMIT_WINDOW_MS,
    }));
  }

  return [...recentMessageTimestamps, nowMs];
};

const checkCommunityReportRateLimit = ({ rateLimitData = {}, nowMs, reason }) => {
  if (isCriticalCommunityReportReason(reason)) {
    return extractRecentActivityTimestamps(rateLimitData.recentReportTimestamps, nowMs, COMMUNITY_REPORT_RATE_LIMIT_WINDOW_MS);
  }

  const recentReportTimestamps = extractRecentActivityTimestamps(
    rateLimitData.recentReportTimestamps,
    nowMs,
    COMMUNITY_REPORT_RATE_LIMIT_WINDOW_MS,
  );

  if (recentReportTimestamps.length >= COMMUNITY_REPORT_RATE_LIMIT_MAX_REPORTS) {
    throw new HttpsError('resource-exhausted', 'Du hast in kurzer Zeit bereits mehrere Meldungen gesendet. Bitte warte einen Moment.', getCommunityErrorDetails('report_rate_limit_exceeded', {
      maxReports: COMMUNITY_REPORT_RATE_LIMIT_MAX_REPORTS,
      windowMs: COMMUNITY_REPORT_RATE_LIMIT_WINDOW_MS,
    }));
  }

  return [...recentReportTimestamps, nowMs];
};

const getCommunityRoomLastActivityMillis = (room = {}) => {
  const lastMessageAtMs = parseTimestampToMillis(room.lastMessageAt);
  const updatedAtMs = parseTimestampToMillis(room.updatedAt);
  const createdAtMs = parseTimestampToMillis(room.createdAt);

  return lastMessageAtMs || updatedAtMs || createdAtMs || 0;
};

const buildCommunityMessageRecord = ({ messageId, roomId, uid, nickname, text, replyToMessageId = '', mentions = [], fieldValue }) => ({
  id: messageId,
  roomId,
  userId: uid,
  nickname,
  text,
  createdAt: fieldValue.serverTimestamp(),
  updatedAt: fieldValue.serverTimestamp(),
  deletedAt: null,
  moderationStatus: COMMUNITY_MESSAGE_MODERATION_STATUSES.VISIBLE,
  replyToMessageId: replyToMessageId || null,
  mentions,
  reactionCounts: createDefaultReactionCounts(),
  edited: false,
});

const buildCommunityRateLimitRecord = ({ uid, recentMessageTimestamps, fieldValue }) => ({
  userId: uid,
  recentMessageTimestamps,
  updatedAt: fieldValue.serverTimestamp(),
});

const buildSeedCommunityRoomRecord = (fieldValue) => ({
  ...DEFAULT_COMMUNITY_ROOM,
  createdBy: 'system',
  createdAt: fieldValue.serverTimestamp(),
  updatedAt: fieldValue.serverTimestamp(),
});

const buildCommunityReactionRecord = ({ roomId, messageId, uid, reactionType, fieldValue }) => ({
  roomId,
  messageId,
  userId: uid,
  reactionType,
  createdAt: fieldValue.serverTimestamp(),
});

const buildMentionPlans = ({ firestore, senderUserId, mentionedUserIds }) => mentionedUserIds.map((mentionedUserId) => ({
  userId: mentionedUserId,
  userRef: firestore.collection('users').doc(mentionedUserId),
  blockedBySenderRef: firestore.collection('communityBlocks').doc(buildCommunityBlockDocumentId({
    blockerUserId: senderUserId,
    blockedUserId: mentionedUserId,
  })),
  blockedSenderRef: firestore.collection('communityBlocks').doc(buildCommunityBlockDocumentId({
    blockerUserId: mentionedUserId,
    blockedUserId: senderUserId,
  })),
}));

const buildMentionSnapshotsByBlockState = ({ mentionPlans, mentionResults }) => {
  const nextSnapshots = [];
  let resultIndex = 0;

  mentionPlans.forEach(() => {
    const userSnapshot = mentionResults[resultIndex];
    const blockedBySenderSnapshot = mentionResults[resultIndex + 1];
    const blockedSenderSnapshot = mentionResults[resultIndex + 2];
    resultIndex += 3;

    if (blockedBySenderSnapshot?.exists || blockedSenderSnapshot?.exists) {
      return;
    }

    nextSnapshots.push(userSnapshot);
  });

  return nextSnapshots;
};

const createSendCommunityMessageHandler = ({ firestore, fieldValue, logger = console, now = () => Date.now() }) => {
  return async (request) => {
    const uid = request.auth?.uid;

    if (!uid) {
      throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
    }

    const roomId = sanitizeCommunityRoomId(request.data?.roomId);
    const normalizedText = validateCommunityMessage(request.data?.text);
    const replyToMessageId = sanitizeOptionalDocumentId(request.data?.replyToMessageId, 'replyToMessageId');
    const requestedMentionUserIds = normalizeCommunityMessageMentions(request.data?.mentions);
    const roomRef = firestore.collection('communityRooms').doc(roomId);
    const messageRef = roomRef.collection('messages').doc();
    const rateLimitRef = firestore.collection('communityRateLimits').doc(uid);
    const safetyStateRef = firestore.collection('communitySafetyStates').doc(uid);
    const userRef = firestore.collection('users').doc(uid);
    const nowMs = now();

    try {
      await firestore.runTransaction(async (transaction) => {
        const replyRef = replyToMessageId ? roomRef.collection('messages').doc(replyToMessageId) : null;
        const acceptanceRef = getCommunityRulesAcceptanceRef(firestore, uid);
        const mentionPlans = buildMentionPlans({
          firestore,
          senderUserId: uid,
          mentionedUserIds: requestedMentionUserIds,
        });
        const [userSnapshot, roomSnapshot, rateLimitSnapshot, safetyStateSnapshot, replySnapshot, acceptanceSnapshot, ...mentionResults] = await Promise.all([
          transaction.get(userRef),
          transaction.get(roomRef),
          transaction.get(rateLimitRef),
          transaction.get(safetyStateRef),
          replyRef ? transaction.get(replyRef) : Promise.resolve(null),
          transaction.get(acceptanceRef),
          ...mentionPlans.flatMap((plan) => [
            transaction.get(plan.userRef),
            transaction.get(plan.blockedBySenderRef),
            transaction.get(plan.blockedSenderRef),
          ]),
        ]);

        if (!userSnapshot.exists) {
          throw new HttpsError('permission-denied', 'Community-Zugriff nicht erlaubt.', getCommunityErrorDetails('missing_profile', {
            action: COMMUNITY_ACCESS_ACTIONS.WRITE,
          }));
        }

        const profile = assertCommunityAccessFromProfile({
          profile: { id: userSnapshot.id, uid, ...userSnapshot.data() },
          authToken: request.auth?.token || {},
          action: COMMUNITY_ACCESS_ACTIONS.WRITE,
        });
        assertCommunityChatWriteAllowed({
          safetyState: safetyStateSnapshot.exists ? safetyStateSnapshot.data() : {},
          nowMs,
        });

        const { config: currentRulesConfig } = await ensureCurrentCommunityRulesConfigInTransaction({
          firestore,
          transaction,
          fieldValue,
        });

        assertCommunityRulesAcceptedSnapshot({
          uid,
          currentRulesConfig,
          acceptanceSnapshot,
        });

        if (!roomSnapshot.exists) {
          throw new HttpsError('not-found', 'Der Community-Raum wurde nicht gefunden.', getCommunityErrorDetails('room_not_found', { roomId }));
        }

        const effectiveRoom = await syncEventRoomStateInTransaction({
          firestore,
          transaction,
          roomRef,
          roomSnapshot,
          fieldValue,
          nowMs,
        });

        if (effectiveRoom?.active !== true) {
          throw new HttpsError('failed-precondition', 'Der Community-Raum ist derzeit nicht aktiv.', getCommunityErrorDetails('room_inactive', { roomId }));
        }

        const recentMessageTimestamps = checkCommunityRateLimit({
          rateLimitData: rateLimitSnapshot.exists ? rateLimitSnapshot.data() : {},
          nowMs,
        });

        const validatedReplyToMessageId = replySnapshot
          ? validateReplyTarget({ roomId, replySnapshot })
          : '';
        const mentions = buildNormalizedMentions({
          userSnapshots: buildMentionSnapshotsByBlockState({
            mentionPlans,
            mentionResults,
          }),
        });

        const nickname = normalizeOptionalString(profile.nickname) || 'Night-Whisper Mitglied';
        const nextMessage = buildCommunityMessageRecord({
          messageId: messageRef.id,
          roomId,
          uid,
          nickname,
          text: normalizedText,
          replyToMessageId: validatedReplyToMessageId,
          mentions,
          fieldValue,
        });

        transaction.set(messageRef, nextMessage);
        transaction.set(roomRef, {
          messageCount: (Number(effectiveRoom?.messageCount) || 0) + 1,
          lastMessageAt: fieldValue.serverTimestamp(),
          updatedAt: fieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.set(rateLimitRef, buildCommunityRateLimitRecord({
          uid,
          recentMessageTimestamps,
          fieldValue,
        }), { merge: true });
      });
    } catch (error) {
      if (!(error instanceof HttpsError)) {
        logger.error('community-chat-send-failed', {
          uid,
          roomId,
          errorCode: 'internal',
          timestamp: new Date(nowMs).toISOString(),
        });
        throw new HttpsError('internal', 'Die Community-Nachricht konnte nicht gesendet werden.');
      }

      if (error.code === 'resource-exhausted') {
        throw error;
      }

      logger.error('community-chat-send-failed', {
        uid,
        roomId,
        errorCode: error.code,
        timestamp: new Date(nowMs).toISOString(),
      });
      throw error;
    }

    return {
      ok: true,
      roomId,
      messageId: messageRef.id,
      replyToMessageId: replyToMessageId || null,
      moderationStatus: COMMUNITY_MESSAGE_MODERATION_STATUSES.VISIBLE,
    };
  };
};

const createToggleCommunityReactionHandler = ({ firestore, fieldValue, logger = console, now = () => Date.now() }) => {
  return async (request) => {
    const uid = request.auth?.uid;

    if (!uid) {
      throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
    }

    const roomId = sanitizeCommunityRoomId(request.data?.roomId);
    const messageId = sanitizeCommunityRoomId(request.data?.messageId);
    const reactionType = validateReactionType(request.data?.reactionType);
    const roomRef = firestore.collection('communityRooms').doc(roomId);
    const messageRef = roomRef.collection('messages').doc(messageId);
    const reactionRef = messageRef.collection('reactions').doc(`${uid}_${reactionType}`);
    const safetyStateRef = firestore.collection('communitySafetyStates').doc(uid);
    const userRef = firestore.collection('users').doc(uid);
    const nowMs = now();

    try {
      return await firestore.runTransaction(async (transaction) => {
        const acceptanceRef = getCommunityRulesAcceptanceRef(firestore, uid);
        const [userSnapshot, roomSnapshot, messageSnapshot, reactionSnapshot, safetyStateSnapshot, acceptanceSnapshot] = await Promise.all([
          transaction.get(userRef),
          transaction.get(roomRef),
          transaction.get(messageRef),
          transaction.get(reactionRef),
          transaction.get(safetyStateRef),
          transaction.get(acceptanceRef),
        ]);

        if (!userSnapshot.exists) {
          throw new HttpsError('permission-denied', 'Community-Zugriff nicht erlaubt.', getCommunityErrorDetails('missing_profile', {
            action: COMMUNITY_ACCESS_ACTIONS.WRITE,
          }));
        }

        assertCommunityAccessFromProfile({
          profile: { id: userSnapshot.id, uid, ...userSnapshot.data() },
          authToken: request.auth?.token || {},
          action: COMMUNITY_ACCESS_ACTIONS.WRITE,
        });
        assertCommunityChatWriteAllowed({
          safetyState: safetyStateSnapshot.exists ? safetyStateSnapshot.data() : {},
          nowMs,
        });

        const { config: currentRulesConfig } = await ensureCurrentCommunityRulesConfigInTransaction({
          firestore,
          transaction,
          fieldValue,
        });

        assertCommunityRulesAcceptedSnapshot({
          uid,
          currentRulesConfig,
          acceptanceSnapshot,
        });

        if (!roomSnapshot.exists) {
          throw new HttpsError('failed-precondition', 'Der Community-Raum ist derzeit nicht aktiv.', getCommunityErrorDetails('room_inactive', { roomId }));
        }

        const effectiveRoom = await syncEventRoomStateInTransaction({
          firestore,
          transaction,
          roomRef,
          roomSnapshot,
          fieldValue,
          nowMs,
        });

        if (effectiveRoom?.active !== true) {
          throw new HttpsError('failed-precondition', 'Der Community-Raum ist derzeit nicht aktiv.', getCommunityErrorDetails('room_inactive', { roomId }));
        }

        const message = assertVisibleCommunityMessage({
          snapshot: messageSnapshot,
          roomId,
          reason: 'reaction_target_invalid',
        });
        const reactionCounts = normalizeReactionCounts(message.reactionCounts);
        const nextReactionCounts = { ...reactionCounts };
        const toggledOn = !reactionSnapshot.exists;

        if (toggledOn) {
          nextReactionCounts[reactionType] += 1;
          transaction.set(reactionRef, buildCommunityReactionRecord({
            roomId,
            messageId,
            uid,
            reactionType,
            fieldValue,
          }));
        } else {
          nextReactionCounts[reactionType] = Math.max(0, nextReactionCounts[reactionType] - 1);
          transaction.delete(reactionRef);
        }

        transaction.set(messageRef, {
          reactionCounts: nextReactionCounts,
          updatedAt: fieldValue.serverTimestamp(),
        }, { merge: true });

        return {
          ok: true,
          roomId,
          messageId,
          reactionType,
          toggledOn,
          reactionCount: nextReactionCounts[reactionType],
        };
      });
    } catch (error) {
      if (!(error instanceof HttpsError)) {
        logger.error('community-chat-reaction-failed', {
          uid,
          roomId,
          errorCode: 'internal',
          timestamp: new Date(nowMs).toISOString(),
        });
        throw new HttpsError('internal', 'Die Reaktion konnte nicht gespeichert werden.');
      }

      logger.error('community-chat-reaction-failed', {
        uid,
        roomId,
        errorCode: error.code,
        timestamp: new Date(nowMs).toISOString(),
      });
      throw error;
    }
  };
};

const createBlockCommunityUserHandler = ({ firestore, fieldValue }) => {
  return async (request) => {
    const uid = request.auth?.uid;

    if (!uid) {
      throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
    }

    const targetUserId = requireDocumentId(request.data?.targetUserId, 'targetUserId');
    const reason = sanitizeCommunityBlockReason(request.data?.reason);

    if (targetUserId === uid) {
      throw new HttpsError('invalid-argument', 'Du kannst dich nicht selbst blockieren.', getCommunityErrorDetails('self_block')); 
    }

    const userRef = firestore.collection('users').doc(uid);
    const targetUserRef = firestore.collection('users').doc(targetUserId);
    const blockRef = firestore.collection('communityBlocks').doc(buildCommunityBlockDocumentId({ blockerUserId: uid, blockedUserId: targetUserId }));

    return firestore.runTransaction(async (transaction) => {
      const [userSnapshot, targetUserSnapshot, existingBlockSnapshot] = await Promise.all([
        transaction.get(userRef),
        transaction.get(targetUserRef),
        transaction.get(blockRef),
      ]);

      if (!userSnapshot.exists) {
        throw new HttpsError('permission-denied', 'Community-Zugriff nicht erlaubt.', getCommunityErrorDetails('missing_profile', {
          action: COMMUNITY_ACCESS_ACTIONS.READ,
        }));
      }

      assertCommunityAccessFromProfile({
        profile: { id: userSnapshot.id, uid, ...userSnapshot.data() },
        authToken: request.auth?.token || {},
        action: COMMUNITY_ACCESS_ACTIONS.READ,
      });

      if (!targetUserSnapshot.exists) {
        throw new HttpsError('not-found', 'Das Zielprofil wurde nicht gefunden.', getCommunityErrorDetails('missing_target_user'));
      }

      if (existingBlockSnapshot.exists) {
        return {
          ok: true,
          blockerUserId: uid,
          blockedUserId: targetUserId,
          alreadyBlocked: true,
        };
      }

      const targetUser = targetUserSnapshot.data() || {};

      transaction.set(blockRef, buildCommunityBlockRecord({
        blockerUserId: uid,
        blockedUserId: targetUserId,
        blockedNickname: normalizeOptionalString(targetUser.nickname) || 'Night-Whisper Mitglied',
        reason,
        fieldValue,
      }));

      return {
        ok: true,
        blockerUserId: uid,
        blockedUserId: targetUserId,
        alreadyBlocked: false,
      };
    });
  };
};

const createUnblockCommunityUserHandler = ({ firestore }) => {
  return async (request) => {
    const uid = request.auth?.uid;

    if (!uid) {
      throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
    }

    const targetUserId = requireDocumentId(request.data?.targetUserId, 'targetUserId');
    const userRef = firestore.collection('users').doc(uid);
    const blockRef = firestore.collection('communityBlocks').doc(buildCommunityBlockDocumentId({ blockerUserId: uid, blockedUserId: targetUserId }));

    return firestore.runTransaction(async (transaction) => {
      const [userSnapshot, blockSnapshot] = await Promise.all([
        transaction.get(userRef),
        transaction.get(blockRef),
      ]);

      if (!userSnapshot.exists) {
        throw new HttpsError('permission-denied', 'Community-Zugriff nicht erlaubt.', getCommunityErrorDetails('missing_profile', {
          action: COMMUNITY_ACCESS_ACTIONS.READ,
        }));
      }

      assertCommunityAccessFromProfile({
        profile: { id: userSnapshot.id, uid, ...userSnapshot.data() },
        authToken: request.auth?.token || {},
        action: COMMUNITY_ACCESS_ACTIONS.READ,
      });

      if (!blockSnapshot.exists) {
        return {
          ok: true,
          blockerUserId: uid,
          blockedUserId: targetUserId,
          removed: false,
        };
      }

      transaction.delete(blockRef);

      return {
        ok: true,
        blockerUserId: uid,
        blockedUserId: targetUserId,
        removed: true,
      };
    });
  };
};

const createReportCommunityContentHandler = ({ firestore, fieldValue, now = () => Date.now() }) => {
  return async (request) => {
    const uid = request.auth?.uid;

    if (!uid) {
      throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
    }

    const roomId = sanitizeCommunityRoomId(request.data?.roomId || DEFAULT_COMMUNITY_ROOM_ID);
    const messageId = sanitizeOptionalDocumentId(request.data?.messageId, 'messageId');
    const targetUserId = sanitizeOptionalDocumentId(request.data?.targetUserId, 'targetUserId');
    const reason = validateCommunityReportReason(request.data?.reason);
    const comment = sanitizeCommunityReportComment(request.data?.comment);
    const userRef = firestore.collection('users').doc(uid);
    const roomRef = firestore.collection('communityRooms').doc(roomId);
    const reportRateLimitRef = firestore.collection('communityReportRateLimits').doc(uid);
    const nowMs = now();

    return firestore.runTransaction(async (transaction) => {
      const messageRef = messageId ? roomRef.collection('messages').doc(messageId) : null;
      const directTargetUserRef = messageId ? null : firestore.collection('users').doc(requireDocumentId(targetUserId, 'targetUserId'));
      const reportId = messageId
        ? buildCommunityMessageReportDocumentId({ reporterUserId: uid, messageId, reason })
        : buildCommunityUserReportDocumentId({ reporterUserId: uid, reportedUserId: requireDocumentId(targetUserId, 'targetUserId'), roomId, reason });
      const reportRef = firestore.collection('communityReports').doc(reportId);

      const [userSnapshot, roomSnapshot, reportRateLimitSnapshot, existingReportSnapshot, messageSnapshot, directTargetUserSnapshot] = await Promise.all([
        transaction.get(userRef),
        transaction.get(roomRef),
        transaction.get(reportRateLimitRef),
        transaction.get(reportRef),
        messageRef ? transaction.get(messageRef) : Promise.resolve(null),
        directTargetUserRef ? transaction.get(directTargetUserRef) : Promise.resolve(null),
      ]);

      if (!userSnapshot.exists) {
        throw new HttpsError('permission-denied', 'Community-Zugriff nicht erlaubt.', getCommunityErrorDetails('missing_profile', {
          action: COMMUNITY_ACCESS_ACTIONS.READ,
        }));
      }

      const reporterProfile = assertCommunityAccessFromProfile({
        profile: { id: userSnapshot.id, uid, ...userSnapshot.data() },
        authToken: request.auth?.token || {},
        action: COMMUNITY_ACCESS_ACTIONS.READ,
      });

      if (!roomSnapshot.exists) {
        throw new HttpsError('failed-precondition', 'Der Community-Raum ist derzeit nicht aktiv.', getCommunityErrorDetails('room_inactive', { roomId }));
      }

      const effectiveRoom = await syncEventRoomStateInTransaction({
        firestore,
        transaction,
        roomRef,
        roomSnapshot,
        fieldValue,
        nowMs,
      });

      if (effectiveRoom?.active !== true) {
        throw new HttpsError('failed-precondition', 'Der Community-Raum ist derzeit nicht aktiv.', getCommunityErrorDetails('room_inactive', { roomId }));
      }

      if (existingReportSnapshot.exists) {
        throw new HttpsError('already-exists', 'Diese Meldung wurde bereits übermittelt.', getCommunityErrorDetails('duplicate_report', { reportId }));
      }

      const recentReportTimestamps = checkCommunityReportRateLimit({
        rateLimitData: reportRateLimitSnapshot.exists ? reportRateLimitSnapshot.data() : {},
        nowMs,
        reason,
      });

      let reportedUserId = messageSnapshot ? '' : requireDocumentId(targetUserId, 'targetUserId');
      let reportedNickname = '';
      let resolvedMessageId = null;
      let messagePreview = '';

      if (messageSnapshot) {
        if (!messageSnapshot.exists) {
          throw new HttpsError('not-found', 'Die Community-Nachricht wurde nicht gefunden.', getCommunityErrorDetails('missing_report_message', { roomId, messageId }));
        }

        const message = messageSnapshot.data() || {};

        if (normalizeOptionalString(message.roomId) !== roomId) {
          throw new HttpsError('failed-precondition', 'Die Community-Nachricht passt nicht zu diesem Raum.', getCommunityErrorDetails('invalid_report_room', { roomId, messageId }));
        }

        reportedUserId = normalizeOptionalString(message.userId);
        reportedNickname = normalizeOptionalString(message.nickname) || 'Night-Whisper Mitglied';
        resolvedMessageId = messageSnapshot.id;
        messagePreview = normalizeCommunityText(message.text || '').slice(0, 280);

        if (!reportedUserId) {
          throw new HttpsError('failed-precondition', 'Die Community-Nachricht ist ungültig.', getCommunityErrorDetails('invalid_report_message_owner', { roomId, messageId }));
        }
      } else {
        if (!directTargetUserSnapshot?.exists) {
          throw new HttpsError('not-found', 'Das Zielprofil wurde nicht gefunden.', getCommunityErrorDetails('missing_target_user'));
        }

        reportedNickname = normalizeOptionalString(directTargetUserSnapshot.data()?.nickname) || 'Night-Whisper Mitglied';
      }

      const priority = buildCommunityReportPriority(reason);

      transaction.set(reportRef, buildCommunityReportRecord({
        reportId,
        reporterUserId: uid,
        reporterNickname: normalizeOptionalString(reporterProfile.nickname) || 'Night-Whisper Mitglied',
        reportedUserId,
        reportedNickname,
        roomId,
        messageId: resolvedMessageId,
        messagePreview,
        reason,
        comment,
        priority,
        fieldValue,
      }));
      transaction.set(reportRateLimitRef, buildCommunityReportRateLimitRecord({
        uid,
        recentReportTimestamps,
        fieldValue,
      }), { merge: true });

      return {
        ok: true,
        reportId,
        status: COMMUNITY_REPORT_STATUSES.OPEN,
        priority,
      };
    });
  };
};

const createModerateCommunityReportHandler = ({ firestore, fieldValue, now = () => Date.now() }) => {
  return async (request) => {
    const uid = request.auth?.uid;

    if (!uid) {
      throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
    }

    const reportId = requireDocumentId(request.data?.reportId, 'reportId');
    const action = validateCommunityModerationAction(request.data?.action);
    const reason = sanitizeCommunityReportComment(request.data?.reason || '');
    const userRef = firestore.collection('users').doc(uid);
    const reportRef = firestore.collection('communityReports').doc(reportId);
    const nowMs = now();

    return firestore.runTransaction(async (transaction) => {
      const [userSnapshot, reportSnapshot] = await Promise.all([
        transaction.get(userRef),
        transaction.get(reportRef),
      ]);

      if (!userSnapshot.exists) {
        throw new HttpsError('permission-denied', 'Community-Zugriff nicht erlaubt.', getCommunityErrorDetails('missing_profile', {
          action: COMMUNITY_ACCESS_ACTIONS.ADMIN,
        }));
      }

      assertCommunityAccessFromProfile({
        profile: { id: userSnapshot.id, uid, ...userSnapshot.data() },
        authToken: request.auth?.token || {},
        action: COMMUNITY_ACCESS_ACTIONS.ADMIN,
      });

      if (!reportSnapshot.exists) {
        throw new HttpsError('not-found', 'Die Meldung wurde nicht gefunden.', getCommunityErrorDetails('missing_report', { reportId }));
      }

      const report = reportSnapshot.data() || {};
      const targetUserId = normalizeOptionalString(report.reportedUserId);
      const roomId = normalizeOptionalString(report.roomId) || DEFAULT_COMMUNITY_ROOM_ID;
      const messageId = normalizeOptionalString(report.messageId);
      const messageRef = messageId ? firestore.collection('communityRooms').doc(roomId).collection('messages').doc(messageId) : null;
      const safetyStateRef = firestore.collection('communitySafetyStates').doc(targetUserId || 'missing');
      const logRef = firestore.collection('communityModerationLogs').doc();
      const [messageSnapshot, safetyStateSnapshot] = await Promise.all([
        messageRef ? transaction.get(messageRef) : Promise.resolve(null),
        targetUserId ? transaction.get(safetyStateRef) : Promise.resolve(null),
      ]);

      const baseReportPatch = {
        updatedAt: fieldValue.serverTimestamp(),
      };

      if (action === COMMUNITY_MODERATION_ACTIONS.START_REVIEW) {
        transaction.set(reportRef, {
          ...baseReportPatch,
          status: COMMUNITY_REPORT_STATUSES.REVIEWING,
          reviewingAt: fieldValue.serverTimestamp(),
          reviewingBy: uid,
        }, { merge: true });
        transaction.set(logRef, buildCommunityModerationLogRecord({
          moderatorId: uid,
          targetUserId,
          targetMessageId: messageId || null,
          reportId,
          action: COMMUNITY_MODERATION_LOG_ACTIONS.REPORT_REVIEW_STARTED,
          reason: reason || report.reason || '',
          fieldValue,
        }));

        return {
          ok: true,
          reportId,
          status: COMMUNITY_REPORT_STATUSES.REVIEWING,
        };
      }

      if (action === COMMUNITY_MODERATION_ACTIONS.CLOSE_REPORT) {
        transaction.set(reportRef, {
          ...baseReportPatch,
          status: COMMUNITY_REPORT_STATUSES.CLOSED,
          handledAt: fieldValue.serverTimestamp(),
          handledBy: uid,
          handledAction: COMMUNITY_MODERATION_LOG_ACTIONS.REPORT_CLOSED,
        }, { merge: true });
        transaction.set(logRef, buildCommunityModerationLogRecord({
          moderatorId: uid,
          targetUserId,
          targetMessageId: messageId || null,
          reportId,
          action: COMMUNITY_MODERATION_LOG_ACTIONS.REPORT_CLOSED,
          reason: reason || report.reason || '',
          fieldValue,
        }));

        return {
          ok: true,
          reportId,
          status: COMMUNITY_REPORT_STATUSES.CLOSED,
        };
      }

      if (action === COMMUNITY_MODERATION_ACTIONS.REMOVE_MESSAGE) {
        if (!messageSnapshot?.exists || !messageRef) {
          throw new HttpsError('failed-precondition', 'Für diese Meldung ist keine gültige Nachricht vorhanden.', getCommunityErrorDetails('missing_report_message_for_action', { reportId }));
        }

        transaction.set(messageRef, {
          moderationStatus: COMMUNITY_MESSAGE_MODERATION_STATUSES.REMOVED,
          deletedAt: fieldValue.serverTimestamp(),
          text: '',
          updatedAt: fieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.set(reportRef, {
          ...baseReportPatch,
          status: COMMUNITY_REPORT_STATUSES.ACTION_TAKEN,
          handledAt: fieldValue.serverTimestamp(),
          handledBy: uid,
          handledAction: COMMUNITY_MODERATION_LOG_ACTIONS.MESSAGE_REMOVED,
        }, { merge: true });
        transaction.set(logRef, buildCommunityModerationLogRecord({
          moderatorId: uid,
          targetUserId,
          targetMessageId: messageId,
          reportId,
          action: COMMUNITY_MODERATION_LOG_ACTIONS.MESSAGE_REMOVED,
          reason: reason || report.reason || '',
          fieldValue,
        }));

        return {
          ok: true,
          reportId,
          status: COMMUNITY_REPORT_STATUSES.ACTION_TAKEN,
        };
      }

      if (!targetUserId) {
        throw new HttpsError('failed-precondition', 'Für diese Meldung ist kein Zielnutzer vorhanden.', getCommunityErrorDetails('missing_report_target_user', { reportId }));
      }

      if (action === COMMUNITY_MODERATION_ACTIONS.WARN_USER) {
        const warningCount = Number(safetyStateSnapshot?.data()?.warningCount || 0) + 1;

        transaction.set(safetyStateRef, buildCommunitySafetyStatePatch({
          uid: targetUserId,
          warningCount,
          warningReason: reason || report.reason || '',
          fieldValue,
        }), { merge: true });
        transaction.set(reportRef, {
          ...baseReportPatch,
          status: COMMUNITY_REPORT_STATUSES.ACTION_TAKEN,
          handledAt: fieldValue.serverTimestamp(),
          handledBy: uid,
          handledAction: COMMUNITY_MODERATION_LOG_ACTIONS.USER_WARNED,
        }, { merge: true });
        transaction.set(logRef, buildCommunityModerationLogRecord({
          moderatorId: uid,
          targetUserId,
          targetMessageId: messageId || null,
          reportId,
          action: COMMUNITY_MODERATION_LOG_ACTIONS.USER_WARNED,
          reason: reason || report.reason || '',
          fieldValue,
        }));

        return {
          ok: true,
          reportId,
          status: COMMUNITY_REPORT_STATUSES.ACTION_TAKEN,
        };
      }

      const logAction = action === COMMUNITY_MODERATION_ACTIONS.BAN_24H
        ? COMMUNITY_MODERATION_LOG_ACTIONS.USER_BANNED_24H
        : action === COMMUNITY_MODERATION_ACTIONS.BAN_7D
          ? COMMUNITY_MODERATION_LOG_ACTIONS.USER_BANNED_7D
          : COMMUNITY_MODERATION_LOG_ACTIONS.USER_BANNED_PERMANENT;

      transaction.set(safetyStateRef, buildCommunitySafetyStatePatch({
        uid: targetUserId,
        chatBan: buildCommunityBanRecord({
          action,
          moderatorId: uid,
          reason: reason || report.reason || '',
          nowMs,
        }),
        fieldValue,
      }), { merge: true });
      transaction.set(reportRef, {
        ...baseReportPatch,
        status: COMMUNITY_REPORT_STATUSES.ACTION_TAKEN,
        handledAt: fieldValue.serverTimestamp(),
        handledBy: uid,
        handledAction: logAction,
      }, { merge: true });
      transaction.set(logRef, buildCommunityModerationLogRecord({
        moderatorId: uid,
        targetUserId,
        targetMessageId: messageId || null,
        reportId,
        action: logAction,
        reason: reason || report.reason || '',
        fieldValue,
      }));

      return {
        ok: true,
        reportId,
        status: COMMUNITY_REPORT_STATUSES.ACTION_TAKEN,
      };
    });
  };
};

const createSeedCommunityRoomsHandler = ({ firestore, fieldValue }) => {
  return async (request) => {
    const uid = request.auth?.uid;

    if (!uid) {
      throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
    }

    const profile = await assertCommunityAccess({
      firestore,
      uid,
      authToken: request.auth?.token || {},
      action: COMMUNITY_ACCESS_ACTIONS.ADMIN,
    });
    const createdBy = normalizeOptionalString(profile.nickname) || uid;
    const createdRoomIds = [];
    const skippedRoomIds = [];

    for (const room of DEFAULT_COMMUNITY_ROOMS) {
      const roomRef = firestore.collection('communityRooms').doc(room.id);
      const roomSnapshot = await roomRef.get();

      if (roomSnapshot.exists) {
        const existingRoom = roomSnapshot.data() || {};
        const repairPatch = {};

        if (typeof existingRoom.name !== 'string' || !existingRoom.name.trim()) {
          repairPatch.name = room.name;
        }

        if (typeof existingRoom.slug !== 'string' || !existingRoom.slug.trim()) {
          repairPatch.slug = room.slug;
        }

        if (typeof existingRoom.description !== 'string' || !existingRoom.description.trim()) {
          repairPatch.description = room.description;
        }

        if (typeof existingRoom.type !== 'string' || !existingRoom.type.trim()) {
          repairPatch.type = room.type;
        }

        if (existingRoom.region === undefined) {
          repairPatch.region = room.region;
        }

        if (typeof existingRoom.active !== 'boolean') {
          repairPatch.active = room.active === true;
        }

        if (typeof existingRoom.manualActive !== 'boolean') {
          repairPatch.manualActive = room.active === true;
        }

        if (!Number.isFinite(Number(existingRoom.messageCount))) {
          repairPatch.messageCount = 0;
        }

        if (Object.keys(repairPatch).length) {
          repairPatch.updatedAt = fieldValue.serverTimestamp();
          await roomRef.set(repairPatch, { merge: true });
          createdRoomIds.push(room.id);
        } else {
          skippedRoomIds.push(room.id);
        }

        continue;
      }

      await roomRef.set({
        ...room,
        manualActive: room.active === true,
        createdBy,
        createdAt: fieldValue.serverTimestamp(),
        updatedAt: fieldValue.serverTimestamp(),
        lastMessageAt: null,
        messageCount: 0,
      }, { merge: true });
      createdRoomIds.push(room.id);
    }

    return {
      ok: true,
      created: createdRoomIds.length > 0,
      createdRoomIds,
      skippedRoomIds,
    };
  };
};

const createMarkCommunityRoomReadHandler = ({ firestore, fieldValue }) => {
  return async (request) => {
    const uid = request.auth?.uid;

    if (!uid) {
      throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
    }

    const roomId = sanitizeCommunityRoomId(request.data?.roomId);
    const lastReadMessageId = sanitizeOptionalDocumentId(request.data?.lastReadMessageId, 'lastReadMessageId');
    const userRef = firestore.collection('users').doc(uid);
    const roomRef = firestore.collection('communityRooms').doc(roomId);
    const readRef = firestore.collection('communityRoomReads').doc(buildCommunityRoomReadDocumentId({ uid, roomId }));
    const acceptanceRef = getCommunityRulesAcceptanceRef(firestore, uid);

    return firestore.runTransaction(async (transaction) => {
      const [userSnapshot, roomSnapshot, acceptanceSnapshot] = await Promise.all([
        transaction.get(userRef),
        transaction.get(roomRef),
        transaction.get(acceptanceRef),
      ]);

      if (!userSnapshot.exists) {
        throw new HttpsError('permission-denied', 'Community-Zugriff nicht erlaubt.', getCommunityErrorDetails('missing_profile', {
          action: COMMUNITY_ACCESS_ACTIONS.READ,
        }));
      }

      assertCommunityAccessFromProfile({
        profile: { id: userSnapshot.id, uid, ...userSnapshot.data() },
        authToken: request.auth?.token || {},
        action: COMMUNITY_ACCESS_ACTIONS.READ,
      });

      const { config: currentRulesConfig } = await ensureCurrentCommunityRulesConfigInTransaction({
        firestore,
        transaction,
        fieldValue,
      });

      assertCommunityRulesAcceptedSnapshot({
        uid,
        currentRulesConfig,
        acceptanceSnapshot,
      });

      if (!roomSnapshot.exists) {
        throw new HttpsError('failed-precondition', 'Der Community-Raum ist derzeit nicht aktiv.', getCommunityErrorDetails('room_inactive', { roomId }));
      }

      const effectiveRoom = await syncEventRoomStateInTransaction({
        firestore,
        transaction,
        roomRef,
        roomSnapshot,
        fieldValue,
      });

      if (effectiveRoom?.active !== true) {
        throw new HttpsError('failed-precondition', 'Der Community-Raum ist derzeit nicht aktiv.', getCommunityErrorDetails('room_inactive', { roomId }));
      }

      transaction.set(readRef, buildCommunityRoomReadRecord({
        uid,
        roomId,
        lastReadMessageId,
        lastReadMessageCount: Number(effectiveRoom?.messageCount) || 0,
        fieldValue,
      }), { merge: true });

      return {
        ok: true,
        roomId,
      };
    });
  };
};

const createTouchCommunityPresenceHandler = ({ firestore, fieldValue, now = () => Date.now() }) => {
  return async (request) => {
    const uid = request.auth?.uid;

    if (!uid) {
      throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
    }

    const requestedRoomId = sanitizeOptionalDocumentId(request.data?.roomId, 'roomId');
    const userRef = firestore.collection('users').doc(uid);
    const presenceRef = getCommunityPresenceRef(firestore, uid);
    const nowMs = now();

    return firestore.runTransaction(async (transaction) => {
      const roomRef = requestedRoomId ? firestore.collection('communityRooms').doc(requestedRoomId) : null;
      const [userSnapshot, presenceSnapshot, roomSnapshot] = await Promise.all([
        transaction.get(userRef),
        transaction.get(presenceRef),
        roomRef ? transaction.get(roomRef) : Promise.resolve(null),
      ]);

      if (!userSnapshot.exists) {
        throw new HttpsError('permission-denied', 'Community-Zugriff nicht erlaubt.', getCommunityErrorDetails('missing_profile', {
          action: COMMUNITY_ACCESS_ACTIONS.READ,
        }));
      }

      const profile = assertCommunityAccessFromProfile({
        profile: { id: userSnapshot.id, uid, ...userSnapshot.data() },
        authToken: request.auth?.token || {},
        action: COMMUNITY_ACCESS_ACTIONS.READ,
      });

      const acceptanceRef = getCommunityRulesAcceptanceRef(firestore, uid);
      const acceptanceSnapshot = await transaction.get(acceptanceRef);
      const { config: currentRulesConfig } = await ensureCurrentCommunityRulesConfigInTransaction({
        firestore,
        transaction,
        fieldValue,
      });

      assertCommunityRulesAcceptedSnapshot({
        uid,
        currentRulesConfig,
        acceptanceSnapshot,
      });

      let nextRoomId = null;

      if (requestedRoomId) {
        if (!roomSnapshot?.exists) {
          throw new HttpsError('failed-precondition', 'Der Community-Raum ist derzeit nicht aktiv.', getCommunityErrorDetails('room_inactive', { roomId: requestedRoomId }));
        }

        const effectiveRoom = await syncEventRoomStateInTransaction({
          firestore,
          transaction,
          roomRef,
          roomSnapshot,
          fieldValue,
          nowMs,
        });

        if (effectiveRoom?.active !== true) {
          throw new HttpsError('failed-precondition', 'Der Community-Raum ist derzeit nicht aktiv.', getCommunityErrorDetails('room_inactive', { roomId: requestedRoomId }));
        }

        nextRoomId = requestedRoomId;
      }

      const existingPresence = presenceSnapshot.exists ? presenceSnapshot.data() : {};
      const showActivityStatus = getEffectiveCommunityPresenceVisibility(profile);

      if (!shouldThrottleCommunityPresenceWrite({
        previousPresence: existingPresence,
        nextRoomId,
        showActivityStatus,
        nowMs,
      })) {
        transaction.set(presenceRef, buildCommunityPresenceRecord({
          uid,
          currentRoomId: nextRoomId,
          showActivityStatus,
          fieldValue,
        }), { merge: true });
      }

      return {
        ok: true,
        roomId: nextRoomId,
        throttled: shouldThrottleCommunityPresenceWrite({
          previousPresence: existingPresence,
          nextRoomId,
          showActivityStatus,
          nowMs,
        }),
      };
    });
  };
};

const createGetCommunityPresenceSummaryHandler = ({ firestore, now = () => Date.now() }) => {
  return async (request) => {
    const uid = request.auth?.uid;

    if (!uid) {
      throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
    }

    await assertCommunityAccess({
      firestore,
      uid,
      authToken: request.auth?.token || {},
      action: COMMUNITY_ACCESS_ACTIONS.READ,
    });

    const [presenceSnapshot, activeRoomsSnapshot] = await Promise.all([
      firestore.collection('communityPresence').get(),
      firestore.collection('communityRooms').where('active', '==', true).get(),
    ]);
    const activeRoomIds = new Set(activeRoomsSnapshot.docs.map((docSnapshot) => docSnapshot.id));

    return {
      ok: true,
      summary: buildCommunityPresenceSummary({
        presenceEntries: presenceSnapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() })),
        activeRoomIds,
        nowMs: now(),
      }),
    };
  };
};

const createUpsertCommunityRoomHandler = ({ firestore, fieldValue }) => {
  return async (request) => {
    const uid = request.auth?.uid;

    if (!uid) {
      throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
    }

    const roomId = sanitizeOptionalDocumentId(request.data?.roomId, 'roomId');
    const name = sanitizeCommunityRoomName(request.data?.name);
    const slug = sanitizeCommunityRoomSlug(request.data?.slug);
    const description = sanitizeCommunityRoomDescription(request.data?.description);
    const type = sanitizeCommunityRoomType(request.data?.type);

    if (type === COMMUNITY_ROOM_TYPES.EVENT) {
      throw new HttpsError('invalid-argument', 'Event-Community-Räume müssen über die Event-Admin-Funktion erstellt werden.', getCommunityErrorDetails('event_room_requires_event_function'));
    }

    const region = sanitizeCommunityRoomRegion(request.data?.region, type);
    const active = request.data?.active !== false;
    const userRef = firestore.collection('users').doc(uid);
    const targetRoomId = roomId || slug;
    const roomRef = firestore.collection('communityRooms').doc(targetRoomId);

    return firestore.runTransaction(async (transaction) => {
      const [userSnapshot, roomSnapshot] = await Promise.all([
        transaction.get(userRef),
        transaction.get(roomRef),
      ]);

      if (!userSnapshot.exists) {
        throw new HttpsError('permission-denied', 'Community-Zugriff nicht erlaubt.', getCommunityErrorDetails('missing_profile', {
          action: COMMUNITY_ACCESS_ACTIONS.ADMIN,
        }));
      }

      const adminProfile = assertCommunityAccessFromProfile({
        profile: { id: userSnapshot.id, uid, ...userSnapshot.data() },
        authToken: request.auth?.token || {},
        action: COMMUNITY_ACCESS_ACTIONS.ADMIN,
      });

      const slugConflictSnapshot = await firestore.collection('communityRooms').where('slug', '==', slug).get();
      const conflictingDoc = slugConflictSnapshot.docs.find((docSnapshot) => docSnapshot.id !== targetRoomId);

      if (conflictingDoc) {
        throw new HttpsError('already-exists', 'Dieser Raum-Slug ist bereits vergeben.', getCommunityErrorDetails('duplicate_room_slug', { slug }));
      }

      const createdBy = normalizeOptionalString(adminProfile.nickname) || uid;

      if (!roomSnapshot.exists) {
        transaction.set(roomRef, buildCommunityRoomRecord({
          roomId: targetRoomId,
          name,
          slug,
          description,
          type,
          region,
          active,
          manualActive: active,
          createdBy,
          fieldValue,
        }));

        return {
          ok: true,
          roomId: targetRoomId,
          created: true,
        };
      }

      transaction.set(roomRef, buildCommunityRoomUpdatePatch({
        name,
        slug,
        description,
        type,
        region,
        active,
        manualActive: active,
        fieldValue,
      }), { merge: true });

      return {
        ok: true,
        roomId: targetRoomId,
        created: false,
      };
    });
  };
};

const createEventCommunityRoomHandler = ({ firestore, fieldValue, now = () => Date.now() }) => {
  return async (request) => {
    const uid = request.auth?.uid;

    if (!uid) {
      throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
    }

    const eventId = requireDocumentId(request.data?.eventId, 'eventId');
    const userRef = firestore.collection('users').doc(uid);
    const eventRef = firestore.collection('events').doc(eventId);

    return firestore.runTransaction(async (transaction) => {
      const [userSnapshot, eventSnapshot] = await Promise.all([
        transaction.get(userRef),
        transaction.get(eventRef),
      ]);

      if (!userSnapshot.exists) {
        throw new HttpsError('permission-denied', 'Community-Zugriff nicht erlaubt.', getCommunityErrorDetails('missing_profile', {
          action: COMMUNITY_ACCESS_ACTIONS.ADMIN,
        }));
      }

      const adminProfile = assertCommunityAccessFromProfile({
        profile: { id: userSnapshot.id, uid, ...userSnapshot.data() },
        authToken: request.auth?.token || {},
        action: COMMUNITY_ACCESS_ACTIONS.ADMIN,
      });

      if (!eventSnapshot.exists) {
        throw new HttpsError('not-found', 'Das Event wurde nicht gefunden.', getCommunityErrorDetails('event_not_found', { eventId }));
      }

      const metadata = buildEventRoomMetadataFromEvent({
        eventId,
        event: eventSnapshot.data(),
        manualActive: true,
        nowMs: now(),
      });
      const roomRef = firestore.collection('communityRooms').doc(buildEventCommunityRoomId(eventId));
      const roomSnapshot = await transaction.get(roomRef);
      const createdBy = normalizeOptionalString(adminProfile.nickname) || uid;

      if (!roomSnapshot.exists) {
        transaction.set(roomRef, buildCommunityRoomRecord({
          roomId: roomRef.id,
          name: metadata.name,
          slug: metadata.slug,
          description: metadata.description,
          type: metadata.type,
          region: metadata.region,
          active: metadata.active,
          manualActive: metadata.manualActive,
          eventId,
          eventMetadata: metadata,
          createdBy,
          fieldValue,
        }));

        return {
          ok: true,
          roomId: roomRef.id,
          eventId,
          active: metadata.active,
          created: true,
        };
      }

      const existingRoom = { id: roomSnapshot.id, ...roomSnapshot.data() };

      if (normalizeOptionalString(existingRoom.eventId) && normalizeOptionalString(existingRoom.eventId) !== eventId) {
        throw new HttpsError('already-exists', 'Für diese Event-ID existiert bereits ein anderer Community-Raum.', getCommunityErrorDetails('duplicate_event_room', { eventId }));
      }

      transaction.set(roomRef, buildCommunityRoomUpdatePatch({
        name: metadata.name,
        slug: metadata.slug,
        description: metadata.description,
        type: metadata.type,
        region: metadata.region,
        active: existingRoom.manualActive === false ? false : metadata.active,
        manualActive: existingRoom.manualActive !== false,
        eventId,
        eventMetadata: metadata,
        fieldValue,
      }), { merge: true });

      return {
        ok: true,
        roomId: roomRef.id,
        eventId,
        active: existingRoom.manualActive === false ? false : metadata.active,
        created: false,
      };
    });
  };
};

const createSyncEventCommunityRoomsHandler = ({ firestore, fieldValue, now = () => Date.now() }) => {
  return async (request) => {
    const uid = request.auth?.uid;

    if (!uid) {
      throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
    }

    await assertCommunityAccess({
      firestore,
      uid,
      authToken: request.auth?.token || {},
      action: COMMUNITY_ACCESS_ACTIONS.READ,
    });

    const requestedRoomId = sanitizeOptionalDocumentId(request.data?.roomId, 'roomId');
    const requestedEventId = sanitizeOptionalDocumentId(request.data?.eventId, 'eventId');
    const roomSnapshots = requestedRoomId
      ? [await firestore.collection('communityRooms').doc(requestedRoomId).get()].filter((snapshot) => snapshot.exists)
      : (await firestore.collection('communityRooms').where('type', '==', COMMUNITY_ROOM_TYPES.EVENT).get()).docs;
    const targetSnapshots = requestedEventId
      ? roomSnapshots.filter((snapshot) => normalizeOptionalString(snapshot.data()?.eventId) === requestedEventId)
      : roomSnapshots;
    const synchronizedRooms = [];

    for (const roomSnapshot of targetSnapshots) {
      const roomRef = firestore.collection('communityRooms').doc(roomSnapshot.id);
      const roomData = await firestore.runTransaction(async (transaction) => {
        const freshRoomSnapshot = await transaction.get(roomRef);
        return syncEventRoomStateInTransaction({
          firestore,
          transaction,
          roomRef,
          roomSnapshot: freshRoomSnapshot,
          fieldValue,
          nowMs: now(),
        });
      });

      if (roomData) {
        synchronizedRooms.push({
          roomId: roomSnapshot.id,
          eventId: roomData.eventId || null,
          active: roomData.active === true,
        });
      }
    }

    return {
      ok: true,
      rooms: synchronizedRooms,
    };
  };
};

const createSetCommunityRoomActiveHandler = ({ firestore, fieldValue }) => {
  return async (request) => {
    const uid = request.auth?.uid;

    if (!uid) {
      throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
    }

    const roomId = sanitizeCommunityRoomId(request.data?.roomId);
    const active = request.data?.active === true;
    const userRef = firestore.collection('users').doc(uid);
    const roomRef = firestore.collection('communityRooms').doc(roomId);

    return firestore.runTransaction(async (transaction) => {
      const [userSnapshot, roomSnapshot] = await Promise.all([
        transaction.get(userRef),
        transaction.get(roomRef),
      ]);

      if (!userSnapshot.exists) {
        throw new HttpsError('permission-denied', 'Community-Zugriff nicht erlaubt.', getCommunityErrorDetails('missing_profile', {
          action: COMMUNITY_ACCESS_ACTIONS.ADMIN,
        }));
      }

      assertCommunityAccessFromProfile({
        profile: { id: userSnapshot.id, uid, ...userSnapshot.data() },
        authToken: request.auth?.token || {},
        action: COMMUNITY_ACCESS_ACTIONS.ADMIN,
      });

      if (!roomSnapshot.exists) {
        throw new HttpsError('not-found', 'Der Community-Raum wurde nicht gefunden.', getCommunityErrorDetails('room_not_found', { roomId }));
      }

      const room = { id: roomSnapshot.id, ...roomSnapshot.data() };

      if (room.type === COMMUNITY_ROOM_TYPES.EVENT && normalizeOptionalString(room.eventId)) {
        const eventRef = firestore.collection('events').doc(room.eventId);
        const eventSnapshot = await transaction.get(eventRef);

        if (!eventSnapshot.exists) {
          transaction.set(roomRef, {
            manualActive: false,
            active: false,
            updatedAt: fieldValue.serverTimestamp(),
          }, { merge: true });

          return {
            ok: true,
            roomId,
            active: false,
          };
        }

        const metadata = buildEventRoomMetadataFromEvent({
          eventId: room.eventId,
          event: eventSnapshot.data(),
          manualActive: active,
        });

        transaction.set(roomRef, buildCommunityRoomUpdatePatch({
          name: metadata.name,
          slug: metadata.slug,
          description: metadata.description,
          type: metadata.type,
          region: metadata.region,
          active: metadata.active,
          manualActive: active,
          eventId: room.eventId,
          eventMetadata: metadata,
          fieldValue,
        }), { merge: true });

        return {
          ok: true,
          roomId,
          active: metadata.active,
        };
      }

      transaction.set(roomRef, {
        manualActive: active,
        active,
        updatedAt: fieldValue.serverTimestamp(),
      }, { merge: true });

      return {
        ok: true,
        roomId,
        active,
      };
    });
  };
};

const createGetCommunityRulesHandler = ({ firestore, fieldValue }) => {
  return async (request) => {
    const uid = request.auth?.uid;

    if (!uid) {
      throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
    }

    const userRef = firestore.collection('users').doc(uid);
    const acceptanceRef = getCommunityRulesAcceptanceRef(firestore, uid);

    return firestore.runTransaction(async (transaction) => {
      const [userSnapshot, acceptanceSnapshot] = await Promise.all([
        transaction.get(userRef),
        transaction.get(acceptanceRef),
      ]);

      if (!userSnapshot.exists) {
        throw new HttpsError('permission-denied', 'Community-Zugriff nicht erlaubt.', getCommunityErrorDetails('missing_profile', {
          action: COMMUNITY_ACCESS_ACTIONS.READ,
        }));
      }

      assertCommunityAccessFromProfile({
        profile: { id: userSnapshot.id, uid, ...userSnapshot.data() },
        authToken: request.auth?.token || {},
        action: COMMUNITY_ACCESS_ACTIONS.READ,
      });

      const { config } = await ensureCurrentCommunityRulesConfigInTransaction({
        firestore,
        transaction,
        fieldValue,
      });

      return {
        rules: config,
        acceptance: acceptanceSnapshot.exists ? acceptanceSnapshot.data() : null,
      };
    });
  };
};

const createAcceptCommunityRulesHandler = ({ firestore, fieldValue }) => {
  return async (request) => {
    const uid = request.auth?.uid;

    if (!uid) {
      throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
    }

    const requestedVersion = validateCommunityRulesVersion(request.data?.rulesVersion);
    const userRef = firestore.collection('users').doc(uid);
    const acceptanceRef = getCommunityRulesAcceptanceRef(firestore, uid);

    return firestore.runTransaction(async (transaction) => {
      const [userSnapshot, acceptanceSnapshot] = await Promise.all([
        transaction.get(userRef),
        transaction.get(acceptanceRef),
      ]);

      if (!userSnapshot.exists) {
        throw new HttpsError('permission-denied', 'Community-Zugriff nicht erlaubt.', getCommunityErrorDetails('missing_profile', {
          action: COMMUNITY_ACCESS_ACTIONS.READ,
        }));
      }

      assertCommunityAccessFromProfile({
        profile: { id: userSnapshot.id, uid, ...userSnapshot.data() },
        authToken: request.auth?.token || {},
        action: COMMUNITY_ACCESS_ACTIONS.READ,
      });

      const { config } = await ensureCurrentCommunityRulesConfigInTransaction({
        firestore,
        transaction,
        fieldValue,
      });

      if (requestedVersion !== config.version) {
        throw new HttpsError('failed-precondition', 'Es können nur die aktuell gültigen Community-Regeln akzeptiert werden.', getCommunityRulesErrorDetails('outdated_rules_version', {
          requestedVersion,
          currentVersion: config.version,
        }));
      }

      const currentAcceptedVersion = normalizeOptionalString(acceptanceSnapshot.exists ? acceptanceSnapshot.data()?.latestAcceptedVersion : '');

      if (currentAcceptedVersion === config.version) {
        return {
          ok: true,
          rulesVersion: config.version,
          acceptedVersion: config.version,
          accepted: true,
          alreadyAccepted: true,
        };
      }

      transaction.set(acceptanceRef, buildCommunityRulesAcceptanceRecord({
        uid,
        version: config.version,
        existingHistory: acceptanceSnapshot.exists ? acceptanceSnapshot.data()?.acceptedVersions : [],
        fieldValue,
      }), { merge: true });

      return {
        ok: true,
        rulesVersion: config.version,
        acceptedVersion: config.version,
        accepted: true,
        alreadyAccepted: false,
      };
    });
  };
};

const createPublishCommunityRulesHandler = ({ firestore, fieldValue }) => {
  return async (request) => {
    const uid = request.auth?.uid;

    if (!uid) {
      throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
    }

    const requestedVersion = validateCommunityRulesVersion(request.data?.version);
    const userRef = firestore.collection('users').doc(uid);
    const configRef = getCommunityRulesConfigRef(firestore);
    const versionRef = getCommunityRulesVersionRef(firestore, requestedVersion);
    const logRef = firestore.collection('communityModerationLogs').doc();

    return firestore.runTransaction(async (transaction) => {
      const [userSnapshot, configSnapshot, versionSnapshot] = await Promise.all([
        transaction.get(userRef),
        transaction.get(configRef),
        transaction.get(versionRef),
      ]);

      if (!userSnapshot.exists) {
        throw new HttpsError('permission-denied', 'Community-Zugriff nicht erlaubt.', getCommunityErrorDetails('missing_profile', {
          action: COMMUNITY_ACCESS_ACTIONS.ADMIN,
        }));
      }

      const adminProfile = assertCommunityAccessFromProfile({
        profile: { id: userSnapshot.id, uid, ...userSnapshot.data() },
        authToken: request.auth?.token || {},
        action: COMMUNITY_ACCESS_ACTIONS.ADMIN,
      });

      const currentRulesConfig = configSnapshot.exists
        ? normalizeCommunityRulesConfig(configSnapshot.data())
        : normalizeCommunityRulesConfig(buildDefaultCommunityRulesConfig());
      const title = sanitizeCommunityRulesTitle(request.data?.title || currentRulesConfig.title || DEFAULT_COMMUNITY_RULES_TITLE);
      const sections = sanitizeCommunityRulesSections(request.data?.sections || currentRulesConfig.sections || cloneRulesSections());

      if (versionSnapshot.exists || currentRulesConfig.version === requestedVersion) {
        throw new HttpsError('already-exists', 'Diese Regelversion existiert bereits.', getCommunityRulesErrorDetails('duplicate_rules_version', { version: requestedVersion }));
      }

      transaction.set(versionRef, buildCommunityRulesVersionRecord({
        version: requestedVersion,
        title,
        sections,
        createdBy: normalizeOptionalString(adminProfile.nickname) || uid,
        fieldValue,
      }));
      transaction.set(configRef, buildCommunityRulesConfigRecord({
        version: requestedVersion,
        title,
        sections,
        fieldValue,
      }), { merge: true });
      transaction.set(logRef, buildCommunityModerationLogRecord({
        moderatorId: uid,
        targetUserId: null,
        action: COMMUNITY_MODERATION_LOG_ACTIONS.COMMUNITY_RULES_PUBLISHED,
        reason: `Community-Regeln ${requestedVersion} veröffentlicht`,
        fieldValue,
      }));

      return {
        ok: true,
        version: requestedVersion,
      };
    });
  };
};

module.exports = {
  ALLOWED_AGE_VERIFICATION_STATUSES,
  COMMUNITY_ACCESS_ACTIONS,
  COMMUNITY_BLOCK_REASON_MAX_LENGTH,
  COMMUNITY_MESSAGE_MAX_LENGTH,
  COMMUNITY_MESSAGE_MODERATION_STATUSES,
  COMMUNITY_MODERATION_ACTIONS,
  COMMUNITY_MODERATION_LOG_ACTIONS,
  COMMUNITY_ROOM_PREVIEW_MAX_LENGTH,
  COMMUNITY_REACTION_TYPES,
  COMMUNITY_MENTION_MAX_COUNT,
  COMMUNITY_REPORT_COMMENT_MAX_LENGTH,
  COMMUNITY_REPORT_PRIORITIES,
  COMMUNITY_REPORT_RATE_LIMIT_MAX_REPORTS,
  COMMUNITY_REPORT_RATE_LIMIT_WINDOW_MS,
  COMMUNITY_REPORT_REASONS,
  COMMUNITY_REPORT_STATUSES,
  COMMUNITY_RATE_LIMIT_ERROR_MESSAGE,
  COMMUNITY_RATE_LIMIT_MAX_MESSAGES,
  COMMUNITY_RATE_LIMIT_WINDOW_MS,
  COMMUNITY_ROOM_TYPES,
  DEFAULT_COMMUNITY_RULES_VERSION,
  DEFAULT_COMMUNITY_ROOMS,
  DEFAULT_COMMUNITY_ROOM,
  DEFAULT_COMMUNITY_ROOM_ID,
  DEFAULT_COMMUNITY_ROOM_SLUG,
  ALLOWED_COMMUNITY_REACTION_TYPES,
  ALLOWED_COMMUNITY_ROOM_TYPES,
  assertCommunityAccess,
  assertCommunityAccessFromProfile,
  assertVisibleCommunityMessage,
  buildCommunityMessageRecord,
  buildCommunityMessageReportDocumentId,
  buildCommunityBlockDocumentId,
  buildCommunityBlockRecord,
  buildCommunityBanRecord,
  buildCommunityReactionRecord,
  buildCommunityReportPriority,
  buildCommunityReportRateLimitRecord,
  buildCommunityReportRecord,
  buildCommunityRoomReadDocumentId,
  buildCommunityRoomReadRecord,
  buildCommunityRoomRecord,
  buildCommunityRoomUpdatePatch,
  buildEventRoomMetadataFromEvent,
  buildCommunitySafetyStatePatch,
  buildSeedCommunityRoomRecord,
  buildNormalizedMentions,
  buildMentionPlans,
  buildMentionSnapshotsByBlockState,
  checkCommunityRateLimit,
  checkCommunityReportRateLimit,
  createAcceptCommunityRulesHandler,
  createBlockCommunityUserHandler,
  createEventCommunityRoomHandler,
  createGetCommunityRulesHandler,
  createGetCommunityPresenceSummaryHandler,
  createMarkCommunityRoomReadHandler,
  createModerateCommunityReportHandler,
  createPublishCommunityRulesHandler,
  createReportCommunityContentHandler,
  createSeedCommunityRoomsHandler,
  createSendCommunityMessageHandler,
  createSetCommunityRoomActiveHandler,
  createSyncEventCommunityRoomsHandler,
  createToggleCommunityReactionHandler,
  createTouchCommunityPresenceHandler,
  createUnblockCommunityUserHandler,
  createUpsertCommunityRoomHandler,
  extractRecentMessageTimestamps,
  extractRecentActivityTimestamps,
  getActiveCommunityChatBan,
  getCommunityRoomLastActivityMillis,
  hasPendingDeletion,
  hasVerifiedAge,
  hasVerifiedEmail,
  isCriticalCommunityReportReason,
  isModerationRestricted,
  isVisibleCommunityMessage,
  normalizeCommunityChatBan,
  normalizeCommunityText,
  normalizeCommunityMessageMentions,
  normalizeReactionCounts,
  normalizeTextList,
  parseTimestampToMillis,
  resolveEventEndMillis,
  resolveEventStartMillis,
  requireDocumentId,
  sanitizeCommunityRoomDescription,
  sanitizeCommunityRoomName,
  sanitizeCommunityRoomRegion,
  sanitizeCommunityRoomSlug,
  sanitizeCommunityRoomType,
  sanitizeCommunityBlockReason,
  sanitizeCommunityReportComment,
  validateCommunityModerationAction,
  validateCommunityReportReason,
  validateReactionType,
  validateCommunityMessage,
  validateReplyTarget,
};
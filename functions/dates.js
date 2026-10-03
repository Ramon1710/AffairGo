const { HttpsError } = require('firebase-functions/v2/https');
const { resolveDateLocation } = require('./dateLocation');

const DATE_COLLECTION = 'dates';
const DATE_INTERESTS_SUBCOLLECTION = 'interests';
const DATE_STATUS = Object.freeze({
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  DISABLED: 'disabled',
});
const DATE_VISIBILITY = Object.freeze({
  COMMUNITY: 'community',
  PUBLIC: 'public',
});

const normalizeOptionalString = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeOptionalBoolean = (value, fallback = false) => (typeof value === 'boolean' ? value : fallback);
const normalizeOptionalNumber = (value, fallback = null) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};
const normalizeStringList = (value) => (Array.isArray(value)
  ? value.filter((entry) => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)
  : []);

const sanitizeLimitedText = (value, fieldName, { min = 1, max = 0, required = true } = {}) => {
  const normalizedValue = normalizeOptionalString(value);

  if (!normalizedValue) {
    if (required) {
      throw new HttpsError('invalid-argument', `${fieldName} ist erforderlich.`);
    }

    return '';
  }

  if (normalizedValue.length < min) {
    throw new HttpsError('invalid-argument', `${fieldName} ist zu kurz.`);
  }

  if (max > 0 && normalizedValue.length > max) {
    throw new HttpsError('invalid-argument', `${fieldName} ist zu lang.`);
  }

  return normalizedValue;
};

const parseScheduledAt = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value);
  }

  if (typeof value === 'string' && value.trim()) {
    return new Date(value);
  }

  if (value instanceof Date) {
    return value;
  }

  throw new HttpsError('invalid-argument', 'Datum und Uhrzeit sind erforderlich.');
};

const ensureFutureDate = (value, nowMs = Date.now()) => {
  const scheduledAt = parseScheduledAt(value);
  const scheduledAtMs = scheduledAt.getTime();

  if (!Number.isFinite(scheduledAtMs)) {
    throw new HttpsError('invalid-argument', 'Datum und Uhrzeit sind ungültig.');
  }

  if (scheduledAtMs <= nowMs) {
    throw new HttpsError('invalid-argument', 'Vergangene Dates können nicht gespeichert werden.');
  }

  return { scheduledAt, scheduledAtMs };
};

const isPrivilegedModerator = (profile = {}) => (
  profile?.isAdmin === true
  || normalizeOptionalString(profile?.role).toLowerCase() === 'admin'
  || normalizeOptionalString(profile?.role).toLowerCase() === 'moderator'
);

const isEligibleDateParticipantProfile = (profile = {}) => {
  const emailVerified = profile.emailVerified === true;
  const verificationStatus = normalizeOptionalString(profile.ageVerificationStatus).toLowerCase();
  const ageVerified = profile.ageVerified === true
    && (!verificationStatus || verificationStatus === 'verified' || verificationStatus === 'approved');
  const noPendingDeletion = !normalizeOptionalString(profile.accountDeletionRequestedAt);
  const moderationState = normalizeOptionalString(profile.moderationState).toLowerCase() || 'clear';
  const noRestriction = moderationState === 'clear' || moderationState === 'review';

  return emailVerified && ageVerified && noPendingDeletion && noRestriction;
};

const hasCommunityRulesAccepted = async ({ firestore, uid, currentRulesVersion }) => {
  if (!uid || !currentRulesVersion) {
    return false;
  }

  const acceptanceSnapshot = await firestore.collection('communityRuleAcceptances').doc(uid).get();

  if (!acceptanceSnapshot.exists) {
    return false;
  }

  const acceptance = acceptanceSnapshot.data() || {};
  return normalizeOptionalString(acceptance.latestAcceptedVersion) === currentRulesVersion;
};

const loadCurrentRulesVersion = async (firestore) => {
  const snapshot = await firestore.collection('communityConfig').doc('rules').get();
  if (!snapshot.exists) {
    return '';
  }

  return normalizeOptionalString(snapshot.data()?.version);
};

const loadUserProfile = async (firestore, uid) => {
  const snapshot = await firestore.collection('users').doc(uid).get();

  if (!snapshot.exists) {
    throw new HttpsError('failed-precondition', 'Für Dates ist ein Nutzerprofil erforderlich.');
  }

  return snapshot.data() || {};
};

const isMutuallyBlocked = (currentProfile = {}, targetProfile = {}, currentUid = '', targetUid = '') => {
  const currentDismissedIds = new Set(normalizeStringList(currentProfile.dismissedProfileIds));
  const targetDismissedIds = new Set(normalizeStringList(targetProfile.dismissedProfileIds));
  return currentDismissedIds.has(targetUid) || targetDismissedIds.has(currentUid);
};

const assertEligibleDateAuthor = async ({ firestore, uid }) => {
  const profile = await loadUserProfile(firestore, uid);
  const rulesVersion = await loadCurrentRulesVersion(firestore);
  const acceptedRules = await hasCommunityRulesAccepted({ firestore, uid, currentRulesVersion: rulesVersion });
  const emailVerified = profile.emailVerified === true;
  const verificationStatus = normalizeOptionalString(profile.ageVerificationStatus);
  const ageVerified = profile.ageVerified === true
    && (!verificationStatus || verificationStatus === 'verified' || verificationStatus === 'approved');
  const noPendingDeletion = !normalizeOptionalString(profile.accountDeletionRequestedAt);
  const moderationState = normalizeOptionalString(profile.moderationState) || 'clear';
  const noRestriction = moderationState === 'clear' || moderationState === 'review';

  if (!emailVerified) {
    throw new HttpsError('permission-denied', 'Für Dates muss deine E-Mail bestätigt sein.');
  }

  if (!ageVerified) {
    throw new HttpsError('permission-denied', 'Für Dates ist eine bestätigte Altersfreigabe erforderlich.');
  }

  if (!acceptedRules) {
    throw new HttpsError('permission-denied', 'Akzeptiere zuerst die Community-Regeln, bevor du Dates erstellst.');
  }

  if (!noPendingDeletion || !noRestriction) {
    throw new HttpsError('permission-denied', 'Dein Konto ist derzeit nicht für Dates freigeschaltet.');
  }

  return { profile, rulesVersion };
};

const sanitizeClientRequestId = (value) => {
  const normalizedValue = normalizeOptionalString(value);

  if (!normalizedValue) {
    return '';
  }

  if (!/^[a-zA-Z0-9_-]{6,80}$/.test(normalizedValue)) {
    throw new HttpsError('invalid-argument', 'Die Anfrage-ID des Dates ist ungültig.');
  }

  return normalizedValue;
};

const sanitizeDatePayload = (payload = {}, nowMs = Date.now()) => {
  const { scheduledAt, scheduledAtMs } = ensureFutureDate(payload.scheduledAt, nowMs);
  const visibility = normalizeOptionalString(payload.visibility).toLowerCase() || DATE_VISIBILITY.COMMUNITY;
  const resolvedLocation = resolveDateLocation({
    locationQuery: payload.locationQuery || payload.regionLabel,
    publicPlaceLabel: payload.publicPlaceLabel,
  });

  if (!Object.values(DATE_VISIBILITY).includes(visibility)) {
    throw new HttpsError('invalid-argument', 'Die Sichtbarkeit ist ungültig.');
  }

  return {
    title: sanitizeLimitedText(payload.title, 'Aktivität oder Wunsch', { min: 3, max: 120 }),
    description: sanitizeLimitedText(payload.description, 'Zusätzliche Beschreibung', { required: false, max: 1200 }),
    category: sanitizeLimitedText(payload.category, 'Kategorie', { required: false, max: 80 }),
    visibility,
    scheduledAt,
    scheduledAtMs,
    clientRequestId: sanitizeClientRequestId(payload.clientRequestId),
    durationMinutes: normalizeOptionalNumber(payload.durationMinutes, null),
    ...resolvedLocation,
  };
};

const buildCreatorProfileSummary = (profile = {}) => ({
  nickname: normalizeOptionalString(profile.nickname) || 'Night-Whisper Mitglied',
  age: Number(profile.age) || null,
  city: normalizeOptionalString(profile.city),
  profilePhotoUrl: normalizeOptionalString(profile.profilePhotoUrl),
  profileImageUri: normalizeOptionalString(profile.profileImageUri),
});

const buildDateRecord = ({
  dateId,
  payload,
  authorProfile,
  uid,
  rulesVersion,
  fieldValue,
  timestamp,
}) => ({
  id: dateId,
  creatorId: uid,
  creatorNickname: normalizeOptionalString(authorProfile.nickname) || 'Night-Whisper Mitglied',
  creatorProfileSummary: buildCreatorProfileSummary(authorProfile),
  title: payload.title,
  description: payload.description,
  category: payload.category,
  locationQuery: payload.locationQuery,
  publicPlaceLabel: payload.publicPlaceLabel,
  cityLabel: payload.cityLabel,
  regionLabel: payload.regionLabel,
  coordinate: payload.coordinate,
  geohash: payload.geohash,
  locationResolution: payload.locationResolution,
  visibility: payload.visibility,
  status: DATE_STATUS.ACTIVE,
  clientRequestId: payload.clientRequestId || '',
  durationMinutes: Number.isFinite(Number(payload.durationMinutes)) ? Number(payload.durationMinutes) : null,
  scheduledAt: timestamp.fromDate ? timestamp.fromDate(payload.scheduledAt) : payload.scheduledAt,
  scheduledAtMs: payload.scheduledAtMs,
  interestCount: 0,
  rulesVersion: rulesVersion || '',
  cancelledAt: null,
  disabledAt: null,
  createdAt: fieldValue.serverTimestamp(),
  updatedAt: fieldValue.serverTimestamp(),
});

const assertAuthenticated = (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
  }

  return uid;
};

const createCreateDateHandler = ({ firestore, fieldValue, timestamp }) => async (request) => {
  const uid = assertAuthenticated(request);
  const { profile, rulesVersion } = await assertEligibleDateAuthor({ firestore, uid });
  const sanitizedPayload = sanitizeDatePayload(request.data || {});
  const dateRef = sanitizedPayload.clientRequestId
    ? firestore.collection(DATE_COLLECTION).doc(`${uid}__${sanitizedPayload.clientRequestId}`)
    : firestore.collection(DATE_COLLECTION).doc();

  if (sanitizedPayload.clientRequestId) {
    const existingSnapshot = await dateRef.get();

    if (existingSnapshot.exists) {
      return { ok: true, duplicate: true, dateId: dateRef.id, date: existingSnapshot.data() };
    }
  }

  const dateRecord = buildDateRecord({
    dateId: dateRef.id,
    payload: sanitizedPayload,
    authorProfile: profile,
    uid,
    rulesVersion,
    fieldValue,
    timestamp,
  });

  await dateRef.set(dateRecord, { merge: false });
  return { ok: true, dateId: dateRef.id, date: dateRecord };
};

const createListDatesHandler = ({ firestore }) => async (request) => {
  const uid = assertAuthenticated(request);
  const { profile: viewerProfile } = await assertEligibleDateAuthor({ firestore, uid });
  const nowMs = Date.now();
  const snapshot = await firestore.collection(DATE_COLLECTION)
    .where('status', '==', DATE_STATUS.ACTIVE)
    .where('scheduledAt', '>', new Date(nowMs))
    .get();
  const entries = snapshot.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .sort((left, right) => Number(left.scheduledAtMs || 0) - Number(right.scheduledAtMs || 0));
  const creatorIds = [...new Set(entries.map((entry) => normalizeOptionalString(entry.creatorId)).filter(Boolean))];
  const creatorProfiles = new Map();

  await Promise.all(creatorIds.map(async (creatorId) => {
    try {
      creatorProfiles.set(creatorId, await loadUserProfile(firestore, creatorId));
    } catch {
      creatorProfiles.set(creatorId, null);
    }
  }));

  const dates = entries.filter((entry) => {
    const creatorId = normalizeOptionalString(entry.creatorId);
    const creatorProfile = creatorProfiles.get(creatorId);

    if (!creatorId || !creatorProfile) {
      return false;
    }

    if (!isEligibleDateParticipantProfile(creatorProfile)) {
      return false;
    }

    if (isMutuallyBlocked(viewerProfile, creatorProfile, uid, creatorId)) {
      return false;
    }

    return true;
  });

  return {
    ok: true,
    dates: dates.map((entry) => {
      const creatorProfile = creatorProfiles.get(normalizeOptionalString(entry.creatorId)) || null;
      return {
        ...entry,
        creatorProfileSummary: creatorProfile ? buildCreatorProfileSummary(creatorProfile) : (entry.creatorProfileSummary || null),
      };
    }),
  };
};

const createUpdateDateHandler = ({ firestore, fieldValue, timestamp }) => async (request) => {
  const uid = assertAuthenticated(request);
  const dateId = sanitizeLimitedText(request.data?.dateId, 'dateId', { max: 120 });
  const dateRef = firestore.collection(DATE_COLLECTION).doc(dateId);
  const snapshot = await dateRef.get();

  if (!snapshot.exists) {
    throw new HttpsError('not-found', 'Das Date wurde nicht gefunden.');
  }

  const existingDate = snapshot.data() || {};

  if (existingDate.creatorId !== uid) {
    throw new HttpsError('permission-denied', 'Nur der Ersteller darf dieses Date bearbeiten.');
  }

  if (existingDate.status !== DATE_STATUS.ACTIVE) {
    throw new HttpsError('failed-precondition', 'Dieses Date kann nicht mehr bearbeitet werden.');
  }

  await assertEligibleDateAuthor({ firestore, uid });
  const sanitizedPayload = sanitizeDatePayload({ ...existingDate, ...request.data });

  await dateRef.set({
    title: sanitizedPayload.title,
    description: sanitizedPayload.description,
    category: sanitizedPayload.category,
    locationQuery: sanitizedPayload.locationQuery,
    publicPlaceLabel: sanitizedPayload.publicPlaceLabel,
    cityLabel: sanitizedPayload.cityLabel,
    regionLabel: sanitizedPayload.regionLabel,
    coordinate: sanitizedPayload.coordinate,
    geohash: sanitizedPayload.geohash,
    locationResolution: sanitizedPayload.locationResolution,
    visibility: sanitizedPayload.visibility,
    durationMinutes: Number.isFinite(Number(sanitizedPayload.durationMinutes)) ? Number(sanitizedPayload.durationMinutes) : null,
    scheduledAt: timestamp.fromDate ? timestamp.fromDate(sanitizedPayload.scheduledAt) : sanitizedPayload.scheduledAt,
    scheduledAtMs: sanitizedPayload.scheduledAtMs,
    updatedAt: fieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true, dateId };
};

const createCancelDateHandler = ({ firestore, fieldValue }) => async (request) => {
  const uid = assertAuthenticated(request);
  const dateId = sanitizeLimitedText(request.data?.dateId, 'dateId', { max: 120 });
  const dateRef = firestore.collection(DATE_COLLECTION).doc(dateId);
  const snapshot = await dateRef.get();

  if (!snapshot.exists) {
    throw new HttpsError('not-found', 'Das Date wurde nicht gefunden.');
  }

  const existingDate = snapshot.data() || {};

  if (existingDate.creatorId !== uid) {
    throw new HttpsError('permission-denied', 'Nur der Ersteller darf dieses Date absagen.');
  }

  await dateRef.set({
    status: DATE_STATUS.CANCELLED,
    cancelledAt: fieldValue.serverTimestamp(),
    updatedAt: fieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true, dateId, status: DATE_STATUS.CANCELLED };
};

const createToggleDateInterestHandler = ({ firestore, fieldValue }) => async (request) => {
  const uid = assertAuthenticated(request);
  const dateId = sanitizeLimitedText(request.data?.dateId, 'dateId', { max: 120 });
  const interested = normalizeOptionalBoolean(request.data?.interested, true);
  const dateRef = firestore.collection(DATE_COLLECTION).doc(dateId);
  const dateSnapshot = await dateRef.get();

  if (!dateSnapshot.exists) {
    throw new HttpsError('not-found', 'Das Date wurde nicht gefunden.');
  }

  const dateRecord = dateSnapshot.data() || {};

  if (dateRecord.status !== DATE_STATUS.ACTIVE || Number(dateRecord.scheduledAtMs || 0) <= Date.now()) {
    throw new HttpsError('failed-precondition', 'Für dieses Date kann kein Interesse mehr hinterlegt werden.');
  }

  if (dateRecord.creatorId === uid) {
    throw new HttpsError('failed-precondition', 'Du kannst nicht auf dein eigenes Date reagieren.');
  }

  const [{ profile: viewerProfile }, creatorProfile] = await Promise.all([
    assertEligibleDateAuthor({ firestore, uid }),
    loadUserProfile(firestore, dateRecord.creatorId),
  ]);

  if (!isEligibleDateParticipantProfile(creatorProfile)) {
    throw new HttpsError('failed-precondition', 'Auf dieses Date kann derzeit nicht reagiert werden.');
  }

  if (isMutuallyBlocked(viewerProfile, creatorProfile, uid, dateRecord.creatorId)) {
    throw new HttpsError('permission-denied', 'Blockierte Nutzer können nicht aufeinander reagieren.');
  }

  const interestRef = dateRef.collection(DATE_INTERESTS_SUBCOLLECTION).doc(uid);
  const interestSnapshot = await interestRef.get();
  const hasInterest = interestSnapshot.exists;

  if (interested && !hasInterest) {
    await interestRef.set({
      dateId,
      userId: uid,
      createdAt: fieldValue.serverTimestamp(),
      updatedAt: fieldValue.serverTimestamp(),
    }, { merge: false });
    await dateRef.set({
      interestCount: Math.max(0, Number(dateRecord.interestCount || 0) + 1),
      updatedAt: fieldValue.serverTimestamp(),
    }, { merge: true });
    return { ok: true, dateId, interested: true };
  }

  if (!interested && hasInterest) {
    await interestRef.delete();
    await dateRef.set({
      interestCount: Math.max(0, Number(dateRecord.interestCount || 0) - 1),
      updatedAt: fieldValue.serverTimestamp(),
    }, { merge: true });
    return { ok: true, dateId, interested: false };
  }

  return { ok: true, dateId, interested: hasInterest };
};

const createModerateDateHandler = ({ firestore, fieldValue }) => async (request) => {
  const uid = assertAuthenticated(request);
  const moderatorProfile = await loadUserProfile(firestore, uid);

  if (!isPrivilegedModerator(moderatorProfile)) {
    throw new HttpsError('permission-denied', 'Nur Admins oder Moderatoren dürfen Dates deaktivieren.');
  }

  const dateId = sanitizeLimitedText(request.data?.dateId, 'dateId', { max: 120 });
  const action = normalizeOptionalString(request.data?.action).toLowerCase();
  const nextStatus = action === 'restore' ? DATE_STATUS.ACTIVE : DATE_STATUS.DISABLED;
  const dateRef = firestore.collection(DATE_COLLECTION).doc(dateId);
  const snapshot = await dateRef.get();

  if (!snapshot.exists) {
    throw new HttpsError('not-found', 'Das Date wurde nicht gefunden.');
  }

  await dateRef.set({
    status: nextStatus,
    disabledAt: nextStatus === DATE_STATUS.DISABLED ? fieldValue.serverTimestamp() : null,
    updatedAt: fieldValue.serverTimestamp(),
    moderatedBy: uid,
  }, { merge: true });

  return { ok: true, dateId, status: nextStatus };
};

module.exports = {
  DATE_COLLECTION,
  DATE_INTERESTS_SUBCOLLECTION,
  DATE_STATUS,
  DATE_VISIBILITY,
  buildDateRecord,
  createCancelDateHandler,
  createCreateDateHandler,
  createListDatesHandler,
  createModerateDateHandler,
  createToggleDateInterestHandler,
  createUpdateDateHandler,
  ensureFutureDate,
  hasCommunityRulesAccepted,
  isMutuallyBlocked,
  isPrivilegedModerator,
  loadCurrentRulesVersion,
  sanitizeDatePayload,
};
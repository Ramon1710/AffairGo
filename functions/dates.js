const { HttpsError } = require('firebase-functions/v2/https');

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

const sanitizeDatePayload = (payload = {}, nowMs = Date.now()) => {
  const { scheduledAt, scheduledAtMs } = ensureFutureDate(payload.scheduledAt, nowMs);
  const visibility = normalizeOptionalString(payload.visibility).toLowerCase() || DATE_VISIBILITY.COMMUNITY;

  if (!Object.values(DATE_VISIBILITY).includes(visibility)) {
    throw new HttpsError('invalid-argument', 'Die Sichtbarkeit ist ungültig.');
  }

  return {
    title: sanitizeLimitedText(payload.title, 'Titel', { min: 4, max: 80 }),
    description: sanitizeLimitedText(payload.description, 'Beschreibung', { min: 12, max: 1200 }),
    category: sanitizeLimitedText(payload.category, 'Kategorie', { required: false, max: 80 }),
    regionLabel: sanitizeLimitedText(payload.regionLabel, 'Region', { min: 2, max: 120 }),
    visibility,
    scheduledAt,
    scheduledAtMs,
  };
};

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
  title: payload.title,
  description: payload.description,
  category: payload.category,
  regionLabel: payload.regionLabel,
  visibility: payload.visibility,
  status: DATE_STATUS.ACTIVE,
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
  const dateRef = firestore.collection(DATE_COLLECTION).doc();
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
    .where('scheduledAtMs', '>', nowMs)
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

    if (isMutuallyBlocked(viewerProfile, creatorProfile, uid, creatorId)) {
      return false;
    }

    return true;
  });

  return { ok: true, dates };
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
    regionLabel: sanitizedPayload.regionLabel,
    visibility: sanitizedPayload.visibility,
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

  const [viewerProfile, creatorProfile] = await Promise.all([
    loadUserProfile(firestore, uid),
    loadUserProfile(firestore, dateRecord.creatorId),
  ]);

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
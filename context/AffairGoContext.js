import * as Location from 'expo-location';
import {
    EmailAuthProvider,
    createUserWithEmailAndPassword,
    deleteUser,
    onAuthStateChanged,
    reauthenticateWithCredential,
    reload,
    sendEmailVerification,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut,
    updatePassword,
    verifyBeforeUpdateEmail,
} from 'firebase/auth';
import {
    Timestamp,
    collection,
    doc,
    endAt,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    startAt,
    where
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { geohashForLocation, geohashQueryBounds } from 'geofire-common';
import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { getModerationProviderLabel, hasConfiguredModerationBackend, submitModerationDecision, submitModerationReport } from '../constants/moderationProvider';
import { checkNicknameAvailability as checkNicknameAvailabilityWithProvider } from '../constants/nicknameProvider';
import { requestManagedPasswordReset } from '../constants/passwordResetProvider';
import { getPaymentProviderLabel, getPaymentSetupInstructions, hasConfiguredPaymentBackend, startPurchaseFlow } from '../constants/paymentProvider';
import {
    approveProfileImage as approveVerifiedProfileImage,
    createFaceLivenessSession as createProfilePhotoLivenessSession,
    getFaceLivenessResultAndCompareProfileImage as getProfilePhotoLivenessResultAndCompare,
    getProfilePhotoVerificationSetupInstructions,
    hasConfiguredProfilePhotoVerification,
    openFaceLivenessFlow,
    rejectAndDeleteTempProfileImage as rejectTempProfileImage,
} from '../constants/profilePhotoVerificationProvider';
import {
    EXPLORE_CITIES,
    EYE_OPTIONS,
    FIGURE_OPTIONS,
    GENDER_OPTIONS,
    HAIR_OPTIONS,
    INITIAL_CHATS,
    INITIAL_CURRENT_USER,
    INITIAL_EVENTS,
    INITIAL_USERS,
    PREFERENCE_OPTIONS,
    SEARCH_GENDER_OPTIONS,
    SKIN_OPTIONS,
    TABOO_OPTIONS,
    VISIBILITY_OPTIONS,
} from '../data/mockData';
import { auth, authReady, db, storage } from '../firebase';
import { getCompatibility as getCompatibilityScore, isMutualSearchMatch as isMutualSearchVisibilityMatch } from '../untils/matching';

const AffairGoContext = createContext(null);
const LIVE_LOCATION_INTERVAL_MS = 8000;
const MAX_MODERATION_AUDIT_TRAIL_ENTRIES = 40;
const FIXED_ADMIN_EMAIL = 'ramon.meyer@admin.de';
const FIXED_ADMIN_PASSWORD = 'heihachi17';
const SESSION_CACHE_STORAGE_KEY = 'affairgo.session.v1';
const FREE_ACCESS_MEMBERSHIP = 'free';
const FREE_ACCESS_STATUS_LABEL = 'Kostenfrei bis Anfang 2027';
const MAP_LOCATIONS_COLLECTION = 'mapLocations';
const LOCATION_PRIVACY_SUBCOLLECTION = 'private';
const LOCATION_PRIVACY_DOC_ID = 'liveLocation';
const LOCATION_MAX_ACCURACY_METERS = 150;
const LOCATION_STALE_AFTER_MS = 10 * 60 * 1000;
const LOCATION_OBFUSCATION_MAX_METERS = 450;
const EVENT_FALLBACK_GEOKM = 2;

const clone = (value) => JSON.parse(JSON.stringify(value));
const PROFILE_VERIFICATION_FAILURE_MESSAGES = {
  FACE_MISMATCH: 'Das Profilbild passt nicht zum Live-Selfie. Das temporäre Bild wurde verworfen.',
  LIVENESS_FAILED: 'Die Live-Selfie-Prüfung war nicht erfolgreich. Das temporäre Bild wurde verworfen.',
};

const canUseBrowserStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const readCachedSession = (uid) => {
  if (!uid || !canUseBrowserStorage()) {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(SESSION_CACHE_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue);

    if (!parsedValue?.profile || parsedValue.uid !== uid) {
      return null;
    }

    return parsedValue;
  } catch (error) {
    console.warn('AffairGo session cache read warning', error);
    return null;
  }
};

const writeCachedSession = (uid, session) => {
  if (!uid || !canUseBrowserStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(SESSION_CACHE_STORAGE_KEY, JSON.stringify({
      uid,
      ...session,
      cachedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.warn('AffairGo session cache write warning', error);
  }
};

const clearCachedSession = () => {
  if (!canUseBrowserStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(SESSION_CACHE_STORAGE_KEY);
  } catch (error) {
    console.warn('AffairGo session cache clear warning', error);
  }
};

const createEmptyTravelPlanEntry = () => ({
  id: '',
  startDate: '',
  endDate: '',
  fromTime: '',
  toTime: '',
  postalCode: '',
  city: '',
  street: '',
  visibility: [],
});

const createEmptyTravelPlans = () => ({
  business: [],
  vacation: [],
});

const createDefaultCurrentUser = () => ({
  ...clone(INITIAL_CURRENT_USER),
  id: 'me',
  email: '',
  nickname: '',
  firstName: '',
  lastName: '',
  birthDay: '',
  birthMonth: 0,
  birthYear: new Date().getFullYear() - 18,
  age: 18,
  height: '',
  braSize: '',
  penisSize: '',
  city: '',
  gallery: [],
  preferences: [],
  taboos: [],
  verified: false,
  emailVerified: false,
  pendingEmail: '',
  pendingNickname: '',
  privacyConsentAccepted: false,
  privacyConsentAcceptedAt: '',
  ageVerified: false,
  ageVerificationStatus: 'not_started',
  ageVerificationProvider: '',
  ageVerificationReferenceId: '',
  ageVerificationCheckedAt: '',
  selfieVerified: false,
  selfieVerificationStatus: 'not_started',
  selfieVerificationProvider: '',
  selfieVerificationReferenceId: '',
  selfieVerificationCheckedAt: '',
  selfieLivenessScore: 0,
  selfieFakeScore: 0,
  selfieDeletionStatus: 'not_requested',
  selfieDeletionConfirmedAt: '',
  selfieDeletionReceiptId: '',
  selfieRetentionPolicy: '',
  onboardingCompleted: false,
  searchActive: false,
  verifiedMatchesOnly: false,
  forcePasswordChange: false,
  role: 'member',
  isAdmin: false,
  searchGenders: [...SEARCH_GENDER_OPTIONS],
  dismissedProfileIds: [],
  membership: FREE_ACCESS_MEMBERSHIP,
  premiumTrialActive: false,
  premiumTrialEndsAt: '',
  billingCycle: 'free',
  planPriceLabel: FREE_ACCESS_STATUS_LABEL,
  goldDiscountPackage: false,
  purchaseHistory: [],
  points: 0,
  rewardLog: [],
  joinedLabel: 'Neu',
  profileImageUri: '',
  profilePhotoUrl: '',
  profilePhotoVerified: false,
  profilePhotoVerifiedAt: '',
  faceMatchSimilarity: 0,
  moderationState: 'clear',
  moderationFlags: [],
  moderationLastCheckedAt: '',
  moderationRateLimitUntil: '',
  moderationAuditTrail: [],
  accountDeletionRequestedAt: '',
  dataExportRequestedAt: '',
  latitude: null,
  longitude: null,
  travelPlans: createEmptyTravelPlans(),
});

const isFixedAdminEmail = (email = '') => email.trim().toLowerCase() === FIXED_ADMIN_EMAIL;

const matchesFixedAdminCredentials = (identifier = '', password = '') => (
  isFixedAdminEmail(identifier) && password === FIXED_ADMIN_PASSWORD
);

const buildFixedAdminProfile = (uid = 'affairgo-admin') => ({
  ...createDefaultCurrentUser(),
  id: uid,
  email: FIXED_ADMIN_EMAIL,
  nickname: 'RamonAdmin',
  firstName: 'Ramon',
  lastName: 'Meyer',
  age: 35,
  birthYear: new Date().getFullYear() - 35,
  city: 'Berlin',
  joinedLabel: 'Admin',
  verified: true,
  emailVerified: true,
  ageVerified: true,
  ageVerificationStatus: 'verified',
  selfieVerified: true,
  selfieVerificationStatus: 'verified',
  onboardingCompleted: true,
  searchActive: true,
  membership: FREE_ACCESS_MEMBERSHIP,
  role: 'admin',
  isAdmin: true,
});

const normalizeGermanComparison = (value = '') => String(value)
  .trim()
  .toLowerCase()
  .replaceAll('ä', 'ae')
  .replaceAll('ö', 'oe')
  .replaceAll('ü', 'ue')
  .replaceAll('ß', 'ss');

const normalizeDateValue = (value) => {
  if (!value) {
    return '';
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
};

const normalizeOptionValue = (value, options, fallback = value) => {
  if (!value) {
    return fallback;
  }

  const normalizedValue = normalizeGermanComparison(value);
  const match = options.find((option) => normalizeGermanComparison(option) === normalizedValue);
  return match || fallback;
};

const normalizeOptionList = (values, options, fallback = []) => {
  if (!Array.isArray(values)) {
    return fallback;
  }

  return values.map((value) => normalizeOptionValue(value, options, value));
};

const pickFirstDefinedValue = (...values) => values.find((value) => value !== undefined && value !== null);

const pickFirstNonEmptyString = (...values) => {
  const match = values.find((value) => typeof value === 'string' && value.trim());
  return match ? match.trim() : '';
};

const resolveProfilePhotoValue = (profile = {}, fallback = '') => pickFirstNonEmptyString(
  profile.profilePhotoUrl,
  profile.profileImageUri,
  profile.profileImage,
  fallback,
);

const getProfileFieldAliases = (profile = {}) => ({
  firstName: pickFirstNonEmptyString(profile.firstName, profile.firstname, profile.vorname),
  lastName: pickFirstNonEmptyString(profile.lastName, profile.lastname, profile.nachname),
  city: pickFirstNonEmptyString(profile.city, profile.ort),
  gender: pickFirstNonEmptyString(profile.gender, profile.geschlecht, profile.sex),
  height: pickFirstNonEmptyString(profile.height, profile.groesse, profile.koerpergroesse, profile.bodyHeight),
  figure: pickFirstNonEmptyString(profile.figure, profile.figur, profile.bodyType),
  penisSize: pickFirstNonEmptyString(profile.penisSize, profile.penisgroesse),
  braSize: pickFirstNonEmptyString(profile.braSize, profile.bhGroesse, profile.bra),
  hairColor: pickFirstNonEmptyString(profile.hairColor, profile.haarfarbe),
  eyeColor: pickFirstNonEmptyString(profile.eyeColor, profile.augenfarbe),
  skinType: pickFirstNonEmptyString(profile.skinType, profile.hauttyp),
  profilePhoto: resolveProfilePhotoValue(profile),
  birthDay: pickFirstDefinedValue(profile.birthDay, profile.geburtsTag),
  birthMonth: pickFirstDefinedValue(profile.birthMonth, profile.geburtsMonat),
  birthYear: pickFirstDefinedValue(profile.birthYear, profile.geburtsJahr),
  age: pickFirstDefinedValue(profile.age, profile.alter),
});

const hasLegacyProfileAliases = (profile = {}) => [
  'profileImage',
  'firstname',
  'lastname',
  'vorname',
  'nachname',
  'ort',
  'geschlecht',
  'sex',
  'groesse',
  'koerpergroesse',
  'bodyHeight',
  'figur',
  'bodyType',
  'penisgroesse',
  'bhGroesse',
  'bra',
  'haarfarbe',
  'augenfarbe',
  'hauttyp',
  'geburtsTag',
  'geburtsMonat',
  'geburtsJahr',
  'alter',
].some((key) => key in profile);

const hasCompletedPreferenceSetup = (profile = {}) => Array.isArray(profile.preferences) && profile.preferences.length > 0;

const normalizeSearchAgeValue = (value, fallback) => {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(99, Math.max(18, parsedValue));
};

const normalizeSearchAgeRange = (profile = {}, defaults = {}) => {
  const fallbackMin = Number.isFinite(Number(defaults.searchAgeMin)) ? Number(defaults.searchAgeMin) : 18;
  const fallbackMax = Number.isFinite(Number(defaults.searchAgeMax)) ? Number(defaults.searchAgeMax) : 99;
  const searchAgeMin = normalizeSearchAgeValue(profile.searchAgeMin, fallbackMin);
  const searchAgeMax = normalizeSearchAgeValue(profile.searchAgeMax, fallbackMax);

  return {
    searchAgeMin: Math.min(searchAgeMin, searchAgeMax),
    searchAgeMax: Math.max(searchAgeMin, searchAgeMax),
  };
};

const getSearchGenders = (profile = {}, fallback = SEARCH_GENDER_OPTIONS) => {
  const normalizedSearchGenders = normalizeOptionList(profile.searchGenders, SEARCH_GENDER_OPTIONS, []);
  return normalizedSearchGenders.length ? normalizedSearchGenders : [...fallback];
};

const hasTravelPlanContent = (travelPlan = {}) => (
  Boolean(
    travelPlan.startDate ||
    travelPlan.endDate ||
    travelPlan.fromTime ||
    travelPlan.toTime ||
    travelPlan.postalCode ||
    travelPlan.city ||
    travelPlan.street ||
    travelPlan.visibility?.length
  )
);

const normalizeTravelPlanEntry = (travelPlan = {}) => {
  const defaults = createEmptyTravelPlanEntry();

  return {
    ...defaults,
    ...travelPlan,
    id: travelPlan.id || `travel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    visibility: normalizeOptionList(travelPlan.visibility, VISIBILITY_OPTIONS, defaults.visibility),
  };
};

const normalizeTravelPlanBucket = (travelPlansForMode) => {
  if (Array.isArray(travelPlansForMode)) {
    return travelPlansForMode.map((entry) => normalizeTravelPlanEntry(entry));
  }

  if (travelPlansForMode && typeof travelPlansForMode === 'object' && hasTravelPlanContent(travelPlansForMode)) {
    return [normalizeTravelPlanEntry(travelPlansForMode)];
  }

  return [];
};

const normalizeTravelPlans = (travelPlans = {}) => {
  return {
    business: normalizeTravelPlanBucket(travelPlans.business),
    vacation: normalizeTravelPlanBucket(travelPlans.vacation),
  };
};

const normalizeIdList = (values) => (Array.isArray(values) ? values.filter(Boolean) : []);
const normalizeTextList = (values) => (Array.isArray(values) ? Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean))) : []);

const createModerationAuditEntry = ({
  actionType,
  outcome,
  reason = '',
  targetUserId = '',
  provider = 'local-fallback',
  auditId = '',
  severity = 'info',
  flags = [],
  metadata = {},
}) => ({
  id: auditId || `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  actionType,
  outcome,
  reason,
  targetUserId,
  provider,
  severity,
  flags: normalizeTextList(flags),
  metadata,
  createdAt: new Date().toISOString(),
});

const appendModerationAuditTrail = (entries, nextEntry) => [nextEntry, ...(Array.isArray(entries) ? entries : [])].slice(0, MAX_MODERATION_AUDIT_TRAIL_ENTRIES);

const getRecentModerationActionCount = (entries, actionType, withinMs) => {
  const now = Date.now();

  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    if (entry.actionType !== actionType || !entry.createdAt) {
      return false;
    }

    const createdAt = new Date(entry.createdAt).getTime();
    return Number.isFinite(createdAt) && now - createdAt <= withinMs;
  }).length;
};

const buildRecentActionSummary = (entries) => {
  const relevantWindowMs = 60 * 60 * 1000;
  const recentEntries = (Array.isArray(entries) ? entries : []).filter((entry) => {
    const createdAt = new Date(entry.createdAt).getTime();
    return Number.isFinite(createdAt) && Date.now() - createdAt <= relevantWindowMs;
  });

  return recentEntries.reduce((summary, entry) => ({
    ...summary,
    [entry.actionType]: (summary[entry.actionType] || 0) + 1,
  }), {});
};

const deriveModerationState = (outcome, flags) => {
  const normalizedFlags = normalizeTextList(flags);

  if (outcome === 'blocked' || normalizedFlags.includes('rate_limited') || normalizedFlags.includes('fraud_risk')) {
    return 'restricted';
  }

  if (outcome === 'reported' || outcome === 'review' || outcome === 'queued' || normalizedFlags.length) {
    return 'review';
  }

  return 'clear';
};

const parseTravelDate = (value) => {
  if (!value || !/^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
    return null;
  }

  const [day, month, year] = value.split('.').map(Number);
  return new Date(year, month - 1, day);
};

const startOfDay = (value) => {
  const nextDate = new Date(value);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const validateTravelPlanEntry = (travelPlan) => {
  const startDate = parseTravelDate(travelPlan.startDate);
  const endDate = parseTravelDate(travelPlan.endDate);

  if (!startDate || !endDate) {
    throw new Error('Bitte gib für Reisen ein gültiges Start- und Enddatum im Format TT.MM.JJJJ an.');
  }

  const normalizedStartDate = startOfDay(startDate);
  const normalizedEndDate = startOfDay(endDate);
  const today = startOfDay(new Date());
  const latestAllowedStart = startOfDay(new Date());
  latestAllowedStart.setDate(latestAllowedStart.getDate() + 14);

  if (normalizedEndDate < normalizedStartDate) {
    throw new Error('Das Enddatum darf nicht vor dem Startdatum liegen.');
  }

  if (normalizedStartDate < today) {
    throw new Error('Reisen können nur ab dem heutigen Datum geplant werden.');
  }

  if (normalizedStartDate > latestAllowedStart) {
    throw new Error('Reisen können maximal 14 Tage im Voraus geplant werden.');
  }
};

const getTravelPlanVisibilityStart = (travelPlan, referenceDate = new Date()) => {
  const startDate = parseTravelDate(travelPlan.startDate);

  if (!startDate) {
    return referenceDate;
  }

  if (travelPlan.visibility?.includes('2 Wochen vorher sichtbar')) {
    const visibleFrom = new Date(startDate);
    visibleFrom.setDate(visibleFrom.getDate() - 14);
    return visibleFrom;
  }

  if (travelPlan.visibility?.includes('Ab Stichtag sichtbar')) {
    return startDate;
  }

  return referenceDate;
};

const getTravelPlanVisibilityEnd = (travelPlan) => {
  const endDate = parseTravelDate(travelPlan.endDate) || parseTravelDate(travelPlan.startDate);

  if (!endDate) {
    return null;
  }

  const visibleUntil = new Date(endDate);
  visibleUntil.setHours(23, 59, 59, 999);
  return visibleUntil;
};

const isTravelPlanVisible = (travelPlan, referenceDate = new Date()) => {
  const now = referenceDate;
  const visibleFrom = getTravelPlanVisibilityStart(travelPlan, referenceDate);
  const visibleUntil = getTravelPlanVisibilityEnd(travelPlan);

  if (visibleUntil && now > visibleUntil) {
    return false;
  }

  return now >= visibleFrom;
};

const getVisibleTravelPlans = (profile, referenceDate = new Date()) => {
  const normalizedTravelPlans = normalizeTravelPlans(profile.travelPlans);

  return {
    business: normalizedTravelPlans.business.filter((entry) => isTravelPlanVisible(entry, referenceDate)),
    vacation: normalizedTravelPlans.vacation.filter((entry) => isTravelPlanVisible(entry, referenceDate)),
  };
};

const getProfileTravelSummary = (profile) => {
  const normalizedTravelPlans = getVisibleTravelPlans(profile);
  const allPlans = [
    ...normalizedTravelPlans.business.map((entry) => ({ ...entry, mode: 'business' })),
    ...normalizedTravelPlans.vacation.map((entry) => ({ ...entry, mode: 'vacation' })),
  ].sort((left, right) => {
    const leftDate = parseTravelDate(left.startDate)?.getTime() || Number.MAX_SAFE_INTEGER;
    const rightDate = parseTravelDate(right.startDate)?.getTime() || Number.MAX_SAFE_INTEGER;
    return leftDate - rightDate;
  });

  if (!allPlans.length) {
    return profile.travelMode && profile.travelMode !== 'active'
      ? {
          mode: profile.travelMode,
          label: profile.travelMode === 'business' ? 'Dienstreise' : 'Urlaub',
          period: '',
          location: profile.city || '',
        }
      : null;
  }

  const primaryPlan = allPlans[0];
  return {
    mode: primaryPlan.mode,
    label: primaryPlan.mode === 'business' ? 'Dienstreise' : 'Urlaub',
    period: primaryPlan.startDate && primaryPlan.endDate ? `${primaryPlan.startDate} bis ${primaryPlan.endDate}` : '',
    location: primaryPlan.city || profile.city || '',
  };
};

const getProfileTravelCities = (profile) => {
  const normalizedTravelPlans = getVisibleTravelPlans(profile);

  return Array.from(new Set([
    profile.city,
    ...normalizedTravelPlans.business.map((entry) => entry.city),
    ...normalizedTravelPlans.vacation.map((entry) => entry.city),
  ].filter(Boolean).map((entry) => entry.trim().toLowerCase())));
};

const getTravelPriorityScore = (sourceProfile, targetProfile) => {
  const sourceCities = getProfileTravelCities(sourceProfile);
  const targetCities = getProfileTravelCities(targetProfile);
  const sourceCitySet = new Set(sourceCities);
  const sharedCities = targetCities.filter((city) => sourceCitySet.has(city)).length;
  const targetTravelSummary = getProfileTravelSummary(targetProfile);

  return (sharedCities * 100) + (targetTravelSummary ? 25 : 0) - (targetProfile.distanceKm || 0);
};

const getTravelMatchForAddress = (profile, address = '') => {
  const normalizedAddress = address.trim().toLowerCase();

  if (!normalizedAddress) {
    return '';
  }

  return getProfileTravelCities(profile).find((city) => normalizedAddress.includes(city)) || '';
};

const normalizeUserProfile = (profile = {}, firebaseUser = null) => {
  const defaults = createDefaultCurrentUser();
  const aliasValues = getProfileFieldAliases(profile);
  const resolvedTravelPlans = normalizeTravelPlans(profile.travelPlans);
  const resolvedEmail = profile.email || firebaseUser?.email || defaults.email;
  const fixedAdmin = Boolean(profile.isAdmin) || profile.role === 'admin' || isFixedAdminEmail(resolvedEmail);
  const { searchAgeMin, searchAgeMax } = normalizeSearchAgeRange(profile, defaults);
  const normalizedPreferences = normalizeOptionList(profile.preferences, PREFERENCE_OPTIONS, defaults.preferences);
  const normalizedTaboos = normalizeOptionList(profile.taboos, TABOO_OPTIONS, defaults.taboos);

  return {
    ...defaults,
    ...profile,
    id: profile.id || firebaseUser?.uid || defaults.id,
    email: resolvedEmail,
    firstName: aliasValues.firstName || defaults.firstName,
    lastName: aliasValues.lastName || defaults.lastName,
    city: aliasValues.city || defaults.city,
    birthDay: pickFirstDefinedValue(aliasValues.birthDay, defaults.birthDay),
    birthMonth: pickFirstDefinedValue(aliasValues.birthMonth, defaults.birthMonth),
    birthYear: pickFirstDefinedValue(aliasValues.birthYear, defaults.birthYear),
    age: Number.isFinite(Number(aliasValues.age)) ? Number(aliasValues.age) : defaults.age,
    gender: normalizeOptionValue(aliasValues.gender, GENDER_OPTIONS, defaults.gender),
    height: aliasValues.height || defaults.height,
    figure: normalizeOptionValue(aliasValues.figure, FIGURE_OPTIONS, defaults.figure),
    penisSize: aliasValues.penisSize || defaults.penisSize,
    braSize: aliasValues.braSize || defaults.braSize,
    hairColor: normalizeOptionValue(aliasValues.hairColor, HAIR_OPTIONS, defaults.hairColor),
    eyeColor: normalizeOptionValue(aliasValues.eyeColor, EYE_OPTIONS, defaults.eyeColor),
    skinType: normalizeOptionValue(aliasValues.skinType, SKIN_OPTIONS, defaults.skinType),
    emailVerified: fixedAdmin ? true : (firebaseUser?.emailVerified ?? profile.emailVerified ?? false),
    pendingEmail: profile.pendingEmail || '',
    pendingNickname: profile.pendingNickname || '',
    privacyConsentAccepted: Boolean(profile.privacyConsentAccepted),
    privacyConsentAcceptedAt: profile.privacyConsentAcceptedAt || '',
    ageVerified: fixedAdmin ? true : (profile.ageVerified ?? Boolean(profile.age >= 18)),
    ageVerificationStatus: fixedAdmin ? 'verified' : (profile.ageVerificationStatus || (profile.age >= 18 ? 'verified' : 'not_started')),
    ageVerificationProvider: profile.ageVerificationProvider || '',
    ageVerificationReferenceId: profile.ageVerificationReferenceId || '',
    ageVerificationCheckedAt: profile.ageVerificationCheckedAt || '',
    selfieVerified: fixedAdmin ? true : Boolean(profile.selfieVerified),
    selfieVerificationStatus: fixedAdmin ? 'verified' : (profile.selfieVerificationStatus || 'not_started'),
    selfieVerificationProvider: profile.selfieVerificationProvider || '',
    selfieVerificationReferenceId: profile.selfieVerificationReferenceId || '',
    selfieVerificationCheckedAt: profile.selfieVerificationCheckedAt || '',
    selfieLivenessScore: Number.isFinite(Number(profile.selfieLivenessScore)) ? Number(profile.selfieLivenessScore) : 0,
    selfieFakeScore: Number.isFinite(Number(profile.selfieFakeScore)) ? Number(profile.selfieFakeScore) : 0,
    selfieDeletionStatus: profile.selfieDeletionStatus || 'not_requested',
    selfieDeletionConfirmedAt: profile.selfieDeletionConfirmedAt || '',
    selfieDeletionReceiptId: profile.selfieDeletionReceiptId || '',
    selfieRetentionPolicy: profile.selfieRetentionPolicy || '',
    moderationState: profile.moderationState || defaults.moderationState,
    moderationFlags: normalizeTextList(profile.moderationFlags),
    moderationLastCheckedAt: profile.moderationLastCheckedAt || '',
    moderationRateLimitUntil: profile.moderationRateLimitUntil || '',
    moderationAuditTrail: Array.isArray(profile.moderationAuditTrail) ? profile.moderationAuditTrail : [],
    verified: fixedAdmin ? true : (profile.verified ?? Boolean(profile.profileImageUploaded)),
    verifiedMatchesOnly: fixedAdmin ? true : Boolean(profile.verifiedMatchesOnly),
    dismissedProfileIds: normalizeIdList(profile.dismissedProfileIds),
    premiumTrialActive: false,
    premiumTrialEndsAt: '',
    billingCycle: profile.billingCycle || defaults.billingCycle,
    planPriceLabel: FREE_ACCESS_STATUS_LABEL,
    goldDiscountPackage: false,
    purchaseHistory: Array.isArray(profile.purchaseHistory) ? profile.purchaseHistory : defaults.purchaseHistory,
    gallery: Array.isArray(profile.gallery) ? profile.gallery : defaults.gallery,
    profilePhotoUrl: aliasValues.profilePhoto,
    profileImageUri: aliasValues.profilePhoto,
    profilePhotoVerified: fixedAdmin ? true : Boolean(profile.profilePhotoVerified),
    profilePhotoVerifiedAt: normalizeDateValue(profile.profilePhotoVerifiedAt),
    faceMatchSimilarity: Number.isFinite(Number(profile.faceMatchSimilarity)) ? Number(profile.faceMatchSimilarity) : 0,
    accountDeletionRequestedAt: profile.accountDeletionRequestedAt || '',
    dataExportRequestedAt: profile.dataExportRequestedAt || '',
    latitude: Number.isFinite(Number(profile.latitude)) ? Number(profile.latitude) : defaults.latitude,
    longitude: Number.isFinite(Number(profile.longitude)) ? Number(profile.longitude) : defaults.longitude,
    searchAgeMin,
    searchAgeMax,
    searchGenders: getSearchGenders(profile, defaults.searchGenders),
    preferences: normalizedPreferences,
    taboos: normalizedTaboos,
    travelPlans: resolvedTravelPlans,
    forcePasswordChange: Boolean(profile.forcePasswordChange),
    onboardingCompleted: fixedAdmin ? true : (Boolean(profile.onboardingCompleted) || hasCompletedPreferenceSetup({ preferences: normalizedPreferences })),
    searchActive: fixedAdmin ? true : Boolean(profile.searchActive),
    membership: FREE_ACCESS_MEMBERSHIP,
    role: fixedAdmin ? 'admin' : (profile.role || defaults.role),
    isAdmin: fixedAdmin,
  };
};

const toStoredProfile = (profile) => {
  const sanitized = { ...profile };
  const aliasValues = getProfileFieldAliases(profile);
  const { searchAgeMin, searchAgeMax } = normalizeSearchAgeRange(profile, createDefaultCurrentUser());
  delete sanitized.password;
  delete sanitized.repeatPassword;

  return {
    ...sanitized,
    firstName: aliasValues.firstName,
    lastName: aliasValues.lastName,
    city: aliasValues.city,
    birthDay: pickFirstDefinedValue(aliasValues.birthDay, profile.birthDay, ''),
    birthMonth: pickFirstDefinedValue(aliasValues.birthMonth, profile.birthMonth, 0),
    birthYear: pickFirstDefinedValue(aliasValues.birthYear, profile.birthYear, ''),
    age: Number.isFinite(Number(aliasValues.age)) ? Number(aliasValues.age) : Number(profile.age) || '',
    gender: normalizeOptionValue(aliasValues.gender, GENDER_OPTIONS, profile.gender),
    height: aliasValues.height,
    figure: normalizeOptionValue(aliasValues.figure, FIGURE_OPTIONS, profile.figure),
    penisSize: aliasValues.penisSize,
    braSize: aliasValues.braSize,
    hairColor: normalizeOptionValue(aliasValues.hairColor, HAIR_OPTIONS, profile.hairColor),
    eyeColor: normalizeOptionValue(aliasValues.eyeColor, EYE_OPTIONS, profile.eyeColor),
    skinType: normalizeOptionValue(aliasValues.skinType, SKIN_OPTIONS, profile.skinType),
    preferences: normalizeOptionList(profile.preferences, PREFERENCE_OPTIONS, []),
    taboos: normalizeOptionList(profile.taboos, TABOO_OPTIONS, []),
    travelPlans: normalizeTravelPlans(profile.travelPlans),
    dismissedProfileIds: normalizeIdList(profile.dismissedProfileIds),
    premiumTrialActive: false,
    premiumTrialEndsAt: '',
    membership: FREE_ACCESS_MEMBERSHIP,
    billingCycle: 'free',
    planPriceLabel: FREE_ACCESS_STATUS_LABEL,
    goldDiscountPackage: false,
    purchaseHistory: Array.isArray(profile.purchaseHistory) ? profile.purchaseHistory : [],
    pendingNickname: profile.pendingNickname || '',
    privacyConsentAccepted: Boolean(profile.privacyConsentAccepted),
    privacyConsentAcceptedAt: profile.privacyConsentAcceptedAt || '',
    ageVerified: Boolean(profile.ageVerified),
    ageVerificationStatus: profile.ageVerificationStatus || 'not_started',
    ageVerificationProvider: profile.ageVerificationProvider || '',
    ageVerificationReferenceId: profile.ageVerificationReferenceId || '',
    ageVerificationCheckedAt: profile.ageVerificationCheckedAt || '',
    selfieVerified: Boolean(profile.selfieVerified),
    selfieVerificationStatus: profile.selfieVerificationStatus || 'not_started',
    selfieVerificationProvider: profile.selfieVerificationProvider || '',
    selfieVerificationReferenceId: profile.selfieVerificationReferenceId || '',
    selfieVerificationCheckedAt: profile.selfieVerificationCheckedAt || '',
    selfieLivenessScore: Number.isFinite(Number(profile.selfieLivenessScore)) ? Number(profile.selfieLivenessScore) : 0,
    selfieFakeScore: Number.isFinite(Number(profile.selfieFakeScore)) ? Number(profile.selfieFakeScore) : 0,
    selfieDeletionStatus: profile.selfieDeletionStatus || 'not_requested',
    selfieDeletionConfirmedAt: profile.selfieDeletionConfirmedAt || '',
    selfieDeletionReceiptId: profile.selfieDeletionReceiptId || '',
    selfieRetentionPolicy: profile.selfieRetentionPolicy || '',
    moderationState: profile.moderationState || 'clear',
    moderationFlags: normalizeTextList(profile.moderationFlags),
    moderationLastCheckedAt: profile.moderationLastCheckedAt || '',
    moderationRateLimitUntil: profile.moderationRateLimitUntil || '',
    moderationAuditTrail: Array.isArray(profile.moderationAuditTrail) ? profile.moderationAuditTrail : [],
    verifiedMatchesOnly: Boolean(profile.verifiedMatchesOnly),
    profileImageUri: aliasValues.profilePhoto,
    profilePhotoUrl: aliasValues.profilePhoto,
    profilePhotoVerified: Boolean(profile.profilePhotoVerified),
    profilePhotoVerifiedAt: profile.profilePhotoVerifiedAt || '',
    faceMatchSimilarity: Number.isFinite(Number(profile.faceMatchSimilarity)) ? Number(profile.faceMatchSimilarity) : 0,
    profilePhotoAgeMonths: Number.isFinite(Number(profile.profilePhotoAgeMonths)) ? Number(profile.profilePhotoAgeMonths) : 0,
    accountDeletionRequestedAt: profile.accountDeletionRequestedAt || '',
    dataExportRequestedAt: profile.dataExportRequestedAt || '',
    latitude: Number.isFinite(Number(profile.latitude)) ? Number(profile.latitude) : null,
    longitude: Number.isFinite(Number(profile.longitude)) ? Number(profile.longitude) : null,
    searchAgeMin,
    searchAgeMax,
    searchGenders: getSearchGenders(profile),
    nicknameLower: normalizeGermanComparison(profile.nickname),
    updatedAt: serverTimestamp(),
  };
};

const buildRegistrationProfile = (payload, uid) => ({
  id: uid,
  email: payload.email.trim().toLowerCase(),
  nickname: payload.nickname.trim(),
  pendingNickname: '',
  privacyConsentAccepted: Boolean(payload.privacyConsentAccepted),
  privacyConsentAcceptedAt: payload.privacyConsentAcceptedAt || '',
  ageVerified: Boolean(payload.ageVerified),
  ageVerificationStatus: payload.ageVerificationStatus || 'not_started',
  ageVerificationProvider: payload.ageVerificationProvider || '',
  ageVerificationReferenceId: payload.ageVerificationReferenceId || '',
  ageVerificationCheckedAt: payload.ageVerificationCheckedAt || '',
  selfieVerified: Boolean(payload.selfieVerified),
  selfieVerificationStatus: payload.selfieVerificationStatus || 'not_started',
  selfieVerificationProvider: payload.selfieVerificationProvider || '',
  selfieVerificationReferenceId: payload.selfieVerificationReferenceId || '',
  selfieVerificationCheckedAt: payload.selfieVerificationCheckedAt || '',
  selfieLivenessScore: Number.isFinite(Number(payload.selfieLivenessScore)) ? Number(payload.selfieLivenessScore) : 0,
  selfieFakeScore: Number.isFinite(Number(payload.selfieFakeScore)) ? Number(payload.selfieFakeScore) : 0,
  selfieDeletionStatus: payload.selfieDeletionStatus || 'not_requested',
  selfieDeletionConfirmedAt: payload.selfieDeletionConfirmedAt || '',
  selfieDeletionReceiptId: payload.selfieDeletionReceiptId || '',
  selfieRetentionPolicy: payload.selfieRetentionPolicy || '',
  moderationState: 'clear',
  moderationFlags: [],
  moderationLastCheckedAt: '',
  moderationRateLimitUntil: '',
  moderationAuditTrail: [],
  firstName: payload.firstName?.trim() || '',
  lastName: payload.lastName?.trim() || '',
  birthDay: payload.birthDay,
  birthMonth: payload.birthMonth,
  birthYear: payload.birthYear,
  birthLabel: payload.birthLabel,
  age: payload.age,
  gender: payload.gender,
  height: payload.height?.trim() || '',
  figure: payload.figure,
  penisSize: payload.penisSize?.trim() || '',
  braSize: payload.braSize?.trim() || '',
  hairColor: payload.hairColor,
  eyeColor: payload.eyeColor,
  skinType: payload.skinType,
  verified: Boolean(payload.profileImageUploaded),
  profileImageUri: payload.profilePhotoUrl || payload.profileImageUri || '',
  profilePhotoUrl: payload.profilePhotoUrl || payload.profileImageUri || '',
  profilePhotoVerified: Boolean(payload.profilePhotoVerified),
  profilePhotoVerifiedAt: payload.profilePhotoVerifiedAt || '',
  faceMatchSimilarity: Number.isFinite(Number(payload.faceMatchSimilarity)) ? Number(payload.faceMatchSimilarity) : 0,
  profilePhotoAgeMonths: 0,
  gallery: [],
  joinedLabel: 'Heute',
  onboardingCompleted: false,
  membership: FREE_ACCESS_MEMBERSHIP,
  premiumTrialActive: false,
  premiumTrialEndsAt: '',
  billingCycle: 'free',
  planPriceLabel: FREE_ACCESS_STATUS_LABEL,
  goldDiscountPackage: false,
  purchaseHistory: [],
  searchAgeMin: 25,
  searchAgeMax: 55,
  searchGenders: [...SEARCH_GENDER_OPTIONS],
  radius: 25,
  searchActive: false,
  verifiedMatchesOnly: false,
  online: true,
  points: 0,
  rewardLog: [],
  accountDeletionRequestedAt: '',
  dataExportRequestedAt: '',
  latitude: null,
  longitude: null,
  preferences: [],
  taboos: [],
  city: '',
  featureSuggestions: [],
  dismissedProfileIds: [],
  travelPlans: createEmptyTravelPlans(),
  createdAt: serverTimestamp(),
});

const addUniqueId = (values = [], nextValue) => Array.from(new Set([...(values || []), nextValue].filter(Boolean)));
const removeId = (values = [], removedValue) => (values || []).filter((value) => value !== removedValue);

const buildFutureDateLabel = (days) => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  return futureDate.toLocaleDateString('de-DE');
};

const DEFAULT_MAP_LOCATION = { latitude: 50.9375, longitude: 6.9603, label: 'Köln' };

const CITY_COORDINATES = {
  amsterdam: { latitude: 52.3676, longitude: 4.9041, label: 'Amsterdam' },
  berlin: { latitude: 52.52, longitude: 13.405, label: 'Berlin' },
  bonn: { latitude: 50.7374, longitude: 7.0982, label: 'Bonn' },
  duesseldorf: { latitude: 51.2277, longitude: 6.7735, label: 'Düsseldorf' },
  hamburg: { latitude: 53.5511, longitude: 9.9937, label: 'Hamburg' },
  koeln: { latitude: 50.9375, longitude: 6.9603, label: 'Köln' },
  leverkusen: { latitude: 51.0459, longitude: 7.0192, label: 'Leverkusen' },
  muenchen: { latitude: 48.1351, longitude: 11.582, label: 'München' },
  pulheim: { latitude: 50.9996, longitude: 6.8062, label: 'Pulheim' },
  westerland: { latitude: 54.9079, longitude: 8.3033, label: 'Westerland' },
  wien: { latitude: 48.2082, longitude: 16.3738, label: 'Wien' },
};

const roundCoordinate = (value) => Number(value.toFixed(5));
const toRadians = (value) => (value * Math.PI) / 180;
const toDegrees = (value) => (value * 180) / Math.PI;

const calculateDistanceKm = (origin, target) => {
  if (!origin || !target) {
    return Number.MAX_SAFE_INTEGER;
  }

  const earthRadiusKm = 6371;
  const deltaLatitude = toRadians(target.latitude - origin.latitude);
  const deltaLongitude = toRadians(target.longitude - origin.longitude);
  const startLatitude = toRadians(origin.latitude);
  const targetLatitude = toRadians(target.latitude);
  const haversine =
    (Math.sin(deltaLatitude / 2) ** 2) +
    (Math.cos(startLatitude) * Math.cos(targetLatitude) * (Math.sin(deltaLongitude / 2) ** 2));

  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
};

const metersToLatitudeDelta = (meters) => meters / 111320;

const metersToLongitudeDelta = (meters, latitude) => {
  const safeCosine = Math.max(0.2, Math.cos(toRadians(latitude || 0)));
  return meters / (111320 * safeCosine);
};

const offsetCoordinate = (coordinate, latitudeDelta, longitudeDelta) => ({
  latitude: roundCoordinate(coordinate.latitude + latitudeDelta),
  longitude: roundCoordinate(coordinate.longitude + longitudeDelta),
});

const getLocationPrivacySeed = (value = '') => value.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);

const anonymizeMarkerPosition = (profile, coordinate) => {
  if (!coordinate || !profile?.id) {
    return coordinate;
  }

  const seed = getLocationPrivacySeed(profile.id);
  const distanceMeters = 120 + (seed % LOCATION_OBFUSCATION_MAX_METERS);
  const angleRadians = ((seed * 47) % 360) * (Math.PI / 180);
  const latitudeDelta = metersToLatitudeDelta(Math.sin(angleRadians) * distanceMeters);
  const longitudeDelta = metersToLongitudeDelta(Math.cos(angleRadians) * distanceMeters, coordinate.latitude);
  return offsetCoordinate(coordinate, latitudeDelta, longitudeDelta);
};

const createLocationGeohash = (coordinate) => {
  if (!coordinate || !Number.isFinite(Number(coordinate.latitude)) || !Number.isFinite(Number(coordinate.longitude))) {
    return '';
  }

  return geohashForLocation([Number(coordinate.latitude), Number(coordinate.longitude)]);
};

const normalizeMapStatus = (value, fallback = 'active') => {
  const normalizedValue = String(value || fallback).trim().toLowerCase();

  if (['vacation', 'business', 'event', 'active'].includes(normalizedValue)) {
    return normalizedValue;
  }

  return fallback;
};

const getMapStatusForProfile = (profile) => {
  const travelSummary = getProfileTravelSummary(profile);

  if (profile?.mapStatus) {
    return normalizeMapStatus(profile.mapStatus);
  }

  if (travelSummary?.mode === 'business') {
    return 'business';
  }

  if (travelSummary?.mode === 'vacation') {
    return 'vacation';
  }

  return 'active';
};

const isLocationFresh = (updatedAt) => {
  const updatedTimestamp = typeof updatedAt?.toMillis === 'function'
    ? updatedAt.toMillis()
    : new Date(updatedAt || 0).getTime();

  return Number.isFinite(updatedTimestamp) && (Date.now() - updatedTimestamp) <= LOCATION_STALE_AFTER_MS;
};

const normalizeLocationAccuracy = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, Math.round(numericValue)) : null;
};

const normalizeLocationCoordinate = (value) => {
  if (!value) {
    return null;
  }

  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    latitude: roundCoordinate(latitude),
    longitude: roundCoordinate(longitude),
  };
};

const buildPublicLocationDocument = ({ profile, exactLocation, accuracyMeters, lastUpdatedAt = Timestamp.now() }) => {
  const normalizedLocation = normalizeLocationCoordinate(exactLocation);

  if (!normalizedLocation) {
    return null;
  }

  const anonymizedCoordinate = anonymizeMarkerPosition(profile, normalizedLocation);
  const locationStatus = getMapStatusForProfile(profile);

  return {
    userId: profile.id,
    nickname: profile.nickname || '',
    profileImageUri: profile.profilePhotoUrl || profile.profileImageUri || '',
    age: Number(profile.age) || null,
    status: locationStatus,
    searchActive: Boolean(profile.searchActive),
    visible: Boolean(profile.searchActive) && !profile.accountDeletionRequestedAt,
    online: true,
    membership: profile.membership || FREE_ACCESS_MEMBERSHIP,
    city: profile.city || '',
    travelMode: profile.travelMode || locationStatus,
    coordinate: anonymizedCoordinate,
    geohash: createLocationGeohash(anonymizedCoordinate),
    accuracyMeters: normalizeLocationAccuracy(accuracyMeters),
    updatedAt: lastUpdatedAt,
  };
};

const buildPrivateLocationDocument = ({ exactLocation, accuracyMeters, lastUpdatedAt = Timestamp.now() }) => {
  const normalizedLocation = normalizeLocationCoordinate(exactLocation);

  if (!normalizedLocation) {
    return null;
  }

  return {
    coordinate: normalizedLocation,
    geohash: createLocationGeohash(normalizedLocation),
    accuracyMeters: normalizeLocationAccuracy(accuracyMeters),
    updatedAt: lastUpdatedAt,
  };
};

const getFirestoreRadiusKm = (value) => {
  const numericValue = Number(value);

  if ([5, 10, 20, 50, 100, 150].includes(numericValue)) {
    return numericValue;
  }

  if (numericValue <= 5) {
    return 5;
  }
  if (numericValue <= 10) {
    return 10;
  }
  if (numericValue <= 20) {
    return 20;
  }
  if (numericValue <= 50) {
    return 50;
  }
  if (numericValue <= 100) {
    return 100;
  }

  return 150;
};

const getEventCoordinate = (event, fallbackLocation) => {
  const explicitCoordinate = normalizeLocationCoordinate(event?.coordinate);

  if (explicitCoordinate) {
    return explicitCoordinate;
  }

  const referencedCity = event?.travelReferenceCity || event?.city || '';
  const cityCoordinate = getCityCoordinates(referencedCity);

  if (cityCoordinate) {
    return cityCoordinate;
  }

  return fallbackLocation || DEFAULT_MAP_LOCATION;
};

const buildEventMapItem = (event, observerLocation) => {
  const coordinate = getEventCoordinate(event, observerLocation);
  return {
    ...event,
    mapItemType: 'event',
    mapStatus: 'event',
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    distanceKm: Math.max(1, Math.round(calculateDistanceKm(observerLocation, coordinate))),
  };
};

const getCityCoordinates = (city = '') => CITY_COORDINATES[normalizeGermanComparison(city)] || null;

const getFallbackLiveLocation = (profile = {}) => {
  if (Number.isFinite(Number(profile.latitude)) && Number.isFinite(Number(profile.longitude))) {
    return {
      latitude: Number(profile.latitude),
      longitude: Number(profile.longitude),
      label: profile.city || DEFAULT_MAP_LOCATION.label,
    };
  }

  const travelLocation = getProfileTravelSummary(profile)?.location;
  return getCityCoordinates(travelLocation || profile.city) || DEFAULT_MAP_LOCATION;
};

const normalizeStoredMapLocation = (entry, observerLocation) => {
  if (!entry?.userId) {
    return null;
  }

  const coordinate = normalizeLocationCoordinate(entry.coordinate);

  if (!coordinate || !isLocationFresh(entry.updatedAt) || entry.visible === false || entry.searchActive === false) {
    return null;
  }

  return {
    userId: entry.userId,
    nickname: entry.nickname || '',
    profileImageUri: entry.profileImageUri || '',
    age: Number(entry.age) || null,
    status: normalizeMapStatus(entry.status),
    searchActive: entry.searchActive !== false,
    online: entry.online !== false,
    coordinate,
    distanceKm: Math.max(1, Math.round(calculateDistanceKm(observerLocation, coordinate))),
    updatedAt: entry.updatedAt,
  };
};

const mergeMapLocationsIntoProfiles = (profiles, mapLocations, observerLocation) => {
  if (!Array.isArray(mapLocations) || !mapLocations.length) {
    return profiles.map((profile) => {
      const fallbackLocation = getFallbackLiveLocation(profile);
      return {
        ...profile,
        latitude: fallbackLocation.latitude,
        longitude: fallbackLocation.longitude,
        mapStatus: getMapStatusForProfile(profile),
        distanceKm: Math.max(1, Math.round(calculateDistanceKm(observerLocation, fallbackLocation))),
      };
    });
  }

  const locationMap = new Map(
    mapLocations
      .map((entry) => normalizeStoredMapLocation(entry, observerLocation))
      .filter(Boolean)
      .map((entry) => [entry.userId, entry])
  );

  return profiles.map((profile) => {
    const publicLocation = locationMap.get(profile.id);

    if (!publicLocation) {
      const fallbackLocation = getFallbackLiveLocation(profile);
      return {
        ...profile,
        latitude: fallbackLocation.latitude,
        longitude: fallbackLocation.longitude,
        mapStatus: getMapStatusForProfile(profile),
        distanceKm: Math.max(1, Math.round(calculateDistanceKm(observerLocation, fallbackLocation))),
      };
    }

    return {
      ...profile,
      latitude: publicLocation.coordinate.latitude,
      longitude: publicLocation.coordinate.longitude,
      online: publicLocation.online,
      profileImageUri: publicLocation.profileImageUri || profile.profileImageUri || '',
      mapStatus: publicLocation.status,
      distanceKm: publicLocation.distanceKm,
      lastLiveSyncAt: normalizeDateValue(publicLocation.updatedAt),
    };
  });
};

const loadStoredUsers = async (excludedUserId = '') => {
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    const storedUsers = snapshot.docs
      .map((profileDoc) => ({
        ...normalizeUserProfile({ id: profileDoc.id, ...profileDoc.data() }),
        latitude: null,
        longitude: null,
      }))
      .filter((profile) => profile.id && profile.id !== excludedUserId);

    return storedUsers;
  } catch (error) {
    console.warn('AffairGo user bootstrap warning', error);
    return [];
  }
};

const loadRadiusMapLocations = async ({ center, radiusKm, excludedUserId = '' }) => {
  const normalizedCenter = normalizeLocationCoordinate(center);

  if (!normalizedCenter) {
    return [];
  }

  const radiusInM = getFirestoreRadiusKm(radiusKm) * 1000;
  const bounds = geohashQueryBounds([normalizedCenter.latitude, normalizedCenter.longitude], radiusInM);
  const locationQueries = bounds.map(([startHash, endHash]) => getDocs(query(
    collection(db, MAP_LOCATIONS_COLLECTION),
    orderBy('geohash'),
    startAt(startHash),
    endAt(endHash)
  )));
  const snapshots = await Promise.all(locationQueries);
  const uniqueEntries = new Map();

  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((locationDoc) => {
      const entry = { id: locationDoc.id, ...locationDoc.data() };

      if (!entry.userId || entry.userId === excludedUserId) {
        return;
      }

      const normalizedEntry = normalizeStoredMapLocation(entry, normalizedCenter);

      if (!normalizedEntry || normalizedEntry.distanceKm > getFirestoreRadiusKm(radiusKm)) {
        return;
      }

      uniqueEntries.set(entry.userId, entry);
    });
  });

  return Array.from(uniqueEntries.values());
};

const createFeatureIdeaEntry = ({ title, submitterId, submitterNickname }) => ({
  id: `idea-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: title.trim(),
  submitterId: submitterId || '',
  submitterNickname: submitterNickname || 'Anonym',
  reward: 'Community-Boost',
  status: 'review',
  createdAt: new Date().toISOString(),
  approvedAt: '',
  approvedBy: '',
});

const mapAuthError = (error, fallbackMessage) => {
  switch (error?.code) {
    case 'auth/email-already-in-use':
      return 'Diese E-Mail-Adresse ist bereits registriert. Bitte logge dich ein oder nutze den Passwort-Reset.';
    case 'auth/invalid-email':
      return 'Die E-Mail-Adresse ist ungültig.';
    case 'auth/weak-password':
      return 'Das Passwort ist zu schwach. Bitte verwende mindestens 6 Zeichen.';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'E-Mail oder Passwort ist nicht korrekt.';
    case 'auth/too-many-requests':
      return 'Zu viele Versuche in kurzer Zeit. Bitte warte kurz und versuche es erneut.';
    case 'auth/network-request-failed':
      return 'Netzwerkfehler. Bitte prüfe deine Verbindung und versuche es erneut.';
    case 'unavailable':
    case 'failed-precondition':
      return 'Die Verbindung zur Datenbank ist gerade nicht verfügbar. Bitte versuche es in wenigen Sekunden erneut.';
    case 'auth/user-disabled':
      return 'Dieses Konto wurde deaktiviert.';
    default:
      return fallbackMessage;
  }
};

const isFirestoreReadOfflineError = (error) => {
  const normalizedMessage = error?.message?.toLowerCase() || '';

  return error?.code === 'unavailable'
    || error?.code === 'failed-precondition'
    || normalizedMessage.includes('client is offline')
    || normalizedMessage.includes('because the client is offline');
};

const trySendVerificationEmail = async (user) => {
  try {
    await withTimeout(
      sendEmailVerification(user),
      10000,
      'Die Verifizierungs-Mail konnte nicht rechtzeitig angefordert werden.'
    );
    return true;
  } catch {
    return false;
  }
};

const withTimeout = async (promise, timeoutMs, timeoutMessage) => {
  let timeoutId;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const trySignOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.warn('AffairGo signOut warning', error);
  }
};

const tryStoreRegistrationProfile = async (profile, userId) => {
  try {
    await withTimeout(
      setDoc(doc(db, 'users', userId), toStoredProfile(profile)),
      10000,
      'Das Profil konnte nicht rechtzeitig gespeichert werden.'
    );
    return true;
  } catch (error) {
    console.warn('AffairGo registration profile save warning', error);
    return false;
  }
};

const ensureFixedAdminProfileStored = async (firebaseUser) => {
  const adminProfile = buildFixedAdminProfile(firebaseUser?.uid || 'affairgo-admin');

  try {
    await withTimeout(
      setDoc(doc(db, 'users', adminProfile.id), toStoredProfile(adminProfile), { merge: true }),
      10000,
      'Das Admin-Profil konnte nicht rechtzeitig gespeichert werden.'
    );
  } catch (error) {
    console.warn('AffairGo fixed admin persist warning', error);
  }

  return adminProfile;
};

const findStoredProfileByEmail = async (email) => {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  const profileQuery = query(
    collection(db, 'users'),
    where('email', '==', normalizedEmail),
    limit(1)
  );
  const profileSnapshot = await getDocs(profileQuery);

  if (profileSnapshot.empty) {
    return null;
  }

  const profileDoc = profileSnapshot.docs[0];
  return {
    id: profileDoc.id,
    profile: profileDoc.data(),
  };
};

const findStoredProfileByNickname = async (nickname) => {
  const nicknameLookup = normalizeGermanComparison(nickname);

  if (!nicknameLookup) {
    return null;
  }

  const profileQuery = query(
    collection(db, 'users'),
    where('nicknameLower', '==', nicknameLookup),
    limit(1)
  );
  const profileSnapshot = await getDocs(profileQuery);

  if (profileSnapshot.empty) {
    return null;
  }

  const profileDoc = profileSnapshot.docs[0];
  return {
    id: profileDoc.id,
    profile: profileDoc.data(),
  };
};

const findStoredProfileByIdentifier = async (identifier) => {
  const trimmedIdentifier = identifier.trim();

  if (!trimmedIdentifier) {
    return null;
  }

  if (trimmedIdentifier.includes('@')) {
    const storedProfile = await findStoredProfileByEmail(trimmedIdentifier);
    return {
      email: trimmedIdentifier.toLowerCase(),
      profile: storedProfile?.profile || null,
      profileId: storedProfile?.id || null,
    };
  }

  const storedProfile = await findStoredProfileByNickname(trimmedIdentifier);

  if (storedProfile?.profile) {
    return {
      email: storedProfile.profile.email?.trim().toLowerCase() || '',
      profile: storedProfile.profile,
      profileId: storedProfile.id,
    };
  }

  return null;
};

const loadStoredProfile = async (userId, email) => {
  let profileData = { id: userId, email };

  try {
    const profileRef = doc(db, 'users', userId);
    const profileSnapshot = await getDoc(profileRef);
    if (profileSnapshot.exists()) {
      profileData = profileSnapshot.data();
    }
  } catch (error) {
    console.warn('AffairGo profile bootstrap warning', error);
  }

  return profileData;
};

const loadStoredEvents = async () => {
  try {
    const eventSnapshot = await getDocs(collection(db, 'events'));
    return eventSnapshot.docs.map((eventDoc) => ({ id: eventDoc.id, ...eventDoc.data() }));
  } catch (error) {
    console.warn('AffairGo event bootstrap warning', error);
    return [];
  }
};

const loadStoredFeatureIdeas = async () => {
  try {
    const ideaSnapshot = await getDocs(collection(db, 'featureIdeas'));
    return ideaSnapshot.docs
      .map((ideaDoc) => ({ id: ideaDoc.id, ...ideaDoc.data() }))
      .sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || ''));
  } catch (error) {
    console.warn('AffairGo feature idea bootstrap warning', error);
    return [];
  }
};

const persistStoredFeatureIdea = async (idea) => {
  await setDoc(doc(db, 'featureIdeas', idea.id), {
    ...idea,
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

const persistStoredEvent = async (event) => {
  await setDoc(doc(db, 'events', event.id), {
    ...event,
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

const readBlobFromUri = async (assetUri) => {
  if (!assetUri) {
    throw new Error('Es wurde kein Bild zum Hochladen ausgewählt.');
  }

  if (/^(https?:|blob:)/i.test(assetUri)) {
    const response = await fetch(assetUri);

    if (!response.ok) {
      throw new Error('Die Bilddatei konnte nicht gelesen werden.');
    }

    return response.blob();
  }

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.onload = () => resolve(request.response);
    request.onerror = () => reject(new Error('Die lokale Bilddatei konnte nicht gelesen werden.'));
    request.responseType = 'blob';
    request.open('GET', assetUri, true);
    request.send();
  });
};

const resolveUploadExtension = (assetOrUri, assetUri) => {
  const fileName = typeof assetOrUri === 'string' ? '' : assetOrUri?.fileName || assetOrUri?.name || '';
  const mimeType = typeof assetOrUri === 'string' ? '' : assetOrUri?.mimeType || '';
  const extensionMatch = (fileName || assetUri).match(/\.([a-zA-Z0-9]+)(?:\?|$)/);

  if (extensionMatch?.[1]) {
    return extensionMatch[1].toLowerCase();
  }

  if (/png/i.test(mimeType)) {
    return 'png';
  }

  if (/webp/i.test(mimeType)) {
    return 'webp';
  }

  return 'jpg';
};

const uploadMediaAsset = async (folder, assetOrUri, ownerId) => {
  const assetUri = typeof assetOrUri === 'string' ? assetOrUri : assetOrUri?.uri;

  if (!assetUri) {
    return '';
  }

  if (/^https?:\/\//i.test(assetUri)) {
    return assetUri;
  }

  const blob = await readBlobFromUri(assetUri);
  const extension = resolveUploadExtension(assetOrUri, assetUri);
  const storageRef = ref(storage, `${folder}/${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`);

  await uploadBytes(storageRef, blob, { contentType: blob.type || 'image/jpeg' });
  return getDownloadURL(storageRef);
};

const uploadMediaAssetToStoragePath = async (folder, assetOrUri, ownerId) => {
  const assetUri = typeof assetOrUri === 'string' ? assetOrUri : assetOrUri?.uri;

  if (!assetUri) {
    throw new Error('Es wurde kein Bild zum Hochladen ausgewählt.');
  }

  if (/^https?:\/\//i.test(assetUri)) {
    throw new Error('Für die Verifizierung sind nur lokale Bilddateien erlaubt.');
  }

  const blob = await readBlobFromUri(assetUri);
  const extension = resolveUploadExtension(assetOrUri, assetUri);
  const filePath = `${folder}/${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const storageRef = ref(storage, filePath);

  await uploadBytes(storageRef, blob, { contentType: blob.type || 'image/jpeg' });
  return {
    storagePath: filePath,
    storageRef,
  };
};

const ensureNicknameAvailable = async (nickname, excludedUserId = null) => {
  const normalizedNickname = nickname?.trim();

  if (!normalizedNickname) {
    throw new Error('Bitte gib einen Spitznamen ein.');
  }

  try {
    const result = await checkNicknameAvailabilityWithProvider({ nickname: normalizedNickname });

    if (!result?.available) {
      throw new Error('Dieser Spitzname ist bereits vergeben. Bitte wähle einen anderen.');
    }
  } catch (error) {
    if (isFirestoreReadOfflineError(error)) {
      console.warn('AffairGo nickname availability fallback', error);
      return;
    }

    throw error;
  }
};

const checkNicknameAvailability = async (nickname) => {
  const normalizedNickname = nickname?.trim();

  if (!normalizedNickname) {
    return {
      available: false,
      message: 'Bitte gib einen Spitznamen ein.',
    };
  }

  return checkNicknameAvailabilityWithProvider({ nickname: normalizedNickname });
};

const resolveAuthEmail = async (identifier) => {
  const trimmedIdentifier = identifier.trim();

  if (!trimmedIdentifier) {
    throw new Error('Bitte eine gültige E-Mail-Adresse oder einen vorhandenen Spitznamen eingeben.');
  }

  if (trimmedIdentifier.includes('@')) {
    return trimmedIdentifier.toLowerCase();
  }

  const resolvedProfile = await findStoredProfileByIdentifier(trimmedIdentifier);

  if (resolvedProfile?.email) {
    return resolvedProfile.email;
  }

  throw new Error('Bitte eine gültige E-Mail-Adresse oder einen vorhandenen Spitznamen eingeben.');
};

const getCompatibility = (sourceProfileOrPreferences, targetProfileOrPreferences) => getCompatibilityScore(sourceProfileOrPreferences, targetProfileOrPreferences);

const isMutualSearchMatch = (currentUser, targetUser) => isMutualSearchVisibilityMatch(currentUser, targetUser, {
  getSearchGenders,
  normalizeOptionValue,
  searchGenderOptions: SEARCH_GENDER_OPTIONS,
});

export const AffairGoProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(createDefaultCurrentUser());
  const [users, setUsers] = useState(clone(INITIAL_USERS));
  const [events, setEvents] = useState(clone(INITIAL_EVENTS));
  const [chats, setChats] = useState(clone(INITIAL_CHATS));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [dismissedProfiles, setDismissedProfiles] = useState([]);
  const [swipeHistory, setSwipeHistory] = useState([]);
  const [pendingVerificationId, setPendingVerificationId] = useState(null);
  const [selectedProfileId, setSelectedProfileId] = useState('u1');
  const [currentRadius, setCurrentRadius] = useState(INITIAL_CURRENT_USER.radius);
  const [photoAgeFilter, setPhotoAgeFilter] = useState(null);
  const [featureIdeas, setFeatureIdeas] = useState([]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [lastLocationSyncLabel, setLastLocationSyncLabel] = useState('Standort-Sync bereit');
  const [deviceLocation, setDeviceLocation] = useState(null);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [publicMapLocations, setPublicMapLocations] = useState([]);
  const currentUserRef = useRef(currentUser);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const mapCenterCoordinates = useMemo(() => deviceLocation || getFallbackLiveLocation(currentUser), [currentUser, deviceLocation]);

  const publishLiveLocation = async (location, profileOverride = null) => {
    if (!Number.isFinite(Number(location?.latitude)) || !Number.isFinite(Number(location?.longitude))) {
      return [];
    }

    try {
      const activeProfile = profileOverride ? { ...currentUserRef.current, ...profileOverride } : currentUserRef.current;
      const accuracyMeters = normalizeLocationAccuracy(location?.accuracy ?? location?.coords?.accuracy);
      const lastUpdatedAt = Timestamp.now();
      const publicLocationDoc = buildPublicLocationDocument({
        profile: activeProfile,
        exactLocation: location,
        accuracyMeters,
        lastUpdatedAt,
      });
      const privateLocationDoc = buildPrivateLocationDocument({
        exactLocation: location,
        accuracyMeters,
        lastUpdatedAt,
      });

      if (!publicLocationDoc || !privateLocationDoc || !activeProfile?.id || activeProfile.id === 'me') {
        return [];
      }

      await Promise.all([
        setDoc(doc(db, MAP_LOCATIONS_COLLECTION, activeProfile.id), publicLocationDoc, { merge: true }),
        setDoc(doc(db, 'users', activeProfile.id, LOCATION_PRIVACY_SUBCOLLECTION, LOCATION_PRIVACY_DOC_ID), privateLocationDoc, { merge: true }),
      ]);

      const mapLocations = await loadRadiusMapLocations({
        center: privateLocationDoc.coordinate,
        radiusKm: currentRadius,
        excludedUserId: activeProfile.id,
      });
      setPublicMapLocations(mapLocations);
      setUsers((existingUsers) => mergeMapLocationsIntoProfiles(existingUsers, mapLocations, privateLocationDoc.coordinate));
      return mapLocations;
    } catch (error) {
      console.warn('AffairGo live location sync warning', error);
      return [];
    }
  };

  const hydrateAuthenticatedSession = (sessionData, firebaseUser = null) => {
    const resolvedProfile = sessionData?.profile && typeof sessionData.profile === 'object'
      ? sessionData.profile
      : sessionData;
    const normalizedProfile = normalizeUserProfile(resolvedProfile, firebaseUser);

    setCurrentUser(normalizedProfile);
    setChats(Array.isArray(sessionData?.chats) ? sessionData.chats : []);
    setSwipeHistory(Array.isArray(sessionData?.swipeHistory) ? sessionData.swipeHistory : []);
    setDismissedProfiles(normalizeIdList(sessionData?.dismissedProfileIds));
    setCurrentRadius(normalizedProfile.radius || INITIAL_CURRENT_USER.radius);
    setIsAuthenticated(true);

    return normalizedProfile;
  };

  const syncCurrentUserFromFirebase = async (firebaseUser) => {
    const profileData = await loadStoredProfile(firebaseUser.uid, firebaseUser.email);
    const normalizedProfile = hydrateAuthenticatedSession(profileData, firebaseUser);
    const normalizedAuthEmail = firebaseUser.email?.trim().toLowerCase() || '';
    const normalizedStoredEmail = normalizedProfile.email?.trim().toLowerCase() || '';
    const normalizedPendingEmail = normalizedProfile.pendingEmail?.trim().toLowerCase() || '';
    const shouldBackfillLegacyFields = hasLegacyProfileAliases(profileData);

    if (normalizedPendingEmail && normalizedAuthEmail && normalizedAuthEmail === normalizedPendingEmail) {
      normalizedProfile.email = normalizedAuthEmail;
      normalizedProfile.pendingEmail = '';
      normalizedProfile.emailVerified = firebaseUser.emailVerified;

      setDoc(doc(db, 'users', firebaseUser.uid), toStoredProfile(normalizedProfile), { merge: true }).catch((error) => {
        console.warn('AffairGo pending email sync warning', error);
      });
    } else if (normalizedAuthEmail && normalizedStoredEmail !== normalizedAuthEmail && !normalizedPendingEmail) {
      normalizedProfile.email = normalizedAuthEmail;
      normalizedProfile.emailVerified = firebaseUser.emailVerified;

      setDoc(doc(db, 'users', firebaseUser.uid), toStoredProfile(normalizedProfile), { merge: true }).catch((error) => {
        console.warn('AffairGo auth email sync warning', error);
      });
    } else if (shouldBackfillLegacyFields) {
      setDoc(doc(db, 'users', firebaseUser.uid), toStoredProfile(normalizedProfile), { merge: true }).catch((error) => {
        console.warn('AffairGo profile legacy backfill warning', error);
      });
    }

    return normalizedProfile;
  };

  useEffect(() => {
    if (!isAuthenticated || !currentUser.id || currentUser.id === 'me') {
      return;
    }

    writeCachedSession(currentUser.id, {
      profile: currentUser,
      chats,
      swipeHistory,
      dismissedProfileIds: dismissedProfiles,
    });
  }, [chats, currentUser, dismissedProfiles, isAuthenticated, swipeHistory]);

  useEffect(() => {
    let unsubscribe = () => undefined;
    let active = true;

    authReady.finally(() => {
      if (!active) {
        return;
      }

      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (!firebaseUser) {
          setIsAuthenticated(false);
          setCurrentUser(createDefaultCurrentUser());
          setChats(clone(INITIAL_CHATS));
          setSwipeHistory([]);
          setDismissedProfiles([]);
          setPendingVerificationId(null);
          setCurrentRadius(INITIAL_CURRENT_USER.radius);
          setDeviceLocation(null);
          setLocationPermissionGranted(false);
          setLocationError('');
          setPublicMapLocations([]);
          setUsers(clone(INITIAL_USERS));
          clearCachedSession();
          setIsAuthReady(true);
          return;
        }

        const cachedSession = readCachedSession(firebaseUser.uid);

        if (cachedSession) {
          hydrateAuthenticatedSession(cachedSession, firebaseUser);
          setIsAuthReady(true);
        }

        syncCurrentUserFromFirebase(firebaseUser)
          .catch((error) => {
            console.warn('AffairGo auth bootstrap warning', error);

            if (!active || cachedSession) {
              return;
            }

            hydrateAuthenticatedSession({
              profile: {
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
              },
            }, firebaseUser);
          })
          .finally(() => {
            if (active) {
              setIsAuthReady(true);
            }
          });
      });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    loadStoredUsers(currentUser.id === 'me' ? '' : currentUser.id).then((storedUsers) => {
      if (!active || !storedUsers.length) {
        return;
      }

      setUsers(storedUsers);
    });

    return () => {
      active = false;
    };
  }, [currentUser.id]);

  useEffect(() => {
    let active = true;

    loadStoredFeatureIdeas().then((storedIdeas) => {
      if (active) {
        setFeatureIdeas(storedIdeas);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrapEvents = async () => {
      const storedEvents = await loadStoredEvents();
      if (!active) {
        return;
      }

      setEvents(storedEvents);
    };

    bootstrapEvents();

    return () => {
      active = false;
    };
  }, []);

  const requestLiveLocationAccess = async () => {
    try {
      let currentPosition;

      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
        const permissionsApi = navigator.permissions?.query
          ? await navigator.permissions.query({ name: 'geolocation' }).catch(() => null)
          : null;

        if (permissionsApi?.state === 'denied') {
          setLocationPermissionGranted(false);
          setLocationError('Die Standortfreigabe wurde im Browser blockiert. Bitte aktiviere sie in den Website-Einstellungen.');
          setLastLocationSyncLabel('Standortfreigabe erforderlich');
          return false;
        }

        currentPosition = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 15000,
          });
        });
      } else {
        const permission = await Location.requestForegroundPermissionsAsync();

        if (!permission.granted) {
          setLocationPermissionGranted(false);
          setLocationError('Standortfreigabe fehlt. Erlaube den Zugriff, damit die Matching Map deinen echten Standort nutzen kann.');
          setLastLocationSyncLabel('Standortfreigabe erforderlich');
          return false;
        }

        currentPosition = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      }

      const accuracy = normalizeLocationAccuracy(currentPosition?.coords?.accuracy);
      const nextDeviceLocation = {
        latitude: roundCoordinate(currentPosition.coords.latitude),
        longitude: roundCoordinate(currentPosition.coords.longitude),
        accuracy,
      };

      setDeviceLocation(nextDeviceLocation);
      setLocationPermissionGranted(true);
      setLocationError('');
      setLastLocationSyncLabel(`GPS aktiv • ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`);
      await publishLiveLocation(nextDeviceLocation);
      return true;
    } catch (error) {
      setLocationPermissionGranted(false);
      setLocationError(error.message || 'Der Standort konnte nicht geladen werden.');
      setLastLocationSyncLabel('Standort aktuell nicht verfügbar');
      return false;
    }
  };

  useEffect(() => {
    if (!currentUser.searchActive) {
      setLastLocationSyncLabel('Live-Standort pausiert');
      return undefined;
    }

    let subscription;
    let watchId;
    let active = true;

    const startWatcher = async () => {
      const granted = await requestLiveLocationAccess();

      if (!granted || !active) {
        return;
      }

      const handlePosition = (position) => {
        const nextDeviceLocation = {
          latitude: roundCoordinate(position.coords.latitude),
          longitude: roundCoordinate(position.coords.longitude),
          accuracy: normalizeLocationAccuracy(position.coords.accuracy),
        };

        setDeviceLocation(nextDeviceLocation);
        setLocationPermissionGranted(true);
        setLocationError('');
        setLastLocationSyncLabel(`GPS aktualisiert • ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`);
        publishLiveLocation(nextDeviceLocation).catch(() => undefined);
      };

      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(handlePosition, (error) => {
          setLocationPermissionGranted(false);
          setLocationError(error.message || 'Der Browser konnte den Standort nicht aktualisieren.');
        }, {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 15000,
        });
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: LIVE_LOCATION_INTERVAL_MS,
          distanceInterval: 30,
        },
        handlePosition
      );
    };

    startWatcher();

    return () => {
      active = false;
      subscription?.remove?.();
      if (Number.isInteger(watchId) && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [currentUser.searchActive]);

  useEffect(() => {
    if (!currentUser.searchActive) {
      return undefined;
    }

    const observerLocation = mapCenterCoordinates || DEFAULT_MAP_LOCATION;
    let active = true;

    const refreshMapLocations = async () => {
      try {
        const mapLocations = await loadRadiusMapLocations({
          center: observerLocation,
          radiusKm: currentRadius,
          excludedUserId: currentUser.id,
        });

        if (!active) {
          return;
        }

        setPublicMapLocations(mapLocations);
        setUsers((existingUsers) => mergeMapLocationsIntoProfiles(existingUsers, mapLocations, observerLocation));
      } catch (error) {
        console.warn('AffairGo map radius refresh warning', error);
      }
    };

    refreshMapLocations();

    const intervalId = setInterval(() => {
      refreshMapLocations();
    }, LIVE_LOCATION_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [currentRadius, currentUser.id, currentUser.searchActive, mapCenterCoordinates]);

  const persistCurrentUserPatch = async (patch) => {
    const latestCurrentUser = currentUserRef.current;
    const userId = auth.currentUser?.uid || latestCurrentUser.id;

    if (!userId || userId === 'me') {
      return;
    }

    await setDoc(doc(db, 'users', userId), toStoredProfile({ ...latestCurrentUser, ...patch }), { merge: true });
  };

  const persistModerationAuditEntry = async (entry, extraPatch = {}) => {
    const nextAuditTrail = appendModerationAuditTrail(currentUser.moderationAuditTrail, entry);
    const nextFlags = normalizeTextList([...(currentUser.moderationFlags || []), ...(entry.flags || []), ...(extraPatch.moderationFlags || [])]);
    const nextPatch = {
      moderationAuditTrail: nextAuditTrail,
      moderationFlags: nextFlags,
      moderationLastCheckedAt: entry.createdAt,
      moderationRateLimitUntil: extraPatch.moderationRateLimitUntil ?? currentUser.moderationRateLimitUntil ?? '',
      moderationState: extraPatch.moderationState || deriveModerationState(entry.outcome, nextFlags),
    };

    setCurrentUser((previous) => ({ ...previous, ...nextPatch }));
    await persistCurrentUserPatch(nextPatch);
    return nextPatch;
  };

  const buildLocalModerationFallback = ({ actionType, content = '', metadata = {} }) => {
    const auditEntries = Array.isArray(currentUser.moderationAuditTrail) ? currentUser.moderationAuditTrail : [];
    const now = Date.now();
    const activeRateLimitUntil = currentUser.moderationRateLimitUntil ? new Date(currentUser.moderationRateLimitUntil).getTime() : 0;

    if (activeRateLimitUntil && Number.isFinite(activeRateLimitUntil) && activeRateLimitUntil > now) {
      return {
        allow: false,
        status: 'blocked',
        message: 'Deine Aktionen sind wegen auffaelliger Aktivitaet temporaer begrenzt. Bitte versuche es spaeter erneut.',
        provider: 'local-fallback',
        flags: ['rate_limited'],
        rateLimited: true,
        rateLimitUntil: new Date(activeRateLimitUntil).toISOString(),
      };
    }

    const suspiciousPattern = /(telegram|whatsapp|onlyfans|bitcoin|crypto|western union|gift card|paypal freunde|cashapp|signal me|t\.me\/|wa\.me\/|https?:\/\/|@gmail\.com|@outlook\.com|\+\d{6,})/i;
    const normalizedContent = String(content || '').trim();

    if ((actionType === 'send_message' || actionType === 'create_event') && suspiciousPattern.test(normalizedContent)) {
      return {
        allow: false,
        status: 'blocked',
        message: 'Die Aktion wurde blockiert, weil Kontaktverlagerung oder Zahlungsbetrug vermutet wird.',
        provider: 'local-fallback',
        flags: ['fraud_risk', 'external_contact'],
        rateLimited: false,
        rateLimitUntil: '',
      };
    }

    if (actionType === 'send_message' && getRecentModerationActionCount(auditEntries, 'send_message', 60 * 1000) >= 6) {
      return {
        allow: false,
        status: 'blocked',
        message: 'Zu viele Nachrichten in kurzer Zeit. Bitte sende langsamer weiter.',
        provider: 'local-fallback',
        flags: ['rate_limited', 'message_spam'],
        rateLimited: true,
        rateLimitUntil: new Date(now + (2 * 60 * 1000)).toISOString(),
      };
    }

    if (actionType === 'respond_swipe' && getRecentModerationActionCount(auditEntries, 'respond_swipe', 60 * 1000) >= 40) {
      return {
        allow: false,
        status: 'blocked',
        message: 'Zu viele Swipes in kurzer Zeit. Bitte warte kurz, bevor du weitermachst.',
        provider: 'local-fallback',
        flags: ['rate_limited', 'swipe_spam'],
        rateLimited: true,
        rateLimitUntil: new Date(now + (60 * 1000)).toISOString(),
      };
    }

    if (actionType === 'create_event' && getRecentModerationActionCount(auditEntries, 'create_event', 24 * 60 * 60 * 1000) >= 3) {
      return {
        allow: false,
        status: 'blocked',
        message: 'Zu viele neue Events innerhalb von 24 Stunden. Bitte warte vor dem naechsten Event.',
        provider: 'local-fallback',
        flags: ['rate_limited', 'event_spam'],
        rateLimited: true,
        rateLimitUntil: new Date(now + (6 * 60 * 60 * 1000)).toISOString(),
      };
    }

    return {
      allow: true,
      status: metadata.reviewOnly ? 'review' : 'allowed',
      message: '',
      provider: 'local-fallback',
      flags: [],
      rateLimited: false,
      rateLimitUntil: '',
    };
  };

  const moderateAuthenticatedAction = async ({ actionType, content = '', targetUserId = '', metadata = {} }) => {
    if (currentUser.isAdmin) {
      return { allow: true, status: 'allowed', provider: 'fixed-admin' };
    }

    let decision;

    try {
      decision = hasConfiguredModerationBackend()
        ? await submitModerationDecision({
            actionType,
            actorId: auth.currentUser?.uid || currentUser.id,
            actorEmail: currentUser.email,
            actorNickname: currentUser.nickname,
            targetUserId,
            content,
            metadata,
            recentActions: buildRecentActionSummary(currentUser.moderationAuditTrail),
          })
        : buildLocalModerationFallback({ actionType, content, metadata });
    } catch (error) {
      decision = buildLocalModerationFallback({ actionType, content, metadata: { ...metadata, moderationFallbackReason: error.message || 'backend_unreachable' } });
    }

    const blocked = decision.allow === false || decision.status === 'blocked';
    const entry = createModerationAuditEntry({
      actionType,
      outcome: blocked ? 'blocked' : decision.status || 'allowed',
      reason: decision.message || '',
      targetUserId,
      provider: decision.provider || getModerationProviderLabel(),
      auditId: decision.auditId || '',
      severity: blocked ? 'warning' : 'info',
      flags: [...(decision.flags || []), ...(decision.rateLimited ? ['rate_limited'] : [])],
      metadata: {
        ...metadata,
        riskLevel: decision.riskLevel || 'low',
        fraudScore: Number.isFinite(Number(decision.fraudScore)) ? Number(decision.fraudScore) : 0,
      },
    });

    await persistModerationAuditEntry(entry, {
      moderationRateLimitUntil: decision.rateLimitUntil || '',
      moderationState: deriveModerationState(entry.outcome, entry.flags),
    });

    if (blocked) {
      throw new Error(decision.message || 'Diese Aktion wurde durch die Sicherheitspruefung blockiert.');
    }

    return decision;
  };

  const moderatePreAuthAction = async ({ actionType, email = '', nickname = '', identifier = '', metadata = {} }) => {
    if (!hasConfiguredModerationBackend()) {
      return { allow: true, status: 'allowed' };
    }

    const decision = await submitModerationDecision({
      actionType,
      actorId: '',
      actorEmail: email,
      actorNickname: nickname,
      identifier,
      targetUserId: '',
      content: '',
      metadata,
      recentActions: {},
    });

    if (decision.allow === false || decision.status === 'blocked') {
      throw new Error(decision.message || 'Diese Anfrage wurde durch die Sicherheitspruefung blockiert.');
    }

    return decision;
  };

  const hasMutualDismiss = (profile) => {
    const ownDismissedIds = normalizeIdList(currentUser.dismissedProfileIds);
    const targetDismissedIds = normalizeIdList(profile.dismissedProfileIds);

    return ownDismissedIds.includes(profile.id) || targetDismissedIds.includes(currentUser.id);
  };

  const setMutualDismissState = (profileId, dismissed) => {
    let nextDismissedIds = normalizeIdList(currentUser.dismissedProfileIds);

    setCurrentUser((previous) => {
      nextDismissedIds = dismissed
        ? addUniqueId(previous.dismissedProfileIds, profileId)
        : removeId(previous.dismissedProfileIds, profileId);

      return {
        ...previous,
        dismissedProfileIds: nextDismissedIds,
      };
    });

    setUsers((previous) => previous.map((user) => {
      if (user.id !== profileId) {
        return user;
      }

      return {
        ...user,
        dismissedProfileIds: dismissed
          ? addUniqueId(user.dismissedProfileIds, currentUser.id)
          : removeId(user.dismissedProfileIds, currentUser.id),
      };
    }));

    persistCurrentUserPatch({ dismissedProfileIds: nextDismissedIds }).catch((error) => {
      console.warn('AffairGo dismiss persist warning', error);
    });
  };

  const visibleProfiles = useMemo(() => users
    .filter((user) => {
      if (!currentUser.searchActive) {
        return false;
      }
      if (!user.searchActive) {
        return false;
      }
      if (dismissedProfiles.includes(user.id)) {
        return false;
      }
      if (hasMutualDismiss(user)) {
        return false;
      }
      if (user.distanceKm > currentRadius) {
        return false;
      }
      if (photoAgeFilter && user.profilePhotoAgeMonths < photoAgeFilter) {
        return false;
      }
      if (currentUser.verifiedMatchesOnly && !user.verified) {
        return false;
      }
      if (!isMutualSearchMatch(currentUser, user)) {
        return false;
      }
      return getCompatibility(currentUser, user) >= 30;
    })
    .sort((left, right) => {
      const priorityDifference = getTravelPriorityScore(currentUser, right) - getTravelPriorityScore(currentUser, left);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      const compatibilityDifference = getCompatibility(currentUser, right) - getCompatibility(currentUser, left);
      if (compatibilityDifference !== 0) {
        return compatibilityDifference;
      }

      return left.distanceKm - right.distanceKm;
    }), [currentRadius, currentUser, dismissedProfiles, photoAgeFilter, users]);

  const matchedProfiles = chats
    .filter((chat) => chat.match)
    .map((chat) => users.find((user) => user.id === chat.userId))
    .filter(Boolean);
  const swipesUsed = swipeHistory.length;
  const remainingSwipes = null;
  const swipeLimitReached = false;

  const nearbyOnlineProfiles = visibleProfiles.filter((profile) => profile.online).slice(0, 3);
  const visibleMapEvents = useMemo(() => events
    .map((event) => buildEventMapItem(event, mapCenterCoordinates || DEFAULT_MAP_LOCATION))
    .filter((event) => event.distanceKm <= currentRadius), [currentRadius, events, mapCenterCoordinates]);
  const selectedProfile = users.find((profile) => profile.id === selectedProfileId) || visibleProfiles[0] || users[0];

  const login = async ({ identifier, password }) => {
    const fixedAdminLogin = matchesFixedAdminCredentials(identifier, password);
    const normalizedEmail = fixedAdminLogin
      ? FIXED_ADMIN_EMAIL
      : await withTimeout(
          resolveAuthEmail(identifier),
          5000,
          'Die Anmeldung hat beim Aufloesen deiner Kennung zu lange gedauert. Bitte versuche es erneut.'
        );

    if (!fixedAdminLogin) {
      await withTimeout(moderatePreAuthAction({
        actionType: 'login_attempt',
        email: normalizedEmail,
        identifier,
        metadata: { hasPassword: Boolean(password) },
      }), 5000, 'Die Sicherheitspruefung vor dem Login hat zu lange gedauert. Bitte versuche es erneut.');
    }

    try {
      let credentials;
      let profileData;

      if (fixedAdminLogin) {
        try {
          credentials = await withTimeout(
            signInWithEmailAndPassword(auth, FIXED_ADMIN_EMAIL, FIXED_ADMIN_PASSWORD),
            12000,
            'Der Admin-Login hat zu lange gedauert. Bitte versuche es erneut.'
          );
        } catch (error) {
          if (error?.code === 'auth/user-not-found' || error?.code === 'auth/invalid-credential') {
            credentials = await withTimeout(
              createUserWithEmailAndPassword(auth, FIXED_ADMIN_EMAIL, FIXED_ADMIN_PASSWORD),
              12000,
              'Das Admin-Konto konnte nicht rechtzeitig angelegt werden. Bitte versuche es erneut.'
            );
          } else {
            throw error;
          }
        }

        const [, persistedAdminProfile] = await Promise.all([
          withTimeout(
            reload(credentials.user),
            4000,
            'Das Aktualisieren des Admin-Status hat zu lange gedauert.'
          ).catch((error) => {
            console.warn('AffairGo admin reload warning', error);
            return null;
          }),
          ensureFixedAdminProfileStored(credentials.user),
        ]);
        profileData = persistedAdminProfile;
      } else {
        credentials = await withTimeout(
          signInWithEmailAndPassword(auth, normalizedEmail, password),
          12000,
          'Der Login hat zu lange gedauert. Bitte pruefe deine Verbindung und versuche es erneut.'
        );

        await withTimeout(
          reload(credentials.user),
          4000,
          'Das Aktualisieren deines Login-Status hat zu lange gedauert.'
        ).catch((error) => {
          console.warn('AffairGo login reload warning', error);
          return null;
        });

        const cachedSession = readCachedSession(credentials.user.uid);

        if (cachedSession) {
          const normalizedProfile = hydrateAuthenticatedSession(cachedSession, credentials.user);

          syncCurrentUserFromFirebase(credentials.user).catch((error) => {
            console.warn('AffairGo login refresh warning', error);
          });

          return {
            requiresPasswordChange: normalizedProfile.isAdmin ? false : normalizedProfile.forcePasswordChange,
            needsOnboarding: normalizedProfile.isAdmin ? false : !normalizedProfile.onboardingCompleted,
          };
        }

        profileData = await withTimeout(
          loadStoredProfile(credentials.user.uid, credentials.user.email),
          5000,
          'Das Laden deines Profils hat zu lange gedauert.'
        ).catch((error) => {
          console.warn('AffairGo login profile fallback warning', error);
          syncCurrentUserFromFirebase(credentials.user).catch((syncError) => {
            console.warn('AffairGo login fallback refresh warning', syncError);
          });
          return {
            id: credentials.user.uid,
            email: credentials.user.email || normalizedEmail,
          };
        });
      }

      if (!fixedAdminLogin && !credentials.user.emailVerified) {
        const resendWorked = await trySendVerificationEmail(credentials.user);
        await trySignOut();
        if (resendWorked) {
          throw new Error('Bitte bestätige zuerst deine E-Mail-Adresse. Wir haben dir soeben erneut eine Verifizierungs-Mail gesendet. Bitte prüfe auch deinen Spam-Ordner.');
        }
        throw new Error('Dein Konto wurde angelegt, aber die Verifizierungs-Mail konnte nicht gesendet werden. Bitte prüfe die Firebase-E-Mail-Vorlagen und versuche es erneut.');
      }

      const normalizedProfile = hydrateAuthenticatedSession(profileData, credentials.user);

      return {
        requiresPasswordChange: normalizedProfile.isAdmin ? false : normalizedProfile.forcePasswordChange,
        needsOnboarding: normalizedProfile.isAdmin ? false : !normalizedProfile.onboardingCompleted,
      };
    } catch (error) {
      throw new Error(mapAuthError(error, error?.message || 'Login fehlgeschlagen.'));
    }
  };

  const logout = async () => {
    await trySignOut();
    setIsAuthenticated(false);
    setCurrentUser(createDefaultCurrentUser());
    setChats(clone(INITIAL_CHATS));
    setSwipeHistory([]);
    setDismissedProfiles([]);
    clearCachedSession();
  };

  const requestPasswordReset = async (identifier) => {
    const normalizedEmail = await resolveAuthEmail(identifier);

    try {
      const managedResetResult = await requestManagedPasswordReset({ email: normalizedEmail }).catch(() => null);

      if (!managedResetResult?.handled) {
        await sendPasswordResetEmail(auth, normalizedEmail);
      }

      const storedProfile = await findStoredProfileByEmail(normalizedEmail);
      if (storedProfile?.id) {
        await setDoc(doc(db, 'users', storedProfile.id), { forcePasswordChange: true }, { merge: true });
      }

      return managedResetResult || { handled: false, mode: 'firebase-reset-link' };
    } catch (error) {
      throw new Error(mapAuthError(error, error?.message || 'Passwort-Reset fehlgeschlagen.'));
    }
  };

  const changePassword = async ({ currentPassword = '', newPassword, skipCurrentPasswordCheck = false }) => {
    if (!auth.currentUser) {
      throw new Error('Du musst eingeloggt sein, um dein Passwort zu ändern.');
    }

    if (!newPassword) {
      throw new Error('Bitte gib ein neues Passwort ein.');
    }

    if (!skipCurrentPasswordCheck) {
      if (!currentPassword) {
        throw new Error('Bitte gib zuerst dein aktuelles Passwort ein.');
      }

      if (!auth.currentUser.email) {
        throw new Error('Für dieses Konto ist keine E-Mail-Adresse zur Bestätigung verfügbar.');
      }
    }

    try {
      if (!skipCurrentPasswordCheck) {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
      }

      await updatePassword(auth.currentUser, newPassword);
      setCurrentUser((previous) => ({ ...previous, forcePasswordChange: false }));
      await persistCurrentUserPatch({ forcePasswordChange: false });
    } catch (error) {
      throw new Error(mapAuthError(error, error?.message || 'Passwort konnte nicht geändert werden.'));
    }
  };

  const requestEmailChange = async (nextEmail) => {
    if (!auth.currentUser) {
      throw new Error('Du musst eingeloggt sein, um deine E-Mail-Adresse zu ändern.');
    }

    const normalizedEmail = nextEmail.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new Error('Bitte gib eine gültige E-Mail-Adresse ein.');
    }

    if (normalizedEmail === currentUser.email?.trim().toLowerCase()) {
      if (currentUser.pendingEmail) {
        setCurrentUser((previous) => ({ ...previous, pendingEmail: '' }));
        await persistCurrentUserPatch({ pendingEmail: '' });
      }
      return { changed: false, pendingEmailCleared: true };
    }

    try {
      await verifyBeforeUpdateEmail(auth.currentUser, normalizedEmail);
      setCurrentUser((previous) => ({ ...previous, pendingEmail: normalizedEmail }));
      await persistCurrentUserPatch({ pendingEmail: normalizedEmail });
      return { changed: true, pendingEmail: normalizedEmail };
    } catch (error) {
      throw new Error(mapAuthError(error, error?.message || 'E-Mail-Änderung konnte nicht gestartet werden.'));
    }
  };

  const register = async (payload) => {
    if (payload.age < 18) {
      throw new Error('Registrierung erst ab 18 Jahren.');
    }

    await withTimeout(moderatePreAuthAction({
      actionType: 'register_attempt',
      email: payload.email.trim().toLowerCase(),
      nickname: payload.nickname.trim(),
      metadata: {
        age: payload.age,
        ageVerified: Boolean(payload.ageVerified),
        selfieVerified: Boolean(payload.selfieVerified),
      },
    }), 5000, 'Die Sicherheitspruefung vor der Registrierung hat zu lange gedauert. Bitte versuche es erneut.');

    try {
      const normalizedEmail = payload.email.trim().toLowerCase();
      const credentials = await withTimeout(
        createUserWithEmailAndPassword(auth, normalizedEmail, payload.password),
        15000,
        'Die Registrierung hat beim Anlegen des Kontos zu lange gedauert. Bitte prüfe Netzwerk und Firebase-Konfiguration.'
      );

      try {
        await withTimeout(
          ensureNicknameAvailable(payload.nickname, credentials.user.uid),
          8000,
          'Die Pruefung deines Spitznamens hat zu lange gedauert. Bitte versuche es erneut.'
        );
      } catch (error) {
        await withTimeout(
          deleteUser(credentials.user).catch(async () => {
            await trySignOut();
          }),
          8000,
          'Das neu angelegte Konto konnte nach dem fehlgeschlagenen Spitznamen-Check nicht rechtzeitig bereinigt werden.'
        ).catch(() => undefined);
        throw error;
      }

      const uploadedProfilePhotoUrl = payload.profileImageAsset?.uri
        ? await uploadMediaAsset('profileImages', payload.profileImageAsset, credentials.user.uid)
        : '';
      const profile = buildRegistrationProfile({
        ...payload,
        profileImageUploaded: Boolean(uploadedProfilePhotoUrl || payload.profileImageUploaded),
        profileImageUri: uploadedProfilePhotoUrl || payload.profileImageUri || '',
        profilePhotoUrl: uploadedProfilePhotoUrl || payload.profilePhotoUrl || '',
        profilePhotoVerified: false,
        profilePhotoVerifiedAt: '',
        faceMatchSimilarity: 0,
        profilePhotoAgeMonths: 0,
        verificationState: uploadedProfilePhotoUrl ? 'uploaded' : 'review',
      }, credentials.user.uid);
      const [profileSaved, emailSent] = await Promise.all([
        tryStoreRegistrationProfile(profile, credentials.user.uid),
        trySendVerificationEmail(credentials.user),
      ]);
      await withTimeout(
        trySignOut(),
        5000,
        'Die Registrierung wurde angelegt, aber die Abmeldung danach hat zu lange gedauert.'
      );

      setPendingVerificationId(credentials.user.uid);
      return {
        profile: normalizeUserProfile(profile, credentials.user),
        emailSent,
        profileSaved,
      };
    } catch (error) {
      throw new Error(mapAuthError(error, error?.message || 'Registrierung fehlgeschlagen.'));
    }
  };

  const verifyPendingEmail = async () => {
    if (!auth.currentUser) {
      return false;
    }

    await reload(auth.currentUser);
    if (auth.currentUser.emailVerified) {
      await syncCurrentUserFromFirebase(auth.currentUser);
      setPendingVerificationId(null);
      return true;
    }

    return false;
  };

  const resendVerificationEmail = async ({ email, password }) => {
    const normalizedEmail = await resolveAuthEmail(email);

    if (!password) {
      throw new Error('Bitte gib dein Passwort ein, damit wir die Verifizierungs-Mail erneut senden können.');
    }

    try {
      const credentials = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      await reload(credentials.user);

      if (credentials.user.emailVerified) {
        await trySignOut();
        return { alreadyVerified: true };
      }

      const emailSent = await trySendVerificationEmail(credentials.user);
      await trySignOut();

      if (!emailSent) {
        throw new Error('Die Verifizierungs-Mail konnte nicht gesendet werden. Bitte prüfe die Firebase-E-Mail-Vorlagen und versuche es erneut.');
      }

      return { alreadyVerified: false };
    } catch (error) {
      throw new Error(mapAuthError(error, error?.message || 'Verifizierungs-Mail konnte nicht erneut gesendet werden.'));
    }
  };

  const completeOnboarding = async ({ preferences, taboos }) => {
    const latestCurrentUser = currentUserRef.current;
    const nextUser = {
      ...latestCurrentUser,
      preferences,
      taboos,
      onboardingCompleted: true,
      searchActive: true,
    };

    setCurrentUser(nextUser);

    Promise.all([
      persistCurrentUserPatch({ preferences, taboos, onboardingCompleted: true, searchActive: true }),
      deviceLocation ? publishLiveLocation(deviceLocation, nextUser) : Promise.resolve([]),
    ]).catch((error) => {
      console.warn('AffairGo onboarding persist warning', error);
    });

    return nextUser;
  };

  const updateCurrentUser = async (patch) => {
    const latestCurrentUser = currentUserRef.current;
    const nextPatch = { ...patch };
    delete nextPatch.password;
    delete nextPatch.repeatPassword;
    delete nextPatch.forcePasswordChange;

    if ('searchAgeMin' in nextPatch || 'searchAgeMax' in nextPatch) {
      const normalizedAgeRange = normalizeSearchAgeRange({
        searchAgeMin: nextPatch.searchAgeMin ?? latestCurrentUser.searchAgeMin,
        searchAgeMax: nextPatch.searchAgeMax ?? latestCurrentUser.searchAgeMax,
      }, latestCurrentUser);
      nextPatch.searchAgeMin = normalizedAgeRange.searchAgeMin;
      nextPatch.searchAgeMax = normalizedAgeRange.searchAgeMax;
    }

    if ('searchGenders' in nextPatch) {
      nextPatch.searchGenders = getSearchGenders(nextPatch, latestCurrentUser.searchGenders);
    }

    if ('verifiedMatchesOnly' in nextPatch) {
      nextPatch.verifiedMatchesOnly = Boolean(nextPatch.verifiedMatchesOnly);
    }

    if ('preferences' in nextPatch) {
      nextPatch.preferences = normalizeOptionList(nextPatch.preferences, PREFERENCE_OPTIONS, latestCurrentUser.preferences);

      if (hasCompletedPreferenceSetup({ preferences: nextPatch.preferences })) {
        nextPatch.onboardingCompleted = true;
      }
    }

    if ('taboos' in nextPatch) {
      nextPatch.taboos = normalizeOptionList(nextPatch.taboos, TABOO_OPTIONS, latestCurrentUser.taboos);
    }

    const requestedEmail = typeof nextPatch.email === 'string' ? nextPatch.email.trim().toLowerCase() : null;
    delete nextPatch.email;

    const requestedNickname = typeof nextPatch.nickname === 'string' ? nextPatch.nickname.trim() : null;
    delete nextPatch.nickname;

    if (requestedNickname && requestedNickname !== latestCurrentUser.nickname) {
      await ensureNicknameAvailable(requestedNickname, auth.currentUser?.uid || latestCurrentUser.id);
      nextPatch.pendingNickname = requestedNickname;
    }

    const nextCurrentUser = { ...latestCurrentUser, ...nextPatch };

    setCurrentUser(nextCurrentUser);

    await Promise.all([
      persistCurrentUserPatch(nextPatch),
      ('searchActive' in nextPatch) && deviceLocation
        ? publishLiveLocation(deviceLocation, nextCurrentUser)
        : Promise.resolve([]),
    ]);

    if (requestedEmail !== null) {
      return requestEmailChange(requestedEmail);
    }

    if (nextPatch.pendingNickname) {
      return { changed: true, pendingNickname: nextPatch.pendingNickname };
    }

    return { changed: false };
  };

  const confirmPendingNickname = async () => {
    const pendingNickname = currentUser.pendingNickname?.trim();

    if (!pendingNickname) {
      return { changed: false };
    }

    await ensureNicknameAvailable(pendingNickname, auth.currentUser?.uid || currentUser.id);
    const nextPatch = {
      nickname: pendingNickname,
      pendingNickname: '',
      nicknameLower: normalizeGermanComparison(pendingNickname),
    };

    setCurrentUser((previous) => ({ ...previous, ...nextPatch }));
    await persistCurrentUserPatch(nextPatch);
    return { changed: true, nickname: pendingNickname };
  };

  const updateProfilePhoto = async (asset) => {
    const ownerId = auth.currentUser?.uid || currentUser.id;

    if (!ownerId || ownerId === 'me') {
      throw new Error('Du musst eingeloggt sein, um dein Profilbild zu verifizieren.');
    }

    if (!hasConfiguredProfilePhotoVerification()) {
      const uploadedProfilePhotoUrl = await uploadMediaAsset('profileImages', asset, ownerId);
      const nextPatch = {
        profilePhotoUrl: uploadedProfilePhotoUrl,
        profileImageUri: uploadedProfilePhotoUrl,
        profilePhotoVerified: false,
        profilePhotoVerifiedAt: '',
        faceMatchSimilarity: 0,
        profilePhotoAgeMonths: 0,
        verificationState: 'uploaded',
      };

      setCurrentUser((previous) => ({ ...previous, ...nextPatch }));
      await persistCurrentUserPatch(nextPatch);

      return {
        directUpload: true,
        ...nextPatch,
      };
    }

    let tempUpload = null;

    try {
      tempUpload = await uploadMediaAssetToStoragePath('tempProfileImages', asset, ownerId);
      const session = await createProfilePhotoLivenessSession({ tempProfileImagePath: tempUpload.storagePath });

      return {
        tempProfileImagePath: tempUpload.storagePath,
        sessionId: session.sessionId,
        verificationToken: session.verificationToken,
        similarityThreshold: session.similarityThreshold,
        awsRegion: session.awsRegion,
      };
    } catch (error) {
      if (tempUpload?.storageRef) {
        await deleteObject(tempUpload.storageRef).catch(() => undefined);
      }

      throw error;
    }
  };

  const completeProfilePhotoVerification = async ({ tempProfileImagePath, sessionId, verificationToken }) => {
    if (!tempProfileImagePath || !sessionId || !verificationToken) {
      throw new Error('Die Profilbild-Verifikation ist unvollständig. Bitte starte den Prozess erneut.');
    }

    const comparisonResult = await getProfilePhotoLivenessResultAndCompare({
      tempProfileImagePath,
      sessionId,
      verificationToken,
    });

    if (comparisonResult?.pending) {
      return {
        approved: false,
        pending: true,
        faceMatchSimilarity: Number(comparisonResult?.faceMatchSimilarity || 0),
        similarityThreshold: Number(comparisonResult?.similarityThreshold || 90),
        message: 'Die Live-Selfie-Analyse wird noch verarbeitet. Bitte schließe die Prüfung in wenigen Sekunden erneut ab.',
      };
    }

    if (!comparisonResult?.approved) {
      await rejectTempProfileImage({
        tempProfileImagePath,
        sessionId,
        verificationToken,
      }).catch(() => undefined);

      return {
        approved: false,
        pending: false,
        failureCode: comparisonResult?.failureCode || 'FACE_MISMATCH',
        faceMatchSimilarity: Number(comparisonResult?.faceMatchSimilarity || 0),
        similarityThreshold: Number(comparisonResult?.similarityThreshold || 90),
        message: PROFILE_VERIFICATION_FAILURE_MESSAGES[comparisonResult?.failureCode] || 'Die Profilbild-Verifikation ist fehlgeschlagen. Das temporäre Bild wurde gelöscht.',
      };
    }

    const approvalResult = await approveVerifiedProfileImage({
      tempProfileImagePath,
      sessionId,
      approvalToken: comparisonResult.approvalToken,
    });

    const nextPatch = {
      profilePhotoUrl: approvalResult.profilePhotoUrl,
      profileImageUri: approvalResult.profilePhotoUrl,
      profilePhotoVerified: true,
      profilePhotoVerifiedAt: approvalResult.profilePhotoVerifiedAt || new Date().toISOString(),
      faceMatchSimilarity: Number(approvalResult.faceMatchSimilarity || 0),
      profilePhotoAgeMonths: 0,
      verificationState: 'verified',
    };

    setCurrentUser((previous) => ({ ...previous, ...nextPatch }));
    await persistCurrentUserPatch(nextPatch);

    return {
      approved: true,
      ...nextPatch,
      similarityThreshold: Number(comparisonResult?.similarityThreshold || 90),
    };
  };

  const discardPendingProfilePhotoVerification = async ({ tempProfileImagePath, sessionId, verificationToken }) => {
    if (!tempProfileImagePath || !sessionId || !verificationToken) {
      return { deleted: false };
    }

    return rejectTempProfileImage({
      tempProfileImagePath,
      sessionId,
      verificationToken,
    });
  };

  const launchProfilePhotoLivenessFlow = async ({ sessionId, verificationToken }) => openFaceLivenessFlow({
    sessionId,
    verificationToken,
  });

  const exportMyData = async () => {
    const exportedAt = new Date().toISOString();
    const exportPayload = {
      exportedAt,
      profile: currentUser,
      chats,
      featureIdeas,
      swipeHistory,
      dismissedProfiles,
      events: events.filter((event) => event.organizerId === currentUser.id || (event.attendeeIds || []).includes(currentUser.id)),
    };

    await persistCurrentUserPatch({ dataExportRequestedAt: exportedAt });
    setCurrentUser((previous) => ({ ...previous, dataExportRequestedAt: exportedAt }));
    return JSON.stringify(exportPayload, null, 2);
  };

  const requestAccountDeletion = async () => {
    const requestedAt = new Date().toISOString();
    const nextPatch = {
      accountDeletionRequestedAt: requestedAt,
      searchActive: false,
    };

    setCurrentUser((previous) => ({ ...previous, ...nextPatch }));
    await persistCurrentUserPatch(nextPatch);
    return requestedAt;
  };

  const addGalleryItem = async (asset) => {
    let nextGallery = currentUser.gallery;
    const ownerId = auth.currentUser?.uid || currentUser.id;
    const imageUri = asset ? await uploadMediaAsset('gallery-images', asset, ownerId) : '';

    setCurrentUser((previous) => {
      if (previous.gallery.length >= 10) {
        return previous;
      }

      nextGallery = [
        ...previous.gallery,
        {
          id: `gallery-${Date.now()}`,
          label: `Bild ${previous.gallery.length + 1}`,
          ageLabel: 'Gerade hochgeladen',
          imageUri,
        },
      ];

      return {
        ...previous,
        gallery: nextGallery,
      };
    });

    if (nextGallery !== currentUser.gallery) {
      await persistCurrentUserPatch({ gallery: nextGallery });
    }
  };

  const saveTravelPlan = async (mode, payload) => {
    const nextEntry = normalizeTravelPlanEntry({
      ...payload,
      id: payload.id || `travel-${Date.now()}`,
    });

    validateTravelPlanEntry(nextEntry);

    const currentPlansForMode = currentUser.travelPlans[mode] || [];
    const existingIndex = currentPlansForMode.findIndex((entry) => entry.id === nextEntry.id);
    const nextPlansForMode = existingIndex >= 0
      ? currentPlansForMode.map((entry) => (entry.id === nextEntry.id ? nextEntry : entry))
      : [nextEntry, ...currentPlansForMode];
    const nextTravelPlans = normalizeTravelPlans({
      ...currentUser.travelPlans,
      [mode]: nextPlansForMode,
    });

    setCurrentUser((previous) => ({
      ...previous,
      travelPlans: nextTravelPlans,
    }));

    await persistCurrentUserPatch({ travelPlans: nextTravelPlans });
  };

  const deleteTravelPlan = async (mode, planId) => {
    const nextTravelPlans = normalizeTravelPlans({
      ...currentUser.travelPlans,
      [mode]: (currentUser.travelPlans[mode] || []).filter((entry) => entry.id !== planId),
    });

    setCurrentUser((previous) => ({
      ...previous,
      travelPlans: nextTravelPlans,
    }));

    await persistCurrentUserPatch({ travelPlans: nextTravelPlans });
  };

  const respondToSwipe = async (profileId, action) => {
    if (swipeLimitReached) {
      throw new Error('Swipes sind derzeit kostenfrei und unbegrenzt freigeschaltet. Bitte versuche es direkt erneut.');
    }

    await moderateAuthenticatedAction({
      actionType: 'respond_swipe',
      targetUserId: profileId,
      metadata: { swipeAction: action },
    });

    const nextSwipeHistory = [...swipeHistory, { profileId, action }];
    const nextDismissedProfiles = [...dismissedProfiles, profileId];

    setSwipeHistory(nextSwipeHistory);
    setDismissedProfiles(nextDismissedProfiles);
    persistCurrentUserPatch({ swipeHistory: nextSwipeHistory, dismissedProfileIds: nextDismissedProfiles }).catch((error) => {
      console.warn('AffairGo swipe persist warning', error);
    });

    if (action === 'dismiss') {
      setMutualDismissState(profileId, true);
    }

    if (action === 'like') {
      const existingChat = chats.find((chat) => chat.userId === profileId);
      if (!existingChat) {
        const nextChats = [
          {
            id: `c${Date.now()}`,
            userId: profileId,
            match: true,
            inactivityDays: 0,
            messages: [
              { id: `m${Date.now()}`, from: profileId, text: 'Match! Lass uns direkt entspannt starten.', time: 'Jetzt' },
            ],
          },
          ...chats,
        ];
        setChats(nextChats);
        persistCurrentUserPatch({ chats: nextChats }).catch((error) => {
          console.warn('AffairGo chat bootstrap persist warning', error);
        });
      }
    }
  };

  const rewindLastSwipe = () => {
    if (!swipeHistory.length) {
      return false;
    }
    const lastSwipe = swipeHistory[swipeHistory.length - 1];
    const nextSwipeHistory = swipeHistory.slice(0, -1);
    const nextDismissedProfiles = dismissedProfiles.filter((id, index) => id !== lastSwipe.profileId || index !== dismissedProfiles.lastIndexOf(lastSwipe.profileId));
    setSwipeHistory(nextSwipeHistory);
    setDismissedProfiles(nextDismissedProfiles);
    persistCurrentUserPatch({ swipeHistory: nextSwipeHistory, dismissedProfileIds: nextDismissedProfiles }).catch((error) => {
      console.warn('AffairGo swipe rewind persist warning', error);
    });

    if (lastSwipe.action === 'dismiss') {
      setMutualDismissState(lastSwipe.profileId, false);
    }

    return true;
  };

  const sendMessage = async (userId, text) => {
    if (!text.trim()) {
      return;
    }

    await moderateAuthenticatedAction({
      actionType: 'send_message',
      targetUserId: userId,
      content: text.trim(),
      metadata: { textLength: text.trim().length },
    });

    const existing = chats.find((chat) => chat.userId === userId);
    const nextChats = !existing
      ? [
          {
            id: `c${Date.now()}`,
            userId,
            match: true,
            inactivityDays: 0,
            messages: [{ id: `m${Date.now()}`, from: 'me', text: text.trim(), time: 'Jetzt' }],
          },
          ...chats,
        ]
      : chats.map((chat) =>
          chat.userId === userId
            ? {
                ...chat,
                inactivityDays: 0,
                messages: [...chat.messages, { id: `m${Date.now()}`, from: 'me', text: text.trim(), time: 'Jetzt' }],
              }
            : chat
        );

    setChats(nextChats);
    persistCurrentUserPatch({ chats: nextChats }).catch((error) => {
      console.warn('AffairGo chat persist warning', error);
    });
  };

  const softBlock = async (userId, reason = 'user_block') => {
    await moderateAuthenticatedAction({
      actionType: 'soft_block',
      targetUserId: userId,
      metadata: { reason },
    });

    const nextChats = chats.filter((chat) => chat.userId !== userId);
    setChats(nextChats);
    setDismissedProfiles((previous) => [...previous, userId]);
    persistCurrentUserPatch({ chats: nextChats }).catch((error) => {
      console.warn('AffairGo soft block persist warning', error);
    });
    setMutualDismissState(userId, true);
  };

  const createEvent = async (payload) => {
    if (payload.verifiedOnly && (!currentUser.verified || !currentUser.searchActive)) {
      throw new Error('Verifizierte Events kannst du erst anlegen, wenn dein Profil geprüft ist und deine Suche aktiv ist.');
    }

    await moderateAuthenticatedAction({
      actionType: 'create_event',
      content: `${payload.title || ''}\n${payload.description || ''}\n${payload.address || ''}`,
      metadata: {
        category: payload.category || '',
        verifiedOnly: Boolean(payload.verifiedOnly),
        maxParticipants: Number(payload.maxParticipants) || 20,
      },
    });

    const travelReferenceCity = getTravelMatchForAddress(currentUser, payload.address);
    const ownerId = auth.currentUser?.uid || currentUser.id;
    const uploadedEventImageUri = payload.imageUri ? await uploadMediaAsset('event-images', payload.imageUri, ownerId) : null;
    const nextEvent = {
      id: `e${Date.now()}`,
      title: payload.title,
      category: payload.category || '',
      date: payload.date,
      time: payload.time,
      address: payload.address,
      distanceKm: 0,
      travelReferenceCity,
      organizerId: currentUser.id,
      attendeeIds: [currentUser.id],
      participants: {
        total: 1,
        women: currentUser.gender === 'weiblich' ? 1 : 0,
        men: currentUser.gender === 'männlich' ? 1 : 0,
        divers: currentUser.gender === 'divers' ? 1 : 0,
      },
      maxParticipants: Number(payload.maxParticipants) || 20,
      verifiedOnly: payload.verifiedOnly,
      description: payload.description,
      imageUri: uploadedEventImageUri,
      imageLabel: travelReferenceCity ? 'Travel Meetup' : 'New',
    };
    setEvents((previous) => [nextEvent, ...previous]);
    persistStoredEvent(nextEvent).catch((error) => {
      console.warn('AffairGo event persist warning', error);
    });
    return nextEvent;
  };

  const registerForEvent = async (eventId) => {
    const targetEvent = events.find((event) => event.id === eventId);

    if (!targetEvent) {
      throw new Error('Das Event wurde nicht gefunden.');
    }

    if (!currentUser.verified || !currentUser.searchActive) {
      throw new Error('Für Events musst du verifiziert sein und deine Sichtbarkeit über die aktive Suche eingeschaltet haben.');
    }

    if (targetEvent.verifiedOnly && (!currentUser.verified || !currentUser.searchActive)) {
      throw new Error('Für dieses Event musst du verifiziert sein und aktiv suchen.');
    }

    if ((targetEvent.attendeeIds || []).includes(currentUser.id)) {
      return false;
    }

    if (Number(targetEvent.participants?.total || 0) >= Number(targetEvent.maxParticipants || 0)) {
      throw new Error('Dieses Event ist bereits ausgebucht.');
    }

    await moderateAuthenticatedAction({
      actionType: 'join_event',
      targetUserId: targetEvent.organizerId,
      content: targetEvent.title,
      metadata: { eventId, verifiedOnly: Boolean(targetEvent.verifiedOnly) },
    });

    const nextEvents = events.map((event) => {
      if (event.id !== eventId) {
        return event;
      }

      return {
        ...event,
        attendeeIds: [...(event.attendeeIds || []), currentUser.id],
        participants: {
          total: Math.min(event.maxParticipants, event.participants.total + 1),
          women: event.participants.women + (currentUser.gender === 'weiblich' ? 1 : 0),
          men: event.participants.men + (currentUser.gender === 'männlich' ? 1 : 0),
          divers: event.participants.divers + (currentUser.gender === 'divers' ? 1 : 0),
        },
      };
    });

    setEvents(nextEvents);
    persistStoredEvent(nextEvents.find((event) => event.id === eventId)).catch((error) => {
      console.warn('AffairGo event registration persist warning', error);
    });

    return true;
  };

  const submitFeatureIdea = async (title) => {
    if (!title.trim()) {
      return;
    }

    await moderateAuthenticatedAction({
      actionType: 'submit_feature_idea',
      content: title.trim(),
      metadata: { textLength: title.trim().length, reviewOnly: true },
    });

    const nextIdea = createFeatureIdeaEntry({
      title,
      submitterId: auth.currentUser?.uid || currentUser.id,
      submitterNickname: currentUser.nickname,
    });
    const nextFeatureIdeas = [nextIdea, ...featureIdeas];
    setFeatureIdeas(nextFeatureIdeas);
    persistStoredFeatureIdea(nextIdea).catch((error) => {
      console.warn('AffairGo feature idea persist warning', error);
    });
  };

  const approveFeatureIdea = async (ideaId) => {
    if (!currentUser.isAdmin) {
      throw new Error('Nur Admins können Feature-Ideen freigeben.');
    }

    const targetIdea = featureIdeas.find((idea) => idea.id === ideaId);

    if (!targetIdea) {
      throw new Error('Die Idee wurde nicht gefunden.');
    }

    if (targetIdea.status === 'approved') {
      return targetIdea;
    }

    const approvedIdea = {
      ...targetIdea,
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: currentUser.nickname || currentUser.id,
    };

    const nextFeatureIdeas = featureIdeas.map((idea) => (idea.id === ideaId ? approvedIdea : idea));
    setFeatureIdeas(nextFeatureIdeas);
    await persistStoredFeatureIdea(approvedIdea);

    if (targetIdea.submitterId) {
      const submitterRef = doc(db, 'users', targetIdea.submitterId);
      const submitterSnapshot = await getDoc(submitterRef);
      const submitterData = submitterSnapshot.exists() ? submitterSnapshot.data() : { id: targetIdea.submitterId };
      const rewardLog = Array.isArray(submitterData.rewardLog) ? submitterData.rewardLog : [];
      const nextPoints = Number.isFinite(Number(submitterData.points)) ? Number(submitterData.points) + 25 : 25;
      const rewardEntry = {
        id: `reward-${ideaId}`,
        label: targetIdea.reward,
        type: 'feature_idea_approved',
        grantedAt: approvedIdea.approvedAt,
      };

      await setDoc(submitterRef, {
        points: nextPoints,
        rewardLog: [rewardEntry, ...rewardLog],
        premiumTrialActive: false,
        premiumTrialEndsAt: '',
      }, { merge: true });

      if (targetIdea.submitterId === (auth.currentUser?.uid || currentUser.id)) {
        setCurrentUser((previous) => ({
          ...previous,
          points: nextPoints,
          rewardLog: [rewardEntry, ...(Array.isArray(previous.rewardLog) ? previous.rewardLog : [])],
          premiumTrialActive: false,
          premiumTrialEndsAt: '',
        }));
      }
    }

    return approvedIdea;
  };

  const activatePlan = async (planConfig) => {
    const resolvedPlan = typeof planConfig === 'string' ? { membership: planConfig } : (planConfig || {});
    const membership = FREE_ACCESS_MEMBERSHIP;
    const nextPatch = {
      membership,
      verifiedMatchesOnly: Boolean(currentUser.verifiedMatchesOnly),
      premiumTrialActive: false,
      premiumTrialEndsAt: '',
      billingCycle: 'free',
      planPriceLabel: FREE_ACCESS_STATUS_LABEL,
      goldDiscountPackage: false,
    };

    setCurrentUser((previous) => ({ ...previous, ...nextPatch }));
    await persistCurrentUserPatch(nextPatch);
  };

  const purchasePlan = async ({ plan, paymentMethod }) => {
    const resolvedPlan = typeof plan === 'string' ? { membership: plan } : (plan || {});

    const checkoutResult = await startPurchaseFlow({
      plan: { membership: FREE_ACCESS_MEMBERSHIP },
      paymentMethod,
      customer: {
        id: auth.currentUser?.uid || currentUser.id,
        email: currentUser.email,
        nickname: currentUser.nickname,
      },
    });

    const nextPatch = {
      membership: FREE_ACCESS_MEMBERSHIP,
      verifiedMatchesOnly: Boolean(currentUser.verifiedMatchesOnly),
      premiumTrialActive: false,
      premiumTrialEndsAt: '',
      billingCycle: 'free',
      planPriceLabel: FREE_ACCESS_STATUS_LABEL,
      goldDiscountPackage: false,
    };

    setCurrentUser((previous) => ({ ...previous, ...nextPatch }));
    await persistCurrentUserPatch(nextPatch);
    return {
      purchaseEntry: null,
      checkoutResult,
    };
  };

  const accessStatusLabel = useMemo(() => {
    return FREE_ACCESS_STATUS_LABEL;
  }, []);

  const playGame = async ({ reward, gameId = '', gameTitle = '', outcome = '' }) => {
    const normalizedReward = Number.isFinite(Number(reward)) ? Number(reward) : 0;
    const rewardEntry = {
      id: `game-${gameId || 'reward'}-${Date.now()}`,
      type: 'game_reward',
      gameId,
      label: gameTitle || 'Spielbelohnung',
      outcome,
      points: normalizedReward,
      grantedAt: new Date().toISOString(),
    };

    const nextPoints = currentUser.points + normalizedReward;
    const nextRewardLog = [rewardEntry, ...(Array.isArray(currentUser.rewardLog) ? currentUser.rewardLog : [])].slice(0, 25);
    setCurrentUser((previous) => ({
      ...previous,
      points: previous.points + normalizedReward,
      rewardLog: [rewardEntry, ...(Array.isArray(previous.rewardLog) ? previous.rewardLog : [])].slice(0, 25),
    }));
    await persistCurrentUserPatch({ points: nextPoints, rewardLog: nextRewardLog });
    return rewardEntry;
  };

  const reportUser = async ({ targetUserId, reason, description = '', evidence = [] }) => {
    if (!targetUserId) {
      throw new Error('Es fehlt ein Zielprofil fuer die Meldung.');
    }

    if (!reason?.trim()) {
      throw new Error('Bitte gib einen Meldegrund an.');
    }

    let outcome;

    try {
      outcome = hasConfiguredModerationBackend()
        ? await submitModerationReport({
            reporterId: auth.currentUser?.uid || currentUser.id,
            reporterEmail: currentUser.email,
            targetUserId,
            reason: reason.trim(),
            description: description.trim(),
            evidence,
          })
        : {
            status: 'queued',
            provider: 'local-fallback',
            referenceId: `report-${Date.now()}`,
            message: 'Meldung lokal vorgemerkt. Hinterlege fuer die echte Bearbeitung dein Moderations-Backend in .env.local.',
          };
    } catch (error) {
      outcome = {
        status: 'queued',
        provider: 'local-fallback',
        referenceId: `report-${Date.now()}`,
        message: error.message || 'Meldung lokal vorgemerkt.',
      };
    }

    const entry = createModerationAuditEntry({
      actionType: 'report_user',
      outcome: outcome.status || 'queued',
      reason: reason.trim(),
      targetUserId,
      provider: outcome.provider || getModerationProviderLabel(),
      auditId: outcome.referenceId || '',
      severity: 'warning',
      flags: ['user_report'],
      metadata: {
        descriptionLength: description.trim().length,
        evidenceCount: Array.isArray(evidence) ? evidence.length : 0,
      },
    });

    await persistModerationAuditEntry(entry, { moderationState: 'review' });
    return outcome;
  };

  const value = {
    isAuthenticated,
    currentUser,
    users,
    events,
    chats,
    featureIdeas,
    currentRadius,
    photoAgeFilter,
    isAuthReady,
    visibleProfiles,
    matchedProfiles,
    nearbyOnlineProfiles,
    visibleMapEvents,
    selectedProfile,
    remainingSwipes,
    swipeLimitReached,
    accessStatusLabel,
    lastLocationSyncLabel,
    moderationBackendConfigured: hasConfiguredModerationBackend(),
    paymentBackendConfigured: hasConfiguredPaymentBackend(),
    paymentProviderLabel: getPaymentProviderLabel(),
    paymentSetupInstructions: getPaymentSetupInstructions(),
    moderationAuditTrail: currentUser.moderationAuditTrail,
    moderationFlags: currentUser.moderationFlags,
    deviceLocation,
    mapCenterCoordinates,
    locationPermissionGranted,
    locationError,
    pendingVerificationId,
    exploreCities: EXPLORE_CITIES,
    preferenceOptions: PREFERENCE_OPTIONS,
    tabooOptions: TABOO_OPTIONS,
    login,
    logout,
    register,
    verifyPendingEmail,
    resendVerificationEmail,
    requestPasswordReset,
    changePassword,
    requestEmailChange,
    confirmPendingNickname,
    updateProfilePhoto,
    completeProfilePhotoVerification,
    discardPendingProfilePhotoVerification,
    launchProfilePhotoLivenessFlow,
    profilePhotoVerificationConfigured: hasConfiguredProfilePhotoVerification(),
    profilePhotoVerificationSetupInstructions: getProfilePhotoVerificationSetupInstructions(),
    exportMyData,
    requestAccountDeletion,
    completeOnboarding,
    updateCurrentUser,
    addGalleryItem,
    saveTravelPlan,
    deleteTravelPlan,
    respondToSwipe,
    rewindLastSwipe,
    sendMessage,
    softBlock,
    createEvent,
    registerForEvent,
    reportUser,
    checkNicknameAvailability,
    submitFeatureIdea,
    approveFeatureIdea,
    activatePlan,
    purchasePlan,
    playGame,
    requestLiveLocationAccess,
    setSelectedProfileId,
    setCurrentRadius,
    setPhotoAgeFilter,
    getCompatibility,
    getProfileTravelSummary,
  };

  return <AffairGoContext.Provider value={value}>{children}</AffairGoContext.Provider>;
};

export const useAffairGo = () => {
  const context = useContext(AffairGoContext);
  if (!context) {
    throw new Error('useAffairGo muss innerhalb des Providers verwendet werden.');
  }
  return context;
};
import * as Location from 'expo-location';
import {
    EmailAuthProvider,
    createUserWithEmailAndPassword,
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
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    query,
    serverTimestamp,
    setDoc,
    where
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { getModerationProviderLabel, hasConfiguredModerationBackend, submitModerationDecision, submitModerationReport } from '../constants/moderationProvider';
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
    SKIN_OPTIONS,
    TABOO_OPTIONS,
    VISIBILITY_OPTIONS,
} from '../data/mockData';
import { auth, db, storage } from '../firebase';

const AffairGoContext = createContext(null);
const BASIC_SWIPE_LIMIT = 10;
const LIVE_LOCATION_INTERVAL_MS = 8000;
const MAX_MODERATION_AUDIT_TRAIL_ENTRIES = 40;

const clone = (value) => JSON.parse(JSON.stringify(value));

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
  onboardingCompleted: false,
  searchActive: false,
  invisibleMode: false,
  forcePasswordChange: false,
  dismissedProfileIds: [],
  membership: 'basic',
  premiumTrialActive: false,
  premiumTrialEndsAt: '',
  billingCycle: 'monthly',
  planPriceLabel: '',
  goldDiscountPackage: false,
  purchaseHistory: [],
  points: 0,
  joinedLabel: 'Neu',
  profileImageUri: '',
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

const normalizeGermanComparison = (value = '') => String(value)
  .trim()
  .toLowerCase()
  .replaceAll('ä', 'ae')
  .replaceAll('ö', 'oe')
  .replaceAll('ü', 'ue')
  .replaceAll('ß', 'ss');

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

const getProfileTravelSummary = (profile) => {
  const normalizedTravelPlans = normalizeTravelPlans(profile.travelPlans);
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
  const normalizedTravelPlans = normalizeTravelPlans(profile.travelPlans);

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
  const resolvedTravelPlans = normalizeTravelPlans(profile.travelPlans);

  return {
    ...defaults,
    ...profile,
    id: profile.id || firebaseUser?.uid || defaults.id,
    email: profile.email || firebaseUser?.email || defaults.email,
    gender: normalizeOptionValue(profile.gender, GENDER_OPTIONS, defaults.gender),
    figure: normalizeOptionValue(profile.figure, FIGURE_OPTIONS, defaults.figure),
    hairColor: normalizeOptionValue(profile.hairColor, HAIR_OPTIONS, defaults.hairColor),
    eyeColor: normalizeOptionValue(profile.eyeColor, EYE_OPTIONS, defaults.eyeColor),
    skinType: normalizeOptionValue(profile.skinType, SKIN_OPTIONS, defaults.skinType),
    emailVerified: firebaseUser?.emailVerified ?? profile.emailVerified ?? false,
    pendingEmail: profile.pendingEmail || '',
    pendingNickname: profile.pendingNickname || '',
    ageVerified: profile.ageVerified ?? Boolean(profile.age >= 18),
    ageVerificationStatus: profile.ageVerificationStatus || (profile.age >= 18 ? 'verified' : 'not_started'),
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
    moderationState: profile.moderationState || defaults.moderationState,
    moderationFlags: normalizeTextList(profile.moderationFlags),
    moderationLastCheckedAt: profile.moderationLastCheckedAt || '',
    moderationRateLimitUntil: profile.moderationRateLimitUntil || '',
    moderationAuditTrail: Array.isArray(profile.moderationAuditTrail) ? profile.moderationAuditTrail : [],
    verified: profile.verified ?? Boolean(profile.profileImageUploaded),
    invisibleMode: Boolean(profile.invisibleMode),
    dismissedProfileIds: normalizeIdList(profile.dismissedProfileIds),
    premiumTrialActive: Boolean(profile.premiumTrialActive),
    premiumTrialEndsAt: profile.premiumTrialEndsAt || '',
    billingCycle: profile.billingCycle || defaults.billingCycle,
    planPriceLabel: profile.planPriceLabel || '',
    goldDiscountPackage: Boolean(profile.goldDiscountPackage),
    purchaseHistory: Array.isArray(profile.purchaseHistory) ? profile.purchaseHistory : defaults.purchaseHistory,
    gallery: Array.isArray(profile.gallery) ? profile.gallery : defaults.gallery,
    profileImageUri: profile.profileImageUri || '',
    accountDeletionRequestedAt: profile.accountDeletionRequestedAt || '',
    dataExportRequestedAt: profile.dataExportRequestedAt || '',
    latitude: Number.isFinite(Number(profile.latitude)) ? Number(profile.latitude) : defaults.latitude,
    longitude: Number.isFinite(Number(profile.longitude)) ? Number(profile.longitude) : defaults.longitude,
    preferences: normalizeOptionList(profile.preferences, PREFERENCE_OPTIONS, defaults.preferences),
    taboos: normalizeOptionList(profile.taboos, TABOO_OPTIONS, defaults.taboos),
    travelPlans: resolvedTravelPlans,
    forcePasswordChange: Boolean(profile.forcePasswordChange),
  };
};

const toStoredProfile = (profile) => {
  const sanitized = { ...profile };
  delete sanitized.password;
  delete sanitized.repeatPassword;

  return {
    ...sanitized,
    gender: normalizeOptionValue(profile.gender, GENDER_OPTIONS, profile.gender),
    figure: normalizeOptionValue(profile.figure, FIGURE_OPTIONS, profile.figure),
    hairColor: normalizeOptionValue(profile.hairColor, HAIR_OPTIONS, profile.hairColor),
    eyeColor: normalizeOptionValue(profile.eyeColor, EYE_OPTIONS, profile.eyeColor),
    skinType: normalizeOptionValue(profile.skinType, SKIN_OPTIONS, profile.skinType),
    preferences: normalizeOptionList(profile.preferences, PREFERENCE_OPTIONS, []),
    taboos: normalizeOptionList(profile.taboos, TABOO_OPTIONS, []),
    travelPlans: normalizeTravelPlans(profile.travelPlans),
    dismissedProfileIds: normalizeIdList(profile.dismissedProfileIds),
    invisibleMode: Boolean(profile.invisibleMode),
    premiumTrialActive: Boolean(profile.premiumTrialActive),
    premiumTrialEndsAt: profile.premiumTrialEndsAt || '',
    billingCycle: profile.billingCycle || 'monthly',
    planPriceLabel: profile.planPriceLabel || '',
    goldDiscountPackage: Boolean(profile.goldDiscountPackage),
    purchaseHistory: Array.isArray(profile.purchaseHistory) ? profile.purchaseHistory : [],
    profileImageUri: profile.profileImageUri || '',
    pendingNickname: profile.pendingNickname || '',
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
    moderationState: profile.moderationState || 'clear',
    moderationFlags: normalizeTextList(profile.moderationFlags),
    moderationLastCheckedAt: profile.moderationLastCheckedAt || '',
    moderationRateLimitUntil: profile.moderationRateLimitUntil || '',
    moderationAuditTrail: Array.isArray(profile.moderationAuditTrail) ? profile.moderationAuditTrail : [],
    accountDeletionRequestedAt: profile.accountDeletionRequestedAt || '',
    dataExportRequestedAt: profile.dataExportRequestedAt || '',
    latitude: Number.isFinite(Number(profile.latitude)) ? Number(profile.latitude) : null,
    longitude: Number.isFinite(Number(profile.longitude)) ? Number(profile.longitude) : null,
    nicknameLower: profile.nickname?.trim().toLowerCase() || '',
    updatedAt: serverTimestamp(),
  };
};

const buildRegistrationProfile = (payload, uid) => ({
  id: uid,
  email: payload.email.trim().toLowerCase(),
  nickname: payload.nickname.trim(),
  pendingNickname: '',
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
  profileImageUri: payload.profileImageUri || '',
  profilePhotoAgeMonths: 0,
  gallery: [],
  joinedLabel: 'Heute',
  onboardingCompleted: false,
  membership: 'basic',
  invisibleMode: false,
  premiumTrialActive: false,
  premiumTrialEndsAt: '',
  billingCycle: 'monthly',
  planPriceLabel: '',
  goldDiscountPackage: false,
  purchaseHistory: [],
  searchAgeMin: 25,
  searchAgeMax: 55,
  radius: 25,
  searchActive: false,
  online: true,
  points: 0,
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

const getProfileMotionSeed = (profileId = '') => profileId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);

const simulateProfileLocation = (profile, pulse, observerLocation) => {
  const baseCoordinates = getFallbackLiveLocation(profile);
  const seed = getProfileMotionSeed(profile.id);
  const latitudeOffset = Math.sin((pulse + seed) / 4) * (0.01 + ((seed % 3) * 0.0025));
  const longitudeOffset = Math.cos((pulse + seed) / 5) * (0.014 + ((seed % 4) * 0.0025));
  const nextCoordinates = {
    latitude: roundCoordinate(baseCoordinates.latitude + latitudeOffset),
    longitude: roundCoordinate(baseCoordinates.longitude + longitudeOffset),
  };

  return {
    ...profile,
    latitude: nextCoordinates.latitude,
    longitude: nextCoordinates.longitude,
    distanceKm: Math.max(1, Math.round(calculateDistanceKm(observerLocation, nextCoordinates))),
  };
};

const createPurchaseEntry = ({ membership, paymentMethod, priceLabel, billingCycle }) => ({
  id: `purchase-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  membership,
  paymentMethod,
  priceLabel: priceLabel || '',
  billingCycle: billingCycle || 'monthly',
  purchasedAt: new Date().toLocaleString('de-DE'),
  status: 'aktiv',
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
    case 'auth/user-disabled':
      return 'Dieses Konto wurde deaktiviert.';
    default:
      return fallbackMessage;
  }
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

const persistStoredEvent = async (event) => {
  await setDoc(doc(db, 'events', event.id), {
    ...event,
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

const uploadMediaAsset = async (folder, assetOrUri, ownerId) => {
  const assetUri = typeof assetOrUri === 'string' ? assetOrUri : assetOrUri?.uri;

  if (!assetUri) {
    return '';
  }

  if (/^https?:\/\//i.test(assetUri)) {
    return assetUri;
  }

  const response = await fetch(assetUri);
  const blob = await response.blob();
  const extensionMatch = assetUri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const extension = extensionMatch?.[1] || 'jpg';
  const storageRef = ref(storage, `${folder}/${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`);

  await uploadBytes(storageRef, blob, { contentType: blob.type || 'image/jpeg' });
  return getDownloadURL(storageRef);
};

const ensureNicknameAvailable = async (nickname, excludedUserId = null) => {
  const storedProfile = await findStoredProfileByNickname(nickname);

  if (storedProfile && storedProfile.id !== excludedUserId) {
    throw new Error('Dieser Spitzname ist bereits vergeben. Bitte wähle einen anderen.');
  }
};

const parseHeightToCentimeters = (value) => {
  if (!value) {
    return null;
  }

  const normalizedValue = String(value).trim().replace(',', '.');
  const numericValue = Number.parseFloat(normalizedValue);

  if (Number.isNaN(numericValue)) {
    return null;
  }

  return numericValue <= 3 ? Math.round(numericValue * 100) : Math.round(numericValue);
};

const parseSizeToNumber = (value) => {
  if (!value) {
    return null;
  }

  const match = String(value).replace(',', '.').match(/\d+(?:\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : null;
};

const resolveAuthEmail = async (identifier) => {
  const resolvedProfile = await findStoredProfileByIdentifier(identifier);

  if (resolvedProfile?.email) {
    return resolvedProfile.email;
  }

  throw new Error('Bitte eine gültige E-Mail-Adresse oder einen vorhandenen Spitznamen eingeben.');
};

const getPreferenceCompatibility = (sourcePreferences = [], targetPreferences = []) => {
  const base = sourcePreferences.length || 1;
  const shared = sourcePreferences.filter((entry) => targetPreferences.includes(entry)).length;
  return Math.round((shared / base) * 100);
};

const getBodyDataCompatibility = (sourceProfile = {}, targetProfile = {}) => {
  let points = 0;
  let maxPoints = 0;

  const sourceHeight = parseHeightToCentimeters(sourceProfile.height);
  const targetHeight = parseHeightToCentimeters(targetProfile.height);
  if (sourceHeight && targetHeight) {
    maxPoints += 35;
    const heightDifference = Math.abs(sourceHeight - targetHeight);

    if (heightDifference <= 5) {
      points += 35;
    } else if (heightDifference <= 10) {
      points += 24;
    } else if (heightDifference <= 15) {
      points += 14;
    } else if (heightDifference <= 20) {
      points += 8;
    }
  }

  if (sourceProfile.figure && targetProfile.figure) {
    maxPoints += 30;
    if (sourceProfile.figure === targetProfile.figure) {
      points += 30;
    }
  }

  if (sourceProfile.hairColor && targetProfile.hairColor) {
    maxPoints += 10;
    if (sourceProfile.hairColor === targetProfile.hairColor) {
      points += 10;
    }
  }

  if (sourceProfile.eyeColor && targetProfile.eyeColor) {
    maxPoints += 10;
    if (sourceProfile.eyeColor === targetProfile.eyeColor) {
      points += 10;
    }
  }

  if (sourceProfile.skinType && targetProfile.skinType) {
    maxPoints += 5;
    if (sourceProfile.skinType === targetProfile.skinType) {
      points += 5;
    }
  }

  const sourceBraSize = parseSizeToNumber(sourceProfile.braSize);
  const targetBraSize = parseSizeToNumber(targetProfile.braSize);
  if (sourceBraSize && targetBraSize) {
    maxPoints += 5;
    if (Math.abs(sourceBraSize - targetBraSize) <= 5) {
      points += 5;
    }
  }

  const sourcePenisSize = parseSizeToNumber(sourceProfile.penisSize);
  const targetPenisSize = parseSizeToNumber(targetProfile.penisSize);
  if (sourcePenisSize && targetPenisSize) {
    maxPoints += 5;
    if (Math.abs(sourcePenisSize - targetPenisSize) <= 2) {
      points += 5;
    }
  }

  if (!maxPoints) {
    return null;
  }

  return Math.round((points / maxPoints) * 100);
};

const getCompatibility = (sourceProfileOrPreferences, targetProfileOrPreferences) => {
  if (Array.isArray(sourceProfileOrPreferences) && Array.isArray(targetProfileOrPreferences)) {
    return getPreferenceCompatibility(sourceProfileOrPreferences, targetProfileOrPreferences);
  }

  const sourceProfile = sourceProfileOrPreferences || {};
  const targetProfile = targetProfileOrPreferences || {};
  const preferenceCompatibility = getPreferenceCompatibility(sourceProfile.preferences || [], targetProfile.preferences || []);
  const bodyCompatibility = getBodyDataCompatibility(sourceProfile, targetProfile);

  if (bodyCompatibility === null) {
    return preferenceCompatibility;
  }

  return Math.round((preferenceCompatibility * 0.7) + (bodyCompatibility * 0.3));
};

const isMutualAgeMatch = (currentUser, targetUser) => {
  const userLikesTarget =
    targetUser.age >= currentUser.searchAgeMin && targetUser.age <= currentUser.searchAgeMax;
  const targetLikesUser =
    currentUser.age >= targetUser.searchAgeMin && currentUser.age <= targetUser.searchAgeMax;
  return userLikesTarget && targetLikesUser;
};

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
  const [locationPulse, setLocationPulse] = useState(0);
  const [lastLocationSyncLabel, setLastLocationSyncLabel] = useState('Standort-Sync bereit');
  const [deviceLocation, setDeviceLocation] = useState(null);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [locationError, setLocationError] = useState('');

  const mapCenterCoordinates = useMemo(() => deviceLocation || getFallbackLiveLocation(currentUser), [currentUser, deviceLocation]);

  const syncCurrentUserFromFirebase = async (firebaseUser) => {
    const profileData = await loadStoredProfile(firebaseUser.uid, firebaseUser.email);
    const normalizedProfile = normalizeUserProfile(profileData, firebaseUser);
    const normalizedAuthEmail = firebaseUser.email?.trim().toLowerCase() || '';
    const normalizedStoredEmail = normalizedProfile.email?.trim().toLowerCase() || '';
    const normalizedPendingEmail = normalizedProfile.pendingEmail?.trim().toLowerCase() || '';

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
    }

    setCurrentUser(normalizedProfile);
    setChats(Array.isArray(profileData.chats) ? profileData.chats : []);
    setFeatureIdeas(Array.isArray(profileData.featureIdeas) ? profileData.featureIdeas : []);
    setSwipeHistory(Array.isArray(profileData.swipeHistory) ? profileData.swipeHistory : []);
    setDismissedProfiles(normalizeIdList(profileData.dismissedProfileIds));
    setCurrentRadius(normalizedProfile.radius || INITIAL_CURRENT_USER.radius);
    setIsAuthenticated(true);

    return normalizedProfile;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setIsAuthenticated(false);
        setCurrentUser(createDefaultCurrentUser());
        setPendingVerificationId(null);
        setCurrentRadius(INITIAL_CURRENT_USER.radius);
        setDeviceLocation(null);
        setLocationPermissionGranted(false);
        setLocationError('');
        setIsAuthReady(true);
        return;
      }

      await syncCurrentUserFromFirebase(firebaseUser);
      setIsAuthReady(true);
    });

    return unsubscribe;
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
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        setLocationPermissionGranted(false);
        setLocationError('Standortfreigabe fehlt. Erlaube den Zugriff, damit die Matching Map deinen echten Standort nutzen kann.');
        setLastLocationSyncLabel('Standortfreigabe erforderlich');
        return false;
      }

      const currentPosition = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nextDeviceLocation = {
        latitude: roundCoordinate(currentPosition.coords.latitude),
        longitude: roundCoordinate(currentPosition.coords.longitude),
      };

      setDeviceLocation(nextDeviceLocation);
      setLocationPermissionGranted(true);
      setLocationError('');
      setLastLocationSyncLabel(`GPS aktiv • ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`);
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
    let active = true;

    const startWatcher = async () => {
      const granted = await requestLiveLocationAccess();

      if (!granted || !active) {
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: LIVE_LOCATION_INTERVAL_MS,
          distanceInterval: 30,
        },
        (position) => {
          setDeviceLocation({
            latitude: roundCoordinate(position.coords.latitude),
            longitude: roundCoordinate(position.coords.longitude),
          });
          setLocationPermissionGranted(true);
          setLocationError('');
          setLastLocationSyncLabel(`GPS aktualisiert • ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`);
        }
      );
    };

    startWatcher();

    return () => {
      active = false;
      subscription?.remove?.();
    };
  }, [currentUser.searchActive]);

  useEffect(() => {
    if (!currentUser.searchActive) {
      return undefined;
    }

    const observerLocation = mapCenterCoordinates || DEFAULT_MAP_LOCATION;

    setUsers((existingUsers) => existingUsers.map((profile) => simulateProfileLocation(profile, locationPulse + 1, observerLocation)));

    const intervalId = setInterval(() => {
      setLocationPulse((previous) => {
        const nextPulse = previous + 1;
        setUsers((existingUsers) => existingUsers.map((profile) => simulateProfileLocation(profile, nextPulse, observerLocation)));
        setLastLocationSyncLabel(`Live aktualisiert • ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`);
        return nextPulse;
      });
    }, LIVE_LOCATION_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [currentUser.searchActive, mapCenterCoordinates]);

  const persistCurrentUserPatch = async (patch) => {
    const userId = auth.currentUser?.uid || currentUser.id;

    if (!userId || userId === 'me') {
      return;
    }

    await setDoc(doc(db, 'users', userId), toStoredProfile({ ...currentUser, ...patch }), { merge: true });
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
      if (dismissedProfiles.includes(user.id)) {
        return false;
      }
      if (user.invisibleMode) {
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
      if (!isMutualAgeMatch(currentUser, user)) {
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
  const remainingSwipes = currentUser.membership === 'basic' ? Math.max(0, BASIC_SWIPE_LIMIT - swipesUsed) : null;
  const swipeLimitReached = currentUser.membership === 'basic' && remainingSwipes === 0;

  const nearbyOnlineProfiles = visibleProfiles.filter((profile) => profile.online).slice(0, 3);
  const selectedProfile = users.find((profile) => profile.id === selectedProfileId) || visibleProfiles[0] || users[0];

  const login = async ({ identifier, password }) => {
    const normalizedEmail = await resolveAuthEmail(identifier);

    await moderatePreAuthAction({
      actionType: 'login_attempt',
      email: normalizedEmail,
      identifier,
      metadata: { hasPassword: Boolean(password) },
    });

    try {
      const credentials = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      await reload(credentials.user);

      if (!credentials.user.emailVerified) {
        const resendWorked = await trySendVerificationEmail(credentials.user);
        await trySignOut();
        if (resendWorked) {
          throw new Error('Bitte bestätige zuerst deine E-Mail-Adresse. Wir haben dir soeben erneut eine Verifizierungs-Mail gesendet. Bitte prüfe auch deinen Spam-Ordner.');
        }
        throw new Error('Dein Konto wurde angelegt, aber die Verifizierungs-Mail konnte nicht gesendet werden. Bitte prüfe die Firebase-E-Mail-Vorlagen und versuche es erneut.');
      }

      const profileSnapshot = await getDoc(doc(db, 'users', credentials.user.uid));
      const profileData = profileSnapshot.exists() ? profileSnapshot.data() : { id: credentials.user.uid, email: credentials.user.email };
      const normalizedProfile = normalizeUserProfile(profileData, credentials.user);

      setCurrentUser(normalizedProfile);
      setCurrentRadius(normalizedProfile.radius || INITIAL_CURRENT_USER.radius);
      setIsAuthenticated(true);

      return { requiresPasswordChange: normalizedProfile.forcePasswordChange, needsOnboarding: !normalizedProfile.onboardingCompleted };
    } catch (error) {
      throw new Error(mapAuthError(error, error?.message || 'Login fehlgeschlagen.'));
    }
  };

  const logout = async () => {
    await trySignOut();
    setIsAuthenticated(false);
    setCurrentUser(createDefaultCurrentUser());
  };

  const requestPasswordReset = async (identifier) => {
    const normalizedEmail = await resolveAuthEmail(identifier);

    try {
      await sendPasswordResetEmail(auth, normalizedEmail);

      const storedProfile = await findStoredProfileByEmail(normalizedEmail);
      if (storedProfile?.id) {
        await setDoc(doc(db, 'users', storedProfile.id), { forcePasswordChange: true }, { merge: true });
      }

      return true;
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

    if (!payload.ageVerified || payload.ageVerificationStatus !== 'verified') {
      throw new Error('Bitte schließe zuerst die Altersverifizierung erfolgreich ab.');
    }

    if (!payload.selfieVerified || payload.selfieVerificationStatus !== 'verified') {
      throw new Error('Bitte schließe zuerst den Selfie- und KI-Fake-Check erfolgreich ab.');
    }

    await moderatePreAuthAction({
      actionType: 'register_attempt',
      email: payload.email.trim().toLowerCase(),
      nickname: payload.nickname.trim(),
      metadata: {
        age: payload.age,
        ageVerified: Boolean(payload.ageVerified),
        selfieVerified: Boolean(payload.selfieVerified),
      },
    });

    try {
      await ensureNicknameAvailable(payload.nickname);
      const normalizedEmail = payload.email.trim().toLowerCase();
      const credentials = await withTimeout(
        createUserWithEmailAndPassword(auth, normalizedEmail, payload.password),
        15000,
        'Die Registrierung hat beim Anlegen des Kontos zu lange gedauert. Bitte prüfe Netzwerk und Firebase-Konfiguration.'
      );
      const profile = buildRegistrationProfile(payload, credentials.user.uid);
      const profileSaved = await tryStoreRegistrationProfile(profile, credentials.user.uid);
      const emailSent = await trySendVerificationEmail(credentials.user);
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
    const nextUser = {
      ...currentUser,
      preferences,
      taboos,
      onboardingCompleted: true,
      searchActive: true,
    };

    setCurrentUser(nextUser);

    persistCurrentUserPatch({ preferences, taboos, onboardingCompleted: true, searchActive: true }).catch((error) => {
      console.warn('AffairGo onboarding persist warning', error);
    });

    return nextUser;
  };

  const updateCurrentUser = async (patch) => {
    const nextPatch = { ...patch };
    delete nextPatch.password;
    delete nextPatch.repeatPassword;
    delete nextPatch.forcePasswordChange;

    const requestedEmail = typeof nextPatch.email === 'string' ? nextPatch.email.trim().toLowerCase() : null;
    delete nextPatch.email;

    const requestedNickname = typeof nextPatch.nickname === 'string' ? nextPatch.nickname.trim() : null;
    delete nextPatch.nickname;

    if (requestedNickname && requestedNickname !== currentUser.nickname) {
      await ensureNicknameAvailable(requestedNickname, auth.currentUser?.uid || currentUser.id);
      nextPatch.pendingNickname = requestedNickname;
    }

    if ('invisibleMode' in nextPatch) {
      nextPatch.invisibleMode = currentUser.membership === 'gold' ? Boolean(nextPatch.invisibleMode) : false;
    }

    setCurrentUser((previous) => ({ ...previous, ...nextPatch }));
    await persistCurrentUserPatch(nextPatch);

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
    const profileImageUri = await uploadMediaAsset('profile-images', asset, ownerId);
    const nextPatch = {
      profileImageUri,
      profilePhotoAgeMonths: 0,
      verificationState: 'review',
    };

    setCurrentUser((previous) => ({ ...previous, ...nextPatch }));
    await persistCurrentUserPatch(nextPatch);
    return profileImageUri;
  };

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
      invisibleMode: true,
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
      throw new Error('Dein Basic-Konto hat das Swipe-Limit erreicht. Upgrade auf Premium oder Gold für unbegrenzte Swipes.');
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
    if (currentUser.membership !== 'gold' || !swipeHistory.length) {
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
            match: currentUser.membership === 'gold',
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
    if (currentUser.membership === 'basic') {
      throw new Error('Eigene Events anlegen ist ab Premium verfügbar.');
    }

    if (payload.verifiedOnly && (!currentUser.verified || !currentUser.searchActive)) {
      throw new Error('Verifizierte Events kannst du erst anlegen, wenn dein Profil geprüft ist und deine Suche aktiv ist.');
    }

    await moderateAuthenticatedAction({
      actionType: 'create_event',
      content: `${payload.title || ''}\n${payload.description || ''}\n${payload.address || ''}`,
      metadata: {
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

    const nextIdea = { id: `idea-${Date.now()}`, title: title.trim(), reward: '1 Premium-Tag' };
    const nextFeatureIdeas = [nextIdea, ...featureIdeas];
    const nextPoints = currentUser.points + 5;
    setFeatureIdeas(nextFeatureIdeas);
    setCurrentUser((previous) => ({ ...previous, points: nextPoints }));
    persistCurrentUserPatch({ featureIdeas: nextFeatureIdeas, points: nextPoints }).catch((error) => {
      console.warn('AffairGo feature idea persist warning', error);
    });
  };

  const activatePlan = async (planConfig) => {
    const resolvedPlan = typeof planConfig === 'string' ? { membership: planConfig } : (planConfig || {});
    const membership = resolvedPlan.membership || 'basic';
    const nextPatch = {
      membership,
      invisibleMode: membership === 'gold' ? currentUser.invisibleMode : false,
      premiumTrialActive: membership === 'premium' && Boolean(resolvedPlan.trialDays),
      premiumTrialEndsAt: membership === 'premium' && resolvedPlan.trialDays ? buildFutureDateLabel(resolvedPlan.trialDays) : '',
      billingCycle: resolvedPlan.billingCycle || 'monthly',
      planPriceLabel: resolvedPlan.priceLabel || '',
      goldDiscountPackage: membership === 'gold' && Boolean(resolvedPlan.goldDiscountPackage),
    };

    setCurrentUser((previous) => ({ ...previous, ...nextPatch }));
    await persistCurrentUserPatch(nextPatch);
  };

  const purchasePlan = async ({ plan, paymentMethod }) => {
    const resolvedPlan = typeof plan === 'string' ? { membership: plan } : (plan || {});

    if (!resolvedPlan.membership) {
      throw new Error('Es wurde kein gültiger Tarif für den Kauf ausgewählt.');
    }

    if (!paymentMethod) {
      throw new Error('Bitte wähle Apple, Google oder Stripe als Bezahlweg.');
    }

    const purchaseEntry = createPurchaseEntry({
      membership: resolvedPlan.membership,
      paymentMethod,
      priceLabel: resolvedPlan.priceLabel,
      billingCycle: resolvedPlan.billingCycle,
    });
    const nextPurchaseHistory = [purchaseEntry, ...(currentUser.purchaseHistory || [])];
    const nextPatch = {
      membership: resolvedPlan.membership,
      invisibleMode: resolvedPlan.membership === 'gold' ? currentUser.invisibleMode : false,
      premiumTrialActive: resolvedPlan.membership === 'premium' && Boolean(resolvedPlan.trialDays),
      premiumTrialEndsAt: resolvedPlan.membership === 'premium' && resolvedPlan.trialDays ? buildFutureDateLabel(resolvedPlan.trialDays) : '',
      billingCycle: resolvedPlan.billingCycle || 'monthly',
      planPriceLabel: resolvedPlan.priceLabel || '',
      goldDiscountPackage: resolvedPlan.membership === 'gold' && Boolean(resolvedPlan.goldDiscountPackage),
      purchaseHistory: nextPurchaseHistory,
    };

    setCurrentUser((previous) => ({ ...previous, ...nextPatch }));
    await persistCurrentUserPatch(nextPatch);
    return purchaseEntry;
  };

  const membershipStatusLabel = useMemo(() => {
    if (currentUser.membership === 'premium' && currentUser.premiumTrialActive && currentUser.premiumTrialEndsAt) {
      return `Premium-Testphase bis ${currentUser.premiumTrialEndsAt}`;
    }

    if (currentUser.membership === 'gold' && currentUser.goldDiscountPackage) {
      return `Gold 6 Monate${currentUser.planPriceLabel ? ` • ${currentUser.planPriceLabel}` : ''}`;
    }

    if (currentUser.planPriceLabel) {
      return `${currentUser.membership.toUpperCase()} • ${currentUser.planPriceLabel}`;
    }

    return currentUser.membership.toUpperCase();
  }, [currentUser.goldDiscountPackage, currentUser.membership, currentUser.planPriceLabel, currentUser.premiumTrialActive, currentUser.premiumTrialEndsAt]);

  const playGame = async (reward) => {
    const nextPoints = currentUser.points + reward;
    setCurrentUser((previous) => ({ ...previous, points: previous.points + reward }));
    await persistCurrentUserPatch({ points: nextPoints });
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
    selectedProfile,
    remainingSwipes,
    swipeLimitReached,
    membershipStatusLabel,
    lastLocationSyncLabel,
    moderationBackendConfigured: hasConfiguredModerationBackend(),
    moderationAuditTrail: currentUser.moderationAuditTrail,
    moderationFlags: currentUser.moderationFlags,
    locationPulse,
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
    submitFeatureIdea,
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
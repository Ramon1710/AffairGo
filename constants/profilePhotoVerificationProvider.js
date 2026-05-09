import { httpsCallable } from 'firebase/functions';
import { Linking, Platform } from 'react-native';
import { functions } from '../firebase';

const { expo } = require('../app.json');

const PROFILE_PHOTO_LIVENESS_WEB_URL = (process.env.EXPO_PUBLIC_PROFILE_PHOTO_LIVENESS_WEB_URL || '/api/profile-photo-liveness').trim().replace(/\/$/, '');
const DEFAULT_WEBSITE_URL = (process.env.EXPO_PUBLIC_WEBSITE_URL || expo?.extra?.websiteUrl || '').trim().replace(/\/$/, '');

const looksLikePlaceholder = (value) => !value || /your_|paste_|placeholder/i.test(value);
const isAbsoluteUrl = (value) => /^https?:\/\//i.test(value);

const resolveProfilePhotoLivenessBaseUrl = () => {
  if (looksLikePlaceholder(PROFILE_PHOTO_LIVENESS_WEB_URL)) {
    return '';
  }

  if (isAbsoluteUrl(PROFILE_PHOTO_LIVENESS_WEB_URL)) {
    return PROFILE_PHOTO_LIVENESS_WEB_URL;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return new URL(PROFILE_PHOTO_LIVENESS_WEB_URL, window.location.origin).toString().replace(/\/$/, '');
  }

  if (DEFAULT_WEBSITE_URL) {
    return new URL(PROFILE_PHOTO_LIVENESS_WEB_URL, DEFAULT_WEBSITE_URL).toString().replace(/\/$/, '');
  }

  return '';
};

const callFunction = async (name, payload) => {
  const callable = httpsCallable(functions, name);
  const result = await callable(payload);
  return result.data;
};

export const hasConfiguredProfilePhotoVerification = () => Boolean(resolveProfilePhotoLivenessBaseUrl());

export const getProfilePhotoVerificationSetupInstructions = () => (
  'Setze AWS_COGNITO_IDENTITY_POOL_ID fuer die eingebaute Liveness-Webseite und optional EXPO_PUBLIC_PROFILE_PHOTO_LIVENESS_WEB_URL fuer eine eigene Route. Fuer Mobilgeraete muss die Liveness-Seite ueber eine absolute HTTPS-URL erreichbar sein, z. B. ueber EXPO_PUBLIC_WEBSITE_URL oder die websiteUrl in app.json. CompareFaces und die finale Bildfreigabe laufen weiterhin ausschließlich über Firebase Cloud Functions.'
);

export const createFaceLivenessSession = async ({ tempProfileImagePath }) => callFunction('createFaceLivenessSession', {
  tempProfileImagePath,
});

export const getFaceLivenessResultAndCompareProfileImage = async ({ sessionId, tempProfileImagePath, verificationToken }) => callFunction('getFaceLivenessResultAndCompareProfileImage', {
  sessionId,
  tempProfileImagePath,
  verificationToken,
});

export const approveProfileImage = async ({ sessionId, tempProfileImagePath, approvalToken }) => callFunction('approveProfileImage', {
  sessionId,
  tempProfileImagePath,
  approvalToken,
});

export const rejectAndDeleteTempProfileImage = async ({ sessionId, tempProfileImagePath, verificationToken }) => callFunction('rejectAndDeleteTempProfileImage', {
  sessionId,
  tempProfileImagePath,
  verificationToken,
});

export const buildFaceLivenessUrl = ({ sessionId, verificationToken }) => {
  const baseUrl = resolveProfilePhotoLivenessBaseUrl();

  if (!baseUrl) {
    return '';
  }

  const query = new URLSearchParams({ sessionId, verificationToken });
  return `${baseUrl}?${query.toString()}`;
};

export const openFaceLivenessFlow = async ({ sessionId, verificationToken }) => {
  const url = buildFaceLivenessUrl({ sessionId, verificationToken });

  if (!url) {
    throw new Error(getProfilePhotoVerificationSetupInstructions());
  }

  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return url;
  }

  await Linking.openURL(url);
  return url;
};
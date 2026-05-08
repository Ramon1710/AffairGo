import { httpsCallable } from 'firebase/functions';
import { Linking, Platform } from 'react-native';
import { functions } from '../firebase';

const PROFILE_PHOTO_LIVENESS_WEB_URL = (process.env.EXPO_PUBLIC_PROFILE_PHOTO_LIVENESS_WEB_URL || '/api/profile-photo-liveness').trim().replace(/\/$/, '');

const looksLikePlaceholder = (value) => !value || /your_|paste_|placeholder/i.test(value);

const callFunction = async (name, payload) => {
  const callable = httpsCallable(functions, name);
  const result = await callable(payload);
  return result.data;
};

export const hasConfiguredProfilePhotoVerification = () => !looksLikePlaceholder(PROFILE_PHOTO_LIVENESS_WEB_URL);

export const getProfilePhotoVerificationSetupInstructions = () => (
  'Setze AWS_COGNITO_IDENTITY_POOL_ID fuer die eingebaute Liveness-Webseite und optional EXPO_PUBLIC_PROFILE_PHOTO_LIVENESS_WEB_URL fuer eine eigene Route. CompareFaces und die finale Bildfreigabe laufen weiterhin ausschließlich über Firebase Cloud Functions.'
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
  if (!hasConfiguredProfilePhotoVerification()) {
    return '';
  }

  const query = new URLSearchParams({ sessionId, verificationToken });
  return `${PROFILE_PHOTO_LIVENESS_WEB_URL}?${query.toString()}`;
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
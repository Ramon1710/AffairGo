const SELFIE_VERIFICATION_PROVIDER = (process.env.EXPO_PUBLIC_SELFIE_VERIFICATION_PROVIDER || 'custom').trim();
const SELFIE_VERIFICATION_BASE_URL = (process.env.EXPO_PUBLIC_SELFIE_VERIFICATION_BASE_URL || '/api/selfie-ai').trim().replace(/\/$/, '');
const SELFIE_VERIFICATION_PUBLIC_TOKEN = (process.env.EXPO_PUBLIC_SELFIE_VERIFICATION_PUBLIC_TOKEN || '').trim();

const looksLikePlaceholder = (value) => !value || /your_|paste_|placeholder/i.test(value);

const toUploadPart = (asset, fallbackName) => ({
  uri: asset.uri,
  name: asset.fileName || fallbackName,
  type: asset.mimeType || asset.type || 'image/jpeg',
});

export const hasConfiguredSelfieVerification = () => !looksLikePlaceholder(SELFIE_VERIFICATION_BASE_URL);

export const getSelfieVerificationProviderLabel = () => {
  if (SELFIE_VERIFICATION_PROVIDER === 'custom') {
    return 'Custom Selfie AI Backend';
  }

  return SELFIE_VERIFICATION_PROVIDER;
};

export const getSelfieVerificationSetupInstructions = () => {
  return 'Setze in .env.local EXPO_PUBLIC_SELFIE_VERIFICATION_BASE_URL und optional EXPO_PUBLIC_SELFIE_VERIFICATION_PUBLIC_TOKEN fuer deinen Selfie-/Liveness-Anbieter oder dein Backend. Das Backend muss verify-selfie und delete-selfie bereitstellen.';
};

const confirmSelfieDeletion = async ({ referenceId, email, nickname }) => {
  const response = await fetch(`${SELFIE_VERIFICATION_BASE_URL}/delete-selfie`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SELFIE_VERIFICATION_PUBLIC_TOKEN ? { 'x-public-token': SELFIE_VERIFICATION_PUBLIC_TOKEN } : {}),
    },
    body: JSON.stringify({ referenceId, email: email || '', nickname: nickname || '' }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || 'Das Backend hat die Loeschung des Selfies nach der Verifizierung nicht bestaetigt.');
  }

  return {
    assetsDeleted: Boolean(payload.assetsDeleted ?? true),
    deletionConfirmedAt: payload.deletionConfirmedAt || new Date().toISOString(),
    deletionReceiptId: payload.deletionReceiptId || `delete-${referenceId || Date.now()}`,
    retentionPolicy: payload.retentionPolicy || 'verification-assets-deleted-after-check',
  };
};

export const submitSelfieVerification = async ({ profileImageAsset, selfieAsset, email, nickname }) => {
  if (!hasConfiguredSelfieVerification()) {
    throw new Error('Der Selfie- und KI-Fake-Check ist noch nicht konfiguriert. Trage den Anbieter oder dein Backend in .env.local ein.');
  }

  if (!profileImageAsset?.uri || !selfieAsset?.uri) {
    throw new Error('Bitte lade zuerst ein Profilbild und ein Live-Selfie hoch.');
  }

  const formData = new FormData();
  formData.append('profileImage', toUploadPart(profileImageAsset, 'profile.jpg'));
  formData.append('selfieImage', toUploadPart(selfieAsset, 'selfie.jpg'));
  formData.append('email', email || '');
  formData.append('nickname', nickname || '');

  const response = await fetch(`${SELFIE_VERIFICATION_BASE_URL}/verify-selfie`, {
    method: 'POST',
    headers: SELFIE_VERIFICATION_PUBLIC_TOKEN ? { 'x-public-token': SELFIE_VERIFICATION_PUBLIC_TOKEN } : undefined,
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || 'Der Selfie- und KI-Fake-Check konnte nicht abgeschlossen werden.');
  }

  const status = payload.status || (payload.verified ? 'verified' : 'pending');
  const livenessScore = Number(payload.livenessScore ?? payload.liveScore ?? 0);
  const fakeScore = Number(payload.fakeScore ?? payload.spoofScore ?? payload.deepfakeScore ?? 0);
  const referenceId = payload.referenceId || payload.verificationId || '';
  const verified = Boolean(
    payload.verified ||
    status === 'verified' ||
    status === 'approved' ||
    (payload.livenessPassed && !payload.fakeDetected)
  );

  let deletionContract = {
    assetsDeleted: Boolean(payload.assetsDeleted ?? false),
    deletionConfirmedAt: payload.deletionConfirmedAt || '',
    deletionReceiptId: payload.deletionReceiptId || '',
    retentionPolicy: payload.retentionPolicy || '',
  };

  if (verified && referenceId) {
    deletionContract = await confirmSelfieDeletion({ referenceId, email, nickname });
  }

  return {
    verified,
    status,
    provider: payload.provider || SELFIE_VERIFICATION_PROVIDER,
    referenceId,
    checkedAt: payload.checkedAt || new Date().toISOString(),
    livenessPassed: Boolean(payload.livenessPassed ?? verified),
    fakeDetected: Boolean(payload.fakeDetected ?? false),
    livenessScore: Number.isFinite(livenessScore) ? livenessScore : 0,
    fakeScore: Number.isFinite(fakeScore) ? fakeScore : 0,
    assetsDeleted: deletionContract.assetsDeleted,
    deletionConfirmedAt: deletionContract.deletionConfirmedAt,
    deletionReceiptId: deletionContract.deletionReceiptId,
    retentionPolicy: deletionContract.retentionPolicy,
  };
};
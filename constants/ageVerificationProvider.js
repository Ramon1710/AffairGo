const AGE_VERIFICATION_PROVIDER = (process.env.EXPO_PUBLIC_AGE_VERIFICATION_PROVIDER || 'custom').trim();
const AGE_VERIFICATION_BASE_URL = (process.env.EXPO_PUBLIC_AGE_VERIFICATION_BASE_URL || '').trim().replace(/\/$/, '');
const AGE_VERIFICATION_PUBLIC_TOKEN = (process.env.EXPO_PUBLIC_AGE_VERIFICATION_PUBLIC_TOKEN || '').trim();

const looksLikePlaceholder = (value) => !value || /your_|paste_|placeholder/i.test(value);

const toUploadPart = (asset, fallbackName) => ({
  uri: asset.uri,
  name: asset.fileName || fallbackName,
  type: asset.mimeType || asset.type || 'image/jpeg',
});

export const hasConfiguredAgeVerification = () => !looksLikePlaceholder(AGE_VERIFICATION_BASE_URL);

export const getAgeVerificationProviderLabel = () => {
  if (AGE_VERIFICATION_PROVIDER === 'custom') {
    return 'Custom KYC Backend';
  }

  return AGE_VERIFICATION_PROVIDER;
};

export const getAgeVerificationSetupInstructions = () => {
  return 'Setze in .env.local EXPO_PUBLIC_AGE_VERIFICATION_BASE_URL und optional EXPO_PUBLIC_AGE_VERIFICATION_PUBLIC_TOKEN für deinen Verifikationsanbieter oder dein Backend.';
};

export const submitAgeVerification = async ({ documentAsset, selfieAsset, birthDateLabel, email, nickname }) => {
  if (!hasConfiguredAgeVerification()) {
    throw new Error('Die Altersverifizierung ist noch nicht konfiguriert. Trage den Provider oder dein Backend in .env.local ein.');
  }

  if (!documentAsset?.uri || !selfieAsset?.uri) {
    throw new Error('Bitte lade ein Ausweisdokument und ein aktuelles Selfie hoch.');
  }

  const formData = new FormData();
  formData.append('documentImage', toUploadPart(documentAsset, 'document.jpg'));
  formData.append('selfieImage', toUploadPart(selfieAsset, 'selfie.jpg'));
  formData.append('birthDateLabel', birthDateLabel || '');
  formData.append('email', email || '');
  formData.append('nickname', nickname || '');

  const response = await fetch(`${AGE_VERIFICATION_BASE_URL}/verify-age`, {
    method: 'POST',
    headers: AGE_VERIFICATION_PUBLIC_TOKEN ? { 'x-public-token': AGE_VERIFICATION_PUBLIC_TOKEN } : undefined,
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || 'Die Altersverifizierung konnte nicht abgeschlossen werden.');
  }

  const status = payload.status || (payload.verified ? 'verified' : 'pending');

  return {
    verified: Boolean(payload.verified || status === 'verified' || status === 'approved'),
    status,
    provider: payload.provider || AGE_VERIFICATION_PROVIDER,
    referenceId: payload.referenceId || payload.verificationId || '',
    checkedAt: payload.checkedAt || new Date().toISOString(),
    minimumAgeVerified: Boolean(payload.minimumAgeVerified ?? payload.verified ?? false),
  };
};
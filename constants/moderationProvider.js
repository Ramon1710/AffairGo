const MODERATION_PROVIDER = (process.env.EXPO_PUBLIC_MODERATION_PROVIDER || 'custom').trim();
const MODERATION_BASE_URL = (process.env.EXPO_PUBLIC_MODERATION_BASE_URL || '').trim().replace(/\/$/, '');
const MODERATION_PUBLIC_TOKEN = (process.env.EXPO_PUBLIC_MODERATION_PUBLIC_TOKEN || '').trim();

const looksLikePlaceholder = (value) => !value || /your_|paste_|placeholder/i.test(value);

const postModerationRequest = async (path, payload) => {
  const response = await fetch(`${MODERATION_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(MODERATION_PUBLIC_TOKEN ? { 'x-public-token': MODERATION_PUBLIC_TOKEN } : {}),
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Die Moderationspruefung konnte nicht abgeschlossen werden.');
  }

  return data;
};

export const hasConfiguredModerationBackend = () => !looksLikePlaceholder(MODERATION_BASE_URL);

export const getModerationProviderLabel = () => {
  if (MODERATION_PROVIDER === 'custom') {
    return 'Custom Moderation Backend';
  }

  return MODERATION_PROVIDER;
};

export const getModerationSetupInstructions = () => {
  return 'Setze in .env.local EXPO_PUBLIC_MODERATION_BASE_URL und optional EXPO_PUBLIC_MODERATION_PUBLIC_TOKEN fuer dein Abuse-, Moderations- und Fraud-Backend.';
};

export const submitModerationDecision = async (payload) => {
  if (!hasConfiguredModerationBackend()) {
    throw new Error('Das Moderations-Backend ist noch nicht konfiguriert. Trage den Anbieter oder dein Backend in .env.local ein.');
  }

  const data = await postModerationRequest('/moderate-action', payload);
  const status = data.status || (data.allow === false ? 'blocked' : 'allowed');

  return {
    allow: data.allow !== false && !data.blocked,
    status,
    message: data.message || '',
    provider: data.provider || MODERATION_PROVIDER,
    auditId: data.auditId || data.referenceId || '',
    flags: Array.isArray(data.flags) ? data.flags.filter(Boolean) : [],
    riskLevel: data.riskLevel || 'low',
    rateLimited: Boolean(data.rateLimited),
    rateLimitUntil: data.rateLimitUntil || '',
    fraudScore: Number.isFinite(Number(data.fraudScore)) ? Number(data.fraudScore) : 0,
  };
};

export const submitModerationReport = async (payload) => {
  if (!hasConfiguredModerationBackend()) {
    throw new Error('Das Moderations-Backend ist noch nicht konfiguriert. Trage den Anbieter oder dein Backend in .env.local ein.');
  }

  const data = await postModerationRequest('/reports', payload);

  return {
    status: data.status || 'queued',
    provider: data.provider || MODERATION_PROVIDER,
    referenceId: data.referenceId || data.reportId || '',
    message: data.message || '',
  };
};
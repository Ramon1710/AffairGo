const PASSWORD_RESET_BASE_URL = (process.env.EXPO_PUBLIC_PASSWORD_RESET_BASE_URL || '/api/auth').trim().replace(/\/$/, '');

export const requestManagedPasswordReset = async ({ email }) => {
  const response = await fetch(`${PASSWORD_RESET_BASE_URL}/password-reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || 'Der verwaltete Passwort-Reset konnte nicht gestartet werden.');
  }

  return {
    handled: Boolean(payload.handled),
    mode: payload.mode || 'firebase-reset-link',
    message: payload.message || '',
    temporaryPasswordIssued: Boolean(payload.temporaryPasswordIssued),
  };
};
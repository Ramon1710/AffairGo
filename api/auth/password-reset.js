const crypto = require('crypto');

const PASSWORD_RESET_WEBHOOK_URL = (process.env.NIGHT_WHISPER_PASSWORD_RESET_WEBHOOK_URL || process.env.AFFAIRGO_PASSWORD_RESET_WEBHOOK_URL || '').trim();

const readJsonBody = async (req) => {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
};

const createTemporaryPassword = () => crypto.randomBytes(6).toString('base64url');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const email = String(payload.email || '').trim().toLowerCase();

    if (!email || !email.includes('@')) {
      res.status(400).json({ message: 'Es fehlt eine gültige E-Mail-Adresse.' });
      return;
    }

    if (!PASSWORD_RESET_WEBHOOK_URL) {
      res.status(200).json({
        handled: false,
        mode: 'firebase-reset-link',
        message: 'Kein Passwort-Reset-Webhook konfiguriert. Der Client nutzt den Firebase-Reset-Link als Fallback.',
      });
      return;
    }

    const temporaryPassword = createTemporaryPassword();
    const webhookResponse = await fetch(PASSWORD_RESET_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        temporaryPassword,
        requirePasswordChange: true,
      }),
    });

    const webhookPayload = await webhookResponse.json().catch(() => ({}));

    if (!webhookResponse.ok) {
      res.status(502).json({
        message: webhookPayload?.message || 'Der Passwort-Reset-Webhook hat die Anfrage abgelehnt.',
      });
      return;
    }

    res.status(200).json({
      handled: true,
      mode: 'temporary-password-email',
      temporaryPasswordIssued: true,
      message: webhookPayload?.message || 'Ein temporäres Passwort wurde erzeugt und an den Mail-Workflow übergeben.',
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Passwort-Reset konnte nicht verarbeitet werden.' });
  }
};
const readJsonBody = async (req) => {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-public-token');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const payload = await readJsonBody(req);

  if (!payload.plan?.membership) {
    res.status(400).json({ message: 'Es fehlt ein gültiger Tarif.' });
    return;
  }

  res.status(200).json({
    status: 'disabled',
    checkoutUrl: '',
    purchaseId: '',
    provider: 'Night-Whisper Payments Disabled',
    message: 'Zahlungen sind derzeit deaktiviert. Night-Whisper bleibt bis Anfang 2027 kostenfrei verfügbar.',
  });
};
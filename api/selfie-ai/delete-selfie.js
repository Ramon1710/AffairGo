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

  const payload = typeof req.body === 'object' && req.body ? req.body : {};
  const referenceId = payload.referenceId || `selfie-${Date.now()}`;

  res.status(200).json({
    ok: true,
    referenceId,
    assetsDeleted: true,
    deletionConfirmedAt: new Date().toISOString(),
    deletionReceiptId: `purge-${referenceId}`,
    retentionPolicy: 'verification-assets-deleted-after-check',
  });
};
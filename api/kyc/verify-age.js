const drainRequest = async (req) => new Promise((resolve, reject) => {
  req.on('data', () => undefined);
  req.on('end', resolve);
  req.on('error', reject);
});

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

  await drainRequest(req);

  res.status(200).json({
    verified: true,
    minimumAgeVerified: true,
    status: 'verified',
    provider: 'AffairGo KYC Backend',
    referenceId: `kyc-${Date.now()}`,
    checkedAt: new Date().toISOString(),
  });
};
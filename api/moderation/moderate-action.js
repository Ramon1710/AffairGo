const readJsonBody = async (req) => {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
};

const BLOCK_PATTERNS = [
  /spam/i,
  /scam/i,
  /betrug/i,
  /fake/i,
  /underage/i,
  /minderjähr/i,
];

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
  const inspectedText = [payload.content, payload.identifier, payload.actorNickname, payload.actorEmail]
    .filter(Boolean)
    .join(' ');
  const matchedFlag = BLOCK_PATTERNS.find((pattern) => pattern.test(inspectedText));

  if (matchedFlag) {
    res.status(200).json({
      allow: false,
      blocked: true,
      status: 'blocked',
      provider: 'AffairGo Moderation Backend',
      message: 'Die Anfrage wurde durch die Sicherheitsprüfung blockiert.',
      auditId: `moderation-${Date.now()}`,
      flags: ['policy_match'],
      riskLevel: 'high',
      rateLimited: false,
      fraudScore: 95,
    });
    return;
  }

  res.status(200).json({
    allow: true,
    status: payload.metadata?.reviewOnly ? 'review' : 'allowed',
    provider: 'AffairGo Moderation Backend',
    message: payload.metadata?.reviewOnly ? 'Die Anfrage wurde zur Prüfung vorgemerkt.' : 'Anfrage erlaubt.',
    auditId: `moderation-${Date.now()}`,
    flags: payload.metadata?.reviewOnly ? ['review_only'] : [],
    riskLevel: 'low',
    rateLimited: false,
    fraudScore: 2,
  });
};
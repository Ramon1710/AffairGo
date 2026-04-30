const readJsonBody = async (req) => {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
};

const getCheckoutUrl = (paymentMethod) => {
  if (/stripe/i.test(paymentMethod)) {
    return (process.env.EXPO_PUBLIC_STRIPE_CHECKOUT_URL || '').trim();
  }

  if (/apple/i.test(paymentMethod)) {
    return (process.env.EXPO_PUBLIC_APPLE_STORE_URL || '').trim();
  }

  if (/google/i.test(paymentMethod)) {
    return (process.env.EXPO_PUBLIC_GOOGLE_PLAY_URL || '').trim();
  }

  return '';
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
  const checkoutUrl = getCheckoutUrl(payload.paymentMethod || '');

  if (!payload.plan?.membership) {
    res.status(400).json({ message: 'Es fehlt ein gültiger Tarif.' });
    return;
  }

  if (!payload.paymentMethod) {
    res.status(400).json({ message: 'Es fehlt ein Zahlungsweg.' });
    return;
  }

  res.status(200).json({
    status: checkoutUrl ? 'pending' : 'demo_activated',
    checkoutUrl,
    purchaseId: `purchase-${Date.now()}`,
    provider: checkoutUrl ? 'AffairGo Billing Backend' : 'AffairGo Billing Demo',
  });
};
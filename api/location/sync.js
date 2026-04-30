const LOCATION_TTL_MS = 45000;

const getLocationStore = () => {
  if (!globalThis.__AFFAIRGO_LIVE_LOCATION_STORE__) {
    globalThis.__AFFAIRGO_LIVE_LOCATION_STORE__ = new Map();
  }

  return globalThis.__AFFAIRGO_LIVE_LOCATION_STORE__;
};

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

const listActiveLocations = () => {
  const store = getLocationStore();
  const now = Date.now();

  for (const [userId, entry] of store.entries()) {
    if (!entry || (now - entry.timestamp) > LOCATION_TTL_MS) {
      store.delete(userId);
    }
  }

  return Array.from(store.values())
    .filter((entry) => entry.searchActive !== false)
    .sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0));
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({ locations: listActiveLocations() });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const userId = String(payload.userId || '').trim();
    const latitude = Number(payload.latitude);
    const longitude = Number(payload.longitude);

    if (!userId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      res.status(400).json({ message: 'userId, latitude und longitude sind erforderlich.' });
      return;
    }

    const timestamp = Date.now();
    getLocationStore().set(userId, {
      userId,
      nickname: payload.nickname || '',
      membership: payload.membership || 'basic',
      searchActive: payload.searchActive !== false,
      online: payload.online !== false,
      latitude,
      longitude,
      timestamp,
      syncedAt: new Date(timestamp).toISOString(),
    });

    res.status(200).json({
      ok: true,
      locations: listActiveLocations(),
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Live-Standort konnte nicht verarbeitet werden.' });
  }
};
const GEOHASH_ALPHABET = '0123456789bcdefghjkmnpqrstuvwxyz';
const DEFAULT_GEOHASH_PRECISION = 8;

const DATE_CITY_CATALOG = Object.freeze({
  amsterdam: { latitude: 52.3676, longitude: 4.9041, label: 'Amsterdam' },
  berlin: { latitude: 52.52, longitude: 13.405, label: 'Berlin' },
  bonn: { latitude: 50.7374, longitude: 7.0982, label: 'Bonn' },
  duesseldorf: { latitude: 51.2277, longitude: 6.7735, label: 'Düsseldorf' },
  hamburg: { latitude: 53.5511, longitude: 9.9937, label: 'Hamburg' },
  koeln: { latitude: 50.9375, longitude: 6.9603, label: 'Köln' },
  leverkusen: { latitude: 51.0459, longitude: 7.0192, label: 'Leverkusen' },
  muenchen: { latitude: 48.1351, longitude: 11.582, label: 'München' },
  pulheim: { latitude: 50.9996, longitude: 6.8062, label: 'Pulheim' },
  westerland: { latitude: 54.9079, longitude: 8.3033, label: 'Westerland' },
  wien: { latitude: 48.2082, longitude: 16.3738, label: 'Wien' },
});

const normalizeOptionalString = (value) => (typeof value === 'string' ? value.trim() : '');
const roundCoordinate = (value) => Number(Number(value).toFixed(5));

const normalizeGermanComparison = (value = '') => String(value || '')
  .trim()
  .toLowerCase()
  .replaceAll('ä', 'ae')
  .replaceAll('ö', 'oe')
  .replaceAll('ü', 'ue')
  .replaceAll('ß', 'ss');

const stripLeadingPostalCode = (value = '') => String(value || '').trim().replace(/^\d{4,5}\s+/, '').trim();

const encodeGeohash = (latitude, longitude, precision = DEFAULT_GEOHASH_PRECISION) => {
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
    return '';
  }

  let latRange = [-90, 90];
  let lngRange = [-180, 180];
  let hash = '';
  let bit = 0;
  let ch = 0;
  let evenBit = true;

  while (hash.length < precision) {
    if (evenBit) {
      const midpoint = (lngRange[0] + lngRange[1]) / 2;
      if (longitude >= midpoint) {
        ch |= 1 << (4 - bit);
        lngRange[0] = midpoint;
      } else {
        lngRange[1] = midpoint;
      }
    } else {
      const midpoint = (latRange[0] + latRange[1]) / 2;
      if (latitude >= midpoint) {
        ch |= 1 << (4 - bit);
        latRange[0] = midpoint;
      } else {
        latRange[1] = midpoint;
      }
    }

    evenBit = !evenBit;

    if (bit < 4) {
      bit += 1;
    } else {
      hash += GEOHASH_ALPHABET[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
};

const resolveCatalogCity = (locationQuery = '') => {
  const trimmedQuery = normalizeOptionalString(locationQuery);
  const withoutPostalCode = stripLeadingPostalCode(trimmedQuery);
  const normalizedCandidates = [trimmedQuery, withoutPostalCode]
    .map((value) => normalizeGermanComparison(value))
    .filter(Boolean);

  for (const candidate of normalizedCandidates) {
    if (DATE_CITY_CATALOG[candidate]) {
      return DATE_CITY_CATALOG[candidate];
    }
  }

  return null;
};

const resolveStoredDateCoordinate = (dateEntry = {}) => {
  const latitude = Number(dateEntry?.coordinate?.latitude);
  const longitude = Number(dateEntry?.coordinate?.longitude);

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return {
      latitude: roundCoordinate(latitude),
      longitude: roundCoordinate(longitude),
    };
  }

  const catalogCity = resolveCatalogCity(dateEntry.cityLabel || dateEntry.regionLabel || dateEntry.locationQuery || '');

  if (!catalogCity) {
    return null;
  }

  return {
    latitude: roundCoordinate(catalogCity.latitude),
    longitude: roundCoordinate(catalogCity.longitude),
  };
};

const resolveViewerCoordinate = (user = {}) => {
  const latitude = Number(user?.latitude);
  const longitude = Number(user?.longitude);

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return {
      latitude: roundCoordinate(latitude),
      longitude: roundCoordinate(longitude),
    };
  }

  const catalogCity = resolveCatalogCity(user?.city || '');

  if (!catalogCity) {
    return null;
  }

  return {
    latitude: roundCoordinate(catalogCity.latitude),
    longitude: roundCoordinate(catalogCity.longitude),
  };
};

const toRadians = (value) => (value * Math.PI) / 180;

const calculateDistanceKm = (origin, target) => {
  if (!origin || !target) {
    return null;
  }

  const earthRadiusKm = 6371;
  const deltaLatitude = toRadians(target.latitude - origin.latitude);
  const deltaLongitude = toRadians(target.longitude - origin.longitude);
  const startLatitude = toRadians(origin.latitude);
  const targetLatitude = toRadians(target.latitude);
  const haversine =
    (Math.sin(deltaLatitude / 2) ** 2) +
    (Math.cos(startLatitude) * Math.cos(targetLatitude) * (Math.sin(deltaLongitude / 2) ** 2));

  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
};

const mapDateDistance = (dateEntry = {}, viewer = {}) => {
  const viewerCoordinate = resolveViewerCoordinate(viewer);
  const dateCoordinate = resolveStoredDateCoordinate(dateEntry);

  if (!viewerCoordinate || !dateCoordinate) {
    return null;
  }

  const distanceKm = calculateDistanceKm(viewerCoordinate, dateCoordinate);
  return Number.isFinite(distanceKm) ? Math.max(1, Math.round(distanceKm)) : null;
};

const filterNearbyDates = (dates = [], { currentUser = {}, radiusKm = 25, nowMs = Date.now() } = {}) => {
  const normalizedRadius = Number(radiusKm);
  const maxRadius = Number.isFinite(normalizedRadius) ? normalizedRadius : 25;

  return (Array.isArray(dates) ? dates : [])
    .filter((entry) => String(entry?.status || 'active') === 'active')
    .filter((entry) => Number(entry?.scheduledAtMs || 0) > nowMs)
    .map((entry) => {
      const distanceKm = mapDateDistance(entry, currentUser);
      return {
        ...entry,
        distanceKm,
      };
    })
    .filter((entry) => entry.distanceKm == null || entry.distanceKm <= maxRadius)
    .sort((left, right) => {
      const leftScheduledAt = Number(left?.scheduledAtMs || 0);
      const rightScheduledAt = Number(right?.scheduledAtMs || 0);

      if (leftScheduledAt !== rightScheduledAt) {
        return leftScheduledAt - rightScheduledAt;
      }

      return Number(left?.distanceKm || Number.MAX_SAFE_INTEGER) - Number(right?.distanceKm || Number.MAX_SAFE_INTEGER);
    });
};

module.exports = {
  DATE_CITY_CATALOG,
  calculateDistanceKm,
  encodeGeohash,
  filterNearbyDates,
  mapDateDistance,
  normalizeGermanComparison,
  resolveCatalogCity,
  resolveStoredDateCoordinate,
  resolveViewerCoordinate,
  stripLeadingPostalCode,
};
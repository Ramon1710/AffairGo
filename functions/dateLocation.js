const { HttpsError } = require('firebase-functions/v2/https');

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

const sanitizeOptionalText = (value, fieldName, maxLength) => {
  const normalizedValue = normalizeOptionalString(value);

  if (!normalizedValue) {
    return '';
  }

  if (normalizedValue.length > maxLength) {
    throw new HttpsError('invalid-argument', `${fieldName} ist zu lang.`);
  }

  return normalizedValue;
};

const sanitizeRequiredText = (value, fieldName, { min = 1, max = 120 } = {}) => {
  const normalizedValue = normalizeOptionalString(value);

  if (!normalizedValue) {
    throw new HttpsError('invalid-argument', `${fieldName} ist erforderlich.`);
  }

  if (normalizedValue.length < min) {
    throw new HttpsError('invalid-argument', `${fieldName} ist zu kurz.`);
  }

  if (normalizedValue.length > max) {
    throw new HttpsError('invalid-argument', `${fieldName} ist zu lang.`);
  }

  return normalizedValue;
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

const resolveDateLocation = ({ locationQuery, publicPlaceLabel = '' } = {}) => {
  const normalizedQuery = sanitizeRequiredText(locationQuery, 'Ort oder Stadt', { min: 2, max: 120 });
  const normalizedPublicPlaceLabel = sanitizeOptionalText(publicPlaceLabel, 'Öffentliche Ortsbezeichnung', 120);
  const isPostalOnlyQuery = /^\d{4,5}$/.test(normalizedQuery);

  if (isPostalOnlyQuery) {
    throw new HttpsError('invalid-argument', 'Eine PLZ allein kann derzeit noch nicht serverseitig aufgelöst werden. Bitte ergänze einen bekannten Ortsnamen.');
  }

  const city = resolveCatalogCity(normalizedQuery);

  if (!city) {
    throw new HttpsError('invalid-argument', 'Der Date-Ort konnte serverseitig noch nicht aufgelöst werden. Aktuell werden nur bekannte Städte aus der bestehenden Matching-Map unterstützt.');
  }

  const coordinate = {
    latitude: roundCoordinate(city.latitude),
    longitude: roundCoordinate(city.longitude),
  };
  const regionLabel = normalizedPublicPlaceLabel ? `${normalizedPublicPlaceLabel}, ${city.label}` : city.label;

  return {
    locationQuery: normalizedQuery,
    publicPlaceLabel: normalizedPublicPlaceLabel,
    cityLabel: city.label,
    regionLabel,
    coordinate,
    geohash: encodeGeohash(coordinate.latitude, coordinate.longitude),
    locationResolution: 'city_catalog',
  };
};

module.exports = {
  DATE_CITY_CATALOG,
  encodeGeohash,
  normalizeGermanComparison,
  resolveDateLocation,
  resolveCatalogCity,
  stripLeadingPostalCode,
};
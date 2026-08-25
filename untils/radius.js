import { RADIUS_OPTIONS } from '../data/mockData.js';

const SORTED_RADIUS_OPTIONS = Array.from(new Set(
  (Array.isArray(RADIUS_OPTIONS) ? RADIUS_OPTIONS : [])
    .map((radius) => Number(radius))
    .filter((radius) => Number.isFinite(radius) && radius > 0)
)).sort((left, right) => left - right);

export const getDefaultRadiusKm = () => (SORTED_RADIUS_OPTIONS.includes(25) ? 25 : (SORTED_RADIUS_OPTIONS[0] || 25));

export const getAllowedRadiusOptions = () => [...SORTED_RADIUS_OPTIONS];

export const normalizeRadiusKm = (value, fallback = getDefaultRadiusKm()) => {
  const normalizedFallback = SORTED_RADIUS_OPTIONS.includes(Number(fallback))
    ? Number(fallback)
    : getDefaultRadiusKm();

  if (value === null || value === undefined) {
    return normalizedFallback;
  }

  if (typeof value === 'string' && !value.trim()) {
    return normalizedFallback;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return normalizedFallback;
  }

  if (SORTED_RADIUS_OPTIONS.includes(numericValue)) {
    return numericValue;
  }

  const nextAllowedRadius = SORTED_RADIUS_OPTIONS.find((radius) => numericValue <= radius);

  return nextAllowedRadius || SORTED_RADIUS_OPTIONS[SORTED_RADIUS_OPTIONS.length - 1] || normalizedFallback;
};

export const formatRadiusKm = (value, fallback = getDefaultRadiusKm()) => `${normalizeRadiusKm(value, fallback)} km`;
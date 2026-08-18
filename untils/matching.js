const parseHeightToCentimeters = (value) => {
  if (!value) {
    return null;
  }

  const normalizedValue = String(value).trim().replace(',', '.');
  const numericValue = Number.parseFloat(normalizedValue);

  if (Number.isNaN(numericValue)) {
    return null;
  }

  return numericValue <= 3 ? Math.round(numericValue * 100) : Math.round(numericValue);
};

const parseSizeToNumber = (value) => {
  if (!value) {
    return null;
  }

  const match = String(value).replace(',', '.').match(/\d+(?:\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : null;
};

const normalizeMatchingList = (values = []) => {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values
    .filter((entry) => typeof entry === 'string' && entry.trim())
    .map((entry) => entry.trim()))];
};

const getSharedPreferences = (sourcePreferences = [], targetPreferences = []) => {
  const normalizedSource = normalizeMatchingList(sourcePreferences);
  const normalizedTargetSet = new Set(normalizeMatchingList(targetPreferences));

  return normalizedSource.filter((entry) => normalizedTargetSet.has(entry));
};

const getSharedPreferenceCount = (sourcePreferences = [], targetPreferences = []) => getSharedPreferences(sourcePreferences, targetPreferences).length;

const hasPreferenceTabooConflict = (sourceProfile = {}, targetProfile = {}) => {
  const sourcePreferences = normalizeMatchingList(sourceProfile.preferences);
  const targetPreferences = normalizeMatchingList(targetProfile.preferences);
  const sourceTaboos = new Set(normalizeMatchingList(sourceProfile.taboos));
  const targetTaboos = new Set(normalizeMatchingList(targetProfile.taboos));

  return sourcePreferences.some((entry) => targetTaboos.has(entry))
    || targetPreferences.some((entry) => sourceTaboos.has(entry));
};

const hasRequiredPreferenceMatch = (sourceProfile = {}, targetProfile = {}, minimumSharedPreferences = 2) => (
  getSharedPreferenceCount(sourceProfile.preferences, targetProfile.preferences) >= minimumSharedPreferences
  && !hasPreferenceTabooConflict(sourceProfile, targetProfile)
);

const isWithinExtendedSearchRadius = (sourceProfile = {}, targetProfile = {}, distanceKm = targetProfile?.distanceKm) => {
  const normalizedDistance = Number(distanceKm);

  if (!Number.isFinite(normalizedDistance)) {
    return true;
  }

  const sourceRadius = Number(sourceProfile.radius);
  const targetRadius = Number(targetProfile.radius);
  const resolvedRadius = Math.max(
    Number.isFinite(sourceRadius) ? sourceRadius : 0,
    Number.isFinite(targetRadius) ? targetRadius : 0,
  );

  if (resolvedRadius <= 0) {
    return true;
  }

  return normalizedDistance <= resolvedRadius;
};

const getPreferenceCompatibility = (sourcePreferences = [], targetPreferences = []) => {
  const base = sourcePreferences.length || 1;
  const shared = sourcePreferences.filter((entry) => targetPreferences.includes(entry)).length;
  return Math.round((shared / base) * 100);
};

const getBodyDataCompatibility = (sourceProfile = {}, targetProfile = {}) => {
  let points = 0;
  let maxPoints = 0;

  const sourceHeight = parseHeightToCentimeters(sourceProfile.height);
  const targetHeight = parseHeightToCentimeters(targetProfile.height);
  if (sourceHeight && targetHeight) {
    maxPoints += 35;
    const heightDifference = Math.abs(sourceHeight - targetHeight);

    if (heightDifference <= 5) {
      points += 35;
    } else if (heightDifference <= 10) {
      points += 24;
    } else if (heightDifference <= 15) {
      points += 14;
    } else if (heightDifference <= 20) {
      points += 8;
    }
  }

  if (sourceProfile.figure && targetProfile.figure) {
    maxPoints += 30;
    if (sourceProfile.figure === targetProfile.figure) {
      points += 30;
    }
  }

  if (sourceProfile.hairColor && targetProfile.hairColor) {
    maxPoints += 10;
    if (sourceProfile.hairColor === targetProfile.hairColor) {
      points += 10;
    }
  }

  if (sourceProfile.eyeColor && targetProfile.eyeColor) {
    maxPoints += 10;
    if (sourceProfile.eyeColor === targetProfile.eyeColor) {
      points += 10;
    }
  }

  if (sourceProfile.skinType && targetProfile.skinType) {
    maxPoints += 5;
    if (sourceProfile.skinType === targetProfile.skinType) {
      points += 5;
    }
  }

  const sourceBraSize = parseSizeToNumber(sourceProfile.braSize);
  const targetBraSize = parseSizeToNumber(targetProfile.braSize);
  if (sourceBraSize && targetBraSize) {
    maxPoints += 5;
    if (Math.abs(sourceBraSize - targetBraSize) <= 5) {
      points += 5;
    }
  }

  const sourcePenisSize = parseSizeToNumber(sourceProfile.penisSize);
  const targetPenisSize = parseSizeToNumber(targetProfile.penisSize);
  if (sourcePenisSize && targetPenisSize) {
    maxPoints += 5;
    if (Math.abs(sourcePenisSize - targetPenisSize) <= 2) {
      points += 5;
    }
  }

  if (!maxPoints) {
    return null;
  }

  return Math.round((points / maxPoints) * 100);
};

const getCompatibility = (sourceProfileOrPreferences, targetProfileOrPreferences) => {
  if (Array.isArray(sourceProfileOrPreferences) && Array.isArray(targetProfileOrPreferences)) {
    return getPreferenceCompatibility(sourceProfileOrPreferences, targetProfileOrPreferences);
  }

  const sourceProfile = sourceProfileOrPreferences || {};
  const targetProfile = targetProfileOrPreferences || {};
  const preferenceCompatibility = getPreferenceCompatibility(sourceProfile.preferences || [], targetProfile.preferences || []);
  const bodyCompatibility = getBodyDataCompatibility(sourceProfile, targetProfile);

  if (bodyCompatibility === null) {
    return preferenceCompatibility;
  }

  return Math.round((preferenceCompatibility * 0.7) + (bodyCompatibility * 0.3));
};

const isMutualAgeMatch = (currentUser, targetUser) => {
  const userLikesTarget = targetUser.age >= currentUser.searchAgeMin && targetUser.age <= currentUser.searchAgeMax;
  const targetLikesUser = currentUser.age >= targetUser.searchAgeMin && currentUser.age <= targetUser.searchAgeMax;
  return userLikesTarget && targetLikesUser;
};

const isMutualGenderMatch = (currentUser, targetUser, helpers) => {
  const currentUserSearchGenders = helpers.getSearchGenders(currentUser);
  const targetUserSearchGenders = helpers.getSearchGenders(targetUser);
  const normalizedCurrentGender = helpers.normalizeOptionValue(currentUser.gender, helpers.searchGenderOptions, currentUser.gender);
  const normalizedTargetGender = helpers.normalizeOptionValue(targetUser.gender, helpers.searchGenderOptions, targetUser.gender);

  const currentUserLikesTarget = currentUserSearchGenders.includes(normalizedTargetGender);
  const targetUserLikesCurrentUser = targetUserSearchGenders.includes(normalizedCurrentGender);

  return currentUserLikesTarget && targetUserLikesCurrentUser;
};

const isMutualSearchMatch = (currentUser, targetUser, helpers) => (
  isMutualAgeMatch(currentUser, targetUser) && isMutualGenderMatch(currentUser, targetUser, helpers)
);

export {
    getCompatibility,
    getSharedPreferenceCount,
    hasPreferenceTabooConflict,
    hasRequiredPreferenceMatch, isMutualAgeMatch,
    isMutualGenderMatch,
    isMutualSearchMatch, isWithinExtendedSearchRadius, parseHeightToCentimeters,
    parseSizeToNumber
};


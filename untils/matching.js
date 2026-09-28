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

const normalizeFiniteNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const normalizeStringValue = (value) => (typeof value === 'string' ? value.trim() : '');

const DEFAULT_PRESENCE_STALE_AFTER_MS = 10 * 60 * 1000;

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

const normalizeMatchingIdList = (values = []) => {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values
    .filter((entry) => typeof entry === 'string' && entry.trim())
    .map((entry) => entry.trim()))];
};

const isAgeWithinRange = (age, minAge, maxAge) => {
  if (![age, minAge, maxAge].every((value) => Number.isFinite(value))) {
    return false;
  }

  return minAge <= age && age <= maxAge;
};

const hasStoredProfilePhoto = (profile = {}) => Boolean(normalizeStringValue(profile.profilePhotoUrl || profile.profileImageUri));

const getPresenceTimestamp = (profile = {}) => profile.lastLiveSyncAt || '';

const isPresenceFresh = (timestampValue, staleAfterMs = DEFAULT_PRESENCE_STALE_AFTER_MS) => {
  const numericStaleAfterMs = Number(staleAfterMs);
  const resolvedStaleAfterMs = Number.isFinite(numericStaleAfterMs) && numericStaleAfterMs > 0
    ? numericStaleAfterMs
    : DEFAULT_PRESENCE_STALE_AFTER_MS;
  const timestamp = typeof timestampValue?.toMillis === 'function'
    ? timestampValue.toMillis()
    : new Date(timestampValue || 0).getTime();

  return Number.isFinite(timestamp) && (Date.now() - timestamp) <= resolvedStaleAfterMs;
};

const getNormalizedSearchGenders = (profile = {}) => normalizeMatchingList(profile.searchGenders);

const getNormalizedGender = (profile = {}) => normalizeStringValue(profile.gender);

const matchesCurrentUserSearchGender = (sourceProfile = {}, targetProfile = {}) => {
  const targetGender = getNormalizedGender(targetProfile);
  const searchGenders = getNormalizedSearchGenders(sourceProfile);

  if (!targetGender || !searchGenders.length) {
    return false;
  }

  return searchGenders.includes(targetGender);
};

const isWithinCurrentUserRadius = (sourceProfile = {}, targetProfile = {}) => {
  const currentUserRadius = normalizeFiniteNumber(sourceProfile.radius);
  const targetDistance = normalizeFiniteNumber(targetProfile.distanceKm);

  if (!Number.isFinite(currentUserRadius) || currentUserRadius <= 0) {
    return Number.isFinite(targetDistance);
  }

  if (!Number.isFinite(targetDistance)) {
    return false;
  }

  return targetDistance <= currentUserRadius;
};

const isBlockedProfilePair = (sourceProfile = {}, targetProfile = {}) => {
  const sourceId = typeof sourceProfile.id === 'string' ? sourceProfile.id.trim() : '';
  const targetId = typeof targetProfile.id === 'string' ? targetProfile.id.trim() : '';
  const sourceDismissedIds = new Set(normalizeMatchingIdList(sourceProfile.dismissedProfileIds));
  const targetDismissedIds = new Set(normalizeMatchingIdList(targetProfile.dismissedProfileIds));

  return Boolean(sourceId && targetId && (sourceDismissedIds.has(targetId) || targetDismissedIds.has(sourceId)));
};

const isAllowedMatchedProfile = (sourceProfile = {}, targetProfile = {}) => {
  const sourceId = typeof sourceProfile.id === 'string' ? sourceProfile.id.trim() : '';
  const targetId = typeof targetProfile.id === 'string' ? targetProfile.id.trim() : '';

  if (!sourceId || !targetId || sourceId === targetId) {
    return false;
  }

  if (sourceProfile.isAdmin || sourceProfile.role === 'admin' || targetProfile.isAdmin || targetProfile.role === 'admin') {
    return false;
  }

  if (sourceProfile.accountDeletionRequestedAt || targetProfile.accountDeletionRequestedAt) {
    return false;
  }

  if (sourceProfile.moderationState === 'restricted' || targetProfile.moderationState === 'restricted') {
    return false;
  }

  return !isBlockedProfilePair(sourceProfile, targetProfile);
};

const buildMatchedProfiles = (sourceProfile = {}, chatList = [], users = [], options = {}) => {
  const staleAfterMs = Number.isFinite(Number(options.locationStaleAfterMs))
    ? Number(options.locationStaleAfterMs)
    : DEFAULT_PRESENCE_STALE_AFTER_MS;
  const userMap = new Map((Array.isArray(users) ? users : []).map((user) => [user.id, user]));
  const seenUserIds = new Set();

  return (Array.isArray(chatList) ? chatList : [])
    .filter((chat) => chat?.match && typeof chat?.userId === 'string' && chat.userId.trim())
    .map((chat) => userMap.get(chat.userId) || null)
    .filter(Boolean)
    .filter((profile) => {
      if (seenUserIds.has(profile.id)) {
        return false;
      }

      seenUserIds.add(profile.id);
      return true;
    })
    .map((profile) => ({
      ...profile,
      online: Boolean(profile.online) && isPresenceFresh(getPresenceTimestamp(profile), staleAfterMs),
    }))
    .filter((profile) => isAllowedMatchedProfile(sourceProfile, profile))
    .sort((left, right) => {
      if (left.online !== right.online) {
        return left.online ? -1 : 1;
      }

      const leftDistance = normalizeFiniteNumber(left.distanceKm) ?? Number.MAX_SAFE_INTEGER;
      const rightDistance = normalizeFiniteNumber(right.distanceKm) ?? Number.MAX_SAFE_INTEGER;

      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }

      return String(left.nickname || '').localeCompare(String(right.nickname || ''), 'de-DE');
    });
};

const getMatchEligibility = (sourceProfile = {}, targetProfile = {}, options = {}) => {
  const minimumSharedPreferences = Number.isFinite(Number(options.minimumSharedPreferences))
    ? Number(options.minimumSharedPreferences)
    : 3;
  const locationStaleAfterMs = Number.isFinite(Number(options.locationStaleAfterMs))
    ? Number(options.locationStaleAfterMs)
    : DEFAULT_PRESENCE_STALE_AFTER_MS;
  const reasons = [];
  const sourceId = typeof sourceProfile.id === 'string' ? sourceProfile.id.trim() : '';
  const targetId = typeof targetProfile.id === 'string' ? targetProfile.id.trim() : '';
  const sourceAge = normalizeFiniteNumber(sourceProfile.age);
  const targetAge = normalizeFiniteNumber(targetProfile.age);
  const sourceMinAge = normalizeFiniteNumber(sourceProfile.searchAgeMin);
  const sourceMaxAge = normalizeFiniteNumber(sourceProfile.searchAgeMax);
  const targetMinAge = normalizeFiniteNumber(targetProfile.searchAgeMin);
  const targetMaxAge = normalizeFiniteNumber(targetProfile.searchAgeMax);
  const commonPreferences = getSharedPreferences(sourceProfile.preferences, targetProfile.preferences);
  const commonPreferenceCount = commonPreferences.length;
  const hasMinimumSharedPreferences = commonPreferenceCount >= minimumSharedPreferences;
  const sourceAgeInTargetRange = isAgeWithinRange(sourceAge, targetMinAge, targetMaxAge);
  const targetAgeInSourceRange = isAgeWithinRange(targetAge, sourceMinAge, sourceMaxAge);
  const ageDataComplete = [sourceAge, targetAge, sourceMinAge, sourceMaxAge, targetMinAge, targetMaxAge]
    .every((value) => Number.isFinite(value));
  const sourceDismissedIds = new Set(normalizeMatchingIdList(sourceProfile.dismissedProfileIds));
  const targetDismissedIds = new Set(normalizeMatchingIdList(targetProfile.dismissedProfileIds));
  const withinCurrentUserRadius = isWithinCurrentUserRadius(sourceProfile, targetProfile);
  const genderMatchesCurrentUserSearch = matchesCurrentUserSearchGender(sourceProfile, targetProfile);
  const hasProfilePhoto = hasStoredProfilePhoto(targetProfile);
  const isOnline = Boolean(targetProfile.online) && isPresenceFresh(getPresenceTimestamp(targetProfile), locationStaleAfterMs);
  const isVisible = Boolean(targetProfile.searchActive) && isOnline;
  const isBlocked = sourceId && targetId && (sourceDismissedIds.has(targetId) || targetDismissedIds.has(sourceId));

  if (!sourceId || !targetId) {
    reasons.push('missing_profile_id');
  }

  if (sourceId && targetId && sourceId === targetId) {
    reasons.push('own_profile');
  }

  if (sourceProfile.isAdmin || sourceProfile.role === 'admin' || targetProfile.isAdmin || targetProfile.role === 'admin') {
    reasons.push('admin_profile');
  }

  if (sourceProfile.accountDeletionRequestedAt || targetProfile.accountDeletionRequestedAt) {
    reasons.push('account_unavailable');
  }

  if (sourceProfile.moderationState === 'restricted' || targetProfile.moderationState === 'restricted') {
    reasons.push('restricted_profile');
  }

  if (isBlocked) {
    reasons.push('blocked_profile');
  }

  if (!ageDataComplete) {
    reasons.push('missing_age_data');
  }

  if (!Array.isArray(sourceProfile.preferences) || !Array.isArray(targetProfile.preferences)) {
    reasons.push('missing_preference_data');
  }

  if (ageDataComplete && !sourceAgeInTargetRange) {
    reasons.push('source_age_out_of_target_range');
  }

  if (ageDataComplete && !targetAgeInSourceRange) {
    reasons.push('target_age_out_of_source_range');
  }

  if (!hasMinimumSharedPreferences) {
    reasons.push('insufficient_common_preferences');
  }

  if (!withinCurrentUserRadius) {
    reasons.push('outside_current_user_radius');
  }

  if (!genderMatchesCurrentUserSearch) {
    reasons.push('gender_not_in_current_user_search');
  }

  if (!hasProfilePhoto) {
    reasons.push('missing_profile_photo');
  }

  if (!isOnline) {
    reasons.push('offline_profile');
  }

  if (!isVisible) {
    reasons.push('invisible_profile');
  }

  if (Array.isArray(options.dismissedProfileIds) && normalizeMatchingIdList(options.dismissedProfileIds).includes(targetId)) {
    reasons.push('dismissed_by_source');
  }

  return {
    isEligible: reasons.length === 0,
    isMatchEligible: reasons.length === 0,
    hasMinimumSharedPreferences,
    ageCompatible: ageDataComplete && sourceAgeInTargetRange && targetAgeInSourceRange,
    sourceAgeInTargetRange,
    targetAgeInSourceRange,
    withinCurrentUserRadius,
    genderMatchesCurrentUserSearch,
    hasProfilePhoto,
    isOnline,
    isVisible,
    isBlocked,
    commonPreferenceCount,
    commonPreferences,
    minimumSharedPreferences,
    reasons,
  };
};

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

  return getMatchEligibility(sourceProfileOrPreferences, targetProfileOrPreferences).commonPreferenceCount;
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
  buildMatchedProfiles,
    DEFAULT_PRESENCE_STALE_AFTER_MS,
    getCompatibility,
    getMatchEligibility, getSharedPreferenceCount, getSharedPreferences, hasPreferenceTabooConflict, hasRequiredPreferenceMatch, hasStoredProfilePhoto, isMutualAgeMatch, isMutualGenderMatch,
  isAllowedMatchedProfile, isBlockedProfilePair, isMutualSearchMatch, isPresenceFresh, isWithinExtendedSearchRadius, parseHeightToCentimeters,
    parseSizeToNumber
};


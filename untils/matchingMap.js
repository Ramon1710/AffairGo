export const filterMatchingMapProfiles = (profiles = [], options = {}) => {
  const verifiedOnly = Boolean(options?.verifiedOnly);

  return profiles.filter((profile) => {
    if (verifiedOnly && !profile?.verified) {
      return false;
    }

    return true;
  });
};

export const buildRadarProfiles = (profiles = []) => profiles.filter((profile) => Boolean(profile?.online));

export const buildSwipeDeckProfiles = (profiles = [], dismissedProfileIds = []) => {
  const dismissedIds = new Set(Array.isArray(dismissedProfileIds)
    ? dismissedProfileIds.filter((entry) => typeof entry === 'string' && entry.trim())
    : []);

  return profiles.filter((profile) => !dismissedIds.has(profile?.id));
};

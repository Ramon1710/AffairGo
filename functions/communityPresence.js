const COMMUNITY_PRESENCE_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  RECENT: 'RECENT',
  OFFLINE: 'OFFLINE',
});

const COMMUNITY_PRESENCE_ACTIVE_WINDOW_MS = 5 * 60 * 1000;
const COMMUNITY_PRESENCE_RECENT_WINDOW_MS = 60 * 60 * 1000;
const COMMUNITY_PRESENCE_TOUCH_THROTTLE_MS = 45 * 1000;
const COMMUNITY_PRESENCE_PUBLIC_COUNT_THRESHOLD = 10;

const parsePresenceMillis = (value) => {
  if (!value) {
    return 0;
  }

  if (typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value.seconds === 'number') {
    return Math.round(value.seconds * 1000 + ((Number(value.nanoseconds) || 0) / 1000000));
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const getCommunityPresenceStatus = ({ lastActiveAt, nowMs = Date.now() }) => {
  const lastActiveAtMs = parsePresenceMillis(lastActiveAt);

  if (!lastActiveAtMs) {
    return COMMUNITY_PRESENCE_STATUSES.OFFLINE;
  }

  const ageMs = Math.max(0, nowMs - lastActiveAtMs);

  if (ageMs <= COMMUNITY_PRESENCE_ACTIVE_WINDOW_MS) {
    return COMMUNITY_PRESENCE_STATUSES.ACTIVE;
  }

  if (ageMs <= COMMUNITY_PRESENCE_RECENT_WINDOW_MS) {
    return COMMUNITY_PRESENCE_STATUSES.RECENT;
  }

  return COMMUNITY_PRESENCE_STATUSES.OFFLINE;
};

const buildCommunityPresenceRecord = ({ uid, currentRoomId = null, showActivityStatus = true, fieldValue }) => ({
  userId: uid,
  currentRoomId: currentRoomId || null,
  showActivityStatus: showActivityStatus !== false,
  lastActiveAt: fieldValue.serverTimestamp(),
  updatedAt: fieldValue.serverTimestamp(),
});

const shouldThrottleCommunityPresenceWrite = ({ previousPresence = {}, nextRoomId = null, showActivityStatus = true, nowMs = Date.now() }) => {
  const previousLastActiveAtMs = parsePresenceMillis(previousPresence.lastActiveAt);
  const previousRoomId = typeof previousPresence.currentRoomId === 'string' ? previousPresence.currentRoomId : null;
  const previousShowActivityStatus = previousPresence.showActivityStatus !== false;

  if (!previousLastActiveAtMs) {
    return false;
  }

  if (previousRoomId !== (nextRoomId || null)) {
    return false;
  }

  if (previousShowActivityStatus !== (showActivityStatus !== false)) {
    return false;
  }

  return nowMs - previousLastActiveAtMs < COMMUNITY_PRESENCE_TOUCH_THROTTLE_MS;
};

const buildCommunityPresenceSummary = ({ presenceEntries = [], activeRoomIds = new Set(), nowMs = Date.now() }) => {
  const roomActiveCounts = {};
  let activeMemberCount = 0;
  let recentMemberCount = 0;

  presenceEntries.forEach((entry) => {
    if (!entry || entry.showActivityStatus === false) {
      return;
    }

    const status = getCommunityPresenceStatus({ lastActiveAt: entry.lastActiveAt, nowMs });

    if (status === COMMUNITY_PRESENCE_STATUSES.OFFLINE) {
      return;
    }

    recentMemberCount += 1;

    if (status !== COMMUNITY_PRESENCE_STATUSES.ACTIVE) {
      return;
    }

    activeMemberCount += 1;

    if (entry.currentRoomId && activeRoomIds.has(entry.currentRoomId)) {
      roomActiveCounts[entry.currentRoomId] = (roomActiveCounts[entry.currentRoomId] || 0) + 1;
    }
  });

  return {
    activeMemberCount,
    recentMemberCount,
    roomActiveCounts,
    publicCountThreshold: COMMUNITY_PRESENCE_PUBLIC_COUNT_THRESHOLD,
    activeWindowMs: COMMUNITY_PRESENCE_ACTIVE_WINDOW_MS,
    recentWindowMs: COMMUNITY_PRESENCE_RECENT_WINDOW_MS,
  };
};

module.exports = {
  COMMUNITY_PRESENCE_ACTIVE_WINDOW_MS,
  COMMUNITY_PRESENCE_PUBLIC_COUNT_THRESHOLD,
  COMMUNITY_PRESENCE_RECENT_WINDOW_MS,
  COMMUNITY_PRESENCE_STATUSES,
  COMMUNITY_PRESENCE_TOUCH_THROTTLE_MS,
  buildCommunityPresenceRecord,
  buildCommunityPresenceSummary,
  getCommunityPresenceStatus,
  parsePresenceMillis,
  shouldThrottleCommunityPresenceWrite,
};
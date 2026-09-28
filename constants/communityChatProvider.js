import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const COMMUNITY_PRESENCE_TOUCH_THROTTLE_MS = 45 * 1000;
let lastCommunityPresenceTouchAt = 0;
let lastCommunityPresenceRoomId = null;

const callCommunityFunction = async (name, payload) => {
  const callable = httpsCallable(functions, name);
  const result = await callable(payload);
  return result.data;
};

export const sendCommunityMessage = async (roomId, text, options = {}) => callCommunityFunction('sendCommunityMessage', {
  roomId,
  text,
  clientMessageId: options.clientMessageId || null,
  replyToMessageId: options.replyToMessageId || null,
  mentions: Array.isArray(options.mentions) ? options.mentions : [],
});

export const seedCommunityRooms = async () => callCommunityFunction('seedCommunityRooms', {});

export const getCommunityRules = async () => callCommunityFunction('getCommunityRules', {});

export const acceptCommunityRules = async ({ rulesVersion }) => callCommunityFunction('acceptCommunityRules', {
  rulesVersion,
});

export const publishCommunityRules = async ({ version, title, sections }) => callCommunityFunction('publishCommunityRules', {
  version,
  title,
  sections,
});

export const getCommunityPresenceSummary = async ({ roomId = null } = {}) => callCommunityFunction('getCommunityPresenceSummary', {
  roomId: roomId || null,
});

export const touchCommunityPresence = async ({ roomId = null, force = false } = {}) => {
  const normalizedRoomId = typeof roomId === 'string' && roomId.trim() ? roomId.trim() : null;
  const nowMs = Date.now();

  if (!force && normalizedRoomId === lastCommunityPresenceRoomId && nowMs - lastCommunityPresenceTouchAt < COMMUNITY_PRESENCE_TOUCH_THROTTLE_MS) {
    return {
      ok: true,
      roomId: normalizedRoomId,
      throttled: true,
      clientThrottled: true,
    };
  }

  const result = await callCommunityFunction('touchCommunityPresence', {
    roomId: normalizedRoomId,
  });

  lastCommunityPresenceTouchAt = nowMs;
  lastCommunityPresenceRoomId = normalizedRoomId;
  return result;
};

export const toggleCommunityReaction = async ({ roomId, messageId, reactionType }) => callCommunityFunction('toggleCommunityReaction', {
  roomId,
  messageId,
  reactionType,
});

export const blockCommunityUser = async ({ targetUserId, reason = '' }) => callCommunityFunction('blockCommunityUser', {
  targetUserId,
  reason,
});

export const unblockCommunityUser = async ({ targetUserId }) => callCommunityFunction('unblockCommunityUser', {
  targetUserId,
});

export const reportCommunityContent = async ({ roomId, messageId = null, targetUserId = null, reason, comment = '' }) => callCommunityFunction('reportCommunityContent', {
  roomId,
  messageId,
  targetUserId,
  reason,
  comment,
});

export const moderateCommunityReport = async ({ reportId, action, reason = '' }) => callCommunityFunction('moderateCommunityReport', {
  reportId,
  action,
  reason,
});

export const markCommunityRoomRead = async ({ roomId, lastReadMessageId = null }) => callCommunityFunction('markCommunityRoomRead', {
  roomId,
  lastReadMessageId,
});

export const upsertCommunityRoom = async ({ roomId = null, name, slug, description, type, region = null, active = true }) => callCommunityFunction('upsertCommunityRoom', {
  roomId,
  name,
  slug,
  description,
  type,
  region,
  active,
});

export const setCommunityRoomActive = async ({ roomId, active }) => callCommunityFunction('setCommunityRoomActive', {
  roomId,
  active,
});

export const createEventCommunityRoom = async ({ eventId }) => callCommunityFunction('createEventCommunityRoom', {
  eventId,
});

export const syncEventCommunityRooms = async ({ roomId = null, eventId = null } = {}) => callCommunityFunction('syncEventCommunityRooms', {
  roomId,
  eventId,
});
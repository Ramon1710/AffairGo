const admin = require('firebase-admin');
const { getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const {
  createAcceptCommunityRulesHandler,
  createBlockCommunityUserHandler,
  createEventCommunityRoomHandler,
  createGetCommunityPresenceSummaryHandler,
  createGetCommunityRulesHandler,
  createMarkCommunityRoomReadHandler,
  createModerateCommunityReportHandler,
  createPublishCommunityRulesHandler,
  createReportCommunityContentHandler,
  createSeedCommunityRoomsHandler,
  createSendCommunityMessageHandler,
  createSetCommunityRoomActiveHandler,
  createSyncEventCommunityRoomsHandler,
  createTouchCommunityPresenceHandler,
  createToggleCommunityReactionHandler,
  createUnblockCommunityUserHandler,
  createUpsertCommunityRoomHandler,
} = require('./communityChat');

if (!getApps().length) {
  admin.initializeApp();
}

const FIREBASE_REGION = 'europe-west1';
const sendCommunityMessageHandler = createSendCommunityMessageHandler({
  firestore: getFirestore(),
  fieldValue: FieldValue,
});
const seedCommunityRoomsHandler = createSeedCommunityRoomsHandler({
  firestore: getFirestore(),
  fieldValue: FieldValue,
});
const getCommunityRulesHandler = createGetCommunityRulesHandler({
  firestore: getFirestore(),
  fieldValue: FieldValue,
});
const acceptCommunityRulesHandler = createAcceptCommunityRulesHandler({
  firestore: getFirestore(),
  fieldValue: FieldValue,
  timestamp: Timestamp,
});
const publishCommunityRulesHandler = createPublishCommunityRulesHandler({
  firestore: getFirestore(),
  fieldValue: FieldValue,
});
const touchCommunityPresenceHandler = createTouchCommunityPresenceHandler({
  firestore: getFirestore(),
  fieldValue: FieldValue,
});
const getCommunityPresenceSummaryHandler = createGetCommunityPresenceSummaryHandler({
  firestore: getFirestore(),
});
const toggleCommunityReactionHandler = createToggleCommunityReactionHandler({
  firestore: getFirestore(),
  fieldValue: FieldValue,
});
const blockCommunityUserHandler = createBlockCommunityUserHandler({
  firestore: getFirestore(),
  fieldValue: FieldValue,
});
const unblockCommunityUserHandler = createUnblockCommunityUserHandler({
  firestore: getFirestore(),
});
const reportCommunityContentHandler = createReportCommunityContentHandler({
  firestore: getFirestore(),
  fieldValue: FieldValue,
});
const moderateCommunityReportHandler = createModerateCommunityReportHandler({
  firestore: getFirestore(),
  fieldValue: FieldValue,
});
const markCommunityRoomReadHandler = createMarkCommunityRoomReadHandler({
  firestore: getFirestore(),
  fieldValue: FieldValue,
});
const upsertCommunityRoomHandler = createUpsertCommunityRoomHandler({
  firestore: getFirestore(),
  fieldValue: FieldValue,
});
const setCommunityRoomActiveHandler = createSetCommunityRoomActiveHandler({
  firestore: getFirestore(),
  fieldValue: FieldValue,
});
const createEventCommunityRoomHandlerInstance = createEventCommunityRoomHandler({
  firestore: getFirestore(),
  fieldValue: FieldValue,
});
const syncEventCommunityRoomsHandler = createSyncEventCommunityRoomsHandler({
  firestore: getFirestore(),
  fieldValue: FieldValue,
});

const assertAuthenticated = (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
  }

  return request.auth.uid;
};

const assertString = (value, fieldName) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpsError('invalid-argument', `${fieldName} ist erforderlich.`);
  }

  return value.trim();
};

const getUserProfileSnapshot = async (uid) => {
  const userRef = getFirestore().collection('users').doc(uid);
  const snapshot = await userRef.get();
  return { userRef, snapshot };
};

const normalizeGermanComparison = (value = '') => String(value)
  .trim()
  .toLowerCase()
  .replaceAll('ä', 'ae')
  .replaceAll('ö', 'oe')
  .replaceAll('ü', 'ue')
  .replaceAll('ß', 'ss');

const normalizeOptionalString = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeOptionalNumber = (value, fallback = null) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};
const normalizeStringList = (value) => (Array.isArray(value) ? value.map((entry) => String(entry || '').trim()).filter(Boolean) : []);
const createChatEntityId = (prefix) => `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
const buildDirectChatId = (firstUserId = '', secondUserId = '') => `chat_${[firstUserId, secondUserId].filter(Boolean).sort().join('__')}`;
const normalizeStoredMessages = (messages = []) => {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((message) => typeof message?.text === 'string' && message.text.trim())
    .map((message) => ({
      id: normalizeOptionalString(message.id) || createChatEntityId('m'),
      from: normalizeOptionalString(message.from) || 'system',
      text: normalizeOptionalString(message.text),
      time: normalizeOptionalString(message.time) || 'Jetzt',
    }));
};
const normalizeStoredChats = (chats = []) => {
  if (!Array.isArray(chats)) {
    return [];
  }

  return chats
    .filter((chat) => normalizeOptionalString(chat?.userId))
    .map((chat, index) => ({
      id: normalizeOptionalString(chat.id) || `c_${normalizeOptionalString(chat.userId)}_${index}`,
      userId: normalizeOptionalString(chat.userId),
      match: chat.match !== false,
      inactivityDays: normalizeOptionalNumber(chat.inactivityDays, 0) || 0,
      unreadCount: Math.max(0, normalizeOptionalNumber(chat.unreadCount, 0) || 0),
      messages: normalizeStoredMessages(chat.messages),
    }));
};
const upsertChatThread = (chatList, { ownerUserId = '', partnerUserId, appendMessage = null, unreadCount = null, unreadIncrement = 0 }) => {
  const normalizedChats = normalizeStoredChats(chatList);
  const existingChat = normalizedChats.find((chat) => chat.userId === partnerUserId);
  const baseUnreadCount = Number(existingChat?.unreadCount) || 0;
  const resolvedUnreadCount = Number.isFinite(Number(unreadCount))
    ? Math.max(0, Number(unreadCount))
    : Math.max(0, baseUnreadCount + (Number(unreadIncrement) || 0));

  const nextChat = {
    id: existingChat?.id || buildDirectChatId(ownerUserId, partnerUserId),
    userId: partnerUserId,
    match: true,
    inactivityDays: 0,
    unreadCount: resolvedUnreadCount,
    messages: appendMessage
      ? [...(existingChat?.messages || []), appendMessage]
      : (existingChat?.messages || []),
  };

  return [nextChat, ...normalizedChats.filter((chat) => chat.userId !== partnerUserId)];
};
const removeChatThread = (chatList, partnerUserId) => normalizeStoredChats(chatList).filter((chat) => chat.userId !== partnerUserId);
const normalizeTravelPlans = (travelPlans = {}) => ({
  business: Array.isArray(travelPlans?.business) ? travelPlans.business : [],
  vacation: Array.isArray(travelPlans?.vacation) ? travelPlans.vacation : [],
});
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const stripUndefinedEntries = (value = {}) => Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));

const normalizeProfilePatch = (patch = {}, existingProfile = {}, uid) => {
  const nextPatch = stripUndefinedEntries({ ...patch });
  delete nextPatch.password;
  delete nextPatch.repeatPassword;
  delete nextPatch.id;

  if (hasOwn(nextPatch, 'email')) {
    nextPatch.email = normalizeOptionalString(nextPatch.email).toLowerCase();
  }

  if (hasOwn(nextPatch, 'nickname')) {
    nextPatch.nickname = normalizeOptionalString(nextPatch.nickname);
  }

  ['firstName', 'lastName', 'birthDay', 'birthLabel', 'gender', 'height', 'figure', 'penisSize', 'braSize', 'hairColor', 'eyeColor', 'skinType', 'city', 'pendingNickname', 'privacyConsentAcceptedAt', 'ageVerificationStatus', 'ageVerificationProvider', 'ageVerificationReferenceId', 'ageVerificationCheckedAt', 'moderationState', 'moderationLastCheckedAt', 'moderationRateLimitUntil', 'accountDeletionRequestedAt', 'dataExportRequestedAt', 'premiumTrialEndsAt', 'billingCycle', 'planPriceLabel', 'joinedLabel'].forEach((key) => {
    if (hasOwn(nextPatch, key)) {
      nextPatch[key] = normalizeOptionalString(nextPatch[key]);
    }
  });

  ['birthMonth', 'birthYear', 'age', 'profilePhotoAgeMonths', 'searchAgeMin', 'searchAgeMax', 'radius', 'points'].forEach((key) => {
    if (hasOwn(nextPatch, key)) {
      nextPatch[key] = normalizeOptionalNumber(nextPatch[key], existingProfile[key] ?? null);
    }
  });

  ['ageVerified', 'verified', 'emailVerified', 'onboardingCompleted', 'searchActive', 'showCommunityActivityStatus', 'verifiedMatchesOnly', 'premiumTrialActive', 'goldDiscountPackage', 'privacyConsentAccepted'].forEach((key) => {
    if (hasOwn(nextPatch, key)) {
      nextPatch[key] = Boolean(nextPatch[key]);
    }
  });

  if (hasOwn(nextPatch, 'online')) {
    nextPatch.online = nextPatch.online !== false;
  }

  if (hasOwn(nextPatch, 'latitude')) {
    nextPatch.latitude = nextPatch.latitude == null ? null : normalizeOptionalNumber(nextPatch.latitude, null);
  }

  if (hasOwn(nextPatch, 'longitude')) {
    nextPatch.longitude = nextPatch.longitude == null ? null : normalizeOptionalNumber(nextPatch.longitude, null);
  }

  ['preferences', 'taboos', 'dismissedProfileIds', 'searchGenders', 'moderationFlags', 'galleryImages'].forEach((key) => {
    if (hasOwn(nextPatch, key)) {
      nextPatch[key] = normalizeStringList(nextPatch[key]);
    }
  });

  if (hasOwn(nextPatch, 'gallery')) {
    nextPatch.galleryImages = normalizeStringList(nextPatch.gallery);
    delete nextPatch.gallery;
  }

  if (hasOwn(nextPatch, 'travelPlans')) {
    nextPatch.travelPlans = normalizeTravelPlans(nextPatch.travelPlans);
  }

  if (hasOwn(nextPatch, 'moderationAuditTrail') && !Array.isArray(nextPatch.moderationAuditTrail)) {
    nextPatch.moderationAuditTrail = [];
  }

  if (hasOwn(nextPatch, 'rewardLog') && !Array.isArray(nextPatch.rewardLog)) {
    nextPatch.rewardLog = [];
  }

  if (hasOwn(nextPatch, 'purchaseHistory') && !Array.isArray(nextPatch.purchaseHistory)) {
    nextPatch.purchaseHistory = [];
  }

  if (hasOwn(nextPatch, 'featureSuggestions') && !Array.isArray(nextPatch.featureSuggestions)) {
    nextPatch.featureSuggestions = [];
  }

  if (hasOwn(nextPatch, 'profilePhotoUrl') || hasOwn(nextPatch, 'profileImageUri')) {
    const photoValue = normalizeOptionalString(nextPatch.profilePhotoUrl || nextPatch.profileImageUri);
    nextPatch.profilePhotoUrl = photoValue;
    nextPatch.profileImageUri = photoValue;
  }

  const mergedProfile = { ...existingProfile, ...nextPatch, uid };
  const mergedNickname = normalizeOptionalString(mergedProfile.nickname);
  const mergedPendingNickname = normalizeOptionalString(mergedProfile.pendingNickname);

  nextPatch.uid = uid;
  nextPatch.nicknameLower = mergedNickname ? normalizeGermanComparison(mergedNickname) : '';
  nextPatch.nicknameUnique = Boolean(mergedNickname) && !mergedPendingNickname;
  nextPatch.profileCompleted = Boolean(
    normalizeOptionalString(mergedProfile.firstName)
    && normalizeOptionalString(mergedProfile.lastName)
    && normalizeOptionalString(mergedProfile.gender)
    && normalizeOptionalString(mergedProfile.height)
    && normalizeOptionalString(mergedProfile.figure)
    && normalizeOptionalString(mergedProfile.profilePhotoUrl || mergedProfile.profileImageUri)
  );
  nextPatch.updatedAt = FieldValue.serverTimestamp();

  return nextPatch;
};

exports.finalizeRegistrationProfile = onCall({
  region: FIREBASE_REGION,
}, async (request) => {
  const uid = assertAuthenticated(request);
  const profile = request.data?.profile;

  if (!profile || typeof profile !== 'object') {
    throw new HttpsError('invalid-argument', 'Profil-Payload fehlt.');
  }

  const email = assertString(profile.email, 'email').toLowerCase();
  const nickname = normalizeOptionalString(profile.nickname);
  const userRef = getFirestore().collection('users').doc(uid);
  const existingSnapshot = await userRef.get();
  const storedProfile = {
    uid,
    email,
    nickname,
    nicknameLower: nickname ? normalizeGermanComparison(nickname) : '',
    pendingNickname: '',
    firstName: normalizeOptionalString(profile.firstName),
    lastName: normalizeOptionalString(profile.lastName),
    birthDay: normalizeOptionalString(profile.birthDay),
    birthMonth: normalizeOptionalNumber(profile.birthMonth, 0),
    birthYear: normalizeOptionalNumber(profile.birthYear, ''),
    birthLabel: normalizeOptionalString(profile.birthLabel),
    age: normalizeOptionalNumber(profile.age, 18),
    gender: normalizeOptionalString(profile.gender),
    height: normalizeOptionalString(profile.height),
    figure: normalizeOptionalString(profile.figure),
    penisSize: normalizeOptionalString(profile.penisSize),
    braSize: normalizeOptionalString(profile.braSize),
    hairColor: normalizeOptionalString(profile.hairColor),
    eyeColor: normalizeOptionalString(profile.eyeColor),
    skinType: normalizeOptionalString(profile.skinType),
    city: normalizeOptionalString(profile.city),
    preferences: normalizeStringList(profile.preferences),
    taboos: normalizeStringList(profile.taboos),
    dismissedProfileIds: normalizeStringList(profile.dismissedProfileIds),
    searchGenders: normalizeStringList(profile.searchGenders),
    travelPlans: normalizeTravelPlans(profile.travelPlans),
    verified: Boolean(profile.verified),
    emailVerified: Boolean(profile.emailVerified),
    ageVerified: Boolean(profile.ageVerified),
    ageVerificationStatus: normalizeOptionalString(profile.ageVerificationStatus) || 'not_started',
    ageVerificationProvider: normalizeOptionalString(profile.ageVerificationProvider),
    ageVerificationReferenceId: normalizeOptionalString(profile.ageVerificationReferenceId),
    ageVerificationCheckedAt: normalizeOptionalString(profile.ageVerificationCheckedAt),
    moderationState: normalizeOptionalString(profile.moderationState) || 'clear',
    moderationFlags: normalizeStringList(profile.moderationFlags),
    moderationLastCheckedAt: normalizeOptionalString(profile.moderationLastCheckedAt),
    moderationRateLimitUntil: normalizeOptionalString(profile.moderationRateLimitUntil),
    moderationAuditTrail: Array.isArray(profile.moderationAuditTrail) ? profile.moderationAuditTrail : [],
    profileImageUri: normalizeOptionalString(profile.profilePhotoUrl || profile.profileImageUri),
    profilePhotoUrl: normalizeOptionalString(profile.profilePhotoUrl || profile.profileImageUri),
    profilePhotoAgeMonths: normalizeOptionalNumber(profile.profilePhotoAgeMonths, 0),
    galleryImages: normalizeStringList(profile.galleryImages || profile.gallery),
    privacyConsentAccepted: Boolean(profile.privacyConsentAccepted),
    privacyConsentAcceptedAt: normalizeOptionalString(profile.privacyConsentAcceptedAt),
    onboardingCompleted: Boolean(profile.onboardingCompleted),
    searchAgeMin: normalizeOptionalNumber(profile.searchAgeMin, 25),
    searchAgeMax: normalizeOptionalNumber(profile.searchAgeMax, 55),
    radius: normalizeOptionalNumber(profile.radius, 25),
    searchActive: Boolean(profile.searchActive),
    showCommunityActivityStatus: profile.showCommunityActivityStatus !== false,
    verifiedMatchesOnly: Boolean(profile.verifiedMatchesOnly),
    online: profile.online !== false,
    points: normalizeOptionalNumber(profile.points, 0),
    rewardLog: Array.isArray(profile.rewardLog) ? profile.rewardLog : [],
    membership: normalizeOptionalString(profile.membership) || 'free',
    premiumTrialActive: Boolean(profile.premiumTrialActive),
    premiumTrialEndsAt: normalizeOptionalString(profile.premiumTrialEndsAt),
    billingCycle: normalizeOptionalString(profile.billingCycle) || 'free',
    planPriceLabel: normalizeOptionalString(profile.planPriceLabel) || 'Kostenfrei bis Anfang 2027',
    goldDiscountPackage: Boolean(profile.goldDiscountPackage),
    purchaseHistory: Array.isArray(profile.purchaseHistory) ? profile.purchaseHistory : [],
    joinedLabel: normalizeOptionalString(profile.joinedLabel) || 'Heute',
    featureSuggestions: Array.isArray(profile.featureSuggestions) ? profile.featureSuggestions : [],
    accountDeletionRequestedAt: normalizeOptionalString(profile.accountDeletionRequestedAt),
    dataExportRequestedAt: normalizeOptionalString(profile.dataExportRequestedAt),
    latitude: null,
    longitude: null,
    nicknameUnique: Boolean(nickname),
    profileCompleted: Boolean(
      normalizeOptionalString(profile.firstName)
      && normalizeOptionalString(profile.lastName)
      && normalizeOptionalString(profile.gender)
      && normalizeOptionalString(profile.height)
      && normalizeOptionalString(profile.figure)
      && normalizeOptionalString(profile.profilePhotoUrl || profile.profileImageUri)
    ),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (!existingSnapshot.exists) {
    storedProfile.createdAt = FieldValue.serverTimestamp();
  }

  await userRef.set(storedProfile, { merge: true });

  return {
    saved: true,
    uid,
    profileCompleted: storedProfile.profileCompleted,
  };
});

exports.applyUserProfilePatch = onCall({
  region: FIREBASE_REGION,
}, async (request) => {
  const uid = assertAuthenticated(request);
  const patch = request.data?.patch;

  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new HttpsError('invalid-argument', 'Patch-Payload fehlt.');
  }

  const userRef = getFirestore().collection('users').doc(uid);
  const existingSnapshot = await userRef.get();
  const existingProfile = existingSnapshot.exists ? existingSnapshot.data() : {};
  const normalizedPatch = normalizeProfilePatch(patch, existingProfile, uid);

  if (!existingSnapshot.exists) {
    normalizedPatch.createdAt = FieldValue.serverTimestamp();
  }

  await userRef.set(normalizedPatch, { merge: true });

  return {
    saved: true,
    uid,
  };
});

exports.syncPeerChatState = onCall({
  region: FIREBASE_REGION,
}, async (request) => {
  const uid = assertAuthenticated(request);
  const targetUserId = assertString(request.data?.targetUserId, 'targetUserId');
  const action = assertString(request.data?.action, 'action');

  if (targetUserId === uid) {
    throw new HttpsError('invalid-argument', 'Peer-Chat-Sync benötigt ein anderes Zielprofil.');
  }

  const firestore = getFirestore();
  const targetUserRef = firestore.collection('users').doc(targetUserId);

  await firestore.runTransaction(async (transaction) => {
    const targetUserSnapshot = await transaction.get(targetUserRef);

    if (!targetUserSnapshot.exists) {
      throw new HttpsError('not-found', 'Das Zielprofil wurde nicht gefunden.');
    }

    const existingChats = normalizeStoredChats(targetUserSnapshot.data()?.chats);
    let nextChats = existingChats;

    if (action === 'ensure_match') {
      nextChats = upsertChatThread(existingChats, {
        ownerUserId: targetUserId,
        partnerUserId: uid,
        unreadCount: normalizeOptionalNumber(request.data?.unreadCount, 0) || 0,
      });
    } else if (action === 'append_message') {
      const rawMessage = request.data?.message;
      const text = normalizeOptionalString(rawMessage?.text);

      if (!text) {
        throw new HttpsError('invalid-argument', 'Nachrichtentext fehlt.');
      }

      nextChats = upsertChatThread(existingChats, {
        ownerUserId: targetUserId,
        partnerUserId: uid,
        appendMessage: {
          id: normalizeOptionalString(rawMessage?.id) || createChatEntityId('m'),
          from: uid,
          text,
          time: normalizeOptionalString(rawMessage?.time) || 'Jetzt',
        },
        unreadIncrement: normalizeOptionalNumber(request.data?.unreadIncrement, 1) || 1,
      });
    } else if (action === 'remove_chat') {
      nextChats = removeChatThread(existingChats, uid);
    } else {
      throw new HttpsError('invalid-argument', 'Unbekannte Peer-Chat-Aktion.');
    }

    transaction.set(targetUserRef, { chats: nextChats }, { merge: true });
  });

  return {
    saved: true,
    targetUserId,
    action,
  };
});

exports.checkNicknameAvailability = onCall({
  region: FIREBASE_REGION,
}, async (request) => {
  const nickname = assertString(request.data?.nickname, 'nickname');
  const normalizedNickname = normalizeGermanComparison(nickname);
  const requesterUid = request.auth?.uid || '';
  const snapshot = await getFirestore()
    .collection('users')
    .where('nicknameLower', '==', normalizedNickname)
    .limit(2)
    .get();

  const conflictingProfile = snapshot.docs.find((profileDoc) => profileDoc.id !== requesterUid);

  return {
    available: !conflictingProfile,
    normalizedNickname,
    message: conflictingProfile
      ? 'Dieser Spitzname ist bereits vergeben.'
      : 'Spitzname ist verfuegbar.',
  };
});

exports.sendCommunityMessage = onCall({
  region: FIREBASE_REGION,
}, sendCommunityMessageHandler);

exports.seedCommunityRooms = onCall({
  region: FIREBASE_REGION,
}, seedCommunityRoomsHandler);

exports.getCommunityRules = onCall({
  region: FIREBASE_REGION,
}, getCommunityRulesHandler);

exports.acceptCommunityRules = onCall({
  region: FIREBASE_REGION,
}, acceptCommunityRulesHandler);

exports.publishCommunityRules = onCall({
  region: FIREBASE_REGION,
}, publishCommunityRulesHandler);

exports.touchCommunityPresence = onCall({
  region: FIREBASE_REGION,
}, touchCommunityPresenceHandler);

exports.getCommunityPresenceSummary = onCall({
  region: FIREBASE_REGION,
}, getCommunityPresenceSummaryHandler);

exports.toggleCommunityReaction = onCall({
  region: FIREBASE_REGION,
}, toggleCommunityReactionHandler);

exports.blockCommunityUser = onCall({
  region: FIREBASE_REGION,
}, blockCommunityUserHandler);

exports.unblockCommunityUser = onCall({
  region: FIREBASE_REGION,
}, unblockCommunityUserHandler);

exports.reportCommunityContent = onCall({
  region: FIREBASE_REGION,
}, reportCommunityContentHandler);

exports.moderateCommunityReport = onCall({
  region: FIREBASE_REGION,
}, moderateCommunityReportHandler);

exports.markCommunityRoomRead = onCall({
  region: FIREBASE_REGION,
}, markCommunityRoomReadHandler);

exports.upsertCommunityRoom = onCall({
  region: FIREBASE_REGION,
}, upsertCommunityRoomHandler);

exports.setCommunityRoomActive = onCall({
  region: FIREBASE_REGION,
}, setCommunityRoomActiveHandler);

exports.createEventCommunityRoom = onCall({
  region: FIREBASE_REGION,
}, createEventCommunityRoomHandlerInstance);

exports.syncEventCommunityRooms = onCall({
  region: FIREBASE_REGION,
}, syncEventCommunityRoomsHandler);
const test = require('node:test');
const assert = require('node:assert/strict');
const { HttpsError } = require('firebase-functions/v2/https');
const {
  ALLOWED_COMMUNITY_REACTION_TYPES,
  COMMUNITY_MODERATION_ACTIONS,
  COMMUNITY_MESSAGE_MAX_LENGTH,
  COMMUNITY_REPORT_PRIORITIES,
  COMMUNITY_REPORT_REASONS,
  COMMUNITY_REPORT_STATUSES,
  DEFAULT_COMMUNITY_RULES_VERSION,
  DEFAULT_COMMUNITY_ROOMS,
  COMMUNITY_RATE_LIMIT_ERROR_MESSAGE,
  DEFAULT_COMMUNITY_ROOM_ID,
  createAcceptCommunityRulesHandler,
  createBlockCommunityUserHandler,
  createEventCommunityRoomHandler,
  createGetCommunityPresenceSummaryHandler,
  createGetCommunityRulesHandler,
  createMarkCommunityRoomReadHandler,
  createModerateCommunityReportHandler,
  createPublishCommunityRulesHandler,
  createReportCommunityContentHandler,
  createSendCommunityMessageHandler,
  createSetCommunityRoomActiveHandler,
  createSyncEventCommunityRoomsHandler,
  createTouchCommunityPresenceHandler,
  createToggleCommunityReactionHandler,
  createUnblockCommunityUserHandler,
  createUpsertCommunityRoomHandler,
} = require('../communityChat');
const {
  COMMUNITY_PRESENCE_STATUSES,
  getCommunityPresenceStatus,
} = require('../communityPresence');

const clone = (value) => JSON.parse(JSON.stringify(value));

class MockDocumentSnapshot {
  constructor(ref, entry) {
    this.ref = ref;
    this.id = ref.id;
    this.exists = Boolean(entry);
    this._entry = entry ? clone(entry.data) : null;
  }

  data() {
    return this._entry ? clone(this._entry) : undefined;
  }
}

class MockDocumentReference {
  constructor(firestore, path) {
    this.firestore = firestore;
    this.path = path;
    const parts = path.split('/');
    this.id = parts[parts.length - 1];
  }

  collection(name) {
    return new MockCollectionReference(this.firestore, `${this.path}/${name}`);
  }

  async get() {
    return this.firestore._getSnapshot(this);
  }

  async set(data, options = {}) {
    const currentEntry = this.firestore.store.get(this.path);
    const resolvedData = this.firestore._resolveSentinels(clone(data));
    const nextData = options.merge
      ? this.firestore._mergeData(currentEntry?.data, resolvedData)
      : resolvedData;

    this.firestore.store.set(this.path, {
      data: nextData,
      version: (currentEntry?.version || 0) + 1,
    });
  }
}

class MockCollectionReference {
  constructor(firestore, path) {
    this.firestore = firestore;
    this.path = path;
  }

  doc(id) {
    const resolvedId = id || this.firestore._nextId(this.path);
    return new MockDocumentReference(this.firestore, `${this.path}/${resolvedId}`);
  }

  async get() {
    const docs = Array.from(this.firestore.store.entries())
      .filter(([path]) => path.startsWith(`${this.path}/`) && path.split('/').length === this.path.split('/').length + 1)
      .map(([path, entry]) => ({
        id: path.split('/').pop(),
        data: () => clone(entry.data),
      }));

    return { docs };
  }

  where(field, operator, value) {
    return {
      get: async () => {
        const docs = Array.from(this.firestore.store.entries())
          .filter(([path]) => path.startsWith(`${this.path}/`) && path.split('/').length === this.path.split('/').length + 1)
          .filter(([, entry]) => {
            const entryValue = entry.data?.[field];

            if (operator === '==') {
              return entryValue === value;
            }

            if (operator === '>=') {
              return entryValue >= value;
            }

            if (operator === '<=') {
              return entryValue <= value;
            }

            return false;
          })
          .map(([path, entry]) => ({
            id: path.split('/').pop(),
            data: () => clone(entry.data),
          }));

        return { docs };
      },
    };
  }
}

class MockTransaction {
  constructor(firestore) {
    this.firestore = firestore;
    this.readVersions = new Map();
    this.writes = [];
  }

  async get(ref) {
    await Promise.resolve();
    const entry = this.firestore.store.get(ref.path);
    this.readVersions.set(ref.path, entry ? entry.version : 0);
    return new MockDocumentSnapshot(ref, entry || null);
  }

  set(ref, data, options = {}) {
    this.writes.push({ ref, data: clone(data), options: { ...options } });
    return this;
  }

  delete(ref) {
    this.writes.push({ ref, delete: true });
    return this;
  }
}

class MockFirestore {
  constructor(initialDocs = {}, nowProvider = () => Date.now()) {
    this.nowProvider = nowProvider;
    this.autoIds = new Map();
    this.store = new Map();

    Object.entries(initialDocs).forEach(([path, data]) => {
      this.store.set(path, { data: clone(data), version: 1 });
    });
  }

  collection(name) {
    return new MockCollectionReference(this, name);
  }

  async runTransaction(callback) {
    let attempt = 0;

    while (attempt < 5) {
      attempt += 1;
      const transaction = new MockTransaction(this);
      const result = await callback(transaction);

      if (this._tryCommit(transaction)) {
        return result;
      }
    }

    throw new Error('transaction-conflict');
  }

  _getSnapshot(ref) {
    return new MockDocumentSnapshot(ref, this.store.get(ref.path) || null);
  }

  _nextId(collectionPath) {
    const nextValue = (this.autoIds.get(collectionPath) || 0) + 1;
    this.autoIds.set(collectionPath, nextValue);
    return `auto-${nextValue}`;
  }

  _resolveSentinels(value) {
    if (value && typeof value === 'object') {
      if (value.__type === 'serverTimestamp') {
        return new Date(this.nowProvider()).toISOString();
      }

      if (Array.isArray(value)) {
        return value.map((entry) => this._resolveSentinels(entry));
      }

      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, this._resolveSentinels(entry)]));
    }

    return value;
  }

  _mergeData(existing, next) {
    return {
      ...(existing || {}),
      ...next,
    };
  }

  _tryCommit(transaction) {
    for (const [path, version] of transaction.readVersions.entries()) {
      const currentVersion = this.store.get(path)?.version || 0;

      if (currentVersion !== version) {
        return false;
      }
    }

    transaction.writes.forEach(({ ref, data, options }) => {
      if (options == null && data == null && transaction.writes.find((entry) => entry.ref.path === ref.path && entry.delete)) {
        this.store.delete(ref.path);
        return;
      }
    });

    transaction.writes.forEach(({ ref, data, options, delete: shouldDelete }) => {
      if (shouldDelete) {
        this.store.delete(ref.path);
        return;
      }

      const currentEntry = this.store.get(ref.path);
      const resolvedData = this._resolveSentinels(data);
      const nextData = options.merge
        ? this._mergeData(currentEntry?.data, resolvedData)
        : resolvedData;

      this.store.set(ref.path, {
        data: nextData,
        version: (currentEntry?.version || 0) + 1,
      });
    });

    return true;
  }
}

const createFieldValueStub = () => ({
  serverTimestamp: () => ({ __type: 'serverTimestamp' }),
});

const createLoggerStub = () => {
  const entries = [];

  return {
    entries,
    error(message, payload) {
      entries.push({ message, payload });
    },
  };
};

const createVerifiedUserProfile = (overrides = {}) => ({
  uid: 'user-1',
  id: 'user-1',
  nickname: 'Alice',
  showCommunityActivityStatus: true,
  emailVerified: true,
  ageVerified: true,
  ageVerificationStatus: 'verified',
  accountDeletionRequestedAt: '',
  moderationState: 'clear',
  role: 'member',
  isAdmin: false,
  ...overrides,
});

const createEventDocument = (overrides = {}) => ({
  id: 'e1',
  title: 'Midnight Party Köln',
  date: '14.09.2026',
  time: '21:00',
  address: '50674 Köln, Belgische Allee 2',
  organizerId: 'user-1',
  attendeeIds: ['user-1'],
  participants: {
    total: 1,
    women: 0,
    men: 0,
    divers: 0,
  },
  maxParticipants: 20,
  verifiedOnly: true,
  description: 'Eventbeschreibung',
  travelReferenceCity: 'Köln',
  ...overrides,
});

const createCommunityRulesAcceptance = (overrides = {}) => ({
  userId: 'user-1',
  latestAcceptedVersion: DEFAULT_COMMUNITY_RULES_VERSION,
  latestAcceptedAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  acceptedVersions: [
    {
      version: DEFAULT_COMMUNITY_RULES_VERSION,
      acceptedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  ...overrides,
});

const createBaseDocs = ({ userProfileOverrides = {}, roomOverrides = {}, rateLimitOverrides = null, includeRuleAcceptance = true } = {}) => {
  const docs = {
    'users/user-1': createVerifiedUserProfile(userProfileOverrides),
    [`communityRooms/${DEFAULT_COMMUNITY_ROOM_ID}`]: {
      id: DEFAULT_COMMUNITY_ROOM_ID,
      name: 'Whisper Lounge',
      slug: 'whisper-lounge',
      description: 'Der offene Community-Chat von Night-Whisper.',
      type: 'GLOBAL',
      region: null,
      active: true,
      manualActive: true,
      createdBy: 'system',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      eventId: null,
      ...roomOverrides,
    },
  };

  if (includeRuleAcceptance) {
    docs['communityRuleAcceptances/user-1'] = createCommunityRulesAcceptance();
  }

  if (rateLimitOverrides) {
    docs['communityRateLimits/user-1'] = {
      userId: 'user-1',
      recentMessageTimestamps: [],
      ...rateLimitOverrides,
    };
  }

  return docs;
};

const createHandlerHarness = ({
  docs = createBaseDocs(),
  nowMs = 0,
} = {}) => {
  const clock = { nowMs };
  const logger = createLoggerStub();
  const firestore = new MockFirestore(docs, () => clock.nowMs);
  const handler = createSendCommunityMessageHandler({
    firestore,
    fieldValue: createFieldValueStub(),
    logger,
    now: () => clock.nowMs,
  });
  const reactionHandler = createToggleCommunityReactionHandler({
    firestore,
    fieldValue: createFieldValueStub(),
    logger,
    now: () => clock.nowMs,
  });
  const blockHandler = createBlockCommunityUserHandler({
    firestore,
    fieldValue: createFieldValueStub(),
  });
  const unblockHandler = createUnblockCommunityUserHandler({
    firestore,
  });
  const reportHandler = createReportCommunityContentHandler({
    firestore,
    fieldValue: createFieldValueStub(),
    now: () => clock.nowMs,
  });
  const moderateReportHandler = createModerateCommunityReportHandler({
    firestore,
    fieldValue: createFieldValueStub(),
    now: () => clock.nowMs,
  });
  const markRoomReadHandler = createMarkCommunityRoomReadHandler({
    firestore,
    fieldValue: createFieldValueStub(),
  });
  const upsertRoomHandler = createUpsertCommunityRoomHandler({
    firestore,
    fieldValue: createFieldValueStub(),
  });
  const setRoomActiveHandler = createSetCommunityRoomActiveHandler({
    firestore,
    fieldValue: createFieldValueStub(),
  });
  const createEventRoomHandler = createEventCommunityRoomHandler({
    firestore,
    fieldValue: createFieldValueStub(),
    now: () => clock.nowMs,
  });
  const syncEventRoomsHandler = createSyncEventCommunityRoomsHandler({
    firestore,
    fieldValue: createFieldValueStub(),
    now: () => clock.nowMs,
  });
  const getRulesHandler = createGetCommunityRulesHandler({
    firestore,
    fieldValue: createFieldValueStub(),
  });
  const acceptRulesHandler = createAcceptCommunityRulesHandler({
    firestore,
    fieldValue: createFieldValueStub(),
  });
  const publishRulesHandler = createPublishCommunityRulesHandler({
    firestore,
    fieldValue: createFieldValueStub(),
  });
  const touchPresenceHandler = createTouchCommunityPresenceHandler({
    firestore,
    fieldValue: createFieldValueStub(),
    now: () => clock.nowMs,
  });
  const getPresenceSummaryHandler = createGetCommunityPresenceSummaryHandler({
    firestore,
    now: () => clock.nowMs,
  });

  return {
    clock,
    firestore,
    handler,
    blockHandler,
    markRoomReadHandler,
    unblockHandler,
    reportHandler,
    moderateReportHandler,
    reactionHandler,
    getRulesHandler,
    acceptRulesHandler,
    createEventRoomHandler,
    touchPresenceHandler,
    getPresenceSummaryHandler,
    publishRulesHandler,
    setRoomActiveHandler,
    syncEventRoomsHandler,
    upsertRoomHandler,
    logger,
  };
};

const createRequest = ({ auth = { uid: 'user-1', token: { email_verified: true } }, data = {} } = {}) => ({
  auth,
  data,
});

const expectHttpsError = async (promise, code) => {
  await assert.rejects(promise, (error) => error instanceof HttpsError && error.code === code);
};

test('Test 1: nicht authentifizierter Nutzer wird abgelehnt', async () => {
  const { handler } = createHandlerHarness();

  await expectHttpsError(handler(createRequest({ auth: null, data: { roomId: DEFAULT_COMMUNITY_ROOM_ID, text: 'Hallo' } })), 'unauthenticated');
});

test('Test 2: authentifizierter Nutzer ohne Altersverifikation wird abgelehnt', async () => {
  const { handler } = createHandlerHarness({
    docs: createBaseDocs({ userProfileOverrides: { ageVerified: false, ageVerificationStatus: 'not_started' } }),
  });

  await expectHttpsError(handler(createRequest({ data: { roomId: DEFAULT_COMMUNITY_ROOM_ID, text: 'Hallo' } })), 'permission-denied');
});

test('Test 3: authentifizierter und altersverifizierter Nutzer darf senden', async () => {
  const { handler } = createHandlerHarness();
  const result = await handler(createRequest({ data: { roomId: DEFAULT_COMMUNITY_ROOM_ID, text: 'Hallo Community' } }));

  assert.equal(result.ok, true);
  assert.equal(result.roomId, DEFAULT_COMMUNITY_ROOM_ID);
});

test('Test 4: nicht existierender Raum wird abgelehnt', async () => {
  const { handler } = createHandlerHarness();

  await expectHttpsError(handler(createRequest({ data: { roomId: 'missing-room', text: 'Hallo' } })), 'not-found');
});

test('Test 5: inaktiver Raum wird abgelehnt', async () => {
  const { handler } = createHandlerHarness({
    docs: createBaseDocs({ roomOverrides: { active: false } }),
  });

  await expectHttpsError(handler(createRequest({ data: { roomId: DEFAULT_COMMUNITY_ROOM_ID, text: 'Hallo' } })), 'failed-precondition');
});

test('Test 6: aktiver Raum speichert Nachricht', async () => {
  const { firestore, handler } = createHandlerHarness({ nowMs: 1_000 });
  const result = await handler(createRequest({ data: { roomId: DEFAULT_COMMUNITY_ROOM_ID, text: 'Night Whisper' } }));
  const messageEntry = firestore.store.get(`communityRooms/${DEFAULT_COMMUNITY_ROOM_ID}/messages/${result.messageId}`);

  assert.ok(messageEntry);
  assert.equal(messageEntry.data.roomId, DEFAULT_COMMUNITY_ROOM_ID);
  assert.equal(messageEntry.data.userId, 'user-1');
  assert.equal(messageEntry.data.nickname, 'Alice');
  assert.equal(messageEntry.data.text, 'Night Whisper');
});

test('Test 7: leere Nachricht wird abgelehnt', async () => {
  const { handler } = createHandlerHarness();

  await expectHttpsError(handler(createRequest({ data: { roomId: DEFAULT_COMMUNITY_ROOM_ID, text: '' } })), 'invalid-argument');
});

test('Test 8: reine Leerzeichen werden abgelehnt', async () => {
  const { handler } = createHandlerHarness();

  await expectHttpsError(handler(createRequest({ data: { roomId: DEFAULT_COMMUNITY_ROOM_ID, text: '   \n\t  ' } })), 'invalid-argument');
});

test('Test 9: 1000 Zeichen sind erlaubt', async () => {
  const { handler } = createHandlerHarness();
  const text = 'a'.repeat(COMMUNITY_MESSAGE_MAX_LENGTH);
  const result = await handler(createRequest({ data: { roomId: DEFAULT_COMMUNITY_ROOM_ID, text } }));

  assert.equal(result.ok, true);
});

test('Test 10: 1001 Zeichen werden abgelehnt', async () => {
  const { handler } = createHandlerHarness();
  const text = 'a'.repeat(COMMUNITY_MESSAGE_MAX_LENGTH + 1);

  await expectHttpsError(handler(createRequest({ data: { roomId: DEFAULT_COMMUNITY_ROOM_ID, text } })), 'invalid-argument');
});

test('Test 11 bis 14: Rate Limit erlaubt zwei Nachrichten in 5 Sekunden und danach wieder', async () => {
  const harness = createHandlerHarness({ nowMs: 0 });

  const first = await harness.handler(createRequest({ data: { roomId: DEFAULT_COMMUNITY_ROOM_ID, text: 'eins' } }));
  assert.equal(first.ok, true);

  harness.clock.nowMs = 2_000;
  const second = await harness.handler(createRequest({ data: { roomId: DEFAULT_COMMUNITY_ROOM_ID, text: 'zwei' } }));
  assert.equal(second.ok, true);

  harness.clock.nowMs = 3_000;
  await assert.rejects(
    harness.handler(createRequest({ data: { roomId: DEFAULT_COMMUNITY_ROOM_ID, text: 'drei' } })),
    (error) => error instanceof HttpsError && error.code === 'resource-exhausted' && error.message === COMMUNITY_RATE_LIMIT_ERROR_MESSAGE,
  );

  harness.clock.nowMs = 5_001;
  const fourth = await harness.handler(createRequest({ data: { roomId: DEFAULT_COMMUNITY_ROOM_ID, text: 'vier' } }));
  assert.equal(fourth.ok, true);
});

test('Test 15: parallele Requests können das Rate Limit nicht umgehen', async () => {
  const harness = createHandlerHarness({
    docs: createBaseDocs({
      rateLimitOverrides: {
        recentMessageTimestamps: [0],
      },
    }),
    nowMs: 1_000,
  });

  const [left, right] = await Promise.allSettled([
    harness.handler(createRequest({ data: { roomId: DEFAULT_COMMUNITY_ROOM_ID, text: 'parallel-1' } })),
    harness.handler(createRequest({ data: { roomId: DEFAULT_COMMUNITY_ROOM_ID, text: 'parallel-2' } })),
  ]);

  const fulfilledCount = [left, right].filter((entry) => entry.status === 'fulfilled').length;
  const rejectedCount = [left, right].filter((entry) => entry.status === 'rejected').length;
  const rateLimitEntry = harness.firestore.store.get('communityRateLimits/user-1');

  assert.equal(fulfilledCount, 1);
  assert.equal(rejectedCount, 1);
  assert.equal(rateLimitEntry.data.recentMessageTimestamps.length, 2);
});

test('Test 16: manipulierte userId-, nickname- und Timestamp-Felder vom Client werden ignoriert', async () => {
  const { firestore, handler } = createHandlerHarness({ nowMs: 10_000 });
  const result = await handler(createRequest({
    data: {
      roomId: DEFAULT_COMMUNITY_ROOM_ID,
      text: 'legitime Nachricht',
      userId: 'attacker',
      nickname: 'Fake',
      createdAt: '1999-01-01T00:00:00.000Z',
      moderationStatus: 'HIDDEN',
    },
  }));
  const messageEntry = firestore.store.get(`communityRooms/${DEFAULT_COMMUNITY_ROOM_ID}/messages/${result.messageId}`);

  assert.equal(messageEntry.data.userId, 'user-1');
  assert.equal(messageEntry.data.nickname, 'Alice');
  assert.equal(messageEntry.data.moderationStatus, 'VISIBLE');
  assert.notEqual(messageEntry.data.createdAt, '1999-01-01T00:00:00.000Z');
});

test('Reply: gültige replyToMessageId wird gespeichert', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      [`communityRooms/${DEFAULT_COMMUNITY_ROOM_ID}/messages/original-1`]: {
        id: 'original-1',
        roomId: DEFAULT_COMMUNITY_ROOM_ID,
        userId: 'user-2',
        nickname: 'Bob',
        text: 'Original',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null,
        moderationStatus: 'VISIBLE',
      },
    },
  });

  const result = await harness.handler(createRequest({
    data: {
      roomId: DEFAULT_COMMUNITY_ROOM_ID,
      text: 'Antwort',
      replyToMessageId: 'original-1',
    },
  }));
  const storedMessage = harness.firestore.store.get(`communityRooms/${DEFAULT_COMMUNITY_ROOM_ID}/messages/${result.messageId}`);

  assert.equal(storedMessage.data.replyToMessageId, 'original-1');
});

test('Reply: Cross-Room-Reply wird abgelehnt', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      'communityRooms/other-room/messages/original-2': {
        id: 'original-2',
        roomId: 'other-room',
        userId: 'user-2',
        nickname: 'Bob',
        text: 'Original',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null,
        moderationStatus: 'VISIBLE',
      },
    },
  });

  await expectHttpsError(harness.handler(createRequest({
    data: {
      roomId: DEFAULT_COMMUNITY_ROOM_ID,
      text: 'Antwort',
      replyToMessageId: 'original-2',
    },
  })), 'failed-precondition');
});

test('Reply: Antwort auf gelöschte Nachricht wird abgelehnt', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      [`communityRooms/${DEFAULT_COMMUNITY_ROOM_ID}/messages/original-3`]: {
        id: 'original-3',
        roomId: DEFAULT_COMMUNITY_ROOM_ID,
        userId: 'user-2',
        nickname: 'Bob',
        text: 'Original',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: '2026-01-01T00:10:00.000Z',
        moderationStatus: 'VISIBLE',
      },
    },
  });

  await expectHttpsError(harness.handler(createRequest({
    data: {
      roomId: DEFAULT_COMMUNITY_ROOM_ID,
      text: 'Antwort',
      replyToMessageId: 'original-3',
    },
  })), 'failed-precondition');
});

test('Reaktionen: erlaubte Reaktion wird gesetzt', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      [`communityRooms/${DEFAULT_COMMUNITY_ROOM_ID}/messages/message-1`]: {
        id: 'message-1',
        roomId: DEFAULT_COMMUNITY_ROOM_ID,
        userId: 'user-2',
        nickname: 'Bob',
        text: 'Original',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null,
        moderationStatus: 'VISIBLE',
        reactionCounts: { heart: 0, fire: 0, laugh: 0, like: 0 },
      },
    },
  });

  const result = await harness.reactionHandler(createRequest({
    data: {
      roomId: DEFAULT_COMMUNITY_ROOM_ID,
      messageId: 'message-1',
      reactionType: 'heart',
    },
  }));

  assert.equal(result.toggledOn, true);
  assert.equal(harness.firestore.store.get(`communityRooms/${DEFAULT_COMMUNITY_ROOM_ID}/messages/message-1/reactions/user-1_heart`).data.reactionType, 'heart');
  assert.equal(harness.firestore.store.get(`communityRooms/${DEFAULT_COMMUNITY_ROOM_ID}/messages/message-1`).data.reactionCounts.heart, 1);
});

test('Reaktionen: gleicher Klick entfernt die Reaktion', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      [`communityRooms/${DEFAULT_COMMUNITY_ROOM_ID}/messages/message-2`]: {
        id: 'message-2',
        roomId: DEFAULT_COMMUNITY_ROOM_ID,
        userId: 'user-2',
        nickname: 'Bob',
        text: 'Original',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null,
        moderationStatus: 'VISIBLE',
        reactionCounts: { heart: 1, fire: 0, laugh: 0, like: 0 },
      },
      [`communityRooms/${DEFAULT_COMMUNITY_ROOM_ID}/messages/message-2/reactions/user-1_heart`]: {
        roomId: DEFAULT_COMMUNITY_ROOM_ID,
        messageId: 'message-2',
        userId: 'user-1',
        reactionType: 'heart',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    },
  });

  const result = await harness.reactionHandler(createRequest({
    data: {
      roomId: DEFAULT_COMMUNITY_ROOM_ID,
      messageId: 'message-2',
      reactionType: 'heart',
    },
  }));

  assert.equal(result.toggledOn, false);
  assert.equal(harness.firestore.store.has(`communityRooms/${DEFAULT_COMMUNITY_ROOM_ID}/messages/message-2/reactions/user-1_heart`), false);
  assert.equal(harness.firestore.store.get(`communityRooms/${DEFAULT_COMMUNITY_ROOM_ID}/messages/message-2`).data.reactionCounts.heart, 0);
});

test('Reaktionen: ungültiger reactionType wird abgelehnt', async () => {
  const harness = createHandlerHarness();

  await expectHttpsError(harness.reactionHandler(createRequest({
    data: {
      roomId: DEFAULT_COMMUNITY_ROOM_ID,
      messageId: 'message-3',
      reactionType: 'invalid',
    },
  })), 'invalid-argument');
});

test('Reaktionen: Reaktion auf gelöschte Nachricht wird abgelehnt', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      [`communityRooms/${DEFAULT_COMMUNITY_ROOM_ID}/messages/message-4`]: {
        id: 'message-4',
        roomId: DEFAULT_COMMUNITY_ROOM_ID,
        userId: 'user-2',
        nickname: 'Bob',
        text: 'Original',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: '2026-01-01T00:10:00.000Z',
        moderationStatus: 'VISIBLE',
        reactionCounts: { heart: 0, fire: 0, laugh: 0, like: 0 },
      },
    },
  });

  await expectHttpsError(harness.reactionHandler(createRequest({
    data: {
      roomId: DEFAULT_COMMUNITY_ROOM_ID,
      messageId: 'message-4',
      reactionType: 'heart',
    },
  })), 'failed-precondition');
});

test('Mentions: gültige Mention wird serverseitig übernommen', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      'users/user-2': {
        uid: 'user-2',
        id: 'user-2',
        nickname: 'Bob',
        emailVerified: true,
        ageVerified: true,
        ageVerificationStatus: 'verified',
        accountDeletionRequestedAt: '',
        moderationState: 'clear',
      },
    },
  });

  const result = await harness.handler(createRequest({
    data: {
      roomId: DEFAULT_COMMUNITY_ROOM_ID,
      text: 'Hallo @Bob',
      mentions: [{ userId: 'user-2', nickname: 'Manipuliert' }],
    },
  }));
  const storedMessage = harness.firestore.store.get(`communityRooms/${DEFAULT_COMMUNITY_ROOM_ID}/messages/${result.messageId}`);

  assert.deepEqual(storedMessage.data.mentions, [{ userId: 'user-2', nickname: 'Bob' }]);
});

test('Mentions: manipulierte User-ID wird nicht blind übernommen', async () => {
  const harness = createHandlerHarness();
  const result = await harness.handler(createRequest({
    data: {
      roomId: DEFAULT_COMMUNITY_ROOM_ID,
      text: 'Hallo @Ghost',
      mentions: [{ userId: 'ghost-user', nickname: 'Ghost' }],
    },
  }));
  const storedMessage = harness.firestore.store.get(`communityRooms/${DEFAULT_COMMUNITY_ROOM_ID}/messages/${result.messageId}`);

  assert.deepEqual(storedMessage.data.mentions, []);
});

test('Blocking: Blockeintrag wird angelegt', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      'users/user-2': createVerifiedUserProfile({ uid: 'user-2', id: 'user-2', nickname: 'Bob' }),
    },
  });

  const result = await harness.blockHandler(createRequest({ data: { targetUserId: 'user-2' } }));

  assert.equal(result.ok, true);
  assert.ok(harness.firestore.store.get('communityBlocks/user-1__user-2'));
});

test('Blocking: Selbstblockierung wird abgelehnt', async () => {
  const harness = createHandlerHarness();

  await expectHttpsError(harness.blockHandler(createRequest({ data: { targetUserId: 'user-1' } })), 'invalid-argument');
});

test('Blocking: doppelte Blockierung erzeugt kein Duplikat', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      'users/user-2': createVerifiedUserProfile({ uid: 'user-2', id: 'user-2', nickname: 'Bob' }),
      'communityBlocks/user-1__user-2': {
        blockerUserId: 'user-1',
        blockedUserId: 'user-2',
        blockedNickname: 'Bob',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    },
  });

  const result = await harness.blockHandler(createRequest({ data: { targetUserId: 'user-2' } }));
  const blockEntries = Array.from(harness.firestore.store.keys()).filter((path) => path.startsWith('communityBlocks/'));

  assert.equal(blockEntries.length, 1);
  assert.equal(result.alreadyBlocked, true);
});

test('Blocking: Entblockieren entfernt den Eintrag', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      'communityBlocks/user-1__user-2': {
        blockerUserId: 'user-1',
        blockedUserId: 'user-2',
        blockedNickname: 'Bob',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    },
  });

  const result = await harness.unblockHandler(createRequest({ data: { targetUserId: 'user-2' } }));

  assert.equal(result.removed, true);
  assert.equal(harness.firestore.store.has('communityBlocks/user-1__user-2'), false);
});

test('Mentions: blockierte Nutzer erzeugen keine gegenseitige Mention', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      'users/user-2': createVerifiedUserProfile({ uid: 'user-2', id: 'user-2', nickname: 'Bob' }),
      'communityBlocks/user-1__user-2': {
        blockerUserId: 'user-1',
        blockedUserId: 'user-2',
        blockedNickname: 'Bob',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    },
  });

  const result = await harness.handler(createRequest({
    data: {
      roomId: DEFAULT_COMMUNITY_ROOM_ID,
      text: 'Hallo @Bob',
      mentions: [{ userId: 'user-2', nickname: 'Bob' }],
    },
  }));
  const storedMessage = harness.firestore.store.get(`communityRooms/${DEFAULT_COMMUNITY_ROOM_ID}/messages/${result.messageId}`);

  assert.deepEqual(storedMessage.data.mentions, []);
});

test('Reporting: normale Meldung erhält NORMAL', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      'users/user-2': createVerifiedUserProfile({ uid: 'user-2', id: 'user-2', nickname: 'Bob' }),
      [`communityRooms/${DEFAULT_COMMUNITY_ROOM_ID}/messages/report-message-1`]: {
        id: 'report-message-1',
        roomId: DEFAULT_COMMUNITY_ROOM_ID,
        userId: 'user-2',
        nickname: 'Bob',
        text: 'Spam',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null,
        moderationStatus: 'VISIBLE',
      },
    },
  });

  const result = await harness.reportHandler(createRequest({
    data: {
      roomId: DEFAULT_COMMUNITY_ROOM_ID,
      messageId: 'report-message-1',
      reason: COMMUNITY_REPORT_REASONS.SPAM,
      comment: 'Spam',
      priority: 'CRITICAL',
      reporterUserId: 'attacker',
    },
  }));
  const reportEntry = harness.firestore.store.get(`communityReports/${result.reportId}`);

  assert.equal(reportEntry.data.priority, COMMUNITY_REPORT_PRIORITIES.NORMAL);
  assert.equal(reportEntry.data.reporterUserId, 'user-1');
});

test('Reporting: Minderjährigkeit vermutet erhält CRITICAL', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      'users/user-2': createVerifiedUserProfile({ uid: 'user-2', id: 'user-2', nickname: 'Bob' }),
    },
  });

  const result = await harness.reportHandler(createRequest({
    data: {
      roomId: DEFAULT_COMMUNITY_ROOM_ID,
      targetUserId: 'user-2',
      reason: COMMUNITY_REPORT_REASONS.SUSPECTED_MINOR,
      comment: 'Wirkt sehr jung',
    },
  }));
  const reportEntry = harness.firestore.store.get(`communityReports/${result.reportId}`);

  assert.equal(reportEntry.data.priority, COMMUNITY_REPORT_PRIORITIES.CRITICAL);
});

test('Reporting: Nachricht aus falschem Raum wird abgelehnt', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      [`communityRooms/other-room/messages/report-message-2`]: {
        id: 'report-message-2',
        roomId: 'other-room',
        userId: 'user-2',
        nickname: 'Bob',
        text: 'Spam',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null,
        moderationStatus: 'VISIBLE',
      },
    },
  });

  await expectHttpsError(harness.reportHandler(createRequest({
    data: {
      roomId: DEFAULT_COMMUNITY_ROOM_ID,
      messageId: 'report-message-2',
      reason: COMMUNITY_REPORT_REASONS.SPAM,
    },
  })), 'not-found');
});

test('Reporting: identische Doppelmeldung wird verhindert', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      'users/user-2': createVerifiedUserProfile({ uid: 'user-2', id: 'user-2', nickname: 'Bob' }),
      [`communityRooms/${DEFAULT_COMMUNITY_ROOM_ID}/messages/report-message-3`]: {
        id: 'report-message-3',
        roomId: DEFAULT_COMMUNITY_ROOM_ID,
        userId: 'user-2',
        nickname: 'Bob',
        text: 'Spam',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null,
        moderationStatus: 'VISIBLE',
      },
    },
  });

  await harness.reportHandler(createRequest({
    data: {
      roomId: DEFAULT_COMMUNITY_ROOM_ID,
      messageId: 'report-message-3',
      reason: COMMUNITY_REPORT_REASONS.SPAM,
    },
  }));

  await expectHttpsError(harness.reportHandler(createRequest({
    data: {
      roomId: DEFAULT_COMMUNITY_ROOM_ID,
      messageId: 'report-message-3',
      reason: COMMUNITY_REPORT_REASONS.SPAM,
    },
  })), 'already-exists');
});

test('Chat-Sperre: ohne Ban bleibt Senden erlaubt', async () => {
  const harness = createHandlerHarness();
  const result = await harness.handler(createRequest({ data: { roomId: DEFAULT_COMMUNITY_ROOM_ID, text: 'ok' } }));

  assert.equal(result.ok, true);
});

test('Chat-Sperre: aktiver 24h-Ban blockiert Senden', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      'communitySafetyStates/user-1': {
        userId: 'user-1',
        chatBan: {
          active: true,
          until: '2026-01-02T00:00:00.000Z',
          reason: 'spam',
          createdAt: '2026-01-01T00:00:00.000Z',
          createdBy: 'admin-1',
        },
      },
    },
    nowMs: new Date('2026-01-01T12:00:00.000Z').getTime(),
  });

  await expectHttpsError(harness.handler(createRequest({ data: { roomId: DEFAULT_COMMUNITY_ROOM_ID, text: 'nein' } })), 'permission-denied');
});

test('Chat-Sperre: abgelaufener Ban erlaubt wieder Senden', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      'communitySafetyStates/user-1': {
        userId: 'user-1',
        chatBan: {
          active: true,
          until: '2026-01-01T00:00:00.000Z',
          reason: 'spam',
          createdAt: '2025-12-31T00:00:00.000Z',
          createdBy: 'admin-1',
        },
      },
    },
    nowMs: new Date('2026-01-02T00:00:00.000Z').getTime(),
  });

  const result = await harness.handler(createRequest({ data: { roomId: DEFAULT_COMMUNITY_ROOM_ID, text: 'wieder da' } }));
  assert.equal(result.ok, true);
});

test('Chat-Sperre: permanenter Ban blockiert Senden', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      'communitySafetyStates/user-1': {
        userId: 'user-1',
        chatBan: {
          active: true,
          until: null,
          reason: 'spam',
          createdAt: '2025-12-31T00:00:00.000Z',
          createdBy: 'admin-1',
        },
      },
    },
    nowMs: new Date('2026-01-02T00:00:00.000Z').getTime(),
  });

  await expectHttpsError(harness.handler(createRequest({ data: { roomId: DEFAULT_COMMUNITY_ROOM_ID, text: 'nie' } })), 'permission-denied');
});

test('Moderation: member darf Admin-Function nicht nutzen', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      'communityReports/r1': {
        id: 'r1',
        reportedUserId: 'user-2',
        roomId: DEFAULT_COMMUNITY_ROOM_ID,
        reason: COMMUNITY_REPORT_REASONS.SPAM,
        status: COMMUNITY_REPORT_STATUSES.OPEN,
      },
    },
  });

  await expectHttpsError(harness.moderateReportHandler(createRequest({
    data: { reportId: 'r1', action: COMMUNITY_MODERATION_ACTIONS.START_REVIEW },
  })), 'permission-denied');
});

test('Moderation: Admin startet Prüfung', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs({ userProfileOverrides: { isAdmin: true, role: 'admin' } }),
      'communityReports/r2': {
        id: 'r2',
        reportedUserId: 'user-2',
        roomId: DEFAULT_COMMUNITY_ROOM_ID,
        reason: COMMUNITY_REPORT_REASONS.SPAM,
        status: COMMUNITY_REPORT_STATUSES.OPEN,
      },
    },
  });

  const result = await harness.moderateReportHandler(createRequest({
    data: { reportId: 'r2', action: COMMUNITY_MODERATION_ACTIONS.START_REVIEW },
  }));

  assert.equal(result.status, COMMUNITY_REPORT_STATUSES.REVIEWING);
  assert.equal(harness.firestore.store.get('communityReports/r2').data.status, COMMUNITY_REPORT_STATUSES.REVIEWING);
});

test('Moderation: Admin entfernt Nachricht', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs({ userProfileOverrides: { isAdmin: true, role: 'admin' } }),
      [`communityRooms/${DEFAULT_COMMUNITY_ROOM_ID}/messages/message-mod-1`]: {
        id: 'message-mod-1',
        roomId: DEFAULT_COMMUNITY_ROOM_ID,
        userId: 'user-2',
        nickname: 'Bob',
        text: 'beleidigend',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null,
        moderationStatus: 'VISIBLE',
      },
      'communityReports/r3': {
        id: 'r3',
        reportedUserId: 'user-2',
        roomId: DEFAULT_COMMUNITY_ROOM_ID,
        messageId: 'message-mod-1',
        reason: COMMUNITY_REPORT_REASONS.INSULT,
        status: COMMUNITY_REPORT_STATUSES.OPEN,
      },
    },
  });

  await harness.moderateReportHandler(createRequest({
    data: { reportId: 'r3', action: COMMUNITY_MODERATION_ACTIONS.REMOVE_MESSAGE },
  }));

  const messageEntry = harness.firestore.store.get(`communityRooms/${DEFAULT_COMMUNITY_ROOM_ID}/messages/message-mod-1`);
  assert.equal(messageEntry.data.moderationStatus, 'REMOVED');
  assert.equal(messageEntry.data.text, '');
});

test('Moderation: Admin sperrt Nutzer serverseitig wirksam', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs({ userProfileOverrides: { isAdmin: true, role: 'admin' } }),
      'communityReports/r4': {
        id: 'r4',
        reportedUserId: 'user-2',
        roomId: DEFAULT_COMMUNITY_ROOM_ID,
        reason: COMMUNITY_REPORT_REASONS.HARASSMENT,
        status: COMMUNITY_REPORT_STATUSES.OPEN,
      },
    },
    nowMs: new Date('2026-01-01T00:00:00.000Z').getTime(),
  });

  await harness.moderateReportHandler(createRequest({
    data: { reportId: 'r4', action: COMMUNITY_MODERATION_ACTIONS.BAN_24H },
  }));

  const safetyState = harness.firestore.store.get('communitySafetyStates/user-2');
  assert.equal(safetyState.data.chatBan.active, true);
  assert.ok(safetyState.data.chatBan.until);
});

test('Moderation: Admin-Aktion erzeugt Moderationslog', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs({ userProfileOverrides: { isAdmin: true, role: 'admin' } }),
      'communityReports/r5': {
        id: 'r5',
        reportedUserId: 'user-2',
        roomId: DEFAULT_COMMUNITY_ROOM_ID,
        reason: COMMUNITY_REPORT_REASONS.HARASSMENT,
        status: COMMUNITY_REPORT_STATUSES.OPEN,
      },
    },
  });

  await harness.moderateReportHandler(createRequest({
    data: { reportId: 'r5', action: COMMUNITY_MODERATION_ACTIONS.WARN_USER },
  }));

  const logEntry = Array.from(harness.firestore.store.entries()).find(([path]) => path.startsWith('communityModerationLogs/'));
  assert.ok(logEntry);
});

test('Seed: fehlende Standardräume werden ergänzt und bestehende bleiben erhalten', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs({ userProfileOverrides: { isAdmin: true, role: 'admin' } }),
      [`communityRooms/${DEFAULT_COMMUNITY_ROOM_ID}`]: {
        ...createBaseDocs()[`communityRooms/${DEFAULT_COMMUNITY_ROOM_ID}`],
        description: 'Bereits vorhanden',
      },
    },
  });
  const seedHandler = require('../communityChat').createSeedCommunityRoomsHandler({
    firestore: harness.firestore,
    fieldValue: createFieldValueStub(),
  });

  const result = await seedHandler(createRequest({ data: {} }));

  assert.equal(result.created, true);
  assert.equal(harness.firestore.store.get(`communityRooms/${DEFAULT_COMMUNITY_ROOM_ID}`).data.description, 'Bereits vorhanden');
  assert.equal(result.createdRoomIds.length, DEFAULT_COMMUNITY_ROOMS.length - 1);
});

test('Raumzugriff: Nachricht an inaktiven Raum wird abgelehnt', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      'communityRooms/nrw': {
        id: 'nrw',
        name: 'NRW',
        slug: 'nrw',
        description: 'NRW',
        type: 'REGION',
        region: 'NRW',
        active: false,
      },
    },
  });

  await expectHttpsError(harness.handler(createRequest({ data: { roomId: 'nrw', text: 'Hallo NRW' } })), 'failed-precondition');
});

test('Read-State: Raum kann als gelesen markiert werden', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      'communityRooms/nrw': {
        id: 'nrw',
        name: 'NRW',
        slug: 'nrw',
        description: 'NRW',
        type: 'REGION',
        region: 'NRW',
        active: true,
      },
    },
  });

  const result = await harness.markRoomReadHandler(createRequest({ data: { roomId: 'nrw', lastReadMessageId: 'm1' } }));
  const readEntry = harness.firestore.store.get('communityRoomReads/user-1__nrw');

  assert.equal(result.ok, true);
  assert.equal(readEntry.data.roomId, 'nrw');
  assert.equal(readEntry.data.userId, 'user-1');
  assert.equal(readEntry.data.lastReadMessageId, 'm1');
  assert.equal(readEntry.data.lastReadMessageCount, 0);
});

test('Read-State: anderer Nutzer überschreibt den Read-State nicht', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      'users/user-2': createVerifiedUserProfile({ uid: 'user-2', id: 'user-2', nickname: 'Bob' }),
      'communityRuleAcceptances/user-2': createCommunityRulesAcceptance({
        userId: 'user-2',
      }),
      'communityRooms/nrw': {
        id: 'nrw',
        name: 'NRW',
        slug: 'nrw',
        description: 'NRW',
        type: 'REGION',
        region: 'NRW',
        active: true,
      },
    },
  });

  await harness.markRoomReadHandler(createRequest({ data: { roomId: 'nrw', lastReadMessageId: 'm1' } }));
  await harness.markRoomReadHandler(createRequest({ auth: { uid: 'user-2', token: { email_verified: true } }, data: { roomId: 'nrw', lastReadMessageId: 'm2' } }));

  assert.equal(harness.firestore.store.get('communityRoomReads/user-1__nrw').data.lastReadMessageId, 'm1');
  assert.equal(harness.firestore.store.get('communityRoomReads/user-2__nrw').data.lastReadMessageId, 'm2');
});

test('Community-Regeln: aktuelle Regeln werden bei Bedarf automatisch bereitgestellt', async () => {
  const harness = createHandlerHarness();

  const result = await harness.getRulesHandler(createRequest());

  assert.equal(result.rules.version, DEFAULT_COMMUNITY_RULES_VERSION);
  assert.ok(Array.isArray(result.rules.sections));
  assert.ok(result.rules.sections.length > 0);
  assert.equal(result.acceptance.latestAcceptedVersion, DEFAULT_COMMUNITY_RULES_VERSION);
  assert.ok(harness.firestore.store.get('communityConfig/rules'));
});

test('Community-Regeln: ohne aktuelle Zustimmung wird Senden abgelehnt', async () => {
  const harness = createHandlerHarness({
    docs: createBaseDocs({ includeRuleAcceptance: false }),
  });

  await expectHttpsError(harness.handler(createRequest({ data: { roomId: DEFAULT_COMMUNITY_ROOM_ID, text: 'Hallo Community' } })), 'permission-denied');
});

test('Community-Regeln: gültige aktuelle Version kann akzeptiert werden', async () => {
  const harness = createHandlerHarness({
    docs: createBaseDocs({ includeRuleAcceptance: false }),
  });

  const result = await harness.acceptRulesHandler(createRequest({ data: { rulesVersion: DEFAULT_COMMUNITY_RULES_VERSION } }));

  assert.equal(result.ok, true);
  assert.equal(result.alreadyAccepted, false);
  assert.equal(harness.firestore.store.get('communityRuleAcceptances/user-1').data.latestAcceptedVersion, DEFAULT_COMMUNITY_RULES_VERSION);
});

test('Community-Regeln: falsche Version wird beim Akzeptieren abgelehnt', async () => {
  const harness = createHandlerHarness({
    docs: createBaseDocs({ includeRuleAcceptance: false }),
  });

  await expectHttpsError(harness.acceptRulesHandler(createRequest({ data: { rulesVersion: '9.9' } })), 'failed-precondition');
});

test('Community-Regeln: erneutes Akzeptieren der aktuellen Version bleibt idempotent', async () => {
  const harness = createHandlerHarness();

  const result = await harness.acceptRulesHandler(createRequest({ data: { rulesVersion: DEFAULT_COMMUNITY_RULES_VERSION } }));

  assert.equal(result.ok, true);
  assert.equal(result.alreadyAccepted, true);
});

test('Community-Regeln: Admin kann neue Version veröffentlichen', async () => {
  const harness = createHandlerHarness({
    docs: createBaseDocs({ userProfileOverrides: { isAdmin: true, role: 'admin' } }),
  });

  const result = await harness.publishRulesHandler(createRequest({
    data: {
      version: '1.1',
      title: 'Night-Whisper Community-Regeln',
      sections: [
        {
          heading: '1. Respekt',
          paragraphs: ['Bleibe respektvoll.'],
        },
      ],
    },
  }));

  assert.equal(result.ok, true);
  assert.equal(harness.firestore.store.get('communityConfig/rules').data.version, '1.1');
  assert.ok(harness.firestore.store.get('communityRuleVersions/1.1'));
  const logEntry = Array.from(harness.firestore.store.entries()).find(([path, entry]) => path.startsWith('communityModerationLogs/') && entry.data.action === 'COMMUNITY_RULES_PUBLISHED');
  assert.ok(logEntry);
});

test('Community-Regeln: Member kann keine neue Version veröffentlichen', async () => {
  const harness = createHandlerHarness();

  await expectHttpsError(harness.publishRulesHandler(createRequest({
    data: {
      version: '1.1',
      title: 'Night-Whisper Community-Regeln',
      sections: [
        {
          heading: '1. Respekt',
          paragraphs: ['Bleibe respektvoll.'],
        },
      ],
    },
  })), 'permission-denied');
});

test('Community-Regeln: Versionssprung entzieht Schreibzugriff bis zur neuen Zustimmung', async () => {
  const harness = createHandlerHarness({
    docs: createBaseDocs({ userProfileOverrides: { isAdmin: true, role: 'admin' } }),
  });

  await harness.publishRulesHandler(createRequest({
    data: {
      version: '1.1',
      title: 'Night-Whisper Community-Regeln',
      sections: [
        {
          heading: '1. Respekt',
          paragraphs: ['Bleibe respektvoll.'],
        },
      ],
    },
  }));

  await expectHttpsError(harness.handler(createRequest({ data: { roomId: DEFAULT_COMMUNITY_ROOM_ID, text: 'Nach Versionssprung' } })), 'permission-denied');

  await harness.acceptRulesHandler(createRequest({ data: { rulesVersion: '1.1' } }));
  const result = await harness.handler(createRequest({ data: { roomId: DEFAULT_COMMUNITY_ROOM_ID, text: 'Nach neuer Zustimmung' } }));

  assert.equal(result.ok, true);
});

test('Presence: nicht authentifizierter Nutzer wird abgelehnt', async () => {
  const harness = createHandlerHarness();

  await expectHttpsError(harness.touchPresenceHandler(createRequest({ auth: null })), 'unauthenticated');
});

test('Presence: berechtigter Nutzer kann Community-Presence aktualisieren', async () => {
  const harness = createHandlerHarness({ nowMs: Date.parse('2026-08-23T12:00:00.000Z') });

  const result = await harness.touchPresenceHandler(createRequest());

  assert.equal(result.ok, true);
  assert.equal(result.roomId, null);
  assert.equal(harness.firestore.store.get('communityPresence/user-1').data.userId, 'user-1');
});

test('Presence: gueltiger Raum setzt currentRoomId', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      'communityRooms/nrw': {
        id: 'nrw',
        name: 'NRW',
        slug: 'nrw',
        description: 'NRW',
        type: 'REGION',
        region: 'NRW',
        active: true,
        messageCount: 3,
      },
    },
    nowMs: Date.parse('2026-08-23T12:00:00.000Z'),
  });

  const result = await harness.touchPresenceHandler(createRequest({ data: { roomId: 'nrw', userId: 'fake', updatedAt: '2000-01-01T00:00:00.000Z' } }));

  assert.equal(result.roomId, 'nrw');
  assert.equal(harness.firestore.store.get('communityPresence/user-1').data.currentRoomId, 'nrw');
});

test('Presence: ungültige roomId wird abgelehnt', async () => {
  const harness = createHandlerHarness();

  await expectHttpsError(harness.touchPresenceHandler(createRequest({ data: { roomId: 'missing-room' } })), 'failed-precondition');
});

test('Presence: versteckter Status geht nicht in Aggregat ein', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      'users/user-2': createVerifiedUserProfile({ uid: 'user-2', id: 'user-2', nickname: 'Bob', showCommunityActivityStatus: false }),
      'communityRuleAcceptances/user-2': createCommunityRulesAcceptance({ userId: 'user-2' }),
      'communityPresence/user-1': {
        userId: 'user-1',
        currentRoomId: 'whisper-lounge',
        showActivityStatus: true,
        lastActiveAt: '2026-08-23T11:58:00.000Z',
        updatedAt: '2026-08-23T11:58:00.000Z',
      },
      'communityPresence/user-2': {
        userId: 'user-2',
        currentRoomId: 'whisper-lounge',
        showActivityStatus: false,
        lastActiveAt: '2026-08-23T11:58:00.000Z',
        updatedAt: '2026-08-23T11:58:00.000Z',
      },
    },
    nowMs: Date.parse('2026-08-23T12:00:00.000Z'),
  });

  const result = await harness.getPresenceSummaryHandler(createRequest());

  assert.equal(result.summary.activeMemberCount, 1);
  assert.equal(result.summary.roomActiveCounts['whisper-lounge'], 1);
});

test('Presence-Status: ACTIVE, RECENT und OFFLINE werden korrekt abgeleitet', () => {
  const nowMs = Date.parse('2026-08-23T12:00:00.000Z');

  assert.equal(getCommunityPresenceStatus({ lastActiveAt: '2026-08-23T11:56:00.000Z', nowMs }), COMMUNITY_PRESENCE_STATUSES.ACTIVE);
  assert.equal(getCommunityPresenceStatus({ lastActiveAt: '2026-08-23T11:10:00.000Z', nowMs }), COMMUNITY_PRESENCE_STATUSES.RECENT);
  assert.equal(getCommunityPresenceStatus({ lastActiveAt: '2026-08-23T09:30:00.000Z', nowMs }), COMMUNITY_PRESENCE_STATUSES.OFFLINE);
});

test('Admin: member kann keinen Raum erstellen', async () => {
  const harness = createHandlerHarness();

  await expectHttpsError(harness.upsertRoomHandler(createRequest({
    data: {
      name: 'Test',
      slug: 'test',
      description: 'Beschreibung',
      type: 'GLOBAL',
      active: true,
    },
  })), 'permission-denied');
});

test('Admin: admin kann Raum erstellen', async () => {
  const harness = createHandlerHarness({
    docs: createBaseDocs({ userProfileOverrides: { isAdmin: true, role: 'admin' } }),
  });

  const result = await harness.upsertRoomHandler(createRequest({
    data: {
      name: 'Test Raum',
      slug: 'test-raum',
      description: 'Beschreibung',
      type: 'GLOBAL',
      active: true,
    },
  }));

  assert.equal(result.created, true);
  assert.ok(harness.firestore.store.get('communityRooms/test-raum'));
});

test('Admin: doppelter Slug wird abgelehnt', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs({ userProfileOverrides: { isAdmin: true, role: 'admin' } }),
      'communityRooms/nrw': {
        id: 'nrw',
        name: 'NRW',
        slug: 'nrw',
        description: 'NRW',
        type: 'REGION',
        region: 'NRW',
        active: true,
      },
    },
  });

  await expectHttpsError(harness.upsertRoomHandler(createRequest({
    data: {
      roomId: 'anderes-nrw',
      name: 'Anderes NRW',
      slug: 'nrw',
      description: 'Beschreibung',
      type: 'GLOBAL',
      active: true,
    },
  })), 'already-exists');
});

test('Admin: admin kann Raum deaktivieren', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs({ userProfileOverrides: { isAdmin: true, role: 'admin' } }),
      'communityRooms/nrw': {
        id: 'nrw',
        name: 'NRW',
        slug: 'nrw',
        description: 'NRW',
        type: 'REGION',
        region: 'NRW',
        active: true,
      },
    },
  });

  const result = await harness.setRoomActiveHandler(createRequest({ data: { roomId: 'nrw', active: false } }));

  assert.equal(result.active, false);
  assert.equal(harness.firestore.store.get('communityRooms/nrw').data.active, false);
});

test('Generalisierung: sendCommunityMessage funktioniert mit anderem gültigen roomId', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      'communityRooms/nrw': {
        id: 'nrw',
        name: 'NRW',
        slug: 'nrw',
        description: 'NRW',
        type: 'REGION',
        region: 'NRW',
        active: true,
      },
    },
  });

  const result = await harness.handler(createRequest({ data: { roomId: 'nrw', text: 'Hallo' } }));
  assert.equal(result.roomId, 'nrw');
  assert.ok(harness.firestore.store.get(`communityRooms/nrw/messages/${result.messageId}`));
});

test('Generalisierung: Replies funktionieren raumbezogen', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      'communityRooms/nrw': {
        id: 'nrw',
        name: 'NRW',
        slug: 'nrw',
        description: 'NRW',
        type: 'REGION',
        region: 'NRW',
        active: true,
      },
      'communityRooms/nrw/messages/root': {
        id: 'root',
        roomId: 'nrw',
        userId: 'user-2',
        nickname: 'Bob',
        text: 'Start',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null,
        moderationStatus: 'VISIBLE',
      },
    },
  });

  const result = await harness.handler(createRequest({ data: { roomId: 'nrw', text: 'Antwort', replyToMessageId: 'root' } }));
  assert.equal(harness.firestore.store.get(`communityRooms/nrw/messages/${result.messageId}`).data.replyToMessageId, 'root');
});

test('Generalisierung: Reaktionen funktionieren raumbezogen', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      'communityRooms/nrw': {
        id: 'nrw',
        name: 'NRW',
        slug: 'nrw',
        description: 'NRW',
        type: 'REGION',
        region: 'NRW',
        active: true,
      },
      'communityRooms/nrw/messages/m1': {
        id: 'm1',
        roomId: 'nrw',
        userId: 'user-2',
        nickname: 'Bob',
        text: 'Start',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null,
        moderationStatus: 'VISIBLE',
        reactionCounts: { heart: 0, fire: 0, laugh: 0, like: 0 },
      },
    },
  });

  const result = await harness.reactionHandler(createRequest({ data: { roomId: 'nrw', messageId: 'm1', reactionType: 'heart' } }));
  assert.equal(result.roomId, 'nrw');
  assert.equal(harness.firestore.store.get('communityRooms/nrw/messages/m1').data.reactionCounts.heart, 1);
});

test('Event-Raum: Admin erstellt Event-Chat', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs({ userProfileOverrides: { isAdmin: true, role: 'admin' } }),
      'events/e1': createEventDocument(),
    },
    nowMs: Date.parse('2026-09-10T12:00:00.000Z'),
  });

  const result = await harness.createEventRoomHandler(createRequest({ data: { eventId: 'e1' } }));

  assert.equal(result.created, true);
  assert.equal(result.roomId, 'event-e1');
  assert.equal(harness.firestore.store.get('communityRooms/event-e1').data.type, 'EVENT');
  assert.equal(harness.firestore.store.get('communityRooms/event-e1').data.eventId, 'e1');
  assert.equal(harness.firestore.store.get('communityRooms/event-e1').data.active, true);
});

test('Event-Raum: ungültige Event-ID wird abgelehnt', async () => {
  const harness = createHandlerHarness({
    docs: createBaseDocs({ userProfileOverrides: { isAdmin: true, role: 'admin' } }),
  });

  await expectHttpsError(harness.createEventRoomHandler(createRequest({ data: { eventId: 'missing-event' } })), 'not-found');
});

test('Event-Raum: member darf keinen Event-Chat erstellen', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      'events/e1': createEventDocument(),
    },
  });

  await expectHttpsError(harness.createEventRoomHandler(createRequest({ data: { eventId: 'e1' } })), 'permission-denied');
});

test('Event-Raum: bestehender Chat wird wiederverwendet', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs({ userProfileOverrides: { isAdmin: true, role: 'admin' } }),
      'events/e1': createEventDocument(),
      'communityRooms/event-e1': {
        id: 'event-e1',
        name: 'Alter Name',
        slug: 'event-alter-name-e1',
        description: 'Alt',
        type: 'EVENT',
        region: null,
        active: true,
        manualActive: true,
        eventId: 'e1',
        createdBy: 'admin',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    },
    nowMs: Date.parse('2026-09-10T12:00:00.000Z'),
  });

  const result = await harness.createEventRoomHandler(createRequest({ data: { eventId: 'e1' } }));

  assert.equal(result.created, false);
  assert.equal(result.roomId, 'event-e1');
  assert.equal(harness.firestore.store.get('communityRooms/event-e1').data.name, 'Midnight Party Köln');
});

test('Event-Raumstatus: mehr als 7 Tage vorher noch nicht sichtbar', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs({ userProfileOverrides: { isAdmin: true, role: 'admin' } }),
      'events/e1': createEventDocument({ date: '14.09.2026', time: '21:00' }),
    },
    nowMs: Date.parse('2026-09-01T10:00:00.000Z'),
  });

  await harness.createEventRoomHandler(createRequest({ data: { eventId: 'e1' } }));
  assert.equal(harness.firestore.store.get('communityRooms/event-e1').data.active, false);
});

test('Event-Raumstatus: innerhalb von 7 Tagen sichtbar', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs({ userProfileOverrides: { isAdmin: true, role: 'admin' } }),
      'events/e1': createEventDocument({ date: '14.09.2026', time: '21:00' }),
    },
    nowMs: Date.parse('2026-09-10T10:00:00.000Z'),
  });

  await harness.createEventRoomHandler(createRequest({ data: { eventId: 'e1' } }));
  assert.equal(harness.firestore.store.get('communityRooms/event-e1').data.active, true);
});

test('Event-Raumstatus: 24 Stunden nach Event noch sichtbar', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      'events/e1': createEventDocument({ date: '14.09.2026', time: '21:00' }),
      'communityRooms/event-e1': {
        id: 'event-e1',
        name: 'Midnight Party Köln',
        slug: 'event-midnight-party-koeln-e1',
        description: 'Community-Chat',
        type: 'EVENT',
        region: null,
        active: true,
        manualActive: true,
        eventId: 'e1',
        createdBy: 'admin',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    },
    nowMs: Date.parse('2026-09-15T22:00:00.000Z'),
  });

  const result = await harness.syncEventRoomsHandler(createRequest({ data: {} }));
  assert.equal(result.rooms[0].active, true);
});

test('Event-Raumstatus: mehr als 48 Stunden nach Event nicht mehr aktiv', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      'events/e1': createEventDocument({ date: '14.09.2026', time: '21:00' }),
      'communityRooms/event-e1': {
        id: 'event-e1',
        name: 'Midnight Party Köln',
        slug: 'event-midnight-party-koeln-e1',
        description: 'Community-Chat',
        type: 'EVENT',
        region: null,
        active: true,
        manualActive: true,
        eventId: 'e1',
        createdBy: 'admin',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    },
    nowMs: Date.parse('2026-09-17T23:30:00.000Z'),
  });

  const result = await harness.syncEventRoomsHandler(createRequest({ data: {} }));
  assert.equal(result.rooms[0].active, false);
  assert.equal(harness.firestore.store.get('communityRooms/event-e1').data.active, false);
});

test('Event-Raum: Senden funktioniert im EVENT-Raum mit denselben Community-Regeln', async () => {
  const harness = createHandlerHarness({
    docs: {
      ...createBaseDocs(),
      'events/e1': createEventDocument({ date: '14.09.2026', time: '21:00' }),
      'communityRooms/event-e1': {
        id: 'event-e1',
        name: 'Midnight Party Köln',
        slug: 'event-midnight-party-koeln-e1',
        description: 'Community-Chat',
        type: 'EVENT',
        region: null,
        active: true,
        manualActive: true,
        eventId: 'e1',
        createdBy: 'admin',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    },
    nowMs: Date.parse('2026-09-10T10:00:00.000Z'),
  });

  const result = await harness.handler(createRequest({ data: { roomId: 'event-e1', text: 'Bis spaeter auf dem Event' } }));
  assert.equal(result.roomId, 'event-e1');
  assert.ok(harness.firestore.store.get(`communityRooms/event-e1/messages/${result.messageId}`));
});
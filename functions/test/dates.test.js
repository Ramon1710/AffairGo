const test = require('node:test');
const assert = require('node:assert/strict');
const { HttpsError } = require('firebase-functions/v2/https');
const {
  DATE_STATUS,
  createCancelDateHandler,
  createCreateDateHandler,
  createListDatesHandler,
  createModerateDateHandler,
  createToggleDateInterestHandler,
  createUpdateDateHandler,
} = require('../dates');

const clone = (value) => JSON.parse(JSON.stringify(value));

const normalizeComparableValue = (value) => {
  if (value instanceof Date) {
    return value.getTime();
  }

  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    return numericValue;
  }

  const timestamp = Date.parse(value);
  if (Number.isFinite(timestamp)) {
    return timestamp;
  }

  return Number.NaN;
};

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
    return new MockDocumentSnapshot(this, this.firestore.store.get(this.path) || null);
  }

  async set(data, options = {}) {
    const currentEntry = this.firestore.store.get(this.path);
    const resolvedData = this.firestore._resolveSentinels(clone(data));
    const nextData = options.merge ? { ...(currentEntry?.data || {}), ...resolvedData } : resolvedData;
    this.firestore.store.set(this.path, { data: nextData });
  }

  async delete() {
    this.firestore.store.delete(this.path);
  }
}

class MockCollectionReference {
  constructor(firestore, path) {
    this.firestore = firestore;
    this.path = path;
    this.filters = [];
  }

  doc(id) {
    const nextId = id || this.firestore._nextId(this.path);
    return new MockDocumentReference(this.firestore, `${this.path}/${nextId}`);
  }

  where(field, operator, value) {
    const nextRef = new MockCollectionReference(this.firestore, this.path);
    nextRef.filters = [...this.filters, { field, operator, value }];
    return nextRef;
  }

  async get() {
    const docs = Array.from(this.firestore.store.entries())
      .filter(([path]) => path.startsWith(`${this.path}/`) && path.split('/').length === this.path.split('/').length + 1)
      .filter(([, entry]) => this.filters.every(({ field, operator, value }) => {
        const entryValue = entry.data?.[field];

        if (operator === '==') {
          return entryValue === value;
        }

        if (operator === '>') {
          return normalizeComparableValue(entryValue) > normalizeComparableValue(value);
        }

        return false;
      }))
      .map(([path, entry]) => ({
        id: path.split('/').pop(),
        data: () => clone(entry.data),
      }));

    return { docs };
  }
}

class MockFirestore {
  constructor(initialDocs = {}, nowProvider = () => Date.now()) {
    this.nowProvider = nowProvider;
    this.autoIds = new Map();
    this.store = new Map();

    Object.entries(initialDocs).forEach(([path, data]) => {
      this.store.set(path, { data: clone(data) });
    });
  }

  collection(path) {
    return new MockCollectionReference(this, path);
  }

  _nextId(path) {
    const nextValue = (this.autoIds.get(path) || 0) + 1;
    this.autoIds.set(path, nextValue);
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
}

const createFieldValueStub = () => ({
  serverTimestamp: () => ({ __type: 'serverTimestamp' }),
});

const createTimestampStub = () => ({
  fromDate: (value) => value,
});

const createRequest = ({ uid = 'alice', data = {} } = {}) => ({
  auth: uid ? { uid } : null,
  data,
});

const expectHttpsError = async (promise, code) => {
  await assert.rejects(promise, (error) => error instanceof HttpsError && error.code === code);
};

const createBaseDocs = (nowMs = Date.now()) => ({
  'communityConfig/rules': {
    version: '1.0',
  },
  'communityRuleAcceptances/alice': {
    latestAcceptedVersion: '1.0',
  },
  'communityRuleAcceptances/bob': {
    latestAcceptedVersion: '1.0',
  },
  'users/alice': {
    nickname: 'Alice',
    emailVerified: true,
    ageVerified: true,
    ageVerificationStatus: 'verified',
    accountDeletionRequestedAt: '',
    moderationState: 'clear',
    dismissedProfileIds: [],
  },
  'users/bob': {
    nickname: 'Bob',
    emailVerified: true,
    ageVerified: true,
    ageVerificationStatus: 'verified',
    accountDeletionRequestedAt: '',
    moderationState: 'clear',
    dismissedProfileIds: [],
  },
  'users/admin': {
    nickname: 'Admin',
    isAdmin: true,
    role: 'admin',
    emailVerified: true,
    ageVerified: true,
    ageVerificationStatus: 'verified',
    accountDeletionRequestedAt: '',
    moderationState: 'clear',
    dismissedProfileIds: [],
  },
  'dates/date-1': {
    id: 'date-1',
    creatorId: 'alice',
    creatorNickname: 'Alice',
    title: 'Freitag essen gehen',
    description: 'Gemeinsam essen und reden in der Stadt.',
    category: '',
    locationQuery: 'Hamburg',
    publicPlaceLabel: 'Innenstadt',
    cityLabel: 'Hamburg',
    regionLabel: 'Hamburg',
    coordinate: { latitude: 53.5511, longitude: 9.9937 },
    geohash: 'u1x0es5x',
    locationResolution: 'city_catalog',
    visibility: 'community',
    status: 'active',
    scheduledAt: new Date(nowMs + (24 * 60 * 60 * 1000)).toISOString(),
    scheduledAtMs: nowMs + (24 * 60 * 60 * 1000),
    interestCount: 0,
  },
});

test('Dates: createDate setzt creatorId ausschließlich aus request.auth.uid', async () => {
  const firestore = new MockFirestore(createBaseDocs());
  const createDateHandler = createCreateDateHandler({
    firestore,
    fieldValue: createFieldValueStub(),
    timestamp: createTimestampStub(),
  });

  const result = await createDateHandler(createRequest({
    uid: 'alice',
    data: {
      creatorId: 'mallory',
      title: 'Samstagabend im Club',
      description: 'Suche Begleitung für einen gemeinsamen Abend im Club.',
      locationQuery: 'Berlin',
      publicPlaceLabel: 'Club am Ring',
      scheduledAt: Date.now() + (2 * 24 * 60 * 60 * 1000),
      clientRequestId: 'create-date-alice-1',
      visibility: 'community',
    },
  }));

  assert.equal(result.date.creatorId, 'alice');
  assert.equal(result.date.status, DATE_STATUS.ACTIVE);
});

test('Dates: ohne aktuelle Regelzustimmung wird createDate abgelehnt', async () => {
  const docs = createBaseDocs();
  delete docs['communityRuleAcceptances/alice'];
  const firestore = new MockFirestore(docs);
  const createDateHandler = createCreateDateHandler({
    firestore,
    fieldValue: createFieldValueStub(),
    timestamp: createTimestampStub(),
  });

  await expectHttpsError(createDateHandler(createRequest({
    uid: 'alice',
    data: {
      title: 'Samstagabend im Club',
      description: 'Suche Begleitung für einen gemeinsamen Abend im Club.',
      locationQuery: 'Berlin',
      scheduledAt: Date.now() + (2 * 24 * 60 * 60 * 1000),
      visibility: 'community',
    },
  })), 'permission-denied');
});

test('Dates: vergangene Termine werden serverseitig abgelehnt', async () => {
  const firestore = new MockFirestore(createBaseDocs());
  const createDateHandler = createCreateDateHandler({
    firestore,
    fieldValue: createFieldValueStub(),
    timestamp: createTimestampStub(),
  });

  await expectHttpsError(createDateHandler(createRequest({
    uid: 'alice',
    data: {
      title: 'Zu spät',
      description: 'Dieses Date liegt bereits in der Vergangenheit.',
      locationQuery: 'Köln',
      scheduledAt: Date.now() - (60 * 60 * 1000),
      visibility: 'community',
    },
  })), 'invalid-argument');
});

test('Dates: fehlende Pflichtfelder werden abgelehnt', async () => {
  const firestore = new MockFirestore(createBaseDocs());
  const createDateHandler = createCreateDateHandler({
    firestore,
    fieldValue: createFieldValueStub(),
    timestamp: createTimestampStub(),
  });

  await expectHttpsError(createDateHandler(createRequest({
    uid: 'alice',
    data: {
      title: '',
      description: 'Kurzer Test ohne Aktivität.',
      locationQuery: 'Berlin',
      scheduledAt: Date.now() + (2 * 24 * 60 * 60 * 1000),
      visibility: 'community',
    },
  })), 'invalid-argument');
});

test('Dates: ungültiger Ort oder fehlende Geo-Daten werden behandelt', async () => {
  const firestore = new MockFirestore(createBaseDocs());
  const createDateHandler = createCreateDateHandler({
    firestore,
    fieldValue: createFieldValueStub(),
    timestamp: createTimestampStub(),
  });

  await expectHttpsError(createDateHandler(createRequest({
    uid: 'alice',
    data: {
      title: 'Unbekannter Ort',
      description: 'Soll an einem nicht auflösbaren Ort stattfinden.',
      locationQuery: '99999',
      scheduledAt: Date.now() + (2 * 24 * 60 * 60 * 1000),
      visibility: 'community',
    },
  })), 'invalid-argument');
});

test('Dates: fremdes Date kann nicht bearbeitet oder abgesagt werden', async () => {
  const firestore = new MockFirestore(createBaseDocs());
  const updateDateHandler = createUpdateDateHandler({
    firestore,
    fieldValue: createFieldValueStub(),
    timestamp: createTimestampStub(),
  });
  const cancelDateHandler = createCancelDateHandler({
    firestore,
    fieldValue: createFieldValueStub(),
  });

  await expectHttpsError(updateDateHandler(createRequest({
    uid: 'bob',
    data: {
      dateId: 'date-1',
      title: 'Manipuliert',
      description: 'Manipuliert Manipuliert Manipuliert',
      locationQuery: 'Koeln',
      scheduledAt: Date.now() + (3 * 24 * 60 * 60 * 1000),
      visibility: 'community',
    },
  })), 'permission-denied');

  await expectHttpsError(cancelDateHandler(createRequest({
    uid: 'bob',
    data: { dateId: 'date-1' },
  })), 'permission-denied');
});

test('Dates: blockierte Nutzer können kein Interesse bekunden', async () => {
  const docs = createBaseDocs();
  docs['users/alice'].dismissedProfileIds = ['bob'];
  const firestore = new MockFirestore(docs);
  const toggleDateInterestHandler = createToggleDateInterestHandler({
    firestore,
    fieldValue: createFieldValueStub(),
  });

  await expectHttpsError(toggleDateInterestHandler(createRequest({
    uid: 'bob',
    data: {
      dateId: 'date-1',
      interested: true,
    },
  })), 'permission-denied');
});

test('Dates: listDates filtert blockierte Ersteller serverseitig aus', async () => {
  const docs = createBaseDocs();
  docs['users/alice'].dismissedProfileIds = ['bob'];
  docs['dates/date-2'] = {
    id: 'date-2',
    creatorId: 'bob',
    creatorNickname: 'Bob',
    title: 'Date von Bob',
    description: 'Gemeinsam ausgehen und reden.',
    category: '',
    regionLabel: 'Berlin',
    visibility: 'community',
    status: 'active',
    scheduledAt: new Date(Date.now() + (48 * 60 * 60 * 1000)),
    scheduledAtMs: Date.now() + (48 * 60 * 60 * 1000),
    interestCount: 0,
  };
  const firestore = new MockFirestore(docs);
  const listDatesHandler = createListDatesHandler({ firestore });

  const result = await listDatesHandler(createRequest({ uid: 'alice' }));

  assert.deepEqual(result.dates.map((entry) => entry.id), ['date-1']);
});

test('Dates: Admin kann problematische Dates deaktivieren', async () => {
  const firestore = new MockFirestore(createBaseDocs());
  const moderateDateHandler = createModerateDateHandler({
    firestore,
    fieldValue: createFieldValueStub(),
  });

  const result = await moderateDateHandler(createRequest({
    uid: 'admin',
    data: {
      dateId: 'date-1',
      action: 'disable',
    },
  }));

  assert.equal(result.status, DATE_STATUS.DISABLED);
  const snapshot = await firestore.collection('dates').doc('date-1').get();
  assert.equal(snapshot.data().status, DATE_STATUS.DISABLED);
});

test('Dates: eigenes Date kann bearbeitet und abgesagt werden', async () => {
  const firestore = new MockFirestore(createBaseDocs());
  const updateDateHandler = createUpdateDateHandler({
    firestore,
    fieldValue: createFieldValueStub(),
    timestamp: createTimestampStub(),
  });
  const cancelDateHandler = createCancelDateHandler({
    firestore,
    fieldValue: createFieldValueStub(),
  });

  await updateDateHandler(createRequest({
    uid: 'alice',
    data: {
      dateId: 'date-1',
      title: 'Samstag gemeinsam essen gehen',
      description: 'Nun am Samstagabend gemeinsam essen gehen.',
      locationQuery: 'Berlin',
      publicPlaceLabel: 'Café Mitte',
      scheduledAt: Date.now() + (3 * 24 * 60 * 60 * 1000),
      visibility: 'community',
    },
  }));

  let snapshot = await firestore.collection('dates').doc('date-1').get();
  assert.equal(snapshot.data().title, 'Samstag gemeinsam essen gehen');
  assert.equal(snapshot.data().cityLabel, 'Berlin');
  assert.equal(snapshot.data().regionLabel, 'Café Mitte, Berlin');

  await cancelDateHandler(createRequest({
    uid: 'alice',
    data: { dateId: 'date-1' },
  }));

  snapshot = await firestore.collection('dates').doc('date-1').get();
  assert.equal(snapshot.data().status, DATE_STATUS.CANCELLED);
});

test('Dates: Doppelklick mit gleicher clientRequestId erzeugt kein doppeltes Date', async () => {
  const firestore = new MockFirestore(createBaseDocs());
  const createDateHandler = createCreateDateHandler({
    firestore,
    fieldValue: createFieldValueStub(),
    timestamp: createTimestampStub(),
  });
  const payload = {
    title: 'Dienstag im Café',
    description: 'Suche Begleitung zum Kaffeetrinken.',
    locationQuery: 'Köln',
    publicPlaceLabel: 'Café Altstadt',
    scheduledAt: Date.now() + (2 * 24 * 60 * 60 * 1000),
    clientRequestId: 'double-click-safe-1',
    visibility: 'community',
  };

  const firstResult = await createDateHandler(createRequest({ uid: 'alice', data: payload }));
  const secondResult = await createDateHandler(createRequest({ uid: 'alice', data: payload }));

  assert.equal(firstResult.dateId, secondResult.dateId);
  assert.equal(secondResult.duplicate, true);
  const allDates = await firestore.collection('dates').get();
  assert.equal(allDates.docs.filter((entry) => entry.id.includes('double-click-safe-1')).length, 1);
});
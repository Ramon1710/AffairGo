// Echte firestore.rules im Firestore-Emulator. Start über: npm run test:rules
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, where } from 'firebase/firestore';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { after, before, beforeEach } from 'node:test';

const PROJECT_ID = 'affairgo-rules-test';
const CURRENT_RULES_VERSION = '1.0';
const COMMUNITY_MESSAGE_TTL_MS = 60 * 60 * 1000;
const CLIENT_QUERY_TIME_SAFETY_MS = 5 * 1000;
const STARTER_ROOMS = [
  { id: 'whisper-lounge', name: 'Offener Treffpunkt' },
  { id: 'kennenlernen-und-flirten', name: 'Kennenlernen und Flirten' },
  { id: 'swinger-und-paare', name: 'Swinger und Paare' },
  { id: 'sex-und-fantasien', name: 'Sex und Fantasien' },
];

let testEnv;
let seededNowMs = Date.now();

const buildCommunityMessageTestTimes = (nowMs = seededNowMs) => ({
  visibleCreatedAt: new Date(nowMs - (15 * 60 * 1000)),
  visibleExpiresAt: new Date(nowMs + (45 * 60 * 1000)),
  expiredCreatedAt: new Date(nowMs - (2 * COMMUNITY_MESSAGE_TTL_MS)),
  expiredExpiresAt: new Date(nowMs - (60 * 1000)),
  visibilityStart: new Date(nowMs - (30 * 60 * 1000)),
  queryLowerBound: new Date(nowMs + CLIENT_QUERY_TIME_SAFETY_MS),
  queryUpperBound: new Date(nowMs + COMMUNITY_MESSAGE_TTL_MS + CLIENT_QUERY_TIME_SAFETY_MS),
});

const verifiedProfile = (overrides = {}) => ({
  emailVerified: true,
  ageVerified: true,
  ageVerificationStatus: 'verified',
  accountDeletionRequestedAt: '',
  moderationState: 'clear',
  nickname: 'Tester',
  ...overrides,
});

const seedBaseData = async (db) => {
  const {
    visibleCreatedAt,
    visibleExpiresAt,
    expiredCreatedAt,
    expiredExpiresAt,
  } = buildCommunityMessageTestTimes();

  await setDoc(doc(db, 'communityConfig', 'rules'), {
    version: CURRENT_RULES_VERSION,
    title: 'Night-Whisper Community-Regeln',
    sections: [{ heading: '1. Respekt', paragraphs: ['Bleibe respektvoll.'] }],
    active: true,
  });

  await setDoc(doc(db, 'communityRooms', 'whisper-lounge'), {
    name: 'Whisper Lounge',
    type: 'GLOBAL',
    active: true,
  });

  for (const room of STARTER_ROOMS) {
    await setDoc(doc(db, 'communityRooms', room.id), {
      id: room.id,
      name: room.name,
      slug: room.id,
      description: `${room.name} Beschreibung`,
      type: 'GLOBAL',
      region: null,
      active: true,
      manualActive: true,
      messageCount: 0,
    });
  }

  await setDoc(doc(db, 'communityRooms', 'archived-room'), {
    name: 'Archiv',
    type: 'GLOBAL',
    active: false,
  });

  await setDoc(doc(db, 'communityRooms', 'edge-case-room'), {
    name: 'Kantenfaelle',
    type: 'GLOBAL',
    active: true,
  });

  await setDoc(doc(db, 'communityRoomReads', 'alice__whisper-lounge'), {
    userId: 'alice',
    roomId: 'whisper-lounge',
    lastReadMessageCount: 3,
  });

  await setDoc(doc(db, 'communityRoomReads', 'mallory__whisper-lounge'), {
    userId: 'mallory',
    roomId: 'whisper-lounge',
    lastReadMessageCount: 1,
  });

  await setDoc(doc(db, 'communityRooms', 'whisper-lounge', 'messages', 'visible-message'), {
    id: 'visible-message',
    roomId: 'whisper-lounge',
    userId: 'alice',
    nickname: 'Tester',
    text: 'Sichtbar',
    createdAt: visibleCreatedAt,
    expiresAt: visibleExpiresAt,
    moderationStatus: 'VISIBLE',
  });

  await setDoc(doc(db, 'communityRooms', 'whisper-lounge', 'messages', 'expired-message'), {
    id: 'expired-message',
    roomId: 'whisper-lounge',
    userId: 'alice',
    nickname: 'Tester',
    text: 'Abgelaufen',
    createdAt: expiredCreatedAt,
    expiresAt: expiredExpiresAt,
    moderationStatus: 'VISIBLE',
  });

  await setDoc(doc(db, 'communityRooms', 'edge-case-room', 'messages', 'missing-expires-at'), {
    id: 'missing-expires-at',
    roomId: 'edge-case-room',
    userId: 'alice',
    nickname: 'Tester',
    text: 'Ohne Ablauf',
    createdAt: visibleCreatedAt,
    moderationStatus: 'VISIBLE',
  });

  await setDoc(doc(db, 'communityRooms', 'edge-case-room', 'messages', 'invalid-expires-at-type'), {
    id: 'invalid-expires-at-type',
    roomId: 'edge-case-room',
    userId: 'alice',
    nickname: 'Tester',
    text: 'Falscher Typ',
    createdAt: visibleCreatedAt,
    expiresAt: '2099-01-01T00:00:00.000Z',
    moderationStatus: 'VISIBLE',
  });

  await setDoc(doc(db, 'dates', 'date-active-alice'), {
    id: 'date-active-alice',
    creatorId: 'alice',
    creatorNickname: 'Tester',
    title: 'Freitagabend essen gehen',
    description: 'Gemeinsam essen gehen und entspannt kennenlernen.',
    regionLabel: 'Hamburg',
    category: '',
    visibility: 'community',
    status: 'active',
    scheduledAt: new Date(seededNowMs + (24 * 60 * 60 * 1000)),
    scheduledAtMs: seededNowMs + (24 * 60 * 60 * 1000),
    interestCount: 0,
  });

  await setDoc(doc(db, 'dates', 'date-cancelled-alice'), {
    id: 'date-cancelled-alice',
    creatorId: 'alice',
    creatorNickname: 'Tester',
    title: 'Abgesagtes Date',
    description: 'Nicht mehr aktiv.',
    regionLabel: 'Hamburg',
    category: '',
    visibility: 'community',
    status: 'cancelled',
    scheduledAt: new Date(seededNowMs + (48 * 60 * 60 * 1000)),
    scheduledAtMs: seededNowMs + (48 * 60 * 60 * 1000),
    interestCount: 0,
  });

  await setDoc(doc(db, 'dates', 'date-active-mallory'), {
    id: 'date-active-mallory',
    creatorId: 'mallory',
    creatorNickname: 'Mallory',
    title: 'Samstagabend Begleitung gesucht',
    description: 'Suche Begleitung für einen gemeinsamen Abend.',
    regionLabel: 'Berlin',
    category: '',
    visibility: 'community',
    status: 'active',
    scheduledAt: new Date(seededNowMs + (72 * 60 * 60 * 1000)),
    scheduledAtMs: seededNowMs + (72 * 60 * 60 * 1000),
    interestCount: 1,
  });
};

const seedUser = async (db, uid, profile) => {
  await setDoc(doc(db, 'users', uid), profile);
};

const seedAcceptance = async (db, uid, version) => {
  await setDoc(doc(db, 'communityRuleAcceptances', uid), {
    userId: uid,
    latestAcceptedVersion: version,
    acceptedVersions: [{ version, acceptedAt: new Date() }],
  });
};

// context.firestore() darf pro withSecurityRulesDisabled-Callback nur einmal aufgerufen werden.
const withAdminDb = (callback) => testEnv.withSecurityRulesDisabled((context) => callback(context.firestore()));

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: Number(process.env.FIRESTORE_EMULATOR_PORT || 8080),
    },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  seededNowMs = Date.now();
  await testEnv.clearFirestore();

  await withAdminDb(async (adminDb) => {
    await seedBaseData(adminDb);
    // alice: alle Voraussetzungen erfüllt und aktuelle Regelversion akzeptiert
    await seedUser(adminDb, 'alice', verifiedProfile());
    await seedAcceptance(adminDb, 'alice', CURRENT_RULES_VERSION);
    // bob: alle Voraussetzungen erfüllt, aber keine Zustimmung
    await seedUser(adminDb, 'bob', verifiedProfile({ nickname: 'Bob' }));
    // carol: veraltete Zustimmung
    await seedUser(adminDb, 'carol', verifiedProfile({ nickname: 'Carol' }));
    await seedAcceptance(adminDb, 'carol', '0.9');
    // dave: moderationsgesperrt, trotz Zustimmung
    await seedUser(adminDb, 'dave', verifiedProfile({ nickname: 'Dave', moderationState: 'banned' }));
    await seedAcceptance(adminDb, 'dave', CURRENT_RULES_VERSION);
    // erin: E-Mail nicht bestätigt
    await seedUser(adminDb, 'erin', verifiedProfile({ nickname: 'Erin', emailVerified: false }));
    await seedAcceptance(adminDb, 'erin', CURRENT_RULES_VERSION);
    // frank: Altersfreigabe fehlt
    await seedUser(adminDb, 'frank', verifiedProfile({ nickname: 'Frank', ageVerified: false, ageVerificationStatus: 'pending' }));
    await seedAcceptance(adminDb, 'frank', CURRENT_RULES_VERSION);
    // mallory: fremder Lesestatus-Eigentümer
    await seedUser(adminDb, 'mallory', verifiedProfile({ nickname: 'Mallory' }));
    await seedAcceptance(adminDb, 'mallory', CURRENT_RULES_VERSION);
  });
});

// rules-unit-testing erlaubt pro Context nur eine Firestore-Initialisierung, daher cachen.
const firestoreCache = new Map();

const authed = (uid, emailVerified = true) => {
  const cacheKey = `${uid}|${emailVerified}`;

  if (!firestoreCache.has(cacheKey)) {
    firestoreCache.set(cacheKey, testEnv.authenticatedContext(uid, { email_verified: emailVerified }).firestore());
  }

  return firestoreCache.get(cacheKey);
};

const anon = () => {
  if (!firestoreCache.has('__anon__')) {
    firestoreCache.set('__anon__', testEnv.unauthenticatedContext().firestore());
  }

  return firestoreCache.get('__anon__');
};

// Exakt die Query aus screens/CommunityScreen.js
const roomsQuery = (db) => query(collection(db, 'communityRooms'), where('active', '==', true));
// Exakt die Query aus screens/CommunityScreen.js
const readsQuery = (db, uid) => query(collection(db, 'communityRoomReads'), where('userId', '==', uid));
const roomMessagesQuery = (db, roomId, visibilityStart, queryNow = seededNowMs) => {
  const normalizedQueryNowMs = Number.isFinite(Number(queryNow)) ? Number(queryNow) : Date.now();

  return query(
    collection(db, 'communityRooms', roomId, 'messages'),
    where('expiresAt', '>', new Date(normalizedQueryNowMs + CLIENT_QUERY_TIME_SAFETY_MS)),
    where('expiresAt', '<=', new Date(normalizedQueryNowMs + COMMUNITY_MESSAGE_TTL_MS + CLIENT_QUERY_TIME_SAFETY_MS)),
    where('createdAt', '>=', visibilityStart),
    orderBy('expiresAt', 'asc'),
    orderBy('createdAt', 'desc'),
    limit(50),
  );
};

const datesQuery = (db, nowMs = seededNowMs) => query(
  collection(db, 'dates'),
  where('status', '==', 'active'),
  where('scheduledAt', '>', new Date(nowMs)),
  orderBy('scheduledAt', 'asc'),
  limit(25),
);

test('nicht angemeldeter Nutzer darf communityRooms nicht lesen', async () => {
  await assertFails(getDocs(roomsQuery(anon())));
});

test('angemeldeter Nutzer ohne Regelzustimmung darf die aktive Raumliste lesen (Übersicht ist vor der Zustimmung erlaubt)', async () => {
  await assertSucceeds(getDocs(roomsQuery(authed('bob'))));
});

test('Nutzer mit latestAcceptedVersion "1.0" und aktueller Version "1.0" darf aktive Räume lesen', async () => {
  const snapshot = await assertSucceeds(getDocs(roomsQuery(authed('alice'))));

  assert.equal(snapshot.size, STARTER_ROOMS.length + 1);
  assert.deepEqual(
    snapshot.docs.map((entry) => entry.id).sort(),
    [...STARTER_ROOMS.map((room) => room.id), 'edge-case-room'].sort(),
  );
});

test('die vier Starträume sind für berechtigte Nutzer einzeln lesbar', async () => {
  for (const room of STARTER_ROOMS) {
    const snapshot = await assertSucceeds(getDoc(doc(authed('alice'), 'communityRooms', room.id)));

    assert.equal(snapshot.data().name, room.name);
    assert.equal(snapshot.data().type, 'GLOBAL');
    assert.equal(snapshot.data().active, true);
  }
});

test('Starträume bleiben clientseitig nicht erstellbar', async () => {
  await assertFails(setDoc(doc(authed('alice'), 'communityRooms', 'eigener-raum'), {
    name: 'Eigener Raum',
    type: 'GLOBAL',
    active: true,
  }));
});

test('ein nicht freigegebener Nutzer sieht keinen der Starträume', async () => {
  for (const room of STARTER_ROOMS) {
    await assertFails(getDoc(doc(authed('dave'), 'communityRooms', room.id)));
  }
});

test('die tatsächlich verwendete rooms-Query wird von den Rules zugelassen', async () => {
  await assertSucceeds(getDocs(roomsQuery(authed('alice'))));
});

test('eine uneingeschränkte rooms-Query ohne active-Filter bleibt gesperrt', async () => {
  await assertFails(getDocs(collection(authed('alice'), 'communityRooms')));
});

test('inaktiver Raum bleibt für Nicht-Admins gesperrt', async () => {
  await assertFails(getDoc(doc(authed('alice'), 'communityRooms', 'archived-room')));
});

test('Nutzer ohne bestätigte E-Mail bleibt für communityRooms gesperrt', async () => {
  await assertFails(getDocs(roomsQuery(authed('erin', false))));
});

test('Nutzer ohne Altersfreigabe bleibt für communityRooms gesperrt', async () => {
  await assertFails(getDocs(roomsQuery(authed('frank'))));
});

test('moderationsgesperrter Nutzer bleibt trotz Zustimmung gesperrt', async () => {
  await assertFails(getDocs(roomsQuery(authed('dave'))));
});

test('die tatsächlich verwendete reads-Query wird für die eigene UID zugelassen', async () => {
  const snapshot = await assertSucceeds(getDocs(readsQuery(authed('alice'), 'alice')));

  assert.equal(snapshot.size, 1);
  assert.equal(snapshot.docs[0].data().userId, 'alice');
});

test('fremde communityRoomReads bleiben gesperrt', async () => {
  await assertFails(getDocs(readsQuery(authed('alice'), 'mallory')));
});

test('direkte Date-Listenabfragen bleiben gesperrt und laufen über Functions', async () => {
  await assertFails(getDocs(datesQuery(authed('alice'))));
});

test('ohne aktuelle Regelzustimmung bleibt die Date-Liste gesperrt', async () => {
  await assertFails(getDocs(datesQuery(authed('bob'))));
});

test('eigene abgesagte Dates bleiben für den Ersteller einzeln lesbar', async () => {
  const snapshot = await assertSucceeds(getDoc(doc(authed('alice'), 'dates', 'date-cancelled-alice')));

  assert.equal(snapshot.data().status, 'cancelled');
});

test('blockierte Date-Ersteller bleiben gesperrt', async () => {
  await withAdminDb(async (adminDb) => {
    await setDoc(doc(adminDb, 'users', 'mallory'), verifiedProfile({ nickname: 'Mallory', dismissedProfileIds: ['alice'] }));
  });

  await assertFails(getDoc(doc(authed('alice'), 'dates', 'date-active-mallory')));
});

test('Dates sind nicht direkt vom Client schreibbar', async () => {
  await assertFails(setDoc(doc(authed('alice'), 'dates', 'manual-date'), {
    creatorId: 'alice',
    title: 'Direktzugriff',
    status: 'active',
    scheduledAt: new Date(seededNowMs + (24 * 60 * 60 * 1000)),
  }));
});

test('communityRoomReads ohne userId-Filter bleibt gesperrt', async () => {
  await assertFails(getDocs(collection(authed('alice'), 'communityRoomReads')));
});

test('communityRoomReads bleibt ohne aktuelle Zustimmung gesperrt', async () => {
  await assertFails(getDocs(readsQuery(authed('bob'), 'bob')));
});

test('veraltete Zustimmung sperrt communityRoomReads weiterhin', async () => {
  await assertFails(getDocs(readsQuery(authed('carol'), 'carol')));
});

test('communityRoomReads ist clientseitig nicht schreibbar', async () => {
  await assertFails(setDoc(doc(authed('alice'), 'communityRoomReads', 'alice__whisper-lounge'), { userId: 'alice', lastReadMessageCount: 99 }));
});

test('das eigene Akzeptanzdokument ist lesbar, ein fremdes nicht', async () => {
  await assertSucceeds(getDoc(doc(authed('alice'), 'communityRuleAcceptances', 'alice')));
  await assertFails(getDoc(doc(authed('alice'), 'communityRuleAcceptances', 'mallory')));
});

test('das Akzeptanzdokument ist clientseitig nicht schreibbar', async () => {
  await assertFails(setDoc(doc(authed('bob'), 'communityRuleAcceptances', 'bob'), {
    userId: 'bob',
    latestAcceptedVersion: CURRENT_RULES_VERSION,
  }));
});

test('die veröffentlichte Regelkonfiguration ist für berechtigte Nutzer lesbar', async () => {
  const snapshot = await assertSucceeds(getDoc(doc(authed('alice'), 'communityConfig', 'rules')));

  assert.equal(snapshot.data().version, CURRENT_RULES_VERSION);
});

test('Zustimmung wirkt sofort: nach dem Schreiben des Akzeptanzdokuments greift der Zugriff ohne Reload', async () => {
  const aliceDb = authed('bob');

  await assertFails(getDocs(readsQuery(aliceDb, 'bob')));

  await withAdminDb((adminDb) => seedAcceptance(adminDb, 'bob', CURRENT_RULES_VERSION));

  // Dieselbe Client-Instanz, kein Reload/Neuaufbau.
  await assertSucceeds(getDocs(readsQuery(aliceDb, 'bob')));
});

test('Reload erhält den Zugriff: eine frische Client-Instanz darf weiterhin lesen', async () => {
  await assertSucceeds(getDocs(readsQuery(authed('alice'), 'alice')));
  await assertSucceeds(getDocs(readsQuery(authed('alice'), 'alice')));
});

test('die tatsächliche Client-Query für Community-Nachrichten wird von den Rules zugelassen', async () => {
  const { visibilityStart } = buildCommunityMessageTestTimes();
  const snapshot = await assertSucceeds(getDocs(roomMessagesQuery(
    authed('alice'),
    'whisper-lounge',
    visibilityStart,
    seededNowMs,
  )));

  assert.deepEqual(snapshot.docs.map((entry) => entry.id), ['visible-message']);
});

test('gültige, nicht abgelaufene Community-Nachricht ist lesbar', async () => {
  await assertSucceeds(getDoc(doc(authed('alice'), 'communityRooms', 'whisper-lounge', 'messages', 'visible-message')));
});

test('abgelaufene Community-Nachricht wird abgelehnt', async () => {
  await assertFails(getDoc(doc(authed('alice'), 'communityRooms', 'whisper-lounge', 'messages', 'expired-message')));
});

test('Community-Nachricht ohne expiresAt wird kontrolliert abgelehnt', async () => {
  await assertFails(getDoc(doc(authed('alice'), 'communityRooms', 'edge-case-room', 'messages', 'missing-expires-at')));
});

test('Community-Nachricht mit falschem expiresAt-Datentyp wird abgelehnt', async () => {
  await assertFails(getDoc(doc(authed('alice'), 'communityRooms', 'edge-case-room', 'messages', 'invalid-expires-at-type')));
});

test('neue Community-Nachricht ohne expiresAt kann clientseitig nicht entstehen', async () => {
  await assertFails(setDoc(doc(authed('alice'), 'communityRooms', 'whisper-lounge', 'messages', 'client-created-without-expiry'), {
    id: 'client-created-without-expiry',
    roomId: 'whisper-lounge',
    userId: 'alice',
    nickname: 'Tester',
    text: 'Direkter Client-Write',
    createdAt: new Date(seededNowMs),
    moderationStatus: 'VISIBLE',
  }));
});

test('private Nachrichten und private Nutzerdaten bleiben von der Änderung unberührt', async () => {
  const privateRef = doc(authed('alice'), 'users', 'alice', 'private', 'direct-chat-state');

  await assertSucceeds(setDoc(privateRef, {
    lastOpenedChatId: 'chat_alice__bob',
    updatedAt: new Date(seededNowMs),
  }));

  const snapshot = await assertSucceeds(getDoc(privateRef));

  assert.equal(snapshot.data().lastOpenedChatId, 'chat_alice__bob');
});

test('users, events und featureIdeas sind für angemeldete Nutzer lesbar, für anonyme nicht', async () => {
  await assertSucceeds(getDocs(collection(authed('alice'), 'users')));
  await assertSucceeds(getDocs(collection(authed('alice'), 'events')));
  await assertSucceeds(getDocs(collection(authed('alice'), 'featureIdeas')));

  await assertFails(getDocs(collection(anon(), 'users')));
  await assertFails(getDocs(collection(anon(), 'events')));
  await assertFails(getDocs(collection(anon(), 'featureIdeas')));
});

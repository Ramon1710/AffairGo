const test = require('node:test');
const assert = require('node:assert/strict');
const {
  COMMUNITY_MESSAGE_MAX_LENGTH,
  COMMUNITY_REPORT_COMMENT_MAX_LENGTH,
  COMMUNITY_REPORT_REASON_OPTIONS,
  COMMUNITY_RATE_LIMIT_ERROR_MESSAGE,
  COMMUNITY_ROOM_ID,
  buildAcceptedCommunityRulesEnvelope,
  buildCommunityRoomSections,
  buildCommunityMentionsPayload,
  clampCommunityDraft,
  findCommunityUnreadDividerIndex,
  formatCommunityEventDateLabel,
  getCommunityChatBanMessage,
  getCommunityOverviewState,
  getCommunityRoomUnreadCount,
  getPreparedCommunityText,
  getCommunityMentionMatch,
  getCommunityReactionSummary,
  getCommunityRoomUnreadLabel,
  getCommunityUnreadRoomsCount,
  formatCommunityRulesVersionLabel,
  getCommunityAccessRequirements,
  hasUnreadCommunityRoom,
  insertCommunityMention,
  mapCommunityErrorMessage,
  mergeCommunityRulesEnvelope,
  normalizeCommunityMessage,
  normalizeCommunityRulesEnvelope,
  normalizeCommunityRoom,
  normalizeCommunityRoomRead,
  parseCommunityRulesEditor,
  stringifyCommunityRulesSections,
} = require('../untils/communityChat');

test('leere Nachricht bleibt nach clientseitiger Vorbereitung leer', () => {
  assert.equal(getPreparedCommunityText('   \n\t  '), '');
});

test('Nachricht über 1000 Zeichen wird clientseitig begrenzt', () => {
  const nextDraft = clampCommunityDraft('a'.repeat(COMMUNITY_MESSAGE_MAX_LENGTH + 15));

  assert.equal(nextDraft.length, COMMUNITY_MESSAGE_MAX_LENGTH);
});

test('gültige Nachricht behält Whisper-Lounge-Raumkontext', () => {
  assert.equal(COMMUNITY_ROOM_ID, 'whisper-lounge');
  assert.equal(getPreparedCommunityText(' Hallo '), 'Hallo');
});

test('Rate-Limit-Fehler wird verständlich gemappt', () => {
  const message = mapCommunityErrorMessage({ code: 'resource-exhausted' }, 'send');

  assert.equal(message, COMMUNITY_RATE_LIMIT_ERROR_MESSAGE);
});

test('Regelzustimmung wird verständlich gemappt', () => {
  const message = mapCommunityErrorMessage({ code: 'permission-denied', details: { reason: 'community_rules_not_accepted' } }, 'send');

  assert.equal(message, 'Bitte bestätige zuerst die aktuellen Community-Regeln.');
});

test('nicht sichtbare Nachrichten werden als entfernt dargestellt', () => {
  const normalized = normalizeCommunityMessage({
    id: 'm1',
    roomId: 'whisper-lounge',
    userId: 'user-1',
    nickname: '',
    text: 'Original',
    moderationStatus: 'HIDDEN',
  }, 'm1');

  assert.equal(normalized.nickname, 'Night-Whisper Mitglied');
  assert.equal(normalized.removed, true);
  assert.equal(normalized.text, 'Diese Nachricht wurde entfernt.');
});

test('Mention-Suche erkennt das letzte @-Fragment', () => {
  const match = getCommunityMentionMatch('Hallo @Al');

  assert.equal(match.query, 'Al');
});

test('Mention-Auswahl ersetzt das letzte @-Fragment', () => {
  const nextDraft = insertCommunityMention({ draft: 'Hallo @Al', nickname: 'Alice' });

  assert.equal(nextDraft, 'Hallo @Alice ');
});

test('Mention-Payload wird nur aus vorhandenen Teilnehmern gebaut', () => {
  const mentions = buildCommunityMentionsPayload({
    text: 'Hallo @Alice und @Bob',
    participants: [
      { userId: '1', nickname: 'Alice' },
      { userId: '2', nickname: 'Bob' },
      { userId: '3', nickname: 'Chris' },
    ],
  });

  assert.deepEqual(mentions, [
    { userId: '1', nickname: 'Alice' },
    { userId: '2', nickname: 'Bob' },
  ]);
});

test('Reaktionszusammenfassung liefert alle erlaubten Typen', () => {
  const summary = getCommunityReactionSummary({ heart: 2, laugh: 1 });

  assert.equal(summary.length, 4);
  assert.equal(summary.find((entry) => entry.reactionType === 'heart').count, 2);
  assert.equal(summary.find((entry) => entry.reactionType === 'fire').count, 0);
});

test('Chat-Ban-Fehler wird verständlich gemappt', () => {
  const message = getCommunityChatBanMessage({
    details: {
      permanent: false,
      until: '2026-08-24T10:30:00.000Z',
    },
  });

  assert.equal(message.includes('Sperre bis:'), true);
});

test('Report-Gründe und Kommentarlimit sind vorhanden', () => {
  assert.equal(COMMUNITY_REPORT_REASON_OPTIONS.length, 8);
  assert.equal(COMMUNITY_REPORT_COMMENT_MAX_LENGTH, 500);
});

test('Räume werden in Allgemein und Regionen gruppiert', () => {
  const sections = buildCommunityRoomSections([
    normalizeCommunityRoom({ id: 'nrw', name: 'NRW', type: 'REGION' }, 'nrw'),
    normalizeCommunityRoom({ id: 'whisper-lounge', name: 'Whisper Lounge', type: 'GLOBAL' }, 'whisper-lounge'),
  ]);

  assert.equal(sections[0].title, 'Allgemein');
  assert.equal(sections[1].title, 'Regionen');
});

test('Unread-Label erkennt neue Raumaktivität über den Count-basierten Read-State', () => {
  const room = normalizeCommunityRoom({ id: 'r1', name: 'Raum', type: 'GLOBAL', messageCount: 5 }, 'r1');
  const readEntry = normalizeCommunityRoomRead({ roomId: 'r1', lastReadMessageCount: 3 }, 'u1__r1');

  assert.equal(hasUnreadCommunityRoom(room, readEntry), true);
  assert.equal(getCommunityRoomUnreadLabel(room, readEntry), '2 neu');
});

test('Unread-Count nutzt messageCount und lastReadMessageCount, wenn vorhanden', () => {
  const room = normalizeCommunityRoom({ id: 'r1', name: 'Raum', type: 'GLOBAL', messageCount: 12 }, 'r1');
  const readEntry = normalizeCommunityRoomRead({ roomId: 'r1', lastReadMessageCount: 9 }, 'u1__r1');

  assert.equal(getCommunityRoomUnreadCount(room, readEntry), 3);
  assert.equal(getCommunityRoomUnreadLabel(room, readEntry), '3 neu');
});

test('Dashboard-Badge zählt Räume mit Unreads statt Gesamt-Nachrichten', () => {
  const rooms = [
    normalizeCommunityRoom({ id: 'r1', name: 'A', type: 'GLOBAL', messageCount: 10 }, 'r1'),
    normalizeCommunityRoom({ id: 'r2', name: 'B', type: 'GLOBAL', messageCount: 3 }, 'r2'),
    normalizeCommunityRoom({ id: 'r3', name: 'C', type: 'GLOBAL', messageCount: 1 }, 'r3'),
  ];
  const reads = [
    normalizeCommunityRoomRead({ roomId: 'r1', lastReadMessageCount: 10 }, 'u1__r1'),
    normalizeCommunityRoomRead({ roomId: 'r2', lastReadMessageCount: 1 }, 'u1__r2'),
    normalizeCommunityRoomRead({ roomId: 'r3', lastReadMessageCount: 0 }, 'u1__r3'),
  ];

  assert.equal(getCommunityUnreadRoomsCount(rooms, reads), 2);
});

test('Raumübersicht zeigt nur Error-State bei Query-Fehler', () => {
  const state = getCommunityOverviewState({
    roomsLoaded: true,
    readsLoaded: true,
    rulesLoaded: true,
    loadError: 'permission-denied',
    roomCount: 0,
  });

  assert.equal(state, 'error');
});

test('Raumübersicht zeigt nur Empty-State bei erfolgreicher leerer Query', () => {
  const state = getCommunityOverviewState({
    roomsLoaded: true,
    readsLoaded: true,
    rulesLoaded: true,
    loadError: '',
    roomCount: 0,
  });

  assert.equal(state, 'empty');
});

test('Legacy-Raum ohne messageCount und lastMessageAt bleibt darstellbar', () => {
  const room = normalizeCommunityRoom({
    id: 'legacy-room',
    name: 'Legacy',
    type: 'GLOBAL',
    active: true,
  }, 'legacy-room');

  assert.equal(room.id, 'legacy-room');
  assert.equal(room.messageCount, null);
  assert.equal(room.lastMessageAtMs, 0);
});

test('Event-Raum-Metadaten werden clientseitig normalisiert', () => {
  const room = normalizeCommunityRoom({
    id: 'event-e1',
    type: 'EVENT',
    eventId: 'e1',
    eventTitle: 'Midnight Party Köln',
    eventDateLabel: '14.09.2026',
    eventTimeLabel: '21:00',
    eventCity: 'Köln',
    eventStartAt: '2026-09-14T21:00:00.000Z',
  }, 'event-e1');

  assert.equal(room.eventId, 'e1');
  assert.equal(room.eventCity, 'Köln');
  assert.match(formatCommunityEventDateLabel(room), /14\.09\./);
});

test('Community-Regeln werden clientseitig normalisiert', () => {
  const envelope = normalizeCommunityRulesEnvelope({
    rules: {
      version: '1.1',
      title: 'Night-Whisper Community-Regeln',
      sections: [
        {
          heading: '1. Respekt',
          paragraphs: ['Bleibe respektvoll.'],
        },
      ],
    },
    acceptance: {
      latestAcceptedVersion: '1.1',
    },
  });

  assert.equal(envelope.acceptedCurrent, true);
  assert.equal(formatCommunityRulesVersionLabel(envelope.version), 'Version 1.1');
  assert.equal(envelope.sections.length, 1);
});

test('Community-Zugangsvoraussetzungen markieren fehlenden Login', () => {
  const requirements = getCommunityAccessRequirements(null, null, null);

  assert.equal(requirements.loggedIn, false);
  assert.equal(requirements.canReadOverview, false);
  assert.deepEqual(requirements.missingKeys, ['loggedIn']);
});

test('Community-Zugangsvoraussetzungen markieren fehlende E-Mail-Bestätigung', () => {
  const requirements = getCommunityAccessRequirements({
    id: 'u1',
    emailVerified: false,
    ageVerified: true,
    ageVerificationStatus: 'verified',
  }, { uid: 'u1', emailVerified: false }, {
    rules: { version: '1.0', sections: [{ heading: 'A', paragraphs: ['B'] }] },
    acceptance: { latestAcceptedVersion: '1.0' },
  });

  assert.equal(requirements.emailVerified, false);
  assert.equal(requirements.canReadOverview, false);
  assert.deepEqual(requirements.missingKeys, ['emailVerified']);
});

test('Community-Zugangsvoraussetzungen markieren fehlende Altersverifikation', () => {
  const requirements = getCommunityAccessRequirements({
    id: 'u1',
    emailVerified: true,
    ageVerified: false,
    ageVerificationStatus: 'pending',
  }, { uid: 'u1', emailVerified: true }, {
    rules: { version: '1.0', sections: [{ heading: 'A', paragraphs: ['B'] }] },
    acceptance: { latestAcceptedVersion: '1.0' },
  });

  assert.equal(requirements.ageVerified, false);
  assert.equal(requirements.canReadOverview, false);
  assert.deepEqual(requirements.missingKeys, ['ageVerified']);
});

test('Community-Zugangsvoraussetzungen erlauben Übersicht vor Regeln, aber nicht Nachrichten', () => {
  const requirements = getCommunityAccessRequirements({
    id: 'u1',
    emailVerified: true,
    ageVerified: true,
    ageVerificationStatus: 'verified',
    moderationState: 'clear',
  }, { uid: 'u1', emailVerified: true }, {
    rules: { version: '1.0', sections: [{ heading: 'A', paragraphs: ['B'] }] },
    acceptance: null,
  });

  assert.equal(requirements.canReadOverview, true);
  assert.equal(requirements.canReadMessages, false);
  assert.deepEqual(requirements.missingKeys, ['rulesAccepted']);
});

test('Community-Zugangsvoraussetzungen erkennen Vollzugriff', () => {
  const requirements = getCommunityAccessRequirements({
    id: 'u1',
    emailVerified: true,
    ageVerified: true,
    ageVerificationStatus: 'approved',
    moderationState: 'clear',
  }, { uid: 'u1', emailVerified: true }, {
    rules: { version: '1.0', sections: [{ heading: 'A', paragraphs: ['B'] }] },
    acceptance: { latestAcceptedVersion: '1.0' },
  });

  assert.equal(requirements.allRequirementsMet, true);
  assert.equal(requirements.canReadOverview, true);
  assert.equal(requirements.canReadMessages, true);
  assert.deepEqual(requirements.missingKeys, []);
});

test('Akzeptierte Regeln werden lokal sofort auf acceptedCurrent gesetzt', () => {
  const currentEnvelope = normalizeCommunityRulesEnvelope({
    rules: {
      version: '1.0',
      title: 'Regeln',
      sections: [{ heading: 'A', paragraphs: ['B'] }],
    },
    acceptance: null,
  });

  const acceptedEnvelope = buildAcceptedCommunityRulesEnvelope(currentEnvelope, {
    acceptedVersion: '1.0',
    accepted: true,
  });

  assert.equal(acceptedEnvelope.acceptedVersion, '1.0');
  assert.equal(acceptedEnvelope.acceptedCurrent, true);
});

test('Stale Rules-Response überschreibt erfolgreiche Acceptance nicht mehr', () => {
  const acceptedEnvelope = normalizeCommunityRulesEnvelope({
    rules: {
      version: '1.0',
      title: 'Regeln',
      sections: [{ heading: 'A', paragraphs: ['B'] }],
    },
    acceptance: {
      latestAcceptedVersion: '1.0',
    },
  });
  const staleEnvelope = normalizeCommunityRulesEnvelope({
    rules: {
      version: '1.0',
      title: 'Regeln',
      sections: [{ heading: 'A', paragraphs: ['B'] }],
    },
    acceptance: null,
  });

  const mergedEnvelope = mergeCommunityRulesEnvelope(acceptedEnvelope, staleEnvelope);

  assert.equal(mergedEnvelope.acceptedVersion, '1.0');
  assert.equal(mergedEnvelope.acceptedCurrent, true);
});

test('Regelabschnitte lassen sich für den Admin-Editor serialisieren und parsen', () => {
  const serialized = stringifyCommunityRulesSections([
    {
      heading: '1. Respekt',
      paragraphs: ['Bleibe respektvoll.', 'Kein Spam.'],
    },
    {
      heading: '2. Grenzen',
      paragraphs: ['Ein Nein ist ein Nein.'],
    },
  ]);

  const parsed = parseCommunityRulesEditor(serialized);

  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].heading, '1. Respekt');
  assert.deepEqual(parsed[0].paragraphs, ['Bleibe respektvoll.', 'Kein Spam.']);
});

test('Neue-Nachrichten-Trenner wird über lastReadMessageId bestimmt', () => {
  const messages = [
    normalizeCommunityMessage({ id: 'm1', createdAt: '2026-08-23T10:00:00.000Z', text: 'A' }, 'm1'),
    normalizeCommunityMessage({ id: 'm2', createdAt: '2026-08-23T10:05:00.000Z', text: 'B' }, 'm2'),
    normalizeCommunityMessage({ id: 'm3', createdAt: '2026-08-23T10:06:00.000Z', text: 'C' }, 'm3'),
  ];
  const readEntry = normalizeCommunityRoomRead({ roomId: 'r1', lastReadMessageId: 'm1', lastReadAt: '2026-08-23T10:00:00.000Z' }, 'u1__r1');

  assert.equal(findCommunityUnreadDividerIndex(messages, readEntry), 1);
});

test('Neue-Nachrichten-Trenner bleibt aus, wenn nichts neuer ist', () => {
  const messages = [
    normalizeCommunityMessage({ id: 'm1', createdAt: '2026-08-23T10:00:00.000Z', text: 'A' }, 'm1'),
    normalizeCommunityMessage({ id: 'm2', createdAt: '2026-08-23T10:05:00.000Z', text: 'B' }, 'm2'),
  ];
  const readEntry = normalizeCommunityRoomRead({ roomId: 'r1', lastReadMessageId: 'm2', lastReadAt: '2026-08-23T10:05:00.000Z' }, 'u1__r1');

  assert.equal(findCommunityUnreadDividerIndex(messages, readEntry), -1);
});
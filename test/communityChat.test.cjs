const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  COMMUNITY_MESSAGE_MAX_LENGTH,
  COMMUNITY_REPORT_COMMENT_MAX_LENGTH,
  COMMUNITY_REPORT_REASON_OPTIONS,
  COMMUNITY_RATE_LIMIT_ERROR_MESSAGE,
  COMMUNITY_ROOM_ID,
  COMMUNITY_ROOM_DISPLAY_ORDER,
  COMMUNITY_RULES_UNCONFIRMED_MESSAGE,
  buildAcceptedCommunityRulesEnvelope,
  buildCommunityRoomSections,
  buildCommunityMentionsPayload,
  clampCommunityDraft,
  findCommunityUnreadDividerIndex,
  formatCommunityEventDateLabel,
  getCommunityChatBanMessage,
  getCommunityOverviewState,
  getCommunityRoomUnreadCount,
  getCommunityRoomTypeLabel,
  getPreparedCommunityText,
  getCommunityMentionMatch,
  getCommunityReactionSummary,
  getCommunityRoomUnreadLabel,
  getCommunityUnreadRoomsCount,
  formatCommunityRulesVersionLabel,
  getCommunityAccessState,
  getCommunityAccessRequirements,
  getCommunityNeedsRulesAcceptance,
  hasUnreadCommunityRoom,
  insertCommunityMention,
  isCommunityRulesAcceptanceConfirmed,
  mapCommunityErrorMessage,
  mergeCommunityRulesEnvelope,
  normalizeCommunityMessage,
  normalizeCommunityRulesEnvelope,
  normalizeCommunityRoom,
  normalizeCommunityRoomRead,
  parseCommunityRulesEditor,
  sortCommunityRooms,
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
  assert.equal(requirements.preRulesRequirementsMet, false);
  assert.deepEqual(requirements.missingKeys, ['emailVerified']);
});

test('Community-Zugangsvoraussetzungen verwenden Auth- und Profilstatus per ODER für E-Mail', () => {
  const requirements = getCommunityAccessRequirements({
    id: 'u1',
    emailVerified: false,
    ageVerified: true,
    ageVerificationStatus: 'verified',
    moderationState: 'clear',
  }, { uid: 'u1', emailVerified: true }, {
    rules: { version: '1.0', sections: [{ heading: 'A', paragraphs: ['B'] }] },
    acceptance: null,
  });

  assert.equal(requirements.authEmailVerified, true);
  assert.equal(requirements.profileEmailVerified, false);
  assert.equal(requirements.effectiveEmailVerified, true);
  assert.equal(requirements.emailVerified, true);
  assert.equal(requirements.preRulesRequirementsMet, true);
});

test('Produktionsfall mit fehlender E-Mail bleibt im Pre-Rules-Gate', () => {
  const requirements = getCommunityAccessRequirements({
    id: 'u1',
    emailVerified: false,
    ageVerified: true,
    ageVerificationStatus: 'verified',
    accountDeletionRequestedAt: '',
    moderationState: 'clear',
  }, { uid: 'u1', emailVerified: false }, {
    rules: { version: '1.0', sections: [{ heading: 'A', paragraphs: ['B'] }] },
    acceptance: null,
  });

  assert.equal(requirements.preRulesRequirementsMet, false);
  assert.equal(requirements.rulesAccepted, false);
  assert.equal(requirements.canReadOverview, false);
  assert.equal(requirements.canReadMessages, false);
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
  assert.equal(requirements.preRulesRequirementsMet, true);
  assert.equal(requirements.allRequirementsMet, false);
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
  assert.equal(getCommunityNeedsRulesAcceptance(acceptedEnvelope), false);
});

test('Rules-Acceptance bleibt erforderlich, solange acceptedVersion leer ist', () => {
  const envelope = normalizeCommunityRulesEnvelope({
    rules: {
      version: '1.0',
      title: 'Regeln',
      sections: [{ heading: 'A', paragraphs: ['B'] }],
    },
    acceptance: null,
  });

  assert.equal(getCommunityNeedsRulesAcceptance(envelope), true);
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
  assert.equal(getCommunityNeedsRulesAcceptance(mergedEnvelope), false);
});

test('Community-Access-State bietet Regelzustimmung statt generischer Sperre an', () => {
  const accessRequirements = getCommunityAccessRequirements({
    id: 'u1',
    emailVerified: true,
    ageVerified: true,
    ageVerificationStatus: 'verified',
    moderationState: 'clear',
  }, { uid: 'u1', emailVerified: true }, {
    rules: { version: '1.0', active: true, sections: [{ heading: 'A', paragraphs: ['B'] }] },
    acceptance: null,
  });

  const state = getCommunityAccessState({
    accessRequirements,
    rulesEnvelope: {
      rules: { version: '1.0', active: true, sections: [{ heading: 'A', paragraphs: ['B'] }] },
      acceptance: null,
    },
    rulesLoaded: true,
    roomsLoaded: true,
    readsLoaded: true,
    roomCount: 2,
  });

  assert.equal(state.status, 'rules_acceptance_required');
  assert.equal(state.accessAllowed, true);
  assert.equal(state.accessReason, 'rules_not_accepted');
  assert.equal(state.needsRulesAcceptance, true);
  assert.equal(state.message, 'Bitte akzeptiere zuerst die aktuellen Community-Regeln.');
});

test('Community-Access-State erkennt bestehenden Zugriff nach aktueller Zustimmung', () => {
  const accessRequirements = getCommunityAccessRequirements({
    id: 'u1',
    emailVerified: true,
    ageVerified: true,
    ageVerificationStatus: 'approved',
    moderationState: 'clear',
  }, { uid: 'u1', emailVerified: true }, {
    rules: { version: '1.0', active: true, sections: [{ heading: 'A', paragraphs: ['B'] }] },
    acceptance: { latestAcceptedVersion: '1.0' },
  });

  const state = getCommunityAccessState({
    accessRequirements,
    rulesEnvelope: {
      rules: { version: '1.0', active: true, sections: [{ heading: 'A', paragraphs: ['B'] }] },
      acceptance: { latestAcceptedVersion: '1.0' },
    },
    rulesLoaded: true,
    roomsLoaded: true,
    readsLoaded: true,
    roomCount: 2,
  });

  assert.equal(state.status, 'allowed');
  assert.equal(state.accessAllowed, true);
  assert.equal(state.accessReason, 'allowed');
  assert.equal(state.needsRulesAcceptance, false);
});

test('Community-Access-State verlangt neue Zustimmung nach Versionssprung', () => {
  const accessRequirements = getCommunityAccessRequirements({
    id: 'u1',
    emailVerified: true,
    ageVerified: true,
    ageVerificationStatus: 'verified',
    moderationState: 'clear',
  }, { uid: 'u1', emailVerified: true }, {
    rules: { version: '2.0', active: true, sections: [{ heading: 'A', paragraphs: ['B'] }] },
    acceptance: { latestAcceptedVersion: '1.0' },
  });

  const state = getCommunityAccessState({
    accessRequirements,
    rulesEnvelope: {
      rules: { version: '2.0', active: true, sections: [{ heading: 'A', paragraphs: ['B'] }] },
      acceptance: { latestAcceptedVersion: '1.0' },
    },
    rulesLoaded: true,
    roomsLoaded: true,
    readsLoaded: true,
    roomCount: 1,
  });

  assert.equal(state.status, 'rules_acceptance_required');
  assert.equal(state.needsRulesAcceptance, true);
});

test('Community-Access-State liefert konkrete Hinweise für E-Mail, Alter und Moderation', () => {
  const emailRequirements = getCommunityAccessRequirements({
    id: 'u1',
    emailVerified: false,
    ageVerified: true,
    ageVerificationStatus: 'verified',
    moderationState: 'clear',
  }, { uid: 'u1', emailVerified: false }, null);
  const ageRequirements = getCommunityAccessRequirements({
    id: 'u1',
    emailVerified: true,
    ageVerified: false,
    ageVerificationStatus: 'pending',
    moderationState: 'clear',
  }, { uid: 'u1', emailVerified: true }, null);
  const moderationRequirements = getCommunityAccessRequirements({
    id: 'u1',
    emailVerified: true,
    ageVerified: true,
    ageVerificationStatus: 'verified',
    moderationState: 'restricted',
  }, { uid: 'u1', emailVerified: true }, null);

  assert.equal(getCommunityAccessState({ accessRequirements: emailRequirements }).status, 'email_verification_required');
  assert.equal(getCommunityAccessState({ accessRequirements: ageRequirements }).status, 'age_verification_required');
  assert.equal(getCommunityAccessState({ accessRequirements: moderationRequirements }).status, 'moderation_restricted');
});

test('Community-Access-State liefert Backendfehler statt falscher Zugriffsverweigerung', () => {
  const accessRequirements = getCommunityAccessRequirements({
    id: 'u1',
    emailVerified: true,
    ageVerified: true,
    ageVerificationStatus: 'verified',
    moderationState: 'clear',
  }, { uid: 'u1', emailVerified: true }, {
    rules: { version: '1.0', active: true, sections: [{ heading: 'A', paragraphs: ['B'] }] },
    acceptance: { latestAcceptedVersion: '1.0' },
  });

  const state = getCommunityAccessState({
    accessRequirements,
    rulesEnvelope: {
      rules: { version: '1.0', active: true, sections: [{ heading: 'A', paragraphs: ['B'] }] },
      acceptance: { latestAcceptedVersion: '1.0' },
    },
    rulesLoaded: true,
    rulesError: 'timeout',
    roomsLoaded: true,
    readsLoaded: true,
    roomCount: 2,
  });

  assert.equal(state.status, 'backend_error');
  assert.equal(state.message, 'Die Community konnte nicht geladen werden. Bitte versuche es erneut.');
});

test('Community-Access-State erkennt erlaubten Leerzustand ohne Räume', () => {
  const accessRequirements = getCommunityAccessRequirements({
    id: 'u1',
    emailVerified: true,
    ageVerified: true,
    ageVerificationStatus: 'verified',
    moderationState: 'clear',
  }, { uid: 'u1', emailVerified: true }, {
    rules: { version: '1.0', active: true, sections: [{ heading: 'A', paragraphs: ['B'] }] },
    acceptance: { latestAcceptedVersion: '1.0' },
  });

  const state = getCommunityAccessState({
    accessRequirements,
    rulesEnvelope: {
      rules: { version: '1.0', active: true, sections: [{ heading: 'A', paragraphs: ['B'] }] },
      acceptance: { latestAcceptedVersion: '1.0' },
    },
    rulesLoaded: true,
    roomsLoaded: true,
    readsLoaded: true,
    roomCount: 0,
  });

  assert.equal(state.status, 'empty');
  assert.equal(state.accessAllowed, true);
  assert.equal(state.message, 'Derzeit sind keine Community-Raeume verfuegbar.');
});

test('Community-Screen enthält Regeln-Link, Modal-Fehleranzeige und Voll-Reload-Retry', () => {
  const source = fs.readFileSync('/workspaces/AffairGo/screens/CommunityScreen.js', 'utf8');

  assert.match(source, /Community-Regeln ansehen/u);
  assert.match(source, /const openRulesModal = \(\) =>/u);
  assert.match(source, /const handleRetryCommunity = async \(\) =>/u);
  assert.match(source, /await refreshRulesStatus\(\{ userId: currentUser\.id \}\)/u);
  assert.match(source, /setRoomsQueryKey\(\(previous\) => previous \+ 1\)/u);
  assert.match(source, /\{rulesError \? <Text style=\{styles\.errorText\}>\{rulesError\}<\/Text> : null\}/u);
  assert.match(source, /'Regeln akzeptieren'/u);
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

test('Bestätigung gilt nur bei exakter Versions-Übereinstimmung nach Server-Reload', () => {
  const confirmedEnvelope = normalizeCommunityRulesEnvelope({
    rules: { version: '1.0', sections: [{ heading: 'A', paragraphs: ['B'] }] },
    acceptance: { latestAcceptedVersion: '1.0' },
  });

  assert.equal(isCommunityRulesAcceptanceConfirmed(confirmedEnvelope, '1.0'), true);
});

test('Bestätigung schlägt fehl, solange die Version noch nicht als akzeptiert zurückgelesen wurde', () => {
  const staleEnvelope = normalizeCommunityRulesEnvelope({
    rules: { version: '1.0', sections: [{ heading: 'A', paragraphs: ['B'] }] },
    acceptance: null,
  });

  assert.equal(isCommunityRulesAcceptanceConfirmed(staleEnvelope, '1.0'), false);
});

test('Ein veralteter Akzeptanz-Snapshot überschreibt den bestätigten Erfolg nicht', () => {
  const outdatedEnvelope = normalizeCommunityRulesEnvelope({
    rules: { version: '1.0', sections: [{ heading: 'A', paragraphs: ['B'] }] },
    acceptance: { latestAcceptedVersion: '0.9' },
  });

  assert.equal(isCommunityRulesAcceptanceConfirmed(outdatedEnvelope, '1.0'), false);
});

test('String-Version "1.0" bleibt bei der Bestätigungsprüfung unverändert und wird nicht numerisch verglichen', () => {
  const envelope = normalizeCommunityRulesEnvelope({
    rules: { version: '1.0', sections: [{ heading: 'A', paragraphs: ['B'] }] },
    acceptance: { latestAcceptedVersion: '1.0' },
  });

  assert.equal(envelope.version, '1.0');
  assert.equal(typeof envelope.version, 'string');
  assert.equal(isCommunityRulesAcceptanceConfirmed(envelope, 1), false);
  assert.equal(isCommunityRulesAcceptanceConfirmed(envelope, '1.0'), true);
});

test('Callable-Fehlercodes werden für den Zustimmungs-Dialog verständlich übersetzt', () => {
  assert.match(mapCommunityErrorMessage({ code: 'unauthenticated' }, 'accept'), /erneut an/u);
  assert.match(mapCommunityErrorMessage({ code: 'not-found' }, 'accept'), /nicht verfügbar/u);
  assert.match(mapCommunityErrorMessage({ code: 'unavailable' }, 'accept'), /nicht erreichbar/u);
  assert.match(mapCommunityErrorMessage({ code: 'invalid-argument' }, 'accept'), /Regelversion/u);
  assert.match(mapCommunityErrorMessage({ code: 'internal' }, 'accept'), /unerwarteter Fehler/u);
  assert.match(
    mapCommunityErrorMessage({ code: 'failed-precondition' }, 'accept'),
    /aktualisiert/u,
  );
  assert.match(
    mapCommunityErrorMessage({ code: 'permission-denied', details: { reason: 'outdated_rules_version' } }, 'accept'),
    /aktualisiert/u,
  );
});

test('Unbestätigte, aber gesendete Zustimmung erhält eine eigene Meldung statt Scheinerfolg', () => {
  assert.equal(
    COMMUNITY_RULES_UNCONFIRMED_MESSAGE,
    'Die Zustimmung wurde gesendet, konnte aber noch nicht bestätigt werden. Bitte versuche es erneut.',
  );
});

test('CommunityScreen: Zustimmung wird gegen Doppelklick abgesichert und erst nach bestätigtem Reload geschlossen', () => {
  const source = fs.readFileSync('/workspaces/AffairGo/screens/CommunityScreen.js', 'utf8');

  assert.match(source, /const isAcceptingRulesRef = useRef\(false\)/u);
  assert.match(source, /if \(!rulesEnvelope\?\.version \|\| isAcceptingRulesRef\.current\)/u);
  assert.match(source, /isAcceptingRulesRef\.current = true;/u);
  assert.match(source, /preserveAcceptedState: false/u);
  assert.match(source, /isCommunityRulesAcceptanceConfirmed\(confirmedEnvelope, requestedVersion\)/u);
  assert.match(source, /if \(isConfirmed\) \{\s*setRulesModalVisible\(false\);/u);
  assert.match(source, /setRulesError\(COMMUNITY_RULES_UNCONFIRMED_MESSAGE\)/u);
  assert.match(source, /mapCommunityErrorMessage\(error, 'accept'\)/u);
});

test('CommunityRoomScreen: Zustimmung wird gegen Doppelklick abgesichert und serverseitig bestätigt', () => {
  const source = fs.readFileSync('/workspaces/AffairGo/screens/CommunityRoomScreen.js', 'utf8');

  assert.match(source, /const isAcceptingRulesRef = useRef\(false\)/u);
  assert.match(source, /if \(!rulesEnvelope\?\.version \|\| isAcceptingRulesRef\.current\)/u);
  assert.match(source, /preserveAcceptedState: false/u);
  assert.match(source, /isCommunityRulesAcceptanceConfirmed\(confirmedEnvelope, requestedVersion\)/u);
  assert.match(source, /setRulesError\(COMMUNITY_RULES_UNCONFIRMED_MESSAGE\)/u);
});

// Simuliert exakt den in handleAcceptRules verwendeten Ablauf mit den echten,
// exportierten Prüf-/Merge-Helfern, um die Kernlogik ohne RN-Renderer zu verifizieren.
const runAcceptRulesFlowSimulation = async ({ acceptImpl, getRulesImpl, initialEnvelope }) => {
  const isAcceptingRulesRef = { current: false };
  const state = { rulesEnvelope: initialEnvelope, rulesModalVisible: true, rulesError: '' };

  const handleAcceptRulesSimulation = async () => {
    if (!state.rulesEnvelope?.version || isAcceptingRulesRef.current) {
      return;
    }

    const requestedVersion = String(state.rulesEnvelope.version || '').trim();
    isAcceptingRulesRef.current = true;

    const acceptResponse = await acceptImpl({ rulesVersion: requestedVersion });

    if (acceptResponse?.ok !== true) {
      isAcceptingRulesRef.current = false;
      return;
    }

    // preserveAcceptedState: false -> Rohantwort wird ohne Merge mit altem State normalisiert.
    const confirmedEnvelope = normalizeCommunityRulesEnvelope(await getRulesImpl());
    const isConfirmed = isCommunityRulesAcceptanceConfirmed(confirmedEnvelope, requestedVersion);

    state.rulesEnvelope = confirmedEnvelope;

    if (isConfirmed) {
      state.rulesModalVisible = false;
      state.rulesError = '';
    } else {
      state.rulesError = COMMUNITY_RULES_UNCONFIRMED_MESSAGE;
    }

    isAcceptingRulesRef.current = false;
  };

  await Promise.all([handleAcceptRulesSimulation(), handleAcceptRulesSimulation()]);

  return state;
};

test('Vollständiger Erfolgsablauf: ein Klick bestätigt "1.0" serverseitig, schließt das Modal und macht die Übersicht sichtbar', async () => {
  let acceptCallCount = 0;
  let capturedPayload = null;
  let getRulesCallCount = 0;

  const initialEnvelope = normalizeCommunityRulesEnvelope({
    rules: { version: '1.0', title: 'Regeln', sections: [{ heading: 'A', paragraphs: ['B'] }] },
    acceptance: null,
  });

  assert.equal(getCommunityNeedsRulesAcceptance(initialEnvelope), true);

  const finalState = await runAcceptRulesFlowSimulation({
    initialEnvelope,
    acceptImpl: async (payload) => {
      acceptCallCount += 1;
      capturedPayload = payload;
      return { ok: true, rulesVersion: '1.0', acceptedVersion: '1.0', accepted: true, alreadyAccepted: false };
    },
    getRulesImpl: async () => {
      getRulesCallCount += 1;
      return {
        rules: { version: '1.0', title: 'Regeln', sections: [{ heading: 'A', paragraphs: ['B'] }] },
        acceptance: { latestAcceptedVersion: '1.0' },
      };
    },
  });

  assert.equal(acceptCallCount, 1, 'genau ein Callable-Aufruf trotz Doppelklick-Versuch');
  assert.equal(getRulesCallCount, 1);
  assert.deepEqual(Object.keys(capturedPayload), ['rulesVersion'], 'Client überträgt keine UID');
  assert.equal(capturedPayload.rulesVersion, '1.0');
  assert.equal(finalState.rulesEnvelope.acceptedVersion, '1.0');
  assert.equal(isCommunityRulesAcceptanceConfirmed(finalState.rulesEnvelope, '1.0'), true);
  assert.equal(getCommunityNeedsRulesAcceptance(finalState.rulesEnvelope), false);
  assert.equal(finalState.rulesModalVisible, false);
  assert.equal(finalState.rulesError, '');

  // Ein verspäteter älterer Snapshot darf den bestätigten Zustand nicht zurücksetzen.
  const staleOlderEnvelope = normalizeCommunityRulesEnvelope({
    rules: { version: '1.0', title: 'Regeln', sections: [{ heading: 'A', paragraphs: ['B'] }] },
    acceptance: null,
  });
  const mergedAfterStaleSnapshot = mergeCommunityRulesEnvelope(finalState.rulesEnvelope, staleOlderEnvelope);

  assert.equal(mergedAfterStaleSnapshot.acceptedCurrent, true);
  assert.equal(getCommunityNeedsRulesAcceptance(mergedAfterStaleSnapshot), false);
});

test('Nicht bestätigter Fall: Callable meldet Erfolg, Reload zeigt aber noch keine passende Version -> Modal bleibt offen', async () => {
  const initialEnvelope = normalizeCommunityRulesEnvelope({
    rules: { version: '1.0', title: 'Regeln', sections: [{ heading: 'A', paragraphs: ['B'] }] },
    acceptance: null,
  });

  const finalState = await runAcceptRulesFlowSimulation({
    initialEnvelope,
    acceptImpl: async () => ({ ok: true, rulesVersion: '1.0', acceptedVersion: '1.0', accepted: true, alreadyAccepted: false }),
    getRulesImpl: async () => ({
      // Eventual-Consistency-Lag: Zustimmung ist serverseitig noch nicht sichtbar.
      rules: { version: '1.0', title: 'Regeln', sections: [{ heading: 'A', paragraphs: ['B'] }] },
      acceptance: null,
    }),
  });

  assert.equal(finalState.rulesModalVisible, true, 'Modal bleibt offen ohne bestätigten Reload');
  assert.equal(finalState.rulesError, COMMUNITY_RULES_UNCONFIRMED_MESSAGE);
  assert.equal(getCommunityNeedsRulesAcceptance(finalState.rulesEnvelope), true, 'kein lokaler Scheinerfolg');
});

const buildStarterRooms = () => [
  normalizeCommunityRoom({ id: 'sex-und-fantasien', name: 'Sex und Fantasien', type: 'GLOBAL', active: true, description: 'Offener 18+-Austausch', messageCount: 0 }, 'sex-und-fantasien'),
  normalizeCommunityRoom({ id: 'whisper-lounge', name: 'Offener Treffpunkt', type: 'GLOBAL', active: true, description: 'Offener Austausch', messageCount: 0 }, 'whisper-lounge'),
  normalizeCommunityRoom({ id: 'swinger-und-paare', name: 'Swinger und Paare', type: 'GLOBAL', active: true, description: 'Austausch für Paare', messageCount: 0 }, 'swinger-und-paare'),
  normalizeCommunityRoom({ id: 'kennenlernen-und-flirten', name: 'Kennenlernen und Flirten', type: 'GLOBAL', active: true, description: 'Lerne Mitglieder kennen', messageCount: 0 }, 'kennenlernen-und-flirten'),
];

test('Starträume: die feste Anzeigereihenfolge ist unabhängig von der Eingabereihenfolge', () => {
  const sortedRooms = sortCommunityRooms(buildStarterRooms());

  assert.deepEqual(sortedRooms.map((room) => room.id), [
    'whisper-lounge',
    'kennenlernen-und-flirten',
    'swinger-und-paare',
    'sex-und-fantasien',
  ]);
  assert.deepEqual(sortedRooms.map((room) => room.id), [...COMMUNITY_ROOM_DISPLAY_ORDER]);
});

test('Starträume: alle vier Starträume landen in der Gruppe Allgemein', () => {
  const sections = buildCommunityRoomSections(buildStarterRooms());

  assert.equal(sections.length, 1);
  assert.equal(sections[0].title, 'Allgemein');
  assert.equal(sections[0].rooms.length, 4);
  sections[0].rooms.forEach((room) => {
    assert.equal(room.type, 'GLOBAL');
    assert.equal(room.active, true);
    assert.equal(getCommunityRoomTypeLabel(room.type), 'Global');
    assert.ok(room.name.trim().length > 0);
    assert.ok(room.description.trim().length > 0);
  });
});

test('Starträume: der Leerzustand verschwindet, sobald aktive Räume vorhanden sind', () => {
  const accessRequirements = getCommunityAccessRequirements({
    id: 'u1',
    emailVerified: true,
    ageVerified: true,
    ageVerificationStatus: 'verified',
    moderationState: 'clear',
  }, { uid: 'u1', emailVerified: true }, {
    rules: { version: '1.0', active: true, sections: [{ heading: 'A', paragraphs: ['B'] }] },
    acceptance: { latestAcceptedVersion: '1.0' },
  });

  const baseState = {
    accessRequirements,
    rulesEnvelope: {
      rules: { version: '1.0', active: true, sections: [{ heading: 'A', paragraphs: ['B'] }] },
      acceptance: { latestAcceptedVersion: '1.0' },
    },
    rulesLoaded: true,
    roomsLoaded: true,
    readsLoaded: true,
  };

  assert.equal(getCommunityAccessState({ ...baseState, roomCount: 0 }).status, 'empty');
  assert.equal(getCommunityAccessState({ ...baseState, roomCount: 4 }).status, 'allowed');
});

test('Starträume: ohne bestätigte Regelversion bleibt der Raumeinstieg gesperrt', () => {
  const accessRequirements = getCommunityAccessRequirements({
    id: 'u1',
    emailVerified: true,
    ageVerified: true,
    ageVerificationStatus: 'verified',
    moderationState: 'clear',
  }, { uid: 'u1', emailVerified: true }, {
    rules: { version: '1.0', active: true, sections: [{ heading: 'A', paragraphs: ['B'] }] },
    acceptance: null,
  });

  assert.equal(accessRequirements.canReadOverview, true, 'Übersicht bleibt sichtbar');
  assert.equal(accessRequirements.canReadMessages, false, 'Raumeinstieg bleibt gesperrt');
});

test('Starträume: ein Klick öffnet den bestehenden CommunityRoomScreen mit der Raum-ID', () => {
  const source = fs.readFileSync('/workspaces/AffairGo/screens/CommunityScreen.js', 'utf8');

  assert.match(source, /const openRoom = \(roomId\) => \{/u);
  assert.match(source, /navigation\.navigate\('CommunityRoom', \{ roomId \}\)/u);
  assert.match(source, /onPress=\{\(\) => openRoom\(room\.id\)\}/u);
  // Raumkarte zeigt Name, Typ-Kennzeichnung, Beschreibung und Aktivitaets-/Ungelesen-Anzeige.
  assert.match(source, /<Text style=\{styles\.roomTitle\}>\{room\.name\}<\/Text>/u);
  assert.match(source, /getCommunityRoomTypeLabel\(room\.type\)/u);
  assert.match(source, /<Text style=\{styles\.roomDescription\}>\{room\.description\}<\/Text>/u);
  assert.match(source, /getCommunityRoomUnreadLabel\(room, readEntry\)/u);
});

test('Starträume: Melden und Blockieren stehen im Raum weiterhin zur Verfügung', () => {
  const source = fs.readFileSync('/workspaces/AffairGo/screens/CommunityRoomScreen.js', 'utf8');

  assert.match(source, /reportCommunityContent/u);
  assert.match(source, /blockCommunityUser/u);
  assert.match(source, /unblockCommunityUser/u);
});

test('Starträume: der Seed lässt sich ausschließlich von Admins auslösen', () => {
  const source = fs.readFileSync('/workspaces/AffairGo/screens/CommunityScreen.js', 'utf8');

  assert.match(source, /if \(!currentUser\?\.isAdmin \|\| isSeedingRoom\) \{\s*return;/u);
  assert.match(source, /action=\{currentUser\?\.isAdmin \? <AccentButton label=\{isSeedingRoom \? 'Räume werden ergänzt\.\.\.' : 'Standardräume anlegen'\}/u);
  // Kein direkter Firestore-Schreibzugriff auf communityRooms aus dem Client.
  assert.equal(/setDoc\(\s*doc\(db, 'communityRooms'/u.test(source), false);
});

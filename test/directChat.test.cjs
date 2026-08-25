const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  buildDirectChatContacts,
  findPreferredDirectChat,
  markDirectChatsAsRead,
  normalizeDirectChatTimeMillis,
} = require('../untils/directChat');

const createUser = (overrides = {}) => ({
  id: 'u1',
  nickname: 'Alice',
  profileImageUri: '',
  profilePhotoUrl: '',
  online: false,
  ...overrides,
});

const createChat = (overrides = {}) => ({
  id: 'chat-default',
  userId: 'u1',
  match: true,
  inactivityDays: 0,
  unreadCount: 0,
  messages: [],
  ...overrides,
});

const createMessage = (overrides = {}) => ({
  id: 'm1',
  from: 'u1',
  text: 'Hallo',
  time: '2026-08-25T10:00:00.000Z',
  ...overrides,
});

test('Timestamp-Helfer verarbeitet Date, Firestore-Timestamp, Millisekunden und ISO robust', () => {
  assert.equal(normalizeDirectChatTimeMillis(new Date('2026-08-25T10:00:00.000Z')), 1787652000000);
  assert.equal(normalizeDirectChatTimeMillis({ seconds: 1787652000, nanoseconds: 0 }), 1787652000000);
  assert.equal(normalizeDirectChatTimeMillis(1787652000000), 1787652000000);
  assert.equal(normalizeDirectChatTimeMillis('2026-08-25T10:00:00.000Z'), 1787652000000);
  assert.equal(normalizeDirectChatTimeMillis('19:07'), null);
});

test('Kontakte werden nach der neuesten Nachricht absteigend sortiert', () => {
  const contacts = buildDirectChatContacts([
    createChat({ id: 'c-old', userId: 'u1', messages: [createMessage({ time: '2026-08-20T10:00:00.000Z' })] }),
    createChat({ id: 'c-new', userId: 'u2', messages: [createMessage({ id: 'm2', time: '2026-08-25T10:00:00.000Z' })] }),
  ], [
    createUser({ id: 'u1', nickname: 'Alice' }),
    createUser({ id: 'u2', nickname: 'Bianca' }),
  ]);

  assert.deepEqual(contacts.map((entry) => entry.userId), ['u2', 'u1']);
});

test('Mehrere Chats mit derselben Person ergeben genau einen Listeneintrag', () => {
  const contacts = buildDirectChatContacts([
    createChat({ id: 'c-1', userId: 'u1', unreadCount: 1, messages: [createMessage({ time: '2026-08-20T10:00:00.000Z' })] }),
    createChat({ id: 'c-2', userId: 'u1', unreadCount: 2, messages: [createMessage({ id: 'm2', time: '2026-08-25T10:00:00.000Z' })] }),
  ], [createUser({ id: 'u1', nickname: 'Alice' })]);

  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].primaryChatId, 'c-2');
  assert.equal(contacts[0].unreadCount, 3);
  assert.equal(contacts[0].chatCount, 2);
});

test('Für eine Person wird der zuletzt aktive bestehende Chat ausgewählt', () => {
  const selectedChat = findPreferredDirectChat([
    createChat({ id: 'c-1', userId: 'u1', messages: [createMessage({ time: '2026-08-20T10:00:00.000Z' })] }),
    createChat({ id: 'c-2', userId: 'u1', messages: [createMessage({ id: 'm2', time: '2026-08-25T10:00:00.000Z' })] }),
  ], 'u1');

  assert.equal(selectedChat.id, 'c-2');
});

test('Chats ohne Nachrichten werden unterhalb aktiver Konversationen einsortiert', () => {
  const contacts = buildDirectChatContacts([
    createChat({ id: 'c-empty', userId: 'u1', inactivityDays: 0, messages: [] }),
    createChat({ id: 'c-active', userId: 'u2', messages: [createMessage({ id: 'm2', time: '2026-08-25T10:00:00.000Z' })] }),
  ], [
    createUser({ id: 'u1', nickname: 'Alice' }),
    createUser({ id: 'u2', nickname: 'Bianca' }),
  ]);

  assert.deepEqual(contacts.map((entry) => entry.userId), ['u2', 'u1']);
});

test('Nur der angemeldete Nutzerkontext sieht seine eigenen Chats pro Partner-ID gruppiert', () => {
  const contacts = buildDirectChatContacts([
    createChat({ id: 'c-a', userId: 'u1' }),
    createChat({ id: 'c-b', userId: 'u2' }),
  ], [
    createUser({ id: 'u1', nickname: 'Alice' }),
    createUser({ id: 'u2', nickname: 'Bianca' }),
    createUser({ id: 'u3', nickname: 'Clara' }),
  ]);

  assert.deepEqual(contacts.map((entry) => entry.userId), ['u1', 'u2']);
});

test('Öffnen eines Chats setzt den Ungelesen-Status für diese Person konsistent auf gelesen', () => {
  const result = markDirectChatsAsRead([
    createChat({ id: 'c-1', userId: 'u1', unreadCount: 2 }),
    createChat({ id: 'c-2', userId: 'u1', unreadCount: 1 }),
    createChat({ id: 'c-3', userId: 'u2', unreadCount: 4 }),
  ], { userId: 'u1' });

  assert.equal(result.changed, true);
  assert.deepEqual(result.chats.map((chat) => ({ id: chat.id, unreadCount: chat.unreadCount })), [
    { id: 'c-1', unreadCount: 0 },
    { id: 'c-2', unreadCount: 0 },
    { id: 'c-3', unreadCount: 4 },
  ]);
});

test('Die Chat-Übersicht rendert nur Kontakte und trennt den Detailzustand im Screen', () => {
  const source = fs.readFileSync('/workspaces/AffairGo/screens/ChatScreen.js', 'utf8');
  const openConversationBlock = source.match(/const openConversation = \(contact\) => \{[\s\S]*?\n  \};/u)?.[0] || '';

  assert.match(source, /Chats werden geladen/u);
  assert.match(source, /Du hast noch keine Chats\./u);
  assert.match(source, /Die Chats konnten nicht geladen werden\. Bitte versuche es erneut\./u);
  assert.match(source, /const isDetailOpen =/u);
  assert.match(source, /openConversation/u);
  assert.match(source, /closeConversation/u);
  assert.match(source, /isDetailOpen \? renderChatDetail\(\) : renderContactList\(\)/u);
  assert.match(source, /setSelectedContactUserId\(contact\.userId\)/u);
  assert.equal(openConversationBlock.includes('sendMessage'), false);
});

test('Direktaufruf aus dem Profil bleibt auf den bestehenden Chat-Screen per userId gerichtet', () => {
  const source = fs.readFileSync('/workspaces/AffairGo/screens/ProfilScreen.js', 'utf8');

  assert.match(source, /navigation\.navigate\('Chat', \{ userId: profile\.id \}\)/u);
});
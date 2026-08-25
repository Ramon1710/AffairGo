const normalizeDirectChatTimeMillis = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return null;
    }

    if (/^\d+$/.test(trimmedValue)) {
      const numericValue = Number(trimmedValue);
      return Number.isFinite(numericValue) ? numericValue : null;
    }

    const parsedValue = new Date(trimmedValue).getTime();
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  if (typeof value.seconds === 'number') {
    const millis = typeof value.nanoseconds === 'number'
      ? Math.round(value.seconds * 1000 + (value.nanoseconds / 1000000))
      : Math.round(value.seconds * 1000);

    return Number.isFinite(millis) ? millis : null;
  }

  return null;
};

const normalizeStoredDirectMessages = (messages = []) => {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((message) => typeof message?.text === 'string' && message.text.trim())
    .map((message, index) => ({
      id: String(message.id || `m_${index}`),
      from: typeof message.from === 'string' && message.from ? message.from : 'system',
      text: message.text.trim(),
      time: message.time ?? 'Jetzt',
    }));
};

const normalizeStoredDirectChats = (rawChats = []) => {
  if (!Array.isArray(rawChats)) {
    return [];
  }

  return rawChats
    .filter((chat) => typeof chat?.userId === 'string' && chat.userId)
    .map((chat, index) => ({
      id: typeof chat.id === 'string' && chat.id ? chat.id : `c_${chat.userId}_${index}`,
      userId: chat.userId,
      match: chat.match !== false,
      inactivityDays: Number.isFinite(Number(chat.inactivityDays)) ? Number(chat.inactivityDays) : 0,
      unreadCount: Number.isFinite(Number(chat.unreadCount)) ? Math.max(0, Number(chat.unreadCount)) : 0,
      messages: normalizeStoredDirectMessages(chat.messages),
    }));
};

const getLastDirectChatMessage = (chat = {}) => {
  const messages = Array.isArray(chat.messages) ? chat.messages : [];
  return messages.length ? messages[messages.length - 1] : null;
};

const getDirectChatActivity = (chat = {}, originalIndex = 0) => {
  const lastMessage = getLastDirectChatMessage(chat);
  const lastMessageAtMs = normalizeDirectChatTimeMillis(lastMessage?.time);

  return {
    chat,
    originalIndex,
    hasMessages: Boolean(lastMessage),
    lastMessage,
    lastMessageAtMs,
    fallbackInactivityDays: Number.isFinite(Number(chat.inactivityDays)) ? Number(chat.inactivityDays) : Number.MAX_SAFE_INTEGER,
  };
};

const compareDirectChatActivity = (left, right) => {
  if (left.hasMessages !== right.hasMessages) {
    return left.hasMessages ? -1 : 1;
  }

  if (left.hasMessages && right.hasMessages) {
    if (left.lastMessageAtMs !== null && right.lastMessageAtMs !== null && left.lastMessageAtMs !== right.lastMessageAtMs) {
      return right.lastMessageAtMs - left.lastMessageAtMs;
    }

    if (left.lastMessageAtMs !== null || right.lastMessageAtMs !== null) {
      return left.lastMessageAtMs !== null ? -1 : 1;
    }

    if (left.chat.messages.length !== right.chat.messages.length) {
      return right.chat.messages.length - left.chat.messages.length;
    }
  }

  if (left.fallbackInactivityDays !== right.fallbackInactivityDays) {
    return left.fallbackInactivityDays - right.fallbackInactivityDays;
  }

  return left.originalIndex - right.originalIndex;
};

const buildDirectChatContacts = (chatList = [], users = []) => {
  const normalizedChats = normalizeStoredDirectChats(chatList);
  const userMap = new Map((Array.isArray(users) ? users : []).map((user) => [user.id, user]));
  const contactMap = new Map();

  normalizedChats.forEach((chat, index) => {
    const activity = getDirectChatActivity(chat, index);
    const existingEntry = contactMap.get(chat.userId);

    if (!existingEntry) {
      contactMap.set(chat.userId, {
        userId: chat.userId,
        primaryActivity: activity,
        totalUnreadCount: chat.unreadCount,
        chatIds: [chat.id],
      });
      return;
    }

    const preferredActivity = compareDirectChatActivity(activity, existingEntry.primaryActivity) < 0
      ? activity
      : existingEntry.primaryActivity;

    contactMap.set(chat.userId, {
      userId: chat.userId,
      primaryActivity: preferredActivity,
      totalUnreadCount: existingEntry.totalUnreadCount + chat.unreadCount,
      chatIds: [...existingEntry.chatIds, chat.id],
    });
  });

  return Array.from(contactMap.values())
    .map((entry) => {
      const user = userMap.get(entry.userId) || null;
      const primaryChat = entry.primaryActivity.chat;
      const lastMessage = entry.primaryActivity.lastMessage;

      return {
        userId: entry.userId,
        nickname: user?.nickname || 'Match',
        profileImageUri: user?.profilePhotoUrl || user?.profileImageUri || '',
        online: user?.online === true,
        unreadCount: entry.totalUnreadCount,
        chatCount: entry.chatIds.length,
        chatIds: entry.chatIds,
        primaryChat,
        primaryChatId: primaryChat.id,
        hasMessages: entry.primaryActivity.hasMessages,
        lastMessageText: lastMessage?.text || '',
        lastMessageTime: lastMessage?.time || '',
        lastMessageAtMs: entry.primaryActivity.lastMessageAtMs,
        inactivityDays: entry.primaryActivity.fallbackInactivityDays,
      };
    })
    .sort((left, right) => compareDirectChatActivity(
      getDirectChatActivity(left.primaryChat, 0),
      getDirectChatActivity(right.primaryChat, 0),
    ));
};

const findDirectChatContact = (chatList = [], users = [], userId = '') => buildDirectChatContacts(chatList, users)
  .find((entry) => entry.userId === userId) || null;

const findPreferredDirectChat = (chatList = [], userId = '') => {
  const normalizedChats = normalizeStoredDirectChats(chatList)
    .filter((chat) => chat.userId === userId)
    .map((chat, index) => getDirectChatActivity(chat, index))
    .sort(compareDirectChatActivity);

  return normalizedChats[0]?.chat || null;
};

const markDirectChatsAsRead = (chatList = [], { chatId = '', userId = '' } = {}) => {
  let hasChanges = false;

  const nextChats = normalizeStoredDirectChats(chatList).map((chat) => {
    const matchesChat = Boolean(chatId) && chat.id === chatId;
    const matchesUser = Boolean(userId) && chat.userId === userId;

    if ((!matchesChat && !matchesUser) || chat.unreadCount < 1) {
      return chat;
    }

    hasChanges = true;
    return {
      ...chat,
      unreadCount: 0,
    };
  });

  return {
    chats: nextChats,
    changed: hasChanges,
  };
};

module.exports = {
  buildDirectChatContacts,
  compareDirectChatActivity,
  findDirectChatContact,
  findPreferredDirectChat,
  getDirectChatActivity,
  getLastDirectChatMessage,
  markDirectChatsAsRead,
  normalizeDirectChatTimeMillis,
  normalizeStoredDirectChats,
  normalizeStoredDirectMessages,
};
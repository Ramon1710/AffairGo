import { allowScreenCaptureAsync, preventScreenCaptureAsync } from 'expo-screen-capture';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, EmptyState, FormField, GlassCard, InfoBanner, ScreenHeader, ToggleChip } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { EMPTY_STATE_COPY, GAME_OPTIONS, ICEBREAKER_SUGGESTIONS } from '../data/mockData';
import { useNavigation, useRoute } from '../naviagtion/SimpleNavigation';

const ChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { chats, users, sendMessage, softBlock, playGame, currentUser } = useAffairGo();
  const [selectedChatId, setSelectedChatId] = useState(chats[0]?.id || null);
  const [draft, setDraft] = useState('');
  const routeUserId = route.params?.userId || null;
  const selectedChat = useMemo(() => {
    if (selectedChatId) {
      return chats.find((chat) => chat.id === selectedChatId) || null;
    }

    if (routeUserId) {
      return chats.find((chat) => chat.userId === routeUserId) || null;
    }

    return chats[0] || null;
  }, [chats, routeUserId, selectedChatId]);
  const selectedUser = users.find((user) => user.id === (selectedChat?.userId || routeUserId));
  const availableGames = currentUser.membership === 'gold' ? GAME_OPTIONS : currentUser.membership === 'premium' ? GAME_OPTIONS.slice(0, 2) : [];
  const availableIcebreakers = currentUser.membership === 'basic' ? [] : ICEBREAKER_SUGGESTIONS.slice(0, currentUser.membership === 'gold' ? 4 : 2);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return undefined;
    }

    preventScreenCaptureAsync().catch(() => undefined);

    return () => {
      allowScreenCaptureAsync().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (!routeUserId) {
      return;
    }

    const existingChat = chats.find((chat) => chat.userId === routeUserId);
    if (existingChat) {
      setSelectedChatId(existingChat.id);
    }
  }, [chats, routeUserId]);

  const submitMessage = async () => {
    const targetUserId = selectedChat?.userId || routeUserId;

    if (!targetUserId) {
      return;
    }

    try {
      await sendMessage(targetUserId, draft);
      setDraft('');
    } catch (error) {
      Alert.alert('Nachricht blockiert', error.message || 'Die Nachricht konnte nicht gesendet werden.');
    }
  };

  const handleSoftBlock = async () => {
    if (!selectedUser?.id) {
      return;
    }

    try {
      await softBlock(selectedUser.id);
      Alert.alert('Profil blockiert', 'Das Profil wurde aus deinen Chats entfernt und fuer dich ausgeblendet.');
    } catch (error) {
      Alert.alert('Blockieren nicht moeglich', error.message || 'Das Profil konnte aktuell nicht blockiert werden.');
    }
  };

  return (
    <AppBackground>
      <ScreenHeader
        title="Chats"
        subtitle={currentUser.membership === 'gold' ? 'Gold kann auch vor dem Match schreiben' : 'Nur nach Match'}
        leftAction={<Pressable onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={28} color={affairGoTheme.colors.text} /></Pressable>}
      />

      <InfoBanner
        title="Screenshot-Schutz"
        detail={
          {Platform.OS === 'web'
            ? 'Im Web wird der Schutz als Hinweis modelliert. In nativen Builds wird dieser Bereich für Screenshot-Sperren vorbereitet.'
            : 'Dieser Bereich ist für nativen Screenshot-Schutz vorbereitet, damit Chat-Inhalte nicht unbemerkt gespeichert werden.'}
        }
        tone="warning"
        style={styles.securityCard}
      />

      <View style={styles.layout}>
        <GlassCard style={styles.sidebar}>
          {chats.length ? chats.map((chat) => {
            const partner = users.find((user) => user.id === chat.userId);
            return (
              <Pressable key={chat.id} onPress={() => setSelectedChatId(chat.id)} style={[styles.chatItem, selectedChat?.id === chat.id && styles.chatItemActive]}>
                <Text style={styles.chatName}>{partner?.nickname || 'Match'}</Text>
                <Text style={styles.chatMeta}>{chat.inactivityDays > 7 ? 'Ghost-Warnung' : chat.match ? 'Match aktiv' : 'Vor Match'}</Text>
              </Pressable>
            );
          }) : <EmptyState title={EMPTY_STATE_COPY.chats.title} detail={EMPTY_STATE_COPY.chats.detail} />}
        </GlassCard>

        <GlassCard strong style={styles.mainPanel}>
          {selectedChat && selectedUser ? (
            <>
              <View style={styles.headerRow}>
                <View>
                  <Text style={styles.partnerName}>{selectedUser.nickname}</Text>
                  <Text style={styles.partnerMeta}>{selectedUser.age} Jahre, {selectedUser.distanceKm} km entfernt</Text>
                </View>
                <ToggleChip label="Soft-Block" active={false} onPress={handleSoftBlock} />
              </View>

              <View style={styles.messageList}>
                {selectedChat.messages.map((message) => (
                  <View key={message.id} style={[styles.messageBubble, message.from === 'me' ? styles.messageMine : styles.messageTheirs]}>
                    <Text style={styles.messageText}>{message.text}</Text>
                    <Text style={styles.messageTime}>{message.time}</Text>
                  </View>
                ))}
              </View>

              <FormField label="Nachricht" value={draft} onChangeText={setDraft} placeholder="Schreibe eine Nachricht" />
              <AccentButton label="Senden" onPress={submitMessage} style={styles.sendButton} />

              <Text style={styles.sectionLabel}>Icebreaker</Text>
              {availableIcebreakers.length ? availableIcebreakers.map((suggestion) => (
                <Pressable key={suggestion} onPress={() => setDraft(suggestion)} style={styles.suggestion}><Text style={styles.suggestionText}>{suggestion}</Text></Pressable>
              )) : <Text style={styles.partnerMeta}>Icebreaker sind ab Premium verfügbar.</Text>}

              <Text style={styles.sectionLabel}>Spiele und Rewards</Text>
              {availableGames.length ? (
                <View style={styles.gamesWrap}>
                  {availableGames.map((game) => (
                    <View key={game.id} style={styles.gameItem}><AccentButton label={`${game.title} +${game.reward}`} variant="secondary" onPress={() => playGame(game.reward)} /></View>
                  ))}
                </View>
              ) : <Text style={styles.partnerMeta}>Spiele sind ab Premium verfügbar.</Text>}
            </>
          ) : <EmptyState title={EMPTY_STATE_COPY.chats.title} detail={EMPTY_STATE_COPY.chats.detail} action={<AccentButton label="Zum Swipe" variant="secondary" onPress={() => navigation.navigate('Swipe')} />} />}
        </GlassCard>
      </View>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  securityCard: {
    marginBottom: 12,
  },
  layout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  sidebar: {
    width: '30%',
    marginRight: 12,
  },
  mainPanel: {
    width: '68%',
  },
  chatItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: affairGoTheme.colors.line,
  },
  chatItemActive: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  chatName: {
    color: affairGoTheme.colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  chatMeta: {
    color: affairGoTheme.colors.textMuted,
    marginTop: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  partnerName: {
    color: affairGoTheme.colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  partnerMeta: {
    color: affairGoTheme.colors.textMuted,
  },
  messageList: {
    marginBottom: 12,
  },
  messageBubble: {
    borderRadius: 18,
    padding: 12,
    marginBottom: 8,
    maxWidth: '84%',
  },
  messageMine: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255,67,67,0.25)',
  },
  messageTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  messageText: {
    color: affairGoTheme.colors.text,
    lineHeight: 20,
  },
  messageTime: {
    color: affairGoTheme.colors.textMuted,
    marginTop: 6,
    fontSize: 12,
  },
  sendButton: {
    marginBottom: 14,
  },
  sectionLabel: {
    color: affairGoTheme.colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  suggestion: {
    borderWidth: 1,
    borderColor: affairGoTheme.colors.line,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  suggestionText: {
    color: affairGoTheme.colors.text,
    lineHeight: 20,
  },
  gamesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gameItem: {
    width: '48%',
    marginRight: '2%',
    marginBottom: 10,
  },
});

export default ChatScreen;

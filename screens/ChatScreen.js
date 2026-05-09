import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, EmptyState, FormField, GlassCard, InfoBanner, ScreenHeader, ToggleChip } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { EMPTY_STATE_COPY, GAME_LIBRARY, GAME_OPTIONS, ICEBREAKER_SUGGESTIONS } from '../data/mockData';
import { useNavigation, useRoute } from '../naviagtion/SimpleNavigation';
import { allowScreenCaptureAsync, preventScreenCaptureAsync } from '../untils/screenCapture';

const createEmptyConnect4Board = () => Array.from({ length: GAME_LIBRARY.connect4.rows }, () => Array.from({ length: GAME_LIBRARY.connect4.columns }, () => ''));

const getRandomItem = (values = []) => values[Math.floor(Math.random() * values.length)] || '';

const hasConnect4Line = (board, token) => {
  const rowCount = board.length;
  const columnCount = board[0]?.length || 0;
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      if (board[rowIndex][columnIndex] !== token) {
        continue;
      }

      for (const [rowStep, columnStep] of directions) {
        let matches = 1;

        while (matches < 4) {
          const nextRow = rowIndex + (rowStep * matches);
          const nextColumn = columnIndex + (columnStep * matches);

          if (nextRow < 0 || nextRow >= rowCount || nextColumn < 0 || nextColumn >= columnCount) {
            break;
          }

          if (board[nextRow][nextColumn] !== token) {
            break;
          }

          matches += 1;
        }

        if (matches >= 4) {
          return true;
        }
      }
    }
  }

  return false;
};

const dropConnect4Token = (board, columnIndex, token) => {
  const nextBoard = board.map((row) => [...row]);

  for (let rowIndex = nextBoard.length - 1; rowIndex >= 0; rowIndex -= 1) {
    if (!nextBoard[rowIndex][columnIndex]) {
      nextBoard[rowIndex][columnIndex] = token;
      return nextBoard;
    }
  }

  return null;
};

const ChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { chats, users, sendMessage, softBlock, playGame, currentUser } = useAffairGo();
  const [selectedChatId, setSelectedChatId] = useState(chats[0]?.id || null);
  const [draft, setDraft] = useState('');
  const [activeGame, setActiveGame] = useState(null);
  const [connect4Board, setConnect4Board] = useState(createEmptyConnect4Board());
  const [rpsOpponentChoice, setRpsOpponentChoice] = useState('');
  const [quizQuestionIndex, setQuizQuestionIndex] = useState(0);
  const [quizCorrectAnswers, setQuizCorrectAnswers] = useState(0);
  const [emojiGuess, setEmojiGuess] = useState('');
  const [emojiPuzzleIndex, setEmojiPuzzleIndex] = useState(0);
  const [truthPrompt, setTruthPrompt] = useState('');
  const [gameResult, setGameResult] = useState('');
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
  const availableGames = GAME_OPTIONS;
  const availableIcebreakers = ICEBREAKER_SUGGESTIONS;

  useEffect(() => {
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
      Alert.alert('Profil blockiert', 'Das Profil wurde aus deinen Chats entfernt und für dich ausgeblendet.');
    } catch (error) {
      Alert.alert('Blockieren nicht möglich', error.message || 'Das Profil konnte aktuell nicht blockiert werden.');
    }
  };

  const resetGameState = () => {
    setActiveGame(null);
    setConnect4Board(createEmptyConnect4Board());
    setRpsOpponentChoice('');
    setQuizQuestionIndex(0);
    setQuizCorrectAnswers(0);
    setEmojiGuess('');
    setEmojiPuzzleIndex(0);
    setTruthPrompt('');
    setGameResult('');
  };

  const finishGame = async (game, outcome, reward = game.reward) => {
    const targetUserId = selectedChat?.userId || routeUserId;
    const pointsWon = Number.isFinite(Number(reward)) ? Number(reward) : 0;
    const resultText = `${game.title}: ${outcome}${pointsWon ? ` (+${pointsWon} Punkte)` : ''}`;

    try {
      await playGame({ reward: pointsWon, gameId: game.id, gameTitle: game.title, outcome });
      if (targetUserId) {
        await sendMessage(targetUserId, resultText);
      }
      setGameResult(resultText);
    } catch (error) {
      Alert.alert('Spiel konnte nicht abgeschlossen werden', error.message || 'Bitte versuche es erneut.');
      return;
    }

    resetGameState();
    Alert.alert('Spiel abgeschlossen', resultText);
  };

  const openGame = (game) => {
    setActiveGame(game);
    setGameResult('');

    if (game.id === 'truth') {
      setTruthPrompt(getRandomItem(GAME_LIBRARY.truth.prompts));
    }
  };

  const handleConnect4Move = async (columnIndex) => {
    if (!activeGame || activeGame.id !== 'connect4') {
      return;
    }

    const playerBoard = dropConnect4Token(connect4Board, columnIndex, 'me');
    if (!playerBoard) {
      return;
    }

    if (hasConnect4Line(playerBoard, 'me')) {
      setConnect4Board(playerBoard);
      await finishGame(activeGame, 'Du hast Vier Gewinnt gewonnen.');
      return;
    }

    const availableColumns = playerBoard[0].map((cell, index) => (!cell ? index : null)).filter((value) => value !== null);
    if (!availableColumns.length) {
      setConnect4Board(playerBoard);
      await finishGame(activeGame, 'Unentschieden nach vollem Brett.', Math.round(activeGame.reward / 2));
      return;
    }

    const opponentColumn = getRandomItem(availableColumns);
    const opponentBoard = dropConnect4Token(playerBoard, opponentColumn, 'opponent') || playerBoard;
    setConnect4Board(opponentBoard);

    if (hasConnect4Line(opponentBoard, 'opponent')) {
      await finishGame(activeGame, 'Dein Match hat diese Runde gewonnen.', Math.round(activeGame.reward / 4));
    }
  };

  const handleRpsChoice = async (choice) => {
    if (!activeGame || activeGame.id !== 'rps') {
      return;
    }

    const opponentChoice = getRandomItem(GAME_LIBRARY.rps.choices);
    setRpsOpponentChoice(opponentChoice);
    const winsAgainst = {
      Schere: 'Papier',
      Stein: 'Schere',
      Papier: 'Stein',
    };

    if (choice === opponentChoice) {
      await finishGame(activeGame, `Unentschieden. Dein Match wählte ebenfalls ${opponentChoice}.`, Math.round(activeGame.reward / 2));
      return;
    }

    const won = winsAgainst[choice] === opponentChoice;
    await finishGame(activeGame, won ? `Du gewinnst mit ${choice} gegen ${opponentChoice}.` : `Du verlierst mit ${choice} gegen ${opponentChoice}.`, won ? activeGame.reward : Math.round(activeGame.reward / 4));
  };

  const handleQuizAnswer = async (answerIndex) => {
    if (!activeGame || activeGame.id !== 'quiz') {
      return;
    }

    const question = GAME_LIBRARY.quiz.questions[quizQuestionIndex];
    const nextCorrectAnswers = quizCorrectAnswers + (question.correctIndex === answerIndex ? 1 : 0);
    const isLastQuestion = quizQuestionIndex >= GAME_LIBRARY.quiz.questions.length - 1;

    if (isLastQuestion) {
      const reward = Math.round((nextCorrectAnswers / GAME_LIBRARY.quiz.questions.length) * activeGame.reward);
      await finishGame(activeGame, `${nextCorrectAnswers} von ${GAME_LIBRARY.quiz.questions.length} Antworten waren richtig.`, reward);
      return;
    }

    setQuizCorrectAnswers(nextCorrectAnswers);
    setQuizQuestionIndex((previous) => previous + 1);
  };

  const handleEmojiGuess = async () => {
    if (!activeGame || activeGame.id !== 'emoji') {
      return;
    }

    const puzzle = GAME_LIBRARY.emoji.puzzles[emojiPuzzleIndex];
    const normalizedGuess = emojiGuess.trim().toLowerCase();
    const normalizedSolution = puzzle.solution.toLowerCase();
    const solved = normalizedGuess && (normalizedSolution.includes(normalizedGuess) || normalizedGuess.includes(normalizedSolution));
    const isLastPuzzle = emojiPuzzleIndex >= GAME_LIBRARY.emoji.puzzles.length - 1;

    if (solved || isLastPuzzle) {
      await finishGame(activeGame, solved ? `Emoji-Rätsel gelöst: ${puzzle.solution}.` : `Rätsel beendet. Lösung: ${puzzle.solution}.`, solved ? activeGame.reward : Math.round(activeGame.reward / 3));
      return;
    }

    setEmojiGuess('');
    setEmojiPuzzleIndex((previous) => previous + 1);
  };

  const handleTruthComplete = async () => {
    if (!activeGame || activeGame.id !== 'truth') {
      return;
    }

    await finishGame(activeGame, `Wahrheit oder Pflicht erledigt: ${truthPrompt}`, activeGame.reward);
  };

  return (
    <AppBackground>
      <ScreenHeader
        title="Chats"
        subtitle="Direktnachrichten, Spiele und Icebreaker"
        leftAction={<Pressable onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={28} color={affairGoTheme.colors.text} /></Pressable>}
      />

      <InfoBanner
        title="Screenshot-Schutz"
        detail={
          Platform.OS === 'web'
            ? 'Private Unterhaltungen werden zusätzlich geschützt, damit Inhalte nicht unbemerkt gesichert werden.'
            : 'Dieser Bereich ist für nativen Screenshot-Schutz vorbereitet, damit Chat-Inhalte nicht unbemerkt gespeichert werden.'
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
              )) : <Text style={styles.partnerMeta}>Aktuell sind alle Icebreaker freigeschaltet.</Text>}

              <Text style={styles.sectionLabel}>Spiele und Rewards</Text>
              {availableGames.length ? (
                <View style={styles.gamesWrap}>
                  {availableGames.map((game) => (
                    <View key={game.id} style={styles.gameItem}><AccentButton label={`${game.title} +${game.reward}`} variant="secondary" onPress={() => openGame(game)} /></View>
                  ))}
                </View>
              ) : <Text style={styles.partnerMeta}>Aktuell sind alle Spiele freigeschaltet.</Text>}
              {gameResult ? <Text style={styles.gameResult}>{gameResult}</Text> : null}
            </>
          ) : <EmptyState title={EMPTY_STATE_COPY.chats.title} detail={EMPTY_STATE_COPY.chats.detail} action={<AccentButton label="Zum Swipe" variant="secondary" onPress={() => navigation.navigate('Swipe')} />} />}
        </GlassCard>
      </View>

      <Modal transparent visible={Boolean(activeGame)} animationType="fade" onRequestClose={resetGameState}>
        <View style={styles.modalBackdrop}>
          <GlassCard strong style={styles.modalCard}>
            {activeGame ? (
              <>
                <Text style={styles.modalTitle}>{activeGame.title}</Text>
                {activeGame.id === 'connect4' ? (
                  <>
                    <Text style={styles.modalText}>Tippe auf eine Spalte. Du spielst gegen die Zufallsantwort deines Matches.</Text>
                    <View style={styles.connect4Grid}>
                      {connect4Board.map((row, rowIndex) => (
                        <View key={`row-${rowIndex}`} style={styles.connect4Row}>
                          {row.map((cell, columnIndex) => (
                            <Pressable key={`cell-${rowIndex}-${columnIndex}`} style={styles.connect4Cell} onPress={() => handleConnect4Move(columnIndex)}>
                              <View style={[styles.connect4Token, cell === 'me' && styles.connect4TokenMe, cell === 'opponent' && styles.connect4TokenOpponent]} />
                            </Pressable>
                          ))}
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}
                {activeGame.id === 'rps' ? (
                  <>
                    <Text style={styles.modalText}>Wähle Schere, Stein oder Papier.</Text>
                    <View style={styles.choiceWrap}>
                      {GAME_LIBRARY.rps.choices.map((choice) => (
                        <View key={choice} style={styles.choiceItem}>
                          <ToggleChip label={choice} active={false} onPress={() => handleRpsChoice(choice)} />
                        </View>
                      ))}
                    </View>
                    {rpsOpponentChoice ? <Text style={styles.modalMeta}>Gegenseite wählte: {rpsOpponentChoice}</Text> : null}
                  </>
                ) : null}
                {activeGame.id === 'quiz' ? (
                  <>
                    <Text style={styles.modalText}>{GAME_LIBRARY.quiz.questions[quizQuestionIndex].prompt}</Text>
                    {GAME_LIBRARY.quiz.questions[quizQuestionIndex].options.map((option, optionIndex) => (
                      <Pressable key={option} style={styles.quizOption} onPress={() => handleQuizAnswer(optionIndex)}>
                        <Text style={styles.quizOptionText}>{option}</Text>
                      </Pressable>
                    ))}
                    <Text style={styles.modalMeta}>Richtig bisher: {quizCorrectAnswers}</Text>
                  </>
                ) : null}
                {activeGame.id === 'emoji' ? (
                  <>
                    <Text style={styles.emojiPrompt}>{GAME_LIBRARY.emoji.puzzles[emojiPuzzleIndex].prompt}</Text>
                    <FormField label="Deine Lösung" value={emojiGuess} onChangeText={setEmojiGuess} placeholder="z. B. Date Night" />
                    <AccentButton label="Antwort prüfen" onPress={handleEmojiGuess} style={styles.modalButton} />
                  </>
                ) : null}
                {activeGame.id === 'truth' ? (
                  <>
                    <Text style={styles.modalText}>{truthPrompt}</Text>
                    <AccentButton label="Erledigt markieren" onPress={handleTruthComplete} style={styles.modalButton} />
                  </>
                ) : null}
                <AccentButton label="Schließen" variant="ghost" onPress={resetGameState} />
              </>
            ) : null}
          </GlassCard>
        </View>
      </Modal>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  securityCard: {
    marginBottom: 12,
  },
  layout: {
    flexDirection: 'column',
  },
  sidebar: {
    width: '100%',
    marginBottom: 12,
  },
  mainPanel: {
    width: '100%',
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
  gameResult: {
    color: affairGoTheme.colors.success,
    marginTop: 10,
    lineHeight: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    maxWidth: 620,
    width: '100%',
    alignSelf: 'center',
  },
  modalTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 10,
  },
  modalText: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 22,
    marginBottom: 14,
  },
  modalMeta: {
    color: affairGoTheme.colors.textMuted,
    marginTop: 12,
  },
  modalButton: {
    marginBottom: 12,
  },
  connect4Grid: {
    marginBottom: 16,
  },
  connect4Row: {
    flexDirection: 'row',
  },
  connect4Cell: {
    width: 58,
    height: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: affairGoTheme.colors.line,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  connect4Token: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  connect4TokenMe: {
    backgroundColor: affairGoTheme.colors.accent,
  },
  connect4TokenOpponent: {
    backgroundColor: affairGoTheme.colors.blue,
  },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  choiceItem: {
    marginRight: 8,
    marginBottom: 8,
  },
  quizOption: {
    borderWidth: 1,
    borderColor: affairGoTheme.colors.line,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  quizOptionText: {
    color: affairGoTheme.colors.text,
    lineHeight: 20,
  },
  emojiPrompt: {
    color: affairGoTheme.colors.text,
    fontSize: 34,
    textAlign: 'center',
    marginBottom: 14,
  },
});

export default ChatScreen;
